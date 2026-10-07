/**
 * Environment gates that must FAIL CLOSED.
 *
 * `NODE_ENV !== 'production'` treated every other value ("staging", "prod", "Production", a typo)
 * as development, and development mode returns one-time codes in API responses. The check is now an
 * explicit allow-list: only the exact values below count as a development environment, and anything
 * else - including an unexpected or mistyped value - gets production behaviour.
 */
const DEV_ENVIRONMENTS = new Set(['development', 'test']);

export const isDevelopmentEnvironment = (): boolean =>
  DEV_ENVIRONMENTS.has(String(process.env.NODE_ENV ?? ''));
