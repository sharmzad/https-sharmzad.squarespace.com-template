---
name: ZeptoMail credit exhaustion
description: What a ZeptoMail LE_102 error means and how to diagnose it quickly
---

When all transactional emails fail with 503, the first thing to test is the ZeptoMail API directly:

```bash
cd backend && node -e "
require('dotenv').config();
const axios = require('axios');
axios.post('https://api.zeptomail.com/v1.1/email', {
  from: { address: process.env.EMAIL_USER, name: 'Test' },
  to: [{ email_address: { address: 'test@example.com', name: 'Test' } }],
  subject: 'Test', htmlbody: '<p>Test</p>'
}, {
  headers: { 'Authorization': 'Zoho-enczapikey ' + process.env.ZEPTOMAIL_API_KEY },
  timeout: 30000
}).then(r => console.log('OK', r.status))
  .catch(e => console.log('ERR', e.response?.status, JSON.stringify(e.response?.data)));
"
```

Error `LE_102 / Credit exhausted` → billing issue, not a code issue. User must top up at zeptomail.com.

**Why:** ZeptoMail returns HTTP 429 (not 402) for exhausted credits, so it looks like a rate-limit error from the outside.

**How to apply:** If a user reports "forgot password / verification emails not working", run this diagnostic before touching any code.
