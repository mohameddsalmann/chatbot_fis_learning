# Production Deployment Guide

## ✅ Implemented Production Features

### 1. **Async Job System with TTL**
- Jobs return immediately with `job_id`, process in background
- 30-minute TTL with automatic cleanup every 5 minutes
- Prevents memory leaks from abandoned jobs

### 2. **Rate Limiting & Security**
- **IP-based rate limit**: 5 video requests per 10 minutes per IP
- **File size limits**: 20MB max (frontend + backend validation)
- Protects against credit burning and resource exhaustion

### 3. **Retry Logic with Exponential Backoff**
- OpenRouter LLM calls retry up to 2 times with 2s, 4s delays
- Handles transient 429 rate limits silently
- Reduces user-facing errors from temporary API issues

### 4. **Comprehensive Validation**
- **PDF quality checks**: Detects scanned/corrupted PDFs, minimum 50 chars
- **Script validation**: 50-400 words, 20-180 second duration estimates
- **Gibberish detection**: Requires 30% alphanumeric content (supports Arabic)

### 5. **Structured Logging**
- JSON-formatted logs with timestamps, job IDs, events
- Tracks: job creation, LLM requests, errors, durations
- Example: `{"timestamp":"2026-02-17T08:00:00Z","jobId":"job_123","event":"llm_success","words":150}`

### 6. **Job Recovery (localStorage)**
- Saves `job_id` to localStorage on submission
- On page reload, prompts user to resume pending jobs (within 30 min)
- Prevents loss of work if user accidentally closes tab

---

## 🚨 Critical Next Steps for Production

### **1. Persistent Storage (HIGH PRIORITY)**

**Problem**: In-memory jobs lost on server restart/crash (common on Vercel, Render, Railway)

**Solutions**:

#### Option A: Redis (Recommended for serverless)
```bash
npm install ioredis
```

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Replace Map operations
await redis.setex(`job:${jobId}`, 1800, JSON.stringify(jobData)); // 30min TTL
const job = JSON.parse(await redis.get(`job:${jobId}`));
```

**Providers**: Upstash (free tier), Redis Cloud, Railway Redis

#### Option B: SQLite (Simple, file-based)
```bash
npm install better-sqlite3
```

```javascript
const Database = require('better-sqlite3');
const db = new Database('jobs.db');

db.exec(`CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  data TEXT,
  created_at INTEGER,
  expires_at INTEGER
)`);
```

#### Option C: PostgreSQL/MongoDB (Full production)
- Use Supabase, Neon, or MongoDB Atlas
- Add job history, analytics, user tracking

---

### **2. D-ID Webhooks (Eliminates Polling)**

**Current**: Poll every 2s for up to 10 minutes  
**Better**: D-ID calls your webhook when video is ready

```javascript
// In /api/doc-to-video
body: JSON.stringify({
  presenter_id: presenterId,
  script: { type: "text", input: scriptText },
  webhook: `${process.env.PUBLIC_URL}/api/did-webhook`
})

// New endpoint
app.post("/api/did-webhook", express.json(), (req, res) => {
  const { id, status, result_url } = req.body;
  
  // Update job in Redis/DB
  updateJob(id, { status: "completed", video_url: result_url });
  
  res.sendStatus(200);
});
```

---

### **3. Cost Tracking & Monitoring**

```javascript
// Add to processVideoJob
const costs = {
  openrouter: 0.0001 * scriptText.split(/\s+/).length, // Estimate
  did_clips: 0.05, // Per video
  did_expressives: 0.10
};

logJobEvent(jobId, "cost_estimate", { 
  total: costs.openrouter + (apiType === "clips" ? costs.did_clips : costs.did_expressives),
  breakdown: costs
});
```

**Monitoring Tools**:
- **Sentry**: Error tracking (`npm install @sentry/node`)
- **LogTail/Datadog**: Centralized logging
- **Prometheus + Grafana**: Metrics dashboard

---

### **4. Concurrent Job Limits**

```javascript
// Track jobs per IP
const activeJobsByIp = new Map();

// In /api/doc-to-video
const userJobs = activeJobsByIp.get(clientIp) || 0;
if (userJobs >= 2) {
  return res.status(429).json({ 
    error: "Maximum 2 concurrent video jobs per user. Please wait for completion." 
  });
}
activeJobsByIp.set(clientIp, userJobs + 1);

// Decrement on completion/failure
```

---

### **5. Arabic Script Validation Adjustment**

**Current**: 150 words/min (English-centric)  
**Better**: Language-aware validation

```javascript
function detectLanguage(text) {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars / text.length > 0.3 ? 'ar' : 'en';
}

