import mongoose from 'mongoose';

/**
 * A small STATEFUL in-memory stand-in for Mongoose models, for tests that need real data flow and real
 * concurrency (no database is ever touched).
 *
 *  - every operation is atomic on its own (it runs synchronously after one event-loop yield) and
 *    operations from different callers interleave between awaits, exactly like single-document
 *    operations against MongoDB, so `Promise.all` of N requests is a genuine race;
 *  - filters: equality (ObjectId/string/Date aware), null = missing, $in $nin $ne $eq $gt $gte $lt $lte
 *    $exists $regex $type, $or;
 *  - updates: $set $inc $unset $setOnInsert (a plain object is treated as $set), upsert, new, includeResultMetadata;
 *  - unique indexes are READ FROM THE REAL SCHEMA (including partialFilterExpression), so a duplicate
 *    raises an E11000-shaped error just as MongoDB would, and a schema change shows up in the tests;
 *  - aggregate supports $match and a $group with $sum / $max / $cond / $eq / $toInt (what the controllers use);
 *  - failure injection: `store.failOn('LedgerItem.findOneAndUpdate', error)`.
 */

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

type Doc = Record<string, any>;

export const oid = () => new mongoose.Types.ObjectId();

const isObjectId = (v: any) => v instanceof mongoose.Types.ObjectId;
const isOperatorObject = (v: any) =>
  v && typeof v === 'object' && !isObjectId(v) && !(v instanceof Date) && !(v instanceof RegExp) && !Array.isArray(v) &&
  Object.keys(v).some((k) => k.startsWith('$'));

/** Comparable form: ids and strings compare by text, dates by time. */
const norm = (v: any): any => {
  if (v === undefined || v === null) return null;
  if (isObjectId(v)) return String(v);
  if (v instanceof Date) return v.getTime();
  return v;
};
const eq = (a: any, b: any) => {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  // an ObjectId on one side and its hex text on the other
  return (isObjectId(a) || isObjectId(b)) && String(a) === String(b);
};

const typeOf = (v: any): string => {
  if (v === undefined) return 'missing';
  if (v === null) return 'null';
  if (isObjectId(v)) return 'objectId';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (v instanceof Date) return 'date';
  return typeof v;
};

export const matches = (doc: Doc, filter: Doc | undefined): boolean => {
  if (!filter) return true;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$or') return (cond as Doc[]).some((f) => matches(doc, f));
    if (key === '$and') return (cond as Doc[]).every((f) => matches(doc, f));
    const value = doc[key];
    if (cond === null || cond === undefined) return value === null || value === undefined;
    if (cond instanceof RegExp) return typeof value === 'string' && cond.test(value);
    if (isOperatorObject(cond)) {
      return Object.entries(cond as Doc).every(([op, arg]) => {
        switch (op) {
          case '$in': return (arg as any[]).some((x) => (x === null ? value == null : eq(value, x)));
          case '$nin': return !(arg as any[]).some((x) => (x === null ? value == null : eq(value, x)));
          case '$ne': return arg === null ? value != null : !eq(value, arg);
          case '$eq': return eq(value, arg);
          case '$gt': return value != null && norm(value) > norm(arg);
          case '$gte': return value != null && norm(value) >= norm(arg);
          case '$lt': return value != null && norm(value) < norm(arg);
          case '$lte': return value != null && norm(value) <= norm(arg);
          case '$exists': return (value !== undefined) === !!arg;
          case '$type': return typeOf(value) === arg;
          case '$regex': {
            const re = arg instanceof RegExp ? arg : new RegExp(String(arg), (cond as Doc).$options);
            return typeof value === 'string' && re.test(value);
          }
          case '$options': return true;
          default: throw new Error(`fakeMongo: unsupported operator ${op}`);
        }
      });
    }
    return eq(value, cond);
  });
};

const evalExpr = (expr: any, doc: Doc): any => {
  if (typeof expr === 'string' && expr.startsWith('$')) return doc[expr.slice(1)];
  if (expr && typeof expr === 'object' && !Array.isArray(expr) && !isObjectId(expr)) {
    if ('$cond' in expr) {
      const [c, a, b] = expr.$cond;
      return evalExpr(c, doc) ? evalExpr(a, doc) : evalExpr(b, doc);
    }
    if ('$eq' in expr) return eq(evalExpr(expr.$eq[0], doc), evalExpr(expr.$eq[1], doc));
    if ('$toInt' in expr) return parseInt(String(evalExpr(expr.$toInt, doc)), 10);
    throw new Error(`fakeMongo: unsupported expression ${JSON.stringify(expr)}`);
  }
  return expr;
};

const dupError = (keyPattern: Doc, name: string) =>
  Object.assign(new Error(`E11000 duplicate key error collection: ${name} index: ${Object.keys(keyPattern).join('_')}`), {
    code: 11000,
    keyPattern,
    keyValue: keyPattern,
  });

