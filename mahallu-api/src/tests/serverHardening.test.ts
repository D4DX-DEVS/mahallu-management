import { test } from 'node:test';
import assert from 'assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import type { AddressInfo } from 'net';
import {
  buildCorsOptions,
  checkBootEnvironment,
  decideDocsPolicy,
  docsBasicAuth,
  isOriginAllowed,
  parseAllowedOrigins,
  parseTrustProxy,
} from '../config/security';
import { createShutdown } from '../utils/gracefulShutdown';
import { appState, createApp } from '../app';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// ───────────────────────────── CORS ─────────────────────────────

const askCors = (options: ReturnType<typeof buildCorsOptions>, origin: string | undefined) =>
  new Promise<boolean>((resolve, reject) => {
    (options.origin as any)(origin, (err: Error | null, allow?: boolean) => (err ? reject(err) : resolve(Boolean(allow))));
  });

test('CORS: only listed origins are allowed; a bare * and blanks are ignored', () => {
  assert.deepEqual(parseAllowedOrigins(' https://cms.example.com , * , ,https://*.netlify.app '), ['https://cms.example.com', 'https://*.netlify.app']);
  const allowed = ['https://cms.example.com', 'https://*.netlify.app'];
  assert.ok(isOriginAllowed('https://cms.example.com', allowed));
  assert.ok(isOriginAllowed('https://deploy-preview-12--mahallu.netlify.app', allowed));
  assert.ok(!isOriginAllowed('http://cms.example.com', allowed), 'scheme must match');
  assert.ok(!isOriginAllowed('https://cms.example.com.evil.com', allowed));
  assert.ok(!isOriginAllowed('https://evilnetlify.app', allowed), 'wildcard needs a real subdomain boundary');
  assert.ok(!isOriginAllowed('https://netlify.app', allowed));
});

test('CORS: outside development an unset list allows NO browser origin, but non-browser clients still work', async () => {
  const options = buildCorsOptions({}, false);
  assert.equal(await askCors(options, 'https://cms.example.com'), false);
  assert.equal(await askCors(options, undefined), true, 'no Origin header = not a browser CORS request (mobile app, curl)');
  assert.equal(options.credentials, false);
});

test('CORS: a configured list is enforced in every environment; development with nothing configured stays open', async () => {
  const configured = buildCorsOptions({ CORS_ORIGINS: 'https://cms.example.com' }, true);
  assert.equal(await askCors(configured, 'https://cms.example.com'), true);
  assert.equal(await askCors(configured, 'https://evil.example.com'), false, 'an explicit list wins even in development');
  const devOpen = buildCorsOptions({}, true);
  assert.equal(await askCors(devOpen, 'http://localhost:3000'), true);
});

// ───────────────────────────── trust proxy ─────────────────────────────

test('TRUST_PROXY: unset trusts nothing; a hop count is honoured; "true" (trust everything) is refused', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(parseTrustProxy(undefined), false);
    assert.equal(parseTrustProxy(''), false);
    assert.equal(parseTrustProxy('0'), false);
    assert.equal(parseTrustProxy('1'), 1);
    assert.equal(parseTrustProxy('2'), 2);
    assert.equal(parseTrustProxy('loopback'), 'loopback');
    assert.equal(parseTrustProxy('true'), false);
  } finally {
    console.warn = warn;
  }
});

// ───────────────────────────── API docs ─────────────────────────────

test('API docs: open in development, otherwise off unless explicitly enabled WITH credentials', () => {
  assert.deepEqual(decideDocsPolicy({}, true), { mount: true, protectedByBasicAuth: false });
  assert.equal(decideDocsPolicy({}, false).mount, false);
  assert.equal(decideDocsPolicy({ ENABLE_API_DOCS: 'true' }, false).mount, false, 'enabled without credentials stays off');
  assert.equal(decideDocsPolicy({ ENABLE_API_DOCS: 'yes', API_DOCS_USER: 'u', API_DOCS_PASSWORD: 'p' }, false).mount, false);
  assert.deepEqual(decideDocsPolicy({ ENABLE_API_DOCS: 'true', API_DOCS_USER: 'u', API_DOCS_PASSWORD: 'p' }, false), {
    mount: true,
    protectedByBasicAuth: true,
  });
});

