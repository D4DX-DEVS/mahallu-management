import { test } from 'node:test';
import assert from 'assert/strict';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { sanitizeRequest } from '../middleware/sanitizeRequest';
import authRoutes from '../routes/authRoutes';
import User from '../models/User';

/**
 * These exercise the full real Express router (cors, body parsing,
 * sanitizeRequest, authMiddleware, the rate limiter, validation, controller)
 * for the endpoints the header's "Switch Role" control depends on —
 * GET /auth/available-accounts and POST /auth/switch-account — rather than
 * calling the controller functions directly. authAccountSwitch.test.ts
 * covers the controller logic in isolation; this file proves the same
 * behaviour survives the real HTTP/middleware chain end to end, including
 * the account-takeover regression and session revocation.
 */

const startServer = async () => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
  app.use(sanitizeRequest);
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, port };
};

/** A session token. `provenPhone` is only present on a session that signed in with an OTP. */
const tokenFor = (userId: string, opts: { provenPhone?: string; tv?: number } = {}) =>
  jwt.sign(
    { userId, isSuperAdmin: false, ...(opts.tv !== undefined ? { tv: opts.tv } : {}), ...(opts.provenPhone ? { pp: opts.provenPhone } : {}) },
    process.env.JWT_SECRET as string,
    { expiresIn: '5m' }
  );

test('GET /auth/available-accounts: an OTP-proven multi-role identity (2 active siblings) gets both roles over real HTTP', async () => {
  const originalUserFindById = User.findById;
  const originalUserFind = User.find;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'mahallUserId', phone: '918000000000', status: 'active', role: 'mahall' }),
  });
  (User as any).find = async () => [
    { _id: 'mahallUserId', phone: '918000000000', status: 'active', role: 'mahall', tenantId: null, instituteId: null },
    { _id: 'memberUserId', phone: '918000000000', status: 'active', role: 'member', tenantId: null, instituteId: null },
  ];

  const { server, port } = await startServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/available-accounts`, {
      headers: { Authorization: `Bearer ${tokenFor('mahallUserId', { provenPhone: '918000000000' })}` },
    });
    const body: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.accounts.length, 2);
    const otherRoles = body.data.accounts.filter((a: any) => !a.isCurrent).map((a: any) => a.role);
    assert.deepEqual(otherRoles, ['member']);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
    (User as any).find = originalUserFind;
  }
});

test('GET /auth/available-accounts: a single-role identity gets back only itself (no switch-role capability)', async () => {
  const originalUserFindById = User.findById;
  const originalUserFind = User.find;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'onlyUserId', phone: '919999999999', status: 'active', role: 'mahall' }),
  });
  (User as any).find = async () => [
    { _id: 'onlyUserId', phone: '919999999999', status: 'active', role: 'mahall', tenantId: null, instituteId: null },
  ];

  const { server, port } = await startServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/available-accounts`, {
      headers: { Authorization: `Bearer ${tokenFor('onlyUserId', { provenPhone: '919999999999' })}` },
    });
    const body: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.accounts.length, 1);
    assert.equal(body.data.accounts[0].isCurrent, true);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
    (User as any).find = originalUserFind;
  }
});

test('GET /auth/available-accounts: a password-only session (no proven phone) is offered nothing over real HTTP', async () => {
  const originalUserFindById = User.findById;
  const originalUserFind = User.find;
  let siblingsQueried = false;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'mahallUserId', phone: '918000000000', status: 'active', role: 'mahall' }),
  });
  (User as any).find = async () => {
    siblingsQueried = true;
    return [];
  };

  const { server, port } = await startServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/available-accounts`, {
      headers: { Authorization: `Bearer ${tokenFor('mahallUserId')}` },
    });
    const body: any = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body.data.accounts, []);
    assert.equal(siblingsQueried, false);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
    (User as any).find = originalUserFind;
  }
});

test('POST /auth/switch-account: a real sibling account switch succeeds over real HTTP for an OTP-proven session', async () => {
  const originalUserFindById = User.findById;
  (User as any).findById = (id: string) => ({
    select: async () => {
      if (id === 'callerId') return { _id: 'callerId', phone: '918000000000', status: 'active', role: 'mahall' };
      return {
        _id: 'siblingId',
        phone: '918000000000',
        status: 'active',
        role: 'member',
        tenantId: null,
        instituteId: null,
        isSuperAdmin: false,
        save: async () => {},
      };
    },
  });

  const { server, port } = await startServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/switch-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('callerId', { provenPhone: '918000000000' })}` },
      body: JSON.stringify({ targetUserId: '507f1f77bcf86cd799439011' }),
    });
    const body: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.user.role, 'member');
    assert.ok(body.data.token);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
  }
});

test('POST /auth/switch-account: a target on an unrelated phone is rejected over real HTTP', async () => {
  const originalUserFindById = User.findById;
  (User as any).findById = (id: string) => ({
    select: async () => {
      if (id === 'callerId') return { _id: 'callerId', phone: '918000000000', status: 'active', role: 'mahall' };
      return { _id: 'strangerId', phone: '917777777777', status: 'active', role: 'mahall' };
    },
  });

  const { server, port } = await startServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/switch-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('callerId', { provenPhone: '918000000000' })}` },
      body: JSON.stringify({ targetUserId: '507f1f77bcf86cd799439099' }),
    });
    const body: any = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.success, false);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
  }
});

test('TAKEOVER REGRESSION over real HTTP: an account whose phone was edited to a victim\'s number cannot switch into the victim', async () => {
  const originalUserFindById = User.findById;
  (User as any).findById = (id: string) => ({
    select: async () => {
      // The attacker's own account, its stored phone now rewritten to the victim's number.
      if (id === 'attackerId') return { _id: 'attackerId', phone: '919111111111', status: 'active', role: 'survey', tenantId: null };
      return { _id: 'victimId', phone: '919111111111', status: 'active', role: 'mahall', isSuperAdmin: false, tenantId: null, save: async () => {} };
    },
  });

  const { server, port } = await startServer();
  try {
    // Password-only session: no proven phone at all.
    const noProof = await fetch(`http://127.0.0.1:${port}/api/auth/switch-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('attackerId')}` },
      body: JSON.stringify({ targetUserId: '507f1f77bcf86cd799439011' }),
    });
    assert.equal(noProof.status, 403);
    assert.equal(((await noProof.json()) as any).code, 'OTP_REQUIRED');

    // OTP session on the attacker's ORIGINAL number: the victim's number was never proven.
    const proofOfOwnNumber = await fetch(`http://127.0.0.1:${port}/api/auth/switch-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('attackerId', { provenPhone: '918000000000' })}` },
      body: JSON.stringify({ targetUserId: '507f1f77bcf86cd799439011' }),
    });
    const body: any = await proofOfOwnNumber.json();
    assert.equal(proofOfOwnNumber.status, 403);
    assert.equal(body.data, undefined);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
  }
});

test('SESSION REVOCATION over real HTTP: a token issued before the account\'s tokenVersion moved on is rejected', async () => {
  const originalUserFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'callerId', phone: '918000000000', status: 'active', role: 'mahall', tokenVersion: 2 }),
  });

  const { server, port } = await startServer();
  try {
    const stale = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenFor('callerId', { tv: 1 })}` },
    });
    assert.equal(stale.status, 401);

    const current = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenFor('callerId', { tv: 2 })}` },
    });
    assert.equal(current.status, 200);
  } finally {
    server.close();
    (User as any).findById = originalUserFindById;
  }
});
