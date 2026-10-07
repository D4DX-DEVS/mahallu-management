import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import cors from 'cors';
import express from 'express';
import { buildCorsOptions } from '../config/security';

describe('[isolated] corsExposedHeaders', () => {

/**
 * The export endpoint sets `X-Export-Truncated: true` when it hits its row cap. Browser JS can only
 * read a non-safelisted response header if CORS exposes it.
 */

test('buildCorsOptions exposes X-Export-Truncated and keeps the rest of the policy', () => {
  const options = buildCorsOptions({ CORS_ORIGINS: 'https://cms.example.com' }, false);
  assert.deepEqual(options.exposedHeaders, ['X-Export-Truncated']);
  assert.equal(options.credentials, false);
  assert.equal(options.maxAge, 600);
});

test('a real cross-origin response from an allowed origin carries Access-Control-Expose-Headers', async () => {
  const app = express();
  app.use(cors(buildCorsOptions({ CORS_ORIGINS: 'https://cms.example.com' }, false)));
  app.get('/export', (_req, res) => {
    res.setHeader('X-Export-Truncated', 'true');
    res.json({ ok: true });
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const get = (origin: string) =>
      new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
        http
          .get({ host: '127.0.0.1', port, path: '/export', headers: { Origin: origin } }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.headers));
          })
          .on('error', reject);
      });

    const allowed = await get('https://cms.example.com');
    assert.equal(allowed['access-control-allow-origin'], 'https://cms.example.com');
    assert.equal(allowed['access-control-expose-headers'], 'X-Export-Truncated');
    assert.equal(allowed['x-export-truncated'], 'true');

    const denied = await get('https://evil.example');
    assert.equal(denied['access-control-allow-origin'], undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
});