interface UniqueIndex {
  fields: string[];
  partial?: Doc;
}

export class FakeStore {
  docs: any[] = [];
  uniques: UniqueIndex[] = [];
  /** every operation, in order: `Name.op` */
  log: string[] = [];
  private failures: Array<{ op: string; error: Error; times: number; when?: (arg: any) => boolean }> = [];
  private clock = Date.UTC(2026, 0, 1);

  constructor(public name: string) {}

  /** Make the next `times` calls of `Name.op` (e.g. 'LedgerItem.findOneAndUpdate') throw `error`. */
  failOn(op: string, error: Error = new Error('injected failure'), times = 1, when?: (arg: any) => boolean) {
    this.failures.push({ op, error, times, when });
  }
  clearFailures() {
    this.failures = [];
  }
  count(op: string) {
    return this.log.filter((l) => l === `${this.name}.${op}`).length;
  }

  hook(op: string, arg?: any) {
    this.log.push(`${this.name}.${op}`);
    const idx = this.failures.findIndex((f) => f.op === `${this.name}.${op}` && f.times > 0 && (!f.when || f.when(arg)));
    if (idx >= 0) {
      this.failures[idx].times -= 1;
      throw this.failures[idx].error;
    }
  }

  private now() {
    this.clock += 1000;
    return new Date(this.clock);
  }

  wrap(doc: Doc | null | undefined): any {
    if (!doc) return null;
    const copy: Doc = { ...doc };
    Object.defineProperty(copy, 'toObject', { value: () => ({ ...doc }), enumerable: false });
    Object.defineProperty(copy, 'toJSON', { value: () => ({ ...doc }), enumerable: false });
    Object.defineProperty(copy, 'id', { value: String(doc._id), enumerable: false });
    return copy;
  }

  private keyOf(doc: Doc, fields: string[]) {
    return JSON.stringify(fields.map((f) => norm(doc[f])));
  }

  private assertUnique(doc: Doc, ignore?: Doc) {
    // _id is always unique
    if (this.docs.some((d) => d !== ignore && eq(d._id, doc._id))) throw dupError({ _id: 1 }, this.name);
    for (const index of this.uniques) {
      if (index.partial && !matches(doc, index.partial)) continue;
      const key = this.keyOf(doc, index.fields);
      const clash = this.docs.find(
        (d) => d !== ignore && (!index.partial || matches(d, index.partial)) && this.keyOf(d, index.fields) === key
      );
      if (clash) throw dupError(Object.fromEntries(index.fields.map((f) => [f, 1])), this.name);
    }
  }

  insert(data: Doc): Doc {
    const doc: Doc = { ...data };
    if (doc._id === undefined) doc._id = oid();
    const stamp = this.now();
    if (doc.createdAt === undefined) doc.createdAt = stamp;
    if (doc.updatedAt === undefined) doc.updatedAt = stamp;
    for (const key of Object.keys(doc)) if (doc[key] === undefined) delete doc[key];
    this.assertUnique(doc);
    this.docs.push(doc);
    return doc;
  }

  apply(doc: Doc, update: Doc, inserting: boolean) {
    const hasOp = Object.keys(update).some((k) => k.startsWith('$'));
    const ops = hasOp ? update : { $set: update };
    for (const [op, spec] of Object.entries(ops)) {
      if (op === '$set') for (const [k, v] of Object.entries(spec as Doc)) { if (v === undefined) delete doc[k]; else doc[k] = v; }
      else if (op === '$inc') for (const [k, v] of Object.entries(spec as Doc)) doc[k] = (doc[k] || 0) + (v as number);
      else if (op === '$unset') for (const k of Object.keys(spec as Doc)) delete doc[k];
      else if (op === '$setOnInsert') { if (inserting) for (const [k, v] of Object.entries(spec as Doc)) if (v !== undefined) doc[k] = v; }
      else throw new Error(`fakeMongo: unsupported update operator ${op}`);
    }
    doc.updatedAt = this.now();
  }

  find(filter?: Doc) {
    return this.docs.filter((d) => matches(d, filter));
  }