test('API docs basic auth: only the right credentials pass, and the failure says how to authenticate', () => {
  const guard = docsBasicAuth('docs-user', 'docs-pass');
  const run = (header?: string) => {
    const out: any = { status: 0, headers: {} as Record<string, string>, nextCalled: false };
    const res: any = {
      setHeader: (k: string, v: string) => (out.headers[k] = v),
      status: (c: number) => {
        out.status = c;
        return res;
      },
      send: () => res,
    };
    guard({ headers: { authorization: header } } as any, res, () => (out.nextCalled = true));
    return out;
  };
  const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
  assert.equal(run(basic('docs-user', 'docs-pass')).nextCalled, true);
  for (const bad of [undefined, 'Bearer abc', basic('docs-user', 'nope'), basic('other', 'docs-pass'), 'Basic !!!', basic('', '')]) {
    const out = run(bad);
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
    assert.match(out.headers['WWW-Authenticate'], /Basic/);
  }
});

// ───────────────────────────── boot checks ─────────────────────────────

test('boot check: a placeholder JWT secret is fatal outside development; a short one and a missing CORS list warn', () => {
  const placeholder = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'your-secret-key', CORS_ORIGINS: 'https://a.example' });
  assert.equal(placeholder.fatal.length, 1);
  const short = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(20) });
  assert.equal(short.fatal.length, 0);
  assert.ok(short.warnings.some((w) => /32 characters/.test(w)));
  assert.ok(short.warnings.some((w) => /CORS_ORIGINS/.test(w)));
  const good = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'https://a.example' });
  assert.deepEqual(good, { fatal: [], warnings: [] });
  const dev = checkBootEnvironment({ NODE_ENV: 'development', JWT_SECRET: 'secret' });
  assert.deepEqual(dev.fatal, []);
});

test('boot check: an unrecognised NODE_ENV is flagged and treated as production', () => {
  const typo = checkBootEnvironment({ NODE_ENV: 'prod', JWT_SECRET: 'x'.repeat(48), CORS_ORIGINS: 'https://a.example' });
  assert.ok(typo.warnings.some((w) => /treated as production/.test(w)));
});

// ───────────────────────────── graceful shutdown ─────────────────────────────

test('shutdown: stops taking traffic, stops jobs, then closes the database - in that order, once', async () => {
  const events: string[] = [];
  const server: any = {
    close: (cb: () => void) => {
      events.push('server.close');
      setImmediate(cb);
    },
    closeIdleConnections: () => events.push('idle'),
  };
  const lifecycle = createShutdown({
    server,
    markNotReady: () => events.push('not-ready'),
    stopJobs: [() => void events.push('job-1'), async () => void events.push('job-2')],
    closeDatabase: async () => void events.push('db.close'),
    log: () => {},
    exit: () => {},
  });
  const first = lifecycle.shutdown('SIGTERM');
  const second = lifecycle.shutdown('SIGINT'); // a second signal joins the first
  const result = await first;
  assert.equal(await second, result);
  assert.equal(result.clean, true);
  assert.deepEqual(events, ['not-ready', 'server.close', 'idle', 'job-1', 'job-2', 'db.close']);
});

test('shutdown: a request that will not finish is cut off after the timeout instead of hanging the deploy', async () => {
  let forced = false;
  const server: any = {
    close: (cb: () => void) => {
      // finishes only once the connections are force-closed
      const poll = setInterval(() => {
        if (forced) {
          clearInterval(poll);
          cb();
        }
      }, 5);
    },
    closeAllConnections: () => {
      forced = true;
    },
  };
  const lifecycle = createShutdown({ server, timeoutMs: 30, log: () => {}, exit: () => {} });
  const result = await lifecycle.shutdown('SIGTERM');
  assert.equal(forced, true);
  assert.equal(result.clean, false);
});

