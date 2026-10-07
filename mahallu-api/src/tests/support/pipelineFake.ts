import mongoose from 'mongoose';
import { matches } from './fakeMongo';

/**
 * A small in-memory interpreter for the aggregation stages the wallet list uses, so a test can run the
 * REAL pipeline built by the service (no database) against plain arrays of documents:
 *
 *   $match (plain filters and $expr), $lookup ({ let, pipeline } form), $unwind (preserveNullAndEmptyArrays),
 *   $project, $sort, $skip, $limit, $group ($sum), $facet
 *   expressions: field paths, $$variables, $and $eq $gt $ifNull $cond $type, and literals (ObjectId, null, ...)
 *
 * Anything else throws, so a pipeline change that this does not understand fails loudly instead of
 * silently passing.
 */

type Doc = Record<string, any>;
export type Collections = Record<string, Doc[]>;

const isOid = (v: any) => v instanceof mongoose.Types.ObjectId;
const norm = (v: any): any => (v === undefined || v === null ? null : isOid(v) ? `oid:${String(v)}` : v instanceof Date ? v.getTime() : v);

const getPath = (doc: any, path: string): any => {
  let cur = doc;
  for (const part of path.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
};

const typeName = (v: any): string => {
  if (v === undefined) return 'missing';
  if (v === null) return 'null';
  if (isOid(v)) return 'objectId';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'double';
  if (v instanceof Date) return 'date';
  return typeof v;
};

const evalExpr = (expr: any, doc: Doc, vars: Doc): any => {
  if (typeof expr === 'string') {
    if (expr.startsWith('$$')) return getPath(vars, expr.slice(2));
    if (expr.startsWith('$')) return getPath(doc, expr.slice(1));
    return expr;
  }
  if (expr && typeof expr === 'object' && !Array.isArray(expr) && !isOid(expr) && !(expr instanceof Date)) {
    const [op] = Object.keys(expr);
    const arg = expr[op];
    const ev = (e: any) => evalExpr(e, doc, vars);
    switch (op) {
      case '$and': return (arg as any[]).every((e) => !!ev(e));
      case '$eq': return norm(ev(arg[0])) === norm(ev(arg[1]));
      case '$gt': return ev(arg[0]) !== null && ev(arg[0]) !== undefined && Number(ev(arg[0])) > Number(ev(arg[1]));
      case '$ifNull': { const v = ev(arg[0]); return v === undefined || v === null ? ev(arg[1]) : v; }
      case '$cond': return ev(arg[0]) ? ev(arg[1]) : ev(arg[2]);
      case '$type': return typeName(ev(arg));
      default: throw new Error(`pipelineFake: unsupported expression ${op}`);
    }
  }
  return expr;
};

const compare = (a: any, b: any) => {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return 0;
  if (x === null) return -1;
  if (y === null) return 1;
  return x < y ? -1 : 1;
};

const runStages = (input: Doc[], stages: Doc[], collections: Collections, vars: Doc): Doc[] => {
  let rows = input;
  for (const stage of stages) {
    const [name] = Object.keys(stage);
    const spec = stage[name];
    switch (name) {
      case '$match': {
        const { $expr, ...plain } = spec;
        rows = rows.filter((d) => matches(d, plain) && (!$expr || !!evalExpr($expr, d, vars)));
        break;
      }
      case '$lookup': {
        const { from, pipeline, as, let: letVars = {} } = spec;
        if (!pipeline) throw new Error('pipelineFake: only the let/pipeline form of $lookup is supported');
        const foreign = collections[from] || [];
        rows = rows.map((d) => {
          const local: Doc = { ...vars };
          for (const [k, e] of Object.entries(letVars)) local[k] = evalExpr(e, d, vars);
          return { ...d, [as]: runStages(foreign.map((f) => ({ ...f })), pipeline, collections, local) };
        });
        break;
      }
      case '$unwind': {
        const path = String(spec.path).slice(1);
        const out: Doc[] = [];
        for (const d of rows) {
          const arr = d[path];
          if (Array.isArray(arr) && arr.length) arr.forEach((item) => out.push({ ...d, [path]: item }));
          else if (spec.preserveNullAndEmptyArrays) {
            const copy = { ...d };
            delete copy[path];
            out.push(copy);
          }
        }
        rows = out;
        break;
      }
      case '$project': {
        rows = rows.map((d) => {
          const out: Doc = {};
          if (spec._id !== 0 && d._id !== undefined) out._id = d._id;
          for (const [k, v] of Object.entries(spec)) {
            if (k === '_id' && v === 0) continue;
            if (v === 1) {
              if (d[k] !== undefined) out[k] = d[k];
            } else {
              const val = evalExpr(v, d, vars);
              if (val !== undefined) out[k] = val;
            }
          }
          return out;
        });
        break;
      }
      case '$sort': {
        const entries = Object.entries(spec) as [string, number][];
        rows = [...rows].sort((a, b) => {
          for (const [field, dir] of entries) {
            const c = compare(a[field], b[field]);
            if (c !== 0) return c * dir;
          }
          return 0;
        });
        break;
      }
      case '$skip': rows = rows.slice(spec); break;
      case '$limit': rows = rows.slice(0, spec); break;
      case '$group': {
        const { _id, ...accs } = spec;
        if (_id !== null) throw new Error('pipelineFake: only $group with _id null is supported');
        if (!rows.length) { rows = []; break; }
        const out: Doc = { _id: null };
        for (const [field, acc] of Object.entries(accs as Doc)) {
          const [op, arg] = Object.entries(acc as Doc)[0];
          if (op !== '$sum') throw new Error(`pipelineFake: unsupported accumulator ${op}`);
          out[field] = rows.reduce((s, d) => {
            const v = evalExpr(arg, d, vars);
            return s + (typeof v === 'number' ? v : 0);
          }, 0);
        }
        rows = [out];
        break;
      }
      case '$facet': {
        const out: Doc = {};
        for (const [k, sub] of Object.entries(spec as Doc)) out[k] = runStages(rows.map((d) => ({ ...d })), sub as Doc[], collections, vars);
        rows = [out];
        break;
      }
      default:
        throw new Error(`pipelineFake: unsupported stage ${name}`);
    }
  }
  return rows;
};

/** Run `pipeline` over `source`; `collections` are the other collections a $lookup may read, by name. */
export const runPipeline = (source: Doc[], pipeline: Doc[], collections: Collections): Doc[] =>
  runStages(source.map((d) => ({ ...d })), pipeline, collections, {});
