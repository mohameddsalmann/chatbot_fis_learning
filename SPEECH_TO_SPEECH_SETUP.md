# Speech-to-Speech Setup Guide

## ✅ Implementation Complete

The speech-to-speech endpoint has been successfully rewritten with a clean, production-ready implementation.

---

## 🔑 Required Environment Variables

Add these to your `.env` file:

```bash
# Direct OpenAI API (for primary speech-to-speech path)
OPENAI_API_KEY=sk-proj-your-direct-openai-key-here

# ElevenLabs API (for fallback speech-to-speech path)
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_STT_MODEL=scribe_v2

# OpenRouter API (already configured, used for LLM in fallback)
OPENROUTER_API_KEY=sk-or-v1-your-existing-key
```

### Where to Get API Keys:

1. **OpenAI Direct API Key**
   - Go to: https://platform.openai.com/api-keys
   - Create a new secret key
   - **Important**: This is different from your OpenRouter key
   - This key calls `api.openai.com` directly (not through OpenRouter)

2. **ElevenLabs API Key**
   - Go to: https://elevenlabs.io/app/settings/api-keys
   - Copy your API key
   - Free tier: 10,000 characters/month

3. **ElevenLabs Voice ID** (optional, defaults to Rachel)
   - Default: `21m00Tcm4TlvDq8ikWAM` (Rachel - clear, neutral voice)
   - Other options:
     - `pNInz6obpgDQGcFmaJgB` (Adam - deep male)
     - `EXAVITQu4vr4xnSDxMaL` (Bella - soft female)
     - `ErXwobaYiN019PkySvjV` (Antoni - well-rounded male)
   - Browse all voices: https://elevenlabs.io/voice-library

---

## 🏗️ Architecture

### Primary Path (OpenAI Direct)
```
User Audio → Direct OpenAI API (api.openai.com)
           → gpt-4o-audio-preview model
           → Stream PCM16 audio back
           → Frontend plays immediately
```

**Features:**
- ✅ Single API call (speech-to-speech in one step)
- ✅ 15-second timeout protection
- ✅ 1 automatic retry with 2-second delay
- ✅ Lowest latency (~2-4 seconds)
- ✅ Header: `X-STS-Provider: openai`

### Fallback Path (ElevenLabs Pipeline)
```
User Audio → ElevenLabs Scribe STT
           → OpenRouter LLM (your selected model)
           → ElevenLabs TTS (streaming)
           → Frontend plays immediately
```

**Features:**
- ✅ Triggers only if OpenAI fails (402, 429, 500, timeout)
- ✅ Accepts WebM (Chrome), MP4 (Safari), WAV
- ✅ Detailed latency logging for each step
- ✅ Header: `X-STS-Provider: elevenlabs`
- ⚠️ Higher latency (~5-8 seconds total)

### Error Handling
If **both** paths fail:
- Returns SSE error event
- Message: "Speech service temporarily unavailable. Please try again or use text input."
- User can fall back to text chat

---

## 📊 Cost Estimates (Corrected)

### OpenAI Direct (Primary Path)
- **Model**: `gpt-4o-audio-preview`
- **Pricing**: $32/M input tokens, $64/M output tokens (audio)
- **Example**: 10-second user speech + 30-second AI response
  - Input: ~1,600 audio tokens = $0.051
  - Output: ~4,800 audio tokens = $0.307
  - **Total per exchange**: ~$0.36
- **Note**: Much cheaper than expected! Audio tokens are efficient.

### ElevenLabs Fallback (Only on OpenAI Failure)
- **STT (Scribe v2)**: ~$0.36/hour of audio
  - 10-second utterance = $0.001
- **LLM (OpenRouter)**: Varies by model
  - `gpt-4o-mini`: ~$0.0001 per exchange
- **TTS (Turbo v2.5)**: $0.06/1K characters
  - 200-char response = $0.012
- **Total per fallback exchange**: ~$0.013

**Fallback is 27x cheaper** but has higher latency and only triggers on errors.

---

## 🧪 Testing

### 1. Start the Server
```bash
npm run dev
```