  findOneAndUpdate(filter: Doc, update: Doc, options: Doc = {}) {
    const found = this.docs.find((d) => matches(d, filter));
    if (found) {
      const before = { ...found };
      const candidate = { ...found };
      this.apply(candidate, update, false);
      this.assertUnique(candidate, found);
      Object.keys(found).forEach((k) => delete found[k]);
      Object.assign(found, candidate);
      const value = options.new ? { ...found } : before;
      return options.includeResultMetadata ? { value: this.wrap(value), lastErrorObject: { updatedExisting: true, n: 1 }, ok: 1 } : this.wrap(value);
    }
    if (!options.upsert) {
      return options.includeResultMetadata ? { value: null, lastErrorObject: { updatedExisting: false, n: 0 }, ok: 1 } : null;
    }
    const base: Doc = {};
    for (const [k, v] of Object.entries(filter)) {
      if (k.startsWith('$') || isOperatorObject(v) || v instanceof RegExp) continue;
      base[k] = v;
    }
    this.apply(base, update, true);
    const stamp = this.now();
    base.createdAt = base.createdAt || stamp;
    const inserted = this.insert(base);
    const value = options.new ? { ...inserted } : null;
    return options.includeResultMetadata
      ? { value: this.wrap(value), lastErrorObject: { updatedExisting: false, upserted: inserted._id, n: 1 }, ok: 1 }
      : this.wrap(value);
  }

  findOneAndDelete(filter: Doc) {
    const i = this.docs.findIndex((d) => matches(d, filter));
    if (i < 0) return null;
    const [removed] = this.docs.splice(i, 1);
    return this.wrap(removed);
  }

  aggregate(pipeline: Doc[]) {
    let rows: Doc[] = this.docs.map((d) => ({ ...d }));
    for (const stage of pipeline) {
      if (stage.$match) rows = rows.filter((d) => matches(d, stage.$match));
      else if (stage.$group) {
        const { _id: idSpec, ...accs } = stage.$group;
        const groups = new Map<string, { id: any; rows: Doc[] }>();
        for (const row of rows) {
          const id = idSpec === null ? null : evalExpr(idSpec, row);
          const key = JSON.stringify(norm(id));
          if (!groups.has(key)) groups.set(key, { id, rows: [] });
          groups.get(key)!.rows.push(row);
        }
        rows = [...groups.values()].map((g) => {
          const out: Doc = { _id: g.id };
          for (const [name, acc] of Object.entries(accs as Doc)) {
            const [op, arg] = Object.entries(acc as Doc)[0];
            const values = g.rows.map((r) => evalExpr(arg, r)).filter((v) => v !== undefined && v !== null);
            if (op === '$sum') out[name] = values.reduce((s, v) => s + Number(v), 0);
            else if (op === '$max') out[name] = values.length ? Math.max(...values.map(Number)) : null;
            else throw new Error(`fakeMongo: unsupported accumulator ${op}`);
          }
          return out;
        });
      } else if (stage.$sort || stage.$limit) {
        // not needed by the controllers under test
      } else throw new Error(`fakeMongo: unsupported stage ${Object.keys(stage)[0]}`);
    }
    return rows;
  }
}

/** A thenable query that runs after one tick; every builder method is accepted. */
const query = (run: () => any, sortRef: { sort?: Doc; skip?: number; limit?: number }): any => {
  const q: any = {
    sort: (s: Doc) => ((sortRef.sort = s), q),
    skip: (n: number) => ((sortRef.skip = n), q),
    limit: (n: number) => ((sortRef.limit = n), q),
    select: () => q,
    populate: () => q,
    lean: () => q,
    session: () => q,
    then: (resolve: any, reject: any) =>
      tick().then(() => run()).then(resolve, reject),
    catch: (reject: any) => tick().then(() => run()).catch(reject),
  };
  return q;
};

const sortDocs = (docs: Doc[], spec?: Doc) => {
  if (!spec) return docs;
  const entries = Object.entries(spec);
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const x = norm(a[field]);
      const y = norm(b[field]);
      if (x === y) continue;
      if (x === null) return -1 * (dir as number);
      if (y === null) return 1 * (dir as number);
      return (x < y ? -1 : 1) * (dir as number);
    }
    return 0;
  });
};

/** Unique indexes of the REAL schema, as the fake enforces them. */
const uniquesFromSchema = (Model: any): UniqueIndex[] =>
  (Model.schema.indexes() as Array<[Doc, Doc]>)
    .filter(([, opts]) => opts && opts.unique)
    .map(([fields, opts]) => ({ fields: Object.keys(fields), partial: opts.partialFilterExpression }));

export interface Installed {
  store: FakeStore;
  restore: () => void;
}

