# Edge rate limiting requirement for multi-instance production

Audience: whoever deploys the API. Names of variables only; no secrets or real hosts appear here.
Hostnames below (`api.example.com`) are placeholders.

## What the API does by itself

`src/middleware/rateLimit.ts` rate limits these endpoints **in process memory**:

| Endpoint | Limiter | Key |
|---|---|---|
| `POST /api/auth/login` | login | client IP + identifier in the body |
| `POST /api/auth/send-otp` | send OTP | client IP + phone number |
| `POST /api/auth/verify-otp` | verify OTP | client IP + phone number |
| `POST /api/auth/select-account` | select account | client IP + the (unverified) phone claim of the role-selection token |
| `POST /api/auth/switch-account`, `POST /api/auth/impersonate` | switch account | client IP + authenticated user id |
| `GET /api/verify/:certificateNo` | public verify | client IP only |

Limits (per window): login 10 per 5 minutes, send OTP 5 per 10 minutes (plus a 60-second cooldown per phone in
the database), verify OTP 8 per 2 minutes (plus a 5-attempt lock per code), select account 10 per 5 minutes,
switch account / impersonate 10 per 5 minutes, public verify 30 per minute. **Each limiter has its own
counter store**: attempts at one endpoint do not use up another endpoint's budget. The role-selection
token is valid for 5 minutes and is not single-use; replay is limited to the accounts of the phone that
proved the OTP and is rate limited.

Consequences you must plan for:

1. **Per instance.** Counters live in each Node process. With N instances behind a load balancer a
   client can make up to N times the limit, and every restart or deploy resets the counters. The
   in-process limiter is a brake on scripted guessing, not a quota. Redis is deliberately NOT used.
2. **Keyed by `req.ip`.** The key is Express `req.ip`, which follows the `trust proxy` setting
   (`TRUST_PROXY`). The API never reads `X-Forwarded-For` / `X-Real-IP` itself (a test fails the build
   if any source file does).
3. **Behind a reverse proxy without `TRUST_PROXY`, every client shares ONE bucket.** `req.ip` is then
   the proxy's address for everybody, so the first 5 OTP requests per phone are fine but, for the
   IP-only public verify limiter, 30 requests per minute across **all** visitors is the whole budget
   and the audit log records the proxy address for every action. Set `TRUST_PROXY` to the real number
   of proxies.
4. **`TRUST_PROXY` too high is worse than too low.** Trusting more hops than exist (or a range that
   contains clients) lets a caller pick the IP the limiter and the audit log see, i.e. evade the limit
   by sending a different `X-Forwarded-For` each request. The API refuses `true`, `0.0.0.0/0`,
   `::/0`, other huge ranges, malformed values and hop counts above 20 (it logs a warning and trusts
   no proxy), and warns above 5. It cannot know how many proxies you really have; count them.

## Requirement for production

When more than one API instance runs, or the API is reachable from the internet at all, enforce a hard
limit at the edge (reverse proxy, CDN/WAF or load balancer) **per client IP** on at least:

- `/api/auth/*` (login and OTP endpoints; OTP sends cost money and reach a person's phone),
- `/api/verify/*` (public, unauthenticated certificate lookup: enumeration target).

Keep the in-process limiter enabled as a second layer; it keys on phone/identifier as well, which an
IP-only edge rule cannot do.

## Nginx example

Adjust rates to your traffic. `$binary_remote_addr` is the TCP peer address the edge sees; if Nginx
itself sits behind a CDN or load balancer, restore the real client address first with the `realip`
module (`set_real_ip_from <your CDN or LB range>; real_ip_header X-Forwarded-For;`) and list ONLY
trusted ranges, otherwise clients can forge the key.

```nginx
# http {} context
limit_req_zone $binary_remote_addr zone=api_auth:10m   rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_verify:10m rate=30r/m;
limit_req_status 429;

server {
    listen 443 ssl;
    server_name api.example.com;

    location /api/auth/ {
        limit_req zone=api_auth burst=5 nodelay;
        proxy_pass http://mahallu_api_upstream;
        proxy_set_header X-Forwarded-For $remote_addr;   # overwrite: never append a client-sent value
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }

    location /api/verify/ {
        limit_req zone=api_verify burst=10 nodelay;
        proxy_pass http://mahallu_api_upstream;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://mahallu_api_upstream;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

With exactly this one Nginx in front of the API, set `TRUST_PROXY=1`. Overwriting
`X-Forwarded-For` with `$remote_addr` (instead of `$proxy_add_x_forwarded_for`) makes the header
unspoofable at the first hop; if you do append, the API still reads only the rightmost trusted hop.

Other edges: Cloudflare rate limiting rules, an AWS WAF rate-based rule, or the load balancer's own
throttling work the same way. Count every hop between the internet and the API (CDN + load balancer +
Nginx = 3) when setting `TRUST_PROXY`, and restrict the API's network access to those proxies so
nobody can reach it directly with a forged header.

## Checklist

- [ ] Edge limit per IP on `/api/auth/*` and `/api/verify/*`.
- [ ] `TRUST_PROXY` equals the real number of proxies (or the exact proxy addresses/CIDR).
- [ ] The API port is not reachable from the internet except through the proxy.
- [ ] After deploy, confirm client IPs in the activity log are real addresses, not the proxy's.
- [ ] If you outgrow this (many instances, strict quotas), move the limiter store to Redis; that is a
      code change and is intentionally out of scope today.