### 2. Test Primary Path (OpenAI)
1. Open http://localhost:3000
2. Click the 🎤 microphone button
3. Select voice settings (Alloy, Echo, etc.)
4. Click the large mic button and speak
5. Click again to stop recording
6. **Expected**: AI responds with streaming audio in 2-4 seconds
7. **Check console**: Should see `X-STS-Provider: openai`

### 3. Test Fallback (Simulate OpenAI Failure)
Temporarily remove or corrupt `OPENAI_API_KEY` in `.env`:
```bash
# OPENAI_API_KEY=sk-proj-...
OPENAI_API_KEY=invalid-key-to-test-fallback
```

Restart server and test voice chat:
- **Expected**: Console shows `[FALLBACK] OpenAI speech-to-speech failed...`
- **Expected**: AI still responds via ElevenLabs (5-8 seconds)
- **Check console**: Should see `X-STS-Provider: elevenlabs`
- **Check console**: Latency breakdown (STT, LLM, TTS times)

### 4. Verify Audio Format Compatibility
Test in different browsers:
- **Chrome**: Sends `audio/webm` → Should work
- **Safari**: Sends `audio/mp4` → Should work
- **Firefox**: Sends `audio/webm` → Should work

---

## 🔍 Monitoring & Debugging

### Console Logs to Watch For

**Primary Path Success:**
```
(No special logs - just works)
```

**Primary Path Retry:**
```
[RETRY] OpenAI attempt 1 failed (timeout), retrying in 2s...
```

**Fallback Triggered:**
```
[FALLBACK] OpenAI speech-to-speech failed after 2 attempts (timeout), routing through ElevenLabs pipeline
[FALLBACK] STT completed in 1234ms
[FALLBACK] LLM completed in 2345ms
[FALLBACK] First TTS chunk in 567ms
[FALLBACK] Total pipeline latency: 5678ms (STT: 1234ms, LLM: 2345ms, TTS: 1890ms)
```

**Both Paths Failed:**
```
ElevenLabs fallback also failed: Error: ElevenLabs STT failed: 401
```

### Common Issues

**Issue**: `OPENAI_API_KEY not configured`
- **Fix**: Add `OPENAI_API_KEY` to `.env` (direct OpenAI key, not OpenRouter)

**Issue**: `ElevenLabs STT failed: 401`
- **Fix**: Check `ELEVENLABS_API_KEY` is valid

**Issue**: `ElevenLabs TTS failed: 404`
- **Fix**: Check `ELEVENLABS_VOICE_ID` is valid (try default: `21m00Tcm4TlvDq8ikWAM`)

**Issue**: Audio doesn't play in fallback mode
- **Fix**: Verify ElevenLabs TTS output format is `pcm_24000` (matches OpenAI)

---

## 🚀 Production Recommendations

1. **Monitor Fallback Rate**
   - If >10% of requests use fallback, investigate OpenAI issues
   - Set up alerts for high fallback rates

2. **Cost Tracking**
   - Log API usage per provider
   - Track `X-STS-Provider` header in analytics

3. **Latency Optimization**
   - Primary path: 2-4s is excellent
   - Fallback path: 5-8s is acceptable for error cases
   - If fallback is too slow, consider caching LLM responses

4. **Rate Limiting**
   - OpenAI: 500 RPM on Tier 1
   - ElevenLabs: 10,000 chars/month free tier
   - Consider implementing per-user rate limits

5. **Error Recovery**
   - Current: 1 retry + fallback = robust
   - Consider adding circuit breaker if OpenAI is consistently down

---

## 📝 Summary

✅ **Primary Path**: Direct OpenAI API (fast, single call)  
✅ **Fallback Path**: ElevenLabs STT → OpenRouter LLM → ElevenLabs TTS  
✅ **Retry Logic**: 1 automatic retry before fallback  
✅ **Audio Format**: Auto-detects WebM/MP4/WAV  
✅ **Latency Logging**: Detailed timing for debugging  
✅ **Error Handling**: Graceful degradation to text chat  
✅ **No Frontend Changes**: Works with existing UI  

The system is production-ready and resilient to API failures! 🎉
