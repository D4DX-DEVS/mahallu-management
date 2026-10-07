import mongoose from 'mongoose';
import { matches } from './fakeMongo';

/**
 * A small in-memory interpreter for the aggregation stages the REPORT and SUMMARY endpoints use, so a test can
 * run the real pipeline a controller builds against plain arrays of documents (no database):
 *
 *   $match (plain filters; ids and dates compare by value), $lookup (localField / foreignField), $unwind
 *   (path, preserveNullAndEmptyArrays), $group (_id null, a field path, or an object of expressions;
 *   $sum / $push), $project, $sort, $skip, $limit
 *   expressions: field paths, $cond, $eq, $ifNull, $subtract, $multiply and literals
 *
 * Anything else throws, so a pipeline change this does not understand fails loudly instead of passing.
 * (support/pipelineFake.ts is the interpreter for the wallet list's let/pipeline $lookup and $facet.)
 */

type Doc = Record<string, any>;

const isOid = (v: any) => v instanceof mongoose.Types.ObjectId;
const idText = (v: any): any => (v === undefined || v === null ? null : isOid(v) ? `oid:${String(v)}` : v instanceof Date ? v.getTime() : v);

const getPath = (doc: any, path: string): any => {
  let cur = doc;
  for (const part of path.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
};

const evalExpr = (expr: any, doc: Doc): any => {
  if (typeof expr === 'string') return expr.startsWith('$') ? getPath(doc, expr.slice(1)) : expr;
  if (expr && typeof expr === 'object' && !Array.isArray(expr) && !isOid(expr) && !(expr instanceof Date)) {
    const [op] = Object.keys(expr);
    if (!op.startsWith('$')) {
      // an object of expressions (a compound _id or a $push document)
      return Object.fromEntries(Object.entries(expr).map(([k, v]) => [k, evalExpr(v, doc)]));
    }
    const arg = expr[op];
    const ev = (e: any) => evalExpr(e, doc);
    switch (op) {
      case '$cond': return ev(arg[0]) ? ev(arg[1]) : ev(arg[2]);
      case '$eq': return idText(ev(arg[0])) === idText(ev(arg[1]));
      case '$ifNull': { const v = ev(arg[0]); return v === undefined || v === null ? ev(arg[1]) : v; }
      case '$subtract': return Number(ev(arg[0])) - Number(ev(arg[1]));
      case '$multiply': return (arg as any[]).reduce((p, e) => p * Number(ev(e)), 1);
      default: throw new Error(`aggregateFake: unsupported expression ${op}`);
    }
  }
  return expr;
};

const compare = (a: any, b: any) => {
  const x = idText(a);
  const y = idText(b);
  if (x === y) return 0;
  if (x === null) return -1;
  if (y === null) return 1;
  return x < y ? -1 : 1;
};

const keyOf = (value: any): string => JSON.stringify(value, (_k, v) => (isOid(v) ? `oid:${String(v)}` : v === undefined ? null : v));

export type Collections = Record<string, Doc[]>;

/** Run `pipeline` over `source`; `collections` (by collection name) are what a $lookup may read. */
export const runAggregate = (source: Doc[], pipeline: Doc[], collections: Collections = {}): Doc[] => {
  let rows: Doc[] = source.map((d) => ({ ...d }));
  for (const stage of pipeline) {
    const [name] = Object.keys(stage);
    const spec = stage[name];
    switch (name) {
      case '$match':
        rows = rows.filter((d) => matches(d, spec));
        break;
      case '$lookup': {
        const { from, localField, foreignField, as } = spec;
        if (!localField || !foreignField) throw new Error('aggregateFake: only localField/foreignField $lookup is supported');
        const foreign = collections[from] || [];
        rows = rows.map((d) => {
          const local = getPath(d, localField);
          const found = local === undefined || local === null ? [] : foreign.filter((f) => idText(getPath(f, foreignField)) === idText(local));
          return { ...d, [as]: found.map((f) => ({ ...f })) };
        });
        break;
      }
      case '$unwind': {
        const path = String(typeof spec === 'string' ? spec : spec.path).slice(1);
        const preserve = typeof spec === 'object' && spec.preserveNullAndEmptyArrays;
        const out: Doc[] = [];
        for (const d of rows) {
          const arr = d[path];
          if (Array.isArray(arr) && arr.length) arr.forEach((item) => out.push({ ...d, [path]: item }));
          else if (preserve) {
            const copy = { ...d };
            delete copy[path];
            out.push(copy);
          }
        }
        rows = out;
        break;
      }
      case '$group': {
        const { _id: idSpec, ...accs } = spec;
        const groups = new Map<string, { id: any; rows: Doc[] }>();
        for (const row of rows) {
          const id = idSpec === null ? null : evalExpr(idSpec, row);
          const key = keyOf(id);
          if (!groups.has(key)) groups.set(key, { id, rows: [] });
          groups.get(key)!.rows.push(row);
        }
        rows = [...groups.values()].map((g) => {
          const out: Doc = { _id: g.id };
          for (const [field, acc] of Object.entries(accs as Doc)) {
            const [op, arg] = Object.entries(acc as Doc)[0];
            if (op === '$sum') out[field] = g.rows.reduce((s, r) => { const v = evalExpr(arg, r); return s + (typeof v === 'number' ? v : 0); }, 0);
            else if (op === '$push') out[field] = g.rows.map((r) => evalExpr(arg, r));
            else throw new Error(`aggregateFake: unsupported accumulator ${op}`);
          }
          return out;
        });
        break;
      }
      case '$project':
        rows = rows.map((d) => {
          const out: Doc = {};
          if (spec._id !== 0 && d._id !== undefined) out._id = d._id;
          for (const [k, v] of Object.entries(spec)) {
            if (k === '_id') { if (v !== 0 && v !== 1) out._id = evalExpr(v, d); continue; }
            if (v === 1) { if (d[k] !== undefined) out[k] = d[k]; }
            else { const val = evalExpr(v, d); if (val !== undefined) out[k] = val; }
          }
          return out;
        });
        break;
      case '$sort': {
        const entries = Object.entries(spec) as [string, number][];
        rows = [...rows].sort((a, b) => {
          for (const [field, dir] of entries) {
            const c = compare(getPath(a, field), getPath(b, field));
            if (c !== 0) return c * dir;
          }
          return 0;
        });
        break;
      }
      case '$skip': rows = rows.slice(spec); break;
      case '$limit': rows = rows.slice(0, spec); break;
      default:
        throw new Error(`aggregateFake: unsupported stage ${name}`);
    }
  }
  return rows;
};