test('shutdownAndExit: exits 0 on a clean stop and 1 when the stop fails', async () => {
  const codes: number[] = [];
  const ok = createShutdown({ server: { close: (cb: any) => cb() }, log: () => {}, exit: (c) => codes.push(c) });
  await ok.shutdownAndExit('SIGTERM');
  const failing = createShutdown({
    server: { close: (cb: any) => cb() },
    closeDatabase: async () => {
      throw new Error('mongo down');
    },
    log: () => {},
    exit: (c) => codes.push(c),
  });
  await failing.shutdownAndExit('SIGTERM');
  assert.deepEqual(codes, [0, 1]);
});

// ───────────────────────────── the real app over HTTP ─────────────────────────────

const withApp = async (
  env: Record<string, string | undefined>,
  fn: (base: string) => Promise<void>
) => {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const log = console.info;
  console.info = () => {};
  const app = createApp();
  console.info = log;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

const setReadyState = (value: number) => {
  Object.defineProperty(mongoose.connection, 'readyState', { value, configurable: true });
};
const restoreReadyState = () => {
  delete (mongoose.connection as any).readyState;
};

test('HTTP: security headers are set, X-Powered-By is gone, and /api/health stays a plain liveness probe', async () => {
  await withApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://cms.example.com' }, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok(res.headers.get('strict-transport-security'));
  });
});

test('HTTP: /api/ready is 503 until the database is connected, 200 once it is, and 503 again while shutting down', async () => {
  await withApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://cms.example.com' }, async (base) => {
    try {
      setReadyState(0);
      let res = await fetch(`${base}/api/ready`);
      assert.equal(res.status, 503);
      assert.equal(((await res.json()) as any).database, 'down');

      setReadyState(1);
      res = await fetch(`${base}/api/ready`);
      assert.equal(res.status, 200);

      appState.shuttingDown = true;
      res = await fetch(`${base}/api/ready`);
      assert.equal(res.status, 503);
      assert.equal(((await res.json()) as any).shuttingDown, true);
    } finally {
      appState.shuttingDown = false;
      restoreReadyState();
    }
  });
});

test('HTTP CORS: a listed origin gets the header, an unlisted one does not, and a preflight from a stranger is not approved', async () => {
  await withApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://cms.example.com' }, async (base) => {
    const good = await fetch(`${base}/api/health`, { headers: { Origin: 'https://cms.example.com' } });
    assert.equal(good.headers.get('access-control-allow-origin'), 'https://cms.example.com');
    const bad = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(`${base}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  });
});

test('HTTP CORS: production with no CORS_ORIGINS answers no cross-origin approval at all', async () => {
  await withApp({ NODE_ENV: 'production', CORS_ORIGINS: undefined }, async (base) => {
    const res = await fetch(`${base}/api/health`, { headers: { Origin: 'https://cms.example.com' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(res.status, 200, 'the request itself is still served (non-browser clients are unaffected)');
  });
});

test('HTTP docs: /api-docs is not exposed in production, is behind basic auth when enabled, and open in development', async () => {
  await withApp({ NODE_ENV: 'production', ENABLE_API_DOCS: undefined }, async (base) => {
    assert.equal((await fetch(`${base}/api-docs/`)).status, 404);
  });
  await withApp({ NODE_ENV: 'production', ENABLE_API_DOCS: 'true', API_DOCS_USER: 'docs', API_DOCS_PASSWORD: 'secret-docs-pass' }, async (base) => {
    const anonymous = await fetch(`${base}/api-docs/`);
    assert.equal(anonymous.status, 401);
    const authed = await fetch(`${base}/api-docs/`, {
      headers: { Authorization: `Basic ${Buffer.from('docs:secret-docs-pass').toString('base64')}` },
    });
    assert.equal(authed.status, 200);
  });
  await withApp({ NODE_ENV: 'development', ENABLE_API_DOCS: undefined }, async (base) => {
    assert.equal((await fetch(`${base}/api-docs/`)).status, 200);
  });
});

test('HTTP: an unknown route is a JSON 404 that does not echo the path', async () => {
  await withApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://cms.example.com' }, async (base) => {
    // (Paths under /api first meet a router's authentication, so use one outside it.)
    const res = await fetch(`${base}/definitely-not-here`);
    assert.equal(res.status, 404);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes('definitely-not-here'));
  });
});
