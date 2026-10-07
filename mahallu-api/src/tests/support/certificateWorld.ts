import mongoose from 'mongoose';
import Certificate from '../../models/Certificate';
import CertificateClaim from '../../models/CertificateClaim';
import Counter from '../../models/Counter';
import DocumentFile from '../../models/DocumentFile';
import Tenant from '../../models/Tenant';
import { NikahRegistration } from '../../models/Registration';
import { setStorageClientForTests } from '../../services/uploadService';
import { certificateIssueTuning } from '../../services/certificateService';
import { installFake, Installed, oid } from './fakeMongo';

/**
 * Stateful world for the certificate issue / orphan tests: the Certificate, CertificateClaim, Counter
 * and DocumentFile collections are in-memory fakes that enforce the REAL schema's unique indexes
 * (including the partial issueKey index) and atomic findOneAndUpdate, and the object storage client is
 * an in-memory fake injected into uploadService (nothing ever touches the network or a database).
 */
export interface StorageFake {
  /** keys currently stored */
  objects: Set<string>;
  puts: string[];
  /** delete requests received (including repeats and failures) */
  deletes: string[];
  failPut: Array<Error | null>;
  failDelete: (key: string) => Error | null;
  /** one entry per upcoming put: awaited (after the key is chosen, before the object is stored) so a test can pause an upload */
  gatePut: Array<((key: string) => Promise<void>) | null>;
  /** every command that reached the client, e.g. 'PutObjectCommand' */
  commands: string[];
  /** the input of every Put command (Key, ACL, ContentType ...), body excluded */
  putInputs: Array<Record<string, unknown>>;
}

export interface CertificateWorld {
  certs: Installed;
  claims: Installed;
  counters: Installed;
  documents: Installed;
  storage: StorageFake;
  prefix: string;
  restore: () => void;
}

export function makeCertificateWorld(): CertificateWorld {
  const certs = installFake(Certificate);
  const claims = installFake(CertificateClaim);
  const counters = installFake(Counter);
  const documents = installFake(DocumentFile);

  const originals: Array<[any, string, any]> = [];
  const stub = (target: any, key: string, impl: any) => {
    originals.push([target, key, target[key]]);
    target[key] = impl;
  };
  stub(Tenant, 'findById', () => ({ select: async () => ({ name: 'Test Mahallu' }) }));
  stub(NikahRegistration, 'findOne', async () => ({
    status: 'approved',
    groomName: 'G',
    brideName: 'B',
    nikahDate: new Date(2026, 5, 1),
  }));

  const storage: StorageFake = {
    objects: new Set(),
    puts: [],
    deletes: [],
    failPut: [],
    failDelete: () => null,
    gatePut: [],
    commands: [],
    putInputs: [],
  };
  setStorageClientForTests({
    send: async (command: any) => {
      const name = command?.constructor?.name as string;
      const key = command?.input?.Key as string;
      storage.commands.push(name);
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (name === 'PutObjectCommand') {
        const gate = storage.gatePut.shift();
        if (gate) await gate(key);
        const planned = storage.failPut.shift();
        if (planned) throw planned;
        storage.puts.push(key);
        const { Body: _body, ...rest } = command.input || {};
        storage.putInputs.push(rest);
        storage.objects.add(key);
        return {};
      }
      if (name === 'DeleteObjectCommand') {
        storage.deletes.push(key);
        const failure = storage.failDelete(key);
        if (failure) throw failure;
        storage.objects.delete(key); // deleting a missing object is a success, like S3
        return {};
      }
      throw new Error(`unexpected storage command ${name}`);
    },
  });

  const saved = { ...certificateIssueTuning };
  // The wait must never be what ends a test: rendering a real PDF (pdfkit reads its font files
  // synchronously) can take seconds on a loaded machine, and a waiter that gave up early turned a
  // slow-but-correct owner into a spurious 409 (and left its in-flight owners to write into the NEXT
  // test's storage). Tests that exercise the timeout set a small waitMs themselves.
  certificateIssueTuning.waitMs = 60_000;
  certificateIssueTuning.pollMs = 5;
  certificateIssueTuning.staleMs = 120_000;

  return {
    certs,
    claims,
    counters,
    documents,
    storage,
    prefix: `${process.env.DO_SPACES_FOLDER || 'uploads'}/documents/`,
    restore: () => {
      Object.assign(certificateIssueTuning, saved);
      setStorageClientForTests(null);
      originals.reverse().forEach(([target, key, value]) => (target[key] = value));
      documents.restore();
      counters.restore();
      claims.restore();
      certs.restore();
    },
  };
}

export const newId = () => String(oid());
export const tenantOid = () => new mongoose.Types.ObjectId();

/** Record console.error output for the duration of a test; returns the lines and a restore function. */
export function captureConsoleError(): { lines: string[]; restore: () => void } {
  const real = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : JSON.stringify(a))).join(' '));
  };
  return { lines, restore: () => { console.error = real; } };
}
