import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Family from '../models/Family';
import Member from '../models/Member';
import { Varisangya, Zakat } from '../models/Collectible';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import { exportEntityCsv, csvEscape } from '../controllers/exportController';
import exportRoutes from '../routes/exportRoutes';
import { authMiddleware } from '../middleware/authMiddleware';

// One root suite so stubs installed by this file's hooks never leak into other suites when every test
// file is imported into the single `npm test` process.
describe('[isolated] backend CSV export', () => {
  const MODELS: Record<string, any> = {
    families: Family,
    members: Member,
    varisangya: Varisangya,
    zakat: Zakat,
    nikah: NikahRegistration,
    death: DeathRegistration,
    noc: NOC,
  };
  const TENANT = '64b000000000000000000001';

  let rows: any[];
  let queries: Array<{ model: string; filter: any; limit?: number }>;
  const originals: Array<[any, any]> = [];

  beforeEach(() => {
    rows = [];
    queries = [];
    for (const [name, Model] of Object.entries(MODELS)) {
      originals.push([Model, Model.find]);
      Model.find = (filter: any) => {
        const record: { model: string; filter: any; limit?: number } = { model: name, filter };
        queries.push(record);
        const chain: any = {
          sort: () => chain,
          limit: (n: number) => {
            record.limit = n;
            return chain;
          },
          lean: async () => rows.slice(0, record.limit ?? rows.length),
        };
        return chain;
      };
    }
  });
  afterEach(() => {
    while (originals.length) {
      const [Model, find] = originals.pop() as [any, any];
      Model.find = find;
    }
  });

  interface Reply {
    status: number;
    headers: Record<string, string>;
    sent?: string;
    json?: any;
  }

  const runExport = async (entity: string, req: Record<string, unknown> = {}): Promise<Reply> => {
    const reply: Reply = { status: 200, headers: {} };
    const res: any = {
      status(code: number) {
        reply.status = code;
        return res;
      },
      json(body: any) {
        reply.json = body;
        return res;
      },
      setHeader(name: string, value: string) {
        reply.headers[name.toLowerCase()] = value;
      },
      send(body: string) {
        reply.sent = body;
        return res;
      },
    };
    await exportEntityCsv({ params: { entity }, tenantId: TENANT, user: { role: 'mahall' }, ...req } as any, res);
    return reply;
  };

  /** Minimal RFC 4180 reader: enough to look at each cell of an export. */
  const parseCsv = (text: string): string[][] => {
    const out: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(cell);
        out.push(row);
        row = [];
        cell = '';
        i += 1;
      } else cell += ch;
    }
    row.push(cell);
    out.push(row);
    return out;
  };

  describe('formula injection', () => {
    const PAYLOADS = [
      '=HYPERLINK("http://x","y")',
      '=cmd|\' /C calc\'!A0',
      '+SUM(1,2)',
      '-2+3+cmd|\' /C calc\'!A0',
      '@SUM(A1)',
      '\t=1+1',
      '\r=1+1',
      '+cmd',
      '-cmd',
    ];

    for (const entity of Object.keys(MODELS)) {
      it(`${entity}: every cell holding a formula payload is neutralised`, async () => {
        for (const payload of PAYLOADS) {
          // A document whose every field reads as the payload exercises every column of the entity.
          rows = [new Proxy({}, { get: (_target, key) => (key === 'isFamilyHead' ? false : payload) })];
          const reply = await runExport(entity);
          assert.equal(reply.status, 200);
          const table = parseCsv((reply.sent as string).slice(1));
          assert.equal(table.length, 2, 'a header row and one data row');
          for (const cell of table[1]) {
            if (cell === '') continue;
            assert.ok(!/^[=+\-@\t\r]/.test(cell), `${entity}: "${cell}" would run as a formula in a spreadsheet`);
            assert.ok(cell.startsWith("'"), `${entity}: payload ${JSON.stringify(payload)} gets an apostrophe prefix`);
            assert.ok(cell.endsWith(payload), 'the original text is preserved after the prefix');
          }
        }
      });
    }

    it('applies the CMS rule: plain numbers and phone-like values stay untouched', () => {
      assert.equal(csvEscape('-500'), '-500');
      assert.equal(csvEscape(-500), '-500');
      assert.equal(csvEscape('+91 98765 43210'), '+91 98765 43210');
      assert.equal(csvEscape('(044) 2345-6789'), '(044) 2345-6789');
      assert.equal(csvEscape('1250.50'), '1250.50');
      assert.equal(csvEscape('-'), '-');
    });

    it('neutralises = @ tab and carriage-return starts, and +/- followed by letters or functions', () => {
      assert.equal(csvEscape('=1+1'), "'=1+1");
      assert.equal(csvEscape('@a'), "'@a");
      assert.equal(csvEscape('\tx'), "'\tx");
      assert.equal(csvEscape('+a'), "'+a");
      assert.equal(csvEscape('-SUM(A1)'), "'-SUM(A1)");
      assert.equal(csvEscape('=1,2'), `"'=1,2"`, 'a quoted field keeps the apostrophe inside the quotes');
      assert.equal(csvEscape('\rx'), `"'\rx"`, 'a leading CR is both neutralised and quoted');
    });

    it('does not touch a formula character that is not at the start of the cell', () => {
      assert.equal(csvEscape('a=b'), 'a=b');
      assert.equal(csvEscape('Hall, =x'), '"Hall, =x"');
    });
  });

  describe('text and number handling (same as the CMS helper)', () => {
    it('keeps long digit strings and leading-zero numbers as text', () => {
      assert.equal(csvEscape('1234567890123456'), '="1234567890123456"');
      assert.equal(csvEscape('123456789012'), '="123456789012"');
      assert.equal(csvEscape('00123456'), '="00123456"');
      assert.equal(csvEscape('12345678901'), '12345678901', 'an 11-digit number is not long enough to need it');
      assert.equal(csvEscape('0'), '0');
      assert.equal(csvEscape(14001), '14001');
    });

    it('quotes commas, quotes and line breaks; renders dates as ISO days; empties as nothing', () => {
      assert.equal(csvEscape('a,b'), '"a,b"');
      assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
      assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
      assert.equal(csvEscape(new Date('2026-03-04T10:00:00Z')), '2026-03-04');
      assert.equal(csvEscape(new Date('not a date')), '');
      assert.equal(csvEscape(null), '');
      assert.equal(csvEscape(undefined), '');
    });

    it('a member row keeps its real data readable', async () => {
      rows = [
        { mahallId: 'M-1', name: 'Ayesha', familyName: 'Hall, House', age: 31, gender: 'female', phone: '+91 98765 43210', isFamilyHead: true, status: 'active', createdAt: new Date('2026-01-02T00:00:00Z') },
      ];
      const reply = await runExport('members');
      const [, data] = parseCsv((reply.sent as string).slice(1));
      assert.deepEqual(data.slice(0, 6), ['M-1', 'Ayesha', 'Hall, House', '31', 'female', '+91 98765 43210']);
      assert.equal(data[11], 'yes');
      assert.equal(data[13], '2026-01-02');
    });
  });

  describe('response shape', () => {
    it('keeps the UTF-8 BOM, CRLF rows, content type, disposition and headers', async () => {
      rows = [{ receiptNo: '14001', amount: 100, paymentDate: new Date('2026-02-03T00:00:00Z'), paymentMethod: 'cash', remarks: 'ok' }];
      const reply = await runExport('varisangya');
      assert.equal(reply.status, 200);
      assert.equal(reply.headers['content-type'], 'text/csv; charset=utf-8');
      assert.match(reply.headers['content-disposition'], /^attachment; filename="varisangya-\d{4}-\d{2}-\d{2}\.csv"$/);
      const body = reply.sent as string;
      assert.equal(body.charCodeAt(0), 0xfeff, 'BOM first');
      assert.equal(body.slice(1).split('\r\n')[0], 'Receipt No,Amount,Payment Date,Method,Status,Source,Remarks');
      assert.equal(body.slice(1).split('\r\n')[1], '14001,100,2026-02-03,cash,verified,admin,ok');
      assert.equal(reply.headers['x-export-truncated'], undefined, 'no truncation header for a small export');
    });

    it('an empty entity still answers a header-only file', async () => {
      const reply = await runExport('noc');
      assert.equal(parseCsv((reply.sent as string).slice(1)).length, 1);
    });
  });

  describe('10,000 row cap', () => {
    const makeRows = (n: number) => Array.from({ length: n }, (_v, i) => ({ receiptNo: String(i + 1), amount: 1 }));

    it('flags a cut-off export with X-Export-Truncated and returns exactly the cap', async () => {
      rows = makeRows(10001);
      const reply = await runExport('zakat');
      assert.equal(reply.headers['x-export-truncated'], 'true');
      assert.equal(parseCsv((reply.sent as string).slice(1)).length, 1 + 10000);
    });

    it('does not flag an export that fits exactly at the cap', async () => {
      rows = makeRows(10000);
      const reply = await runExport('zakat');
      assert.equal(reply.headers['x-export-truncated'], undefined);
      assert.equal(parseCsv((reply.sent as string).slice(1)).length, 1 + 10000);
    });

    it('does not flag a smaller export', async () => {
      rows = makeRows(9999);
      assert.equal((await runExport('zakat')).headers['x-export-truncated'], undefined);
    });
  });

  describe('tenant scope and access', () => {
    it('only ever queries the caller\'s own Mahallu', async () => {
      await runExport('families');
      await runExport('members');
      assert.equal(queries.length, 2);
      for (const q of queries) assert.deepEqual(q.filter, { tenantId: TENANT });
    });

    it('a request without a selected Mahallu is refused before any query runs', async () => {
      const reply = await runExport('members', { tenantId: undefined });
      assert.equal(reply.status, 400);
      assert.equal(queries.length, 0);
    });

    it('an unknown entity is a 400, including names inherited from Object.prototype', async () => {
      for (const entity of ['users', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        const reply = await runExport(entity);
        assert.equal(reply.status, 400, entity);
      }
      assert.equal(queries.length, 0);
    });

    it('the router authenticates and then allows only the Mahallu admin and the Super Admin', () => {
      const stack: any[] = (exportRoutes as any).stack;
      const auth = stack.findIndex((l) => l.handle === authMiddleware);
      const guard = stack.findIndex((l) => l.handle?.isRoleGuard);
      const route = stack.findIndex((l) => l.route?.path === '/:entity');
      assert.ok(auth >= 0 && guard > auth && route > guard, 'authMiddleware, then the role guard, then the route');
      assert.deepEqual(stack[guard].handle.allowedRoles, ['super_admin', 'mahall']);
      let status = 0;
      stack[guard].handle({ user: { role: 'member' }, isSuperAdmin: false }, { status: (c: number) => { status = c; return { json: () => undefined }; } }, () => {
        status = -1;
      });
      assert.equal(status, 403);
    });
  });
});