/** Replace the statics of a real Mongoose model with the in-memory implementation. */
export function installFake(Model: any, seed: Doc[] = []): Installed {
  const store = new FakeStore(Model.modelName);
  store.uniques = uniquesFromSchema(Model);
  seed.forEach((d) => store.insert(d));
  const originals: Array<[any, string, any]> = [];
  const stub = (target: any, key: string, impl: any) => {
    originals.push([target, key, target[key]]);
    target[key] = impl;
  };

  const readQuery = (op: string, filter: Doc | undefined, take: 'many' | 'one') => {
    const ref: { sort?: Doc; skip?: number; limit?: number } = {};
    return query(() => {
      store.hook(op, filter);
      let rows = sortDocs(store.find(filter), ref.sort);
      if (ref.skip) rows = rows.slice(ref.skip);
      if (ref.limit) rows = rows.slice(0, ref.limit);
      return take === 'one' ? store.wrap(rows[0] || null) : rows.map((r) => store.wrap(r));
    }, ref);
  };

  stub(Model, 'find', (filter?: Doc) => readQuery('find', filter, 'many'));
  stub(Model, 'findOne', (filter?: Doc) => readQuery('findOne', filter, 'one'));
  stub(Model, 'findById', (id: any) => readQuery('findById', { _id: id }, 'one'));
  stub(Model, 'exists', (filter: Doc) =>
    query(() => {
      store.hook('exists', filter);
      const found = store.find(filter)[0];
      return found ? { _id: found._id } : null;
    }, {})
  );
  stub(Model, 'countDocuments', (filter?: Doc) =>
    query(() => {
      store.hook('countDocuments', filter);
      return store.find(filter).length;
    }, {})
  );
  stub(Model, 'aggregate', (pipeline: Doc[]) =>
    query(() => {
      store.hook('aggregate', pipeline);
      return store.aggregate(pipeline);
    }, {})
  );

  const atomic = (op: string, fn: (...args: any[]) => any) =>
    stub(Model, op, (...args: any[]) =>
      query(() => {
        store.hook(op, args[0]);
        return fn(...args);
      }, {})
    );
  atomic('findOneAndUpdate', (filter: Doc, update: Doc, options?: Doc) => store.findOneAndUpdate(filter, update, options));
  atomic('findByIdAndUpdate', (id: any, update: Doc, options?: Doc) => store.findOneAndUpdate({ _id: id }, update, options));
  atomic('findOneAndDelete', (filter: Doc) => store.findOneAndDelete(filter));
  atomic('findByIdAndDelete', (id: any) => store.findOneAndDelete({ _id: id }));
  atomic('updateOne', (filter: Doc, update: Doc, options?: Doc) => {
    const found = store.docs.find((d) => matches(d, filter));
    if (!found) return { matchedCount: 0, modifiedCount: 0 };
    const candidate = { ...found };
    store.apply(candidate, update, false);
    Object.keys(found).forEach((k) => delete found[k]);
    Object.assign(found, candidate);
    return { matchedCount: 1, modifiedCount: 1 };
  });
  atomic('deleteOne', (filter: Doc) => {
    const i = store.docs.findIndex((d) => matches(d, filter));
    if (i >= 0) store.docs.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  });
  atomic('deleteMany', (filter: Doc) => {
    const before = store.docs.length;
    store.docs = store.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - store.docs.length };
  });

  stub(Model, 'create', async (data: Doc | Doc[]) => {
    await tick();
    const list = Array.isArray(data) ? data : [data];
    const out = list.map((item) => {
      store.hook('create', item);
      return store.wrap(store.insert(item));
    });
    return Array.isArray(data) ? out : out[0];
  });

  stub(Model.prototype, 'save', async function (this: any) {
    await tick();
    const plain = this.toObject({ depopulate: true });
    store.hook('save', plain);
    store.insert(plain);
    return this;
  });

  return {
    store,
    restore: () => originals.reverse().forEach(([target, key, original]) => (target[key] = original)),
  };
}

let muteDepth = 0;
let realConsoleError: typeof console.error = console.error;

/** A recorded response. */
export interface Reply {
  status: number;
  body: any;
}

/** Run an Express-style handler with a fake request/response and return what it answered. */
export async function call(
  handler: (req: any, res: any) => any,
  req: {
    params?: Doc;
    body?: Doc;
    query?: Doc;
    tenantId?: string;
    isSuperAdmin?: boolean;
    user?: Doc;
  } = {}
): Promise<Reply> {
  const reply: Reply = { status: 200, body: undefined };
  let done: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => (done = resolve));
  const res: any = {
    status(code: number) {
      reply.status = code;
      return res;
    },
    json(body: any) {
      reply.body = body;
      done();
      return res;
    },
  };
  const fullReq: any = {
    params: {},
    body: {},
    query: {},
    headers: {},
    method: 'TEST',
    originalUrl: '/test',
    ...req,
    user: { role: 'mahall', ...(req.user || {}) },
  };
  res.req = fullReq;
  // swallow the controllers' own error logging in the test output (re-entrant: calls run concurrently)
  muteDepth += 1;
  if (muteDepth === 1) {
    realConsoleError = console.error;
    console.error = () => undefined;
  }
  try {
    await handler(fullReq, res);
    await Promise.race([finished, tick()]);
  } finally {
    muteDepth -= 1;
    if (muteDepth === 0) console.error = realConsoleError;
  }
  return reply;
}