function validateScriptLength(script) {
  const lang = detectLanguage(script);
  const words = script.trim().split(/\s+/).length;
  
  // Arabic is denser: ~120 words/min vs 150 for English
  const wpm = lang === 'ar' ? 120 : 150;
  const estimatedSeconds = (words / wpm) * 60;
  
  const limits = lang === 'ar' 
    ? { min: 40, max: 320 }  // Adjusted for Arabic
    : { min: 50, max: 400 };
  
  if (words < limits.min || words > limits.max) {
    return { valid: false, error: `Script ${lang === 'ar' ? '(Arabic)' : ''} out of range`, words, estimatedSeconds };
  }
  
  return { valid: true, words, estimatedSeconds };
}
```

---

## 📊 Environment Variables Checklist

```bash
# Required
DID_API_KEY=your_d_id_api_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional but recommended
REDIS_URL=redis://...
PUBLIC_URL=https://yourdomain.com
SENTRY_DSN=https://...

# D-ID Avatar IDs (customize)
DID_CLIPS_PROFESSIONAL=v2_public_Amber@0zSz8kflCN
DID_EXPRESSIVE_PROFESSIONAL=public_amber_casual@avt_PfMblk
# ... (add others as needed)
```

---

## 🚀 Deployment Platforms

### **Vercel** (Serverless)
- ✅ Auto-scaling, CDN, free tier
- ⚠️ 10s function timeout (use webhooks, not polling)
- ⚠️ Stateless (MUST use Redis/DB for jobs)

### **Railway** (Containers)
- ✅ Persistent storage, longer timeouts
- ✅ Built-in Redis add-on
- ✅ Good for polling-based approach

### **Render** (Containers)
- ✅ Free tier, persistent disk
- ✅ Background workers support
- ⚠️ Free tier spins down after inactivity

---

## 📝 Logging Best Practices

Current structured logs capture:
- Job lifecycle: `job_created`, `job_failed`, `job_completed`
- LLM events: `llm_request`, `llm_success`, `llm_error`
- Metadata: IP, file size, duration, costs

**Recommended additions**:
```javascript
logJobEvent(jobId, "did_video_request", { apiType, avatarId });
logJobEvent(jobId, "did_polling_start", { endpoint: pollEndpoint });
logJobEvent(jobId, "did_video_ready", { duration: pollAttempts * 2 });
```

**Query examples**:
```bash
# Find all failed jobs
grep '"event":"job_failed"' server.log | jq .

# Calculate average LLM response time
grep '"event":"llm_success"' server.log | jq -r '.duration' | awk '{sum+=$1} END {print sum/NR}'
```

---

## 🔒 Security Hardening

1. **API Key Rotation**: Rotate OpenRouter/D-ID keys monthly
2. **CORS**: Restrict to your domain in production
3. **Helmet**: Already enabled, consider CSP rules
4. **Input Sanitization**: Already validates PDF mime types, file sizes
5. **Rate Limit Headers**: Already returns `X-RateLimit-*` headers

---

## 📈 Performance Optimization

1. **PDF Parsing**: Currently loads full file to memory. For large PDFs:
   ```javascript
   const pdfText = (await extractPdfText(pdfBuffer)).slice(0, 50000); // Limit chars
   ```

2. **Script Caching**: Cache LLM responses for identical PDFs (use hash)
   ```javascript
   const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
   const cached = await redis.get(`script:${pdfHash}`);
   if (cached) return JSON.parse(cached);
   ```

3. **CDN for Videos**: D-ID URLs expire in 24h. Download and serve from your CDN/S3

---

## 🧪 Testing Checklist

- [ ] Upload 20MB PDF (should succeed)
- [ ] Upload 21MB PDF (should fail with clear error)
- [ ] Submit 6 videos from same IP (6th should be rate limited)
- [ ] Close tab mid-generation, reload (should prompt to resume)
- [ ] Upload scanned PDF (should fail with "scanned" error)
- [ ] Trigger OpenRouter 429 (verify retry logic)
- [ ] Check logs for structured JSON format
- [ ] Verify job cleanup after 30 minutes

---

## 🆘 Troubleshooting

**"Job not found" after server restart**  
→ Jobs are in-memory. Implement Redis/DB (see Section 1)

**Videos fail with "timeout after 10 minutes"**  
→ D-ID under load. Implement webhooks (see Section 2) or increase `maxAttempts`

**High OpenRouter costs**  
→ Add cost tracking (Section 3), use cheaper models for testing

**Arabic scripts rejected as "too long"**  
→ Adjust validation (Section 5)

---

## 📚 Additional Resources

- [D-ID API Docs](https://docs.d-id.com)
- [OpenRouter Pricing](https://openrouter.ai/docs#pricing)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

---

**Current Status**: ✅ Production-ready for MVP with in-memory jobs  
**Recommended**: Implement Redis + webhooks before scaling beyond 100 users/day
