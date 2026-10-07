import mongoose from 'mongoose';

/**
 * A tiny stateful stand-in for the Mongoose model methods the money workflows use.
 *
 * It exists so concurrency can be tested without a database: every operation yields to the event
 * loop first (so parallel requests interleave), reads hand out SNAPSHOTS (so a stale read is really
 * stale), and every write - findOneAndUpdate, findOneAndDelete, create - evaluates its filter and
 * applies its update in one synchronous step, exactly like a single-document atomic operation in
 * MongoDB. A conditional update whose filter no longer matches returns null.
 *
 * Supported filter operators: $in $nin $ne $lte $lt $gte $gt $type $exists.
 * Supported update operators: $set $unset $push $pull $inc.
 */

export const oid = () => new mongoose.Types.ObjectId();

type Doc = Record<string, any>;

export const clone = (value: any): any => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out;
  }
  return value;
};

const same = (a: any, b: any): boolean => {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  return String(a?._id ?? a) === String(b?._id ?? b);
};

const matchCondition = (actual: any, cond: any): boolean => {
  const isOperatorObject =
    cond &&
    typeof cond === 'object' &&
    !(cond instanceof mongoose.Types.ObjectId) &&
    !(cond instanceof Date) &&
    !Array.isArray(cond) &&
    Object.keys(cond).some((k) => k.startsWith('$'));
  if (isOperatorObject) {
    return Object.entries(cond).every(([op, v]: [string, any]) => {
      switch (op) {
        case '$in':
          return v.some((x: any) => same(x, actual));
        case '$nin':
          return !v.some((x: any) => same(x, actual));
        case '$ne':
          return !(actual !== undefined && actual !== null && same(actual, v));
        case '$lte':
          return actual !== undefined && actual !== null && actual <= v;
        case '$lt':
          return actual !== undefined && actual !== null && actual < v;
        case '$gte':
          return actual !== undefined && actual !== null && actual >= v;
        case '$gt':
          return actual !== undefined && actual !== null && actual > v;
        case '$type':
          return v === 'string' ? typeof actual === 'string' : false;
        case '$exists':
          return v ? actual !== undefined : actual === undefined;
        default:
          throw new Error(`fakeMongo: unsupported operator ${op}`);
      }
    });
  }
  if (cond === null || cond === undefined) return actual === null || actual === undefined;
  return same(actual, cond);
};

export const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter || {}).every(([key, cond]) => matchCondition(doc[key], cond));

const applyUpdate = (doc: Doc, update: Doc): Doc => {
  const next = clone(doc);
  const ops = Object.keys(update).some((k) => k.startsWith('$')) ? update : { $set: update };
  for (const [op, fields] of Object.entries(ops) as Array<[string, Doc]>) {
    for (const [path, value] of Object.entries(fields)) {
      switch (op) {
        case '$set':
          next[path] = clone(value);
          break;
        case '$unset':
          delete next[path];
          break;
        case '$push':
          next[path] = [...(next[path] || []), clone(value)];
          break;
        case '$pull':
          next[path] = (next[path] || []).filter((item: Doc) => !matches(item, value));
          break;
        case '$inc':
          next[path] = (next[path] || 0) + value;
          break;
        default:
          throw new Error(`fakeMongo: unsupported update operator ${op}`);
      }
    }
  }
  return next;
};

/** Awaitable query that also tolerates the chained helpers controllers call. */
const query = (producer: () => Promise<any>): any => {
  const q: any = {
    populate: () => q,
    select: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: () => q,
    then: (resolve: any, reject: any) => producer().then(resolve, reject),
  };
  return q;
};

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export interface FakeCollection {
  rows: Doc[];
  /** Every write that reached the collection, for assertions. */
  log: Array<{ op: string; filter?: Doc; update?: Doc; doc?: Doc }>;
  /** Make the next `op` (create / findOneAndUpdate / findOneAndDelete) reject with `error`. */
  failNext: (op: string, error: Error, when?: (arg: any) => boolean) => void;
  /** Reject `create` with a duplicate-key error when this returns true for (candidate, existingRows). */
  uniqueOn: (isDuplicate: (candidate: Doc, rows: Doc[]) => boolean) => void;
  seed: (...docs: Doc[]) => Doc[];
  get: (id: any) => Doc | undefined;
}

