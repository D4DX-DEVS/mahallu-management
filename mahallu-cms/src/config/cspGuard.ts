/**
 * Build-time guard for the Content-Security-Policy in netlify.toml.
 *
 * netlify.toml carries a placeholder (`https://REPLACE_WITH_API_ORIGIN`) in `connect-src` because the
 * API origin is only known per deployment. Left in place, the site deploys fine and then the browser
 * blocks every API call with nothing in the build log to say why. `vite.config.ts` runs
 * `checkCspForBuild` on every production build and fails it.
 *
 * Pure (no fs / env access) and free of browser and Vite APIs so it can be verified with a throwaway
 * node script; the CMS has no frontend test runner. `vite.config.ts` does the file reading.
 */

export const CSP_API_PLACEHOLDER = 'REPLACE_WITH_API_ORIGIN';
export const CSP_OPT_OUT_VARIABLE = 'VITE_ALLOW_CSP_PLACEHOLDER';

export interface CspGuardInput {
  /** Text of the file that carries the deployed CSP (netlify.toml); undefined when it could not be read. */
  cspFileText: string | undefined;
  /** Display name of that file in messages. */
  cspFileName?: string;
  /** VITE_API_URL as configured for this build. */
  apiUrl: string | undefined;
  /** Value of VITE_ALLOW_CSP_PLACEHOLDER. Only the exact string "true" opts out. */
  allowPlaceholder: string | undefined;
}

export interface CspGuardResult {
  errors: string[];
  warnings: string[];
}

/** Drops whole-line TOML comments (the placeholder is mentioned in prose there). */
const withoutComments = (text: string): string =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

/** Every `Content-Security-Policy = "..."` value in a TOML file (comment lines ignored). */
export const extractCspPolicies = (fileText: string): string[] => {
  const policies: string[] = [];
  const pattern = /Content-Security-Policy\s*=\s*"((?:\\.|[^"\\])*)"/gi;
  let match: RegExpExecArray | null;
  const text = withoutComments(fileText);
  while ((match = pattern.exec(text)) !== null) policies.push(match[1]);
  return policies;
};

const directiveSources = (policy: string, name: string): string[] | undefined => {
  for (const directive of policy.split(';')) {
    const parts = directive.trim().split(/\s+/);
    if (parts[0]?.toLowerCase() === name) return parts.slice(1);
  }
  return undefined;
};

/**
 * Sources that govern fetch/XHR for one policy: `connect-src`, else `default-src`, else undefined
 * (the policy does not restrict connections at all).
 */
export const connectSources = (policy: string): string[] | undefined =>
  directiveSources(policy, 'connect-src') ?? directiveSources(policy, 'default-src');

/** `https://api.example.com/api` -> `https://api.example.com`; undefined when it is not an http(s) URL. */
export const originOf = (apiUrl: string | undefined): string | undefined => {
  try {
    const parsed = new URL(String(apiUrl ?? '').trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
};

/** Does one CSP source expression permit requests to `origin`? */
export const cspSourceAllows = (source: string, origin: string): boolean => {
  const expression = source.trim().toLowerCase().replace(/\/+$/, '');
  const target = new URL(origin);
  if (expression === '*') return target.protocol === 'https:' || target.protocol === 'http:';
  if (expression === 'https:' || expression === 'http:') return expression === target.protocol;
  const match = /^(https?):\/\/(\*\.)?([a-z0-9.-]+)(?::(\d+|\*))?$/.exec(expression);
  if (!match) return false;
  const [, scheme, wildcard, host, port] = match;
  if (`${scheme}:` !== target.protocol) return false;
  const defaultPort = scheme === 'https' ? '443' : '80';
  const targetPort = target.port || defaultPort;
  if (port !== '*' && (port ?? defaultPort) !== targetPort) return false;
  if (wildcard) return target.hostname.endsWith(`.${host}`);
  return target.hostname === host;
};

export const checkCspForBuild = (input: CspGuardInput): CspGuardResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileName = input.cspFileName ?? 'netlify.toml';
  const optedOut = String(input.allowPlaceholder ?? '').trim() === 'true';
  const report = (message: string) => {
    if (optedOut) warnings.push(`${message} (allowed because ${CSP_OPT_OUT_VARIABLE}=true; do NOT deploy this build)`);
    else errors.push(message);
  };
  const optOutHint = `For a local verification build only, set ${CSP_OPT_OUT_VARIABLE}=true.`;
  const originHint = 'the scheme + host[:port] of VITE_API_URL, no path, e.g. https://api.example.com';

  if (input.cspFileText === undefined) {
    warnings.push(`CSP guard: ${fileName} was not found, so the Content-Security-Policy could not be checked.`);
    return { errors, warnings };
  }

  const active = withoutComments(input.cspFileText);
  if (active.includes(CSP_API_PLACEHOLDER)) {
    report(
      `CSP guard: ${fileName} still contains the placeholder "${CSP_API_PLACEHOLDER}". ` +
        `Deployed as is, the browser would block every API call. ` +
        `Fix: replace https://${CSP_API_PLACEHOLDER} in the Content-Security-Policy of ${fileName} with the real API origin (${originHint}). ${optOutHint}`
    );
  }

  const policies = extractCspPolicies(input.cspFileText);
  if (policies.length === 0) {
    warnings.push(`CSP guard: no Content-Security-Policy header found in ${fileName}.`);
    return { errors, warnings };
  }

  const origin = originOf(input.apiUrl);
  if (origin && !active.includes(CSP_API_PLACEHOLDER)) {
    // With the placeholder still present the placeholder error above already covers this.
    for (const policy of policies) {
      const sources = connectSources(policy);
      if (!sources) continue; // no connect-src: default-src governs and is not a concrete connect list
      if (!sources.some((source) => cspSourceAllows(source, origin))) {
        report(
          `CSP guard: connect-src in ${fileName} does not allow the API origin ${origin} (from VITE_API_URL). ` +
            `The browser would block every API call. Fix: add ${origin} to connect-src in ${fileName}. ${optOutHint}`
        );
        break;
      }
    }
  }
  return { errors, warnings };
};
