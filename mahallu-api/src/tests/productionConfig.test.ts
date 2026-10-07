import { describe, it } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import {
  analyzeCorsOrigins,
  analyzeTrustProxy,
  buildCorsOptions,
  checkBootEnvironment,
  isOriginAllowed,
  parseAllowedOrigins,
  parseTrustProxy,
} from '../config/security';

const askCors = (options: ReturnType<typeof buildCorsOptions>, origin: string | undefined) =>
  new Promise<boolean>((resolve, reject) => {
    (options.origin as any)(origin, (err: Error | null, allow?: boolean) => (err ? reject(err) : resolve(Boolean(allow))));
  });

const GOOD_SECRET = 'x'.repeat(48);
const OPEN_PROBES = ['https://evil.example', 'https://cms.example.com', 'http://localhost:3000', 'null', 'https://a.com', 'https://example.com'];

/** Walks src/ (not tests) and returns every .ts source file. */
const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });

/** Removes comments but keeps string/template literals (so "https://" is not mistaken for a comment). */
const stripComments = (code: string): string =>
  code.replace(
    /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, literal) => literal ?? ''
  );

describe('[isolated] productionConfig', () => {
  describe('CORS_ORIGINS matrix', () => {
    const CLOSED_INPUTS: Array<[string, string | undefined]> = [
      ['unset', undefined],
      ['empty', ''],
      ['blank', '   '],
      ['only commas', ' , ,, '],
    ];

    for (const [label, value] of CLOSED_INPUTS) {
      it(`${label} in production allows no browser origin (non-browser clients still work)`, async () => {
        const options = buildCorsOptions({ CORS_ORIGINS: value }, false);
        for (const origin of OPEN_PROBES) assert.equal(await askCors(options, origin), false, `${origin} must be blocked`);
        assert.equal(await askCors(options, undefined), true);
      });
    }

    const INVALID_INPUTS = [
      '*',
      ' * ',
      '*,*',
      'null',
      '*.example.com',
      'https://*.com',
      'https://*.*.com',
      'https://*.co.uk',
      'https://*',
      'https://*.',
      'cms.example.com',
      '//cms.example.com',
      'ftp://cms.example.com',
      'https://',
      'https://exa mple.com',
      'https://cms.example.com/app',
      'https://user@cms.example.com',
      'https://cms.example.com:99999',
      'https://cms.example.com:0',
      'https://(a+)+$.example.com',
      'https://[::1]',
      'https://-bad.example.com',
      'https://under_score.example.com',
      'https://' + 'a'.repeat(70) + '.example.com',
      'x'.repeat(5000),
    ];

    for (const input of INVALID_INPUTS) {
      const shown = input.length > 40 ? `${input.slice(0, 37)}...` : input;
      it(`invalid list "${shown}" never opens CORS (production AND development) and never throws`, async () => {
        const analysis = analyzeCorsOrigins(input);
        assert.deepEqual(analysis.valid, [], 'no entry is valid');
        assert.ok(analysis.invalid.length >= 1);
        assert.deepEqual(parseAllowedOrigins(input), []);
        for (const development of [false, true]) {
          const options = buildCorsOptions({ CORS_ORIGINS: input }, development);
          for (const origin of OPEN_PROBES) {
            assert.equal(await askCors(options, origin), false, `${origin} must be blocked (development=${development})`);
          }
        }
        assert.equal(isOriginAllowed('https://cms.example.com', [input]), false, 'isOriginAllowed ignores bad entries instead of throwing');
      });
    }

    it('one valid entry among invalid ones still works, and only the valid one', async () => {
      const options = buildCorsOptions({ CORS_ORIGINS: '*, https://cms.example.com, nonsense' }, false);
      assert.equal(await askCors(options, 'https://cms.example.com'), true);
      assert.equal(await askCors(options, 'https://evil.example'), false);
    });

    it('development with nothing configured stays open; production never does', async () => {
      assert.equal(await askCors(buildCorsOptions({}, true), 'http://localhost:3000'), true);
      assert.equal(await askCors(buildCorsOptions({}, false), 'http://localhost:3000'), false);
    });

    it('trailing slash, upper case, default ports and explicit ports are normalised', () => {
      assert.deepEqual(parseAllowedOrigins('HTTPS://CMS.Example.COM/'), ['https://cms.example.com']);
      assert.deepEqual(parseAllowedOrigins('https://cms.example.com//'), ['https://cms.example.com']);
      assert.deepEqual(parseAllowedOrigins('https://cms.example.com:443'), ['https://cms.example.com']);
      assert.deepEqual(parseAllowedOrigins('http://localhost:03000'), ['http://localhost:3000']);
      assert.deepEqual(parseAllowedOrigins('https://a.example, https://A.example'), ['https://a.example']);

      const allowed = parseAllowedOrigins('https://cms.example.com/,http://localhost:3000');
      assert.ok(isOriginAllowed('https://cms.example.com', allowed));
      assert.ok(isOriginAllowed('HTTPS://CMS.EXAMPLE.COM', allowed), 'the Origin header is matched case-insensitively');
      assert.ok(isOriginAllowed('https://cms.example.com:443', allowed));
      assert.ok(!isOriginAllowed('https://cms.example.com:8443', allowed), 'a different port is a different origin');
      assert.ok(isOriginAllowed('http://localhost:3000', allowed));
      assert.ok(!isOriginAllowed('http://localhost:3001', allowed));
      assert.ok(!isOriginAllowed('http://localhost', allowed));
      assert.ok(!isOriginAllowed('http://cms.example.com', allowed), 'scheme must match');
    });

    it('wildcards: need a real subdomain, same scheme and port, and at least two labels after "*."', () => {
      const allowed = parseAllowedOrigins('https://*.example.com, https://*.preview.example.org:8443');
      assert.deepEqual(allowed, ['https://*.example.com', 'https://*.preview.example.org:8443']);
      assert.ok(isOriginAllowed('https://app.example.com', allowed));
      assert.ok(isOriginAllowed('https://a.b.example.com', allowed), 'one or more labels');
      assert.ok(!isOriginAllowed('https://example.com', allowed), 'the apex is not a subdomain');
      assert.ok(!isOriginAllowed('https://evilexample.com', allowed));
      assert.ok(!isOriginAllowed('https://app.example.com.evil.com', allowed));
      assert.ok(!isOriginAllowed('http://app.example.com', allowed));
      assert.ok(!isOriginAllowed('https://app.example.com:8443', allowed));
      assert.ok(isOriginAllowed('https://x.preview.example.org:8443', allowed));
      assert.ok(!isOriginAllowed('https://x.preview.example.org', allowed));
      assert.ok(!isOriginAllowed('https://*.example.com', allowed), 'a literal wildcard Origin is never valid');
      // Wildcard spanning a public suffix
      for (const bad of ['https://*.com', 'https://*.org', 'https://*.co.uk', 'https://*.com.au', 'https://*.co.in', 'https://*.ac.in']) {
        assert.deepEqual(parseAllowedOrigins(bad), [], `${bad} must be rejected`);
        assert.match(analyzeCorsOrigins(bad).invalid[0].reason, /public suffix/);
        assert.ok(!isOriginAllowed('https://evil.com', [bad]));
        assert.ok(!isOriginAllowed('https://anything.co.uk', [bad]));
      }
    });

    it('the Origin "null" and malformed Origins are never allowed, whatever is configured', () => {
      const allowed = parseAllowedOrigins('https://cms.example.com, https://*.example.com');
      for (const origin of ['null', '', '*', 'https://', 'https://cms.example.com/path', 'https://cms.example.com@evil.com', 'javascript:alert(1)', 'https://*.example.com']) {
        assert.equal(isOriginAllowed(origin, allowed), false, `"${origin}"`);
      }
      assert.equal(isOriginAllowed(undefined as any, allowed), false);
      assert.equal(isOriginAllowed(null as any, allowed), false);
    });

    it('boot check: "*" and other invalid entries are FATAL outside development, warnings in development', () => {
      for (const input of ['*', 'cms.example.com', 'https://*.com', 'https://cms.example.com, *', 'null', 'ftp://x.example']) {
        for (const nodeEnv of ['production', 'staging', 'prod', '']) {
          const result = checkBootEnvironment({ NODE_ENV: nodeEnv, JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: input });
          assert.ok(result.fatal.some((m) => /CORS_ORIGINS has invalid entries/.test(m)), `"${input}" in "${nodeEnv}" must be fatal`);
        }
        for (const nodeEnv of ['development', 'test']) {
          const result = checkBootEnvironment({ NODE_ENV: nodeEnv, JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: input });
          assert.deepEqual(result.fatal, []);
          assert.ok(result.warnings.some((m) => /CORS_ORIGINS has invalid entries/.test(m)));
        }
      }
      const star = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: '*' });
      assert.match(star.fatal[0], /"\*" \(a bare "\*" would allow every origin\)/);
    });

    it('boot check: empty is only a warning (closed policy); valid exact origins are clean', () => {
      for (const blank of [undefined, '', '   ', ',']) {
        const result = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: blank });
        assert.deepEqual(result.fatal, []);
        assert.ok(result.warnings.some((m) => /CORS_ORIGINS is not set/.test(m)));
      }
      const clean = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'https://cms.example.com/, https://*.example.org' });
      assert.deepEqual(clean, { fatal: [], warnings: [] });
    });

    it('boot check: plain http origins warn in production (localhost excepted); shared-host wildcards warn', () => {
      const http = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'http://cms.example.com' });
      assert.deepEqual(http.fatal, []);
      assert.ok(http.warnings.some((m) => /plain http/.test(m)));
      const local = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000' });
      assert.deepEqual(local.warnings, []);
      const shared = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'https://*.netlify.app' });
      assert.deepEqual(shared.fatal, []);
      assert.ok(shared.warnings.some((m) => /shared hosting domain/.test(m)));
    });
  });

  describe('TRUST_PROXY matrix', () => {
    const silently = <T>(run: () => T): T => {
      const warn = console.warn;
      console.warn = () => {};
      try {
        return run();
      } finally {
        console.warn = warn;
      }
    };

    it('unset / falsy values trust nothing without a warning', () => {
      for (const input of [undefined, '', '  ', 'false', 'FALSE', '0', ' 0 ']) {
        assert.deepEqual(analyzeTrustProxy(input), { value: false, warnings: [] }, JSON.stringify(input));
      }
    });

    it('hop counts: honoured up to 5, warned above 5, refused above the cap', () => {
      for (const hops of [1, 2, 3, 5]) assert.deepEqual(analyzeTrustProxy(String(hops)), { value: hops, warnings: [] });
      for (const hops of [6, 20]) {
        const result = analyzeTrustProxy(String(hops));
        assert.equal(result.value, hops);
        assert.equal(result.warnings.length, 1);
        assert.match(result.warnings[0], /trusts \d+ proxy hops/);
      }
      for (const huge of ['21', '100', '4294967295', '99999999999999999999999']) {
        const result = analyzeTrustProxy(huge);
        assert.equal(result.value, false, huge);
        assert.match(result.warnings[0], /NO proxy is trusted/);
      }
    });

    it('anything that trusts every address is refused', () => {
      for (const input of ['true', 'TRUE', 'True', '0.0.0.0/0', '::/0', 'loopback, 0.0.0.0/0', '0.0.0.0/1', '128.0.0.0/1', '::/6', '10.0.0.0/7']) {
        const result = analyzeTrustProxy(input);
        assert.equal(result.value, false, `"${input}" must be refused`);
        assert.equal(result.warnings.length, 1);
        assert.match(result.warnings[0], /ignored and NO proxy is trusted/);
      }
    });

    it('malformed values are refused instead of crashing Express', () => {
      for (const input of ['-1', '-0', '1.5', '+1', '1e3', '0x10', '1,2', 'abc', 'loopback,abc', '10.0.0.0/33', '10.0.0.0/-1', '10.0.0.0/8/8', '::1/129', 'localhost', ',', 'x'.repeat(500)]) {
        const result = analyzeTrustProxy(input);
        assert.equal(result.value, false, `"${input.slice(0, 20)}" must be refused`);
        assert.equal(result.warnings.length, 1);
      }
    });

    it('keywords, addresses and sane CIDR ranges are accepted and normalised', () => {
      assert.deepEqual(analyzeTrustProxy('loopback'), { value: 'loopback', warnings: [] });
      assert.deepEqual(analyzeTrustProxy('LoopBack,  UniqueLocal'), { value: 'loopback, uniquelocal', warnings: [] });
      assert.deepEqual(analyzeTrustProxy('10.0.0.0/8'), { value: '10.0.0.0/8', warnings: [] });
      assert.deepEqual(analyzeTrustProxy('loopback, 172.16.0.0/12, 192.168.1.5, ::1, fc00::/7'), {
        value: 'loopback, 172.16.0.0/12, 192.168.1.5, ::1, fc00::/7',
        warnings: [],
      });
    });

    it('parseTrustProxy returns the same value and prints each warning', () => {
      const printed: string[] = [];
      const warn = console.warn;
      console.warn = (message: string) => printed.push(String(message));
      try {
        assert.equal(parseTrustProxy('true'), false);
        assert.equal(parseTrustProxy('1'), 1);
      } finally {
        console.warn = warn;
      }
      assert.equal(printed.length, 1);
      assert.match(printed[0], /TRUST_PROXY/);
      assert.equal(silently(() => parseTrustProxy('0.0.0.0/0')), false);
    });

    it('boot check reports a refused TRUST_PROXY as a warning, in every environment', () => {
      for (const nodeEnv of ['production', 'development']) {
        const result = checkBootEnvironment({ NODE_ENV: nodeEnv, JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'https://cms.example.com', TRUST_PROXY: 'true' });
        assert.deepEqual(result.fatal, []);
        assert.ok(result.warnings.some((m) => /TRUST_PROXY/.test(m)));
      }
      const fine = checkBootEnvironment({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGINS: 'https://cms.example.com', TRUST_PROXY: '1' });
      assert.deepEqual(fine, { fatal: [], warnings: [] });
    });
  });

  describe('client IP source', () => {
    it('no source file outside tests reads x-forwarded-for / x-real-ip (or similar) headers directly', () => {
      const srcRoot = path.resolve(__dirname, '..');
      const files = sourceFiles(srcRoot);
      assert.ok(files.length > 50, 'the scan must actually find the source tree');
      const forbidden = /x-forwarded-(for|host|proto)|x-real-ip|x-client-ip|cf-connecting-ip|true-client-ip|x-cluster-client-ip|['"`]forwarded['"`]/i;
      const offenders = files
        .filter((file) => forbidden.test(stripComments(fs.readFileSync(file, 'utf8'))))
        .map((file) => path.relative(srcRoot, file));
      assert.deepEqual(offenders, [], 'use req.ip (it follows the trust proxy setting) instead of reading proxy headers');
    });

    it('the rate limiter and the audit logger key on req.ip', () => {
      const srcRoot = path.resolve(__dirname, '..');
      const limiter = fs.readFileSync(path.join(srcRoot, 'middleware', 'rateLimit.ts'), 'utf8');
      assert.match(stripComments(limiter), /req\.ip/);
      const logger = fs.readFileSync(path.join(srcRoot, 'middleware', 'activityLogger.ts'), 'utf8');
      assert.match(stripComments(logger), /req\.ip/);
    });

    it('the comment stripper keeps URL-like string literals (guards the scan above against false negatives)', () => {
      assert.match(stripComments("const a = 'https://x'; // x-forwarded-for\nconst h = 'x-real-ip';"), /x-real-ip/);
      assert.doesNotMatch(stripComments('// x-forwarded-for\n/* x-real-ip */ const a = 1;'), /x-forwarded|x-real/);
    });
  });
});
