/**
 * An id the client invents for one logical request, so the server can tell a
 * retry from a second, intentional request ("idempotency key").
 *
 * `crypto.randomUUID` only exists in secure contexts (https or localhost), so a
 * page served over plain http on a LAN has to fall back: first to
 * `getRandomValues`, and only as a last resort to `Math.random`.
 */
export function newClientRequestId(cryptoSource: Crypto | undefined = globalThis.crypto): string {
  if (cryptoSource && typeof cryptoSource.randomUUID === 'function') {
    return cryptoSource.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoSource && typeof cryptoSource.getRandomValues === 'function') {
    cryptoSource.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 version 4: set the version and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The keys a form holds for payments it is still trying to save, by payer + date. */
export type RequestIdStore = Map<string, { id: string; amount: number }>;

/**
 * The idempotency key for one payment (`key` is typically payer + date).
 *
 * The same key is handed back on every retry, so a payment that actually saved
 * the first time is returned instead of created twice. If the amount has changed
 * since the key was issued, a new key is made: the server answers 409 ("already
 * used for a different payment") when one id is reused with a different amount.
 * Drop the entry (`store.delete(key)`) once the payment is known to be saved.
 */
export function requestIdFor(store: RequestIdStore, key: string, amount: number): string {
  const held = store.get(key);
  if (held && held.amount === amount) return held.id;
  const id = newClientRequestId();
  store.set(key, { id, amount });
  return id;
}