/** Replace the data methods of `Model` with in-memory ones; returns the collection and a restore function. */
export const fakeModel = (Model: any): { collection: FakeCollection; restore: () => void } => {
  const rows: Doc[] = [];
  const log: FakeCollection['log'] = [];
  const failures: Array<{ op: string; error: Error; when?: (arg: any) => boolean }> = [];
  let duplicate: ((candidate: Doc, rows: Doc[]) => boolean) | undefined;
  const originals: Record<string, any> = {};

  const stub = (name: string, impl: any) => {
    originals[name] = Model[name];
    Model[name] = impl;
  };
  const maybeFail = (op: string, arg: any) => {
    const index = failures.findIndex((f) => f.op === op && (!f.when || f.when(arg)));
    if (index >= 0) {
      const [failure] = failures.splice(index, 1);
      throw failure.error;
    }
  };

  stub('findOne', (filter: Doc = {}) =>
    query(async () => {
      await tick();
      const found = rows.find((d) => matches(d, filter));
      return found ? clone(found) : null;
    })
  );
  stub('findById', (id: any) =>
    query(async () => {
      await tick();
      const found = rows.find((d) => same(d._id, id));
      return found ? clone(found) : null;
    })
  );
  stub('find', (filter: Doc = {}) =>
    query(async () => {
      await tick();
      return rows.filter((d) => matches(d, filter)).map(clone);
    })
  );
  stub('countDocuments', (filter: Doc = {}) =>
    query(async () => {
      await tick();
      return rows.filter((d) => matches(d, filter)).length;
    })
  );
  stub('findOneAndUpdate', (filter: Doc, update: Doc, options: Doc = {}) =>
    query(async () => {
      await tick();
      maybeFail('findOneAndUpdate', { filter, update });
      const index = rows.findIndex((d) => matches(d, filter));
      if (index < 0) return null;
      const before = rows[index];
      rows[index] = applyUpdate(before, update);
      log.push({ op: 'findOneAndUpdate', filter: clone(filter), update: clone(update) });
      return clone(options.new === false ? before : rows[index]);
    })
  );
  stub('findByIdAndUpdate', (id: any, update: Doc) =>
    query(async () => {
      await tick();
      const index = rows.findIndex((d) => same(d._id, id));
      if (index < 0) return null;
      rows[index] = applyUpdate(rows[index], update);
      log.push({ op: 'findByIdAndUpdate', filter: { _id: id }, update: clone(update) });
      return clone(rows[index]);
    })
  );
  stub('findOneAndDelete', (filter: Doc) =>
    query(async () => {
      await tick();
      maybeFail('findOneAndDelete', { filter });
      const index = rows.findIndex((d) => matches(d, filter));
      if (index < 0) return null;
      const [removed] = rows.splice(index, 1);
      log.push({ op: 'findOneAndDelete', filter: clone(filter) });
      return clone(removed);
    })
  );
  stub('create', async (data: Doc) => {
    await tick();
    maybeFail('create', data);
    const candidate = { _id: oid(), createdAt: new Date(), updatedAt: new Date(), ...clone(data) };
    if (duplicate && duplicate(candidate, rows)) {
      throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
    }
    rows.push(candidate);
    log.push({ op: 'create', doc: clone(candidate) });
    const created = clone(candidate);
    // controllers call doc.populate(...) on a freshly created document
    Object.defineProperty(created, 'populate', { value: async function () { return this; }, enumerable: false });
    return created;
  });

  const collection: FakeCollection = {
    rows,
    log,
    failNext: (op, error, when) => {
      failures.push({ op, error, when });
    },
    uniqueOn: (isDuplicate) => {
      duplicate = isDuplicate;
    },
    seed: (...docs) => {
      for (const d of docs) rows.push({ _id: oid(), ...clone(d) });
      return docs.length ? rows.slice(-docs.length) : [];
    },
    get: (id) => rows.find((d) => same(d._id, id)),
  };

  return {
    collection,
    restore: () => {
      for (const [name, original] of Object.entries(originals)) Model[name] = original;
    },
  };
};

/** Call a controller with a fake request and collect {status, body}. */
export const callHandler = async (
  handler: (req: any, res: any) => Promise<any>,
  req: Doc
): Promise<{ status: number; body: any }> => {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  await handler({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
  return out;
};

export const silenceConsoleError = (): (() => void) => {
  const original = console.error;
  console.error = () => undefined;
  return () => {
    console.error = original;
  };
};
