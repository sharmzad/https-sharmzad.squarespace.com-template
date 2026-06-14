---
name: Rate limiting behind Cloudflare
description: How to correctly key rate limiters when the app sits behind Cloudflare
---

With Cloudflare → Replit LB → Express, `trust proxy: 1` makes `req.ip` the Cloudflare edge IP — shared by all users on that edge node. All auth rate limits then apply to that one shared IP, causing legitimate users to get 429 errors after the first few requests.

**Fix:** Use `CF-Connecting-IP` (always set by Cloudflare to the real client IP) as the rate-limiter key, with `ipKeyGenerator` to normalize IPv6:

```javascript
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const getRealIp = (req) => {
  const ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    '0.0.0.0';
  return ipKeyGenerator(ip);
};

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 15, keyGenerator: getRealIp, ... });
const strictLimiter = rateLimit({ windowMs: 60*60*1000, max: 20, keyGenerator: getRealIp, ... });
```

**Why:** Omitting `ipKeyGenerator` causes a `ERR_ERL_KEY_GEN_IPV6` validation warning from express-rate-limit (non-fatal but noisy). The app still runs but the warning appears on every startup.

**How to apply:** Any new rate limiter on this project must use `getRealIp` as its `keyGenerator`.
