# FIS Chatbot

**An enterprise-ready tutoring assistant that showcases full-stack AI craftsmanship.** Built end-to-end with **Node.js**, **Express**, and **Vanilla JavaScript**, FIS Chatbot replicates the ChatGPT experience while adding classroom-ready guardrails, multi-model routing, and multimodal inputs (text, images, audio). The project demonstrates how to ship a polished AI product that recruiters and hiring managers can immediately understand and evaluate.

---

## 🎯 Why It Matters to Recruiters & Hiring Managers

| What they care about | How this project answers it |
| --- | --- |
| **Real product impact** | Live streaming interface, editable chat threads, STT/TTS workflows, and safety rails make this app feel production-ready. |
| **Technical versatility** | Full-stack ownership: custom SPA, Express API, rate limiting, SSE streaming, OpenRouter integration, Whisper STT, ElevenLabs TTS. |
| **User empathy** | Designed for students in bilingual classrooms (Arabic/English), with polite moderation and adaptive teaching prompts. |
| **Code quality** | Vanilla tech stack (no heavy frameworks) proves the ability to craft maintainable infrastructure from the ground up. |

---

## ✨ Product Highlights

1. **Multi-model tutor** — Switch between Gemini 2.5 Flash Lite, DeepSeek V3.2, GPT‑4o mini, Qwen 235B, and more via OpenRouter.
2. **Streaming UI** — SSE-driven token streaming mirrors ChatGPT’s interaction model with typing indicators, regen controls, and copy/edit actions.
3. **Speech Intelligence** — One mic button opens both **Speech → Text** (OpenAI Whisper) and **Text → Speech** (ElevenLabs) flows. Recorded transcripts auto-send to the AI; assistants can speak their answers back to the learner.
4. **Multimodal prompts** — Inline image upload with live preview, ready for vision-capable models.
5. **Conversation OS** — LocalStorage-backed persistence, sidebar management, theme toggle, model settings, and quick actions deliver a complete UX.
6. **Safety & consistency** — System prompts enforce respectful tone, deterministic formatting (each reply begins with `Model used: …` and `•` bullets), and bilingual insult filtering before requests ever reach OpenRouter.

---

## 🧱 Architecture at a Glance

**Client (SPA, Vanilla JS)**
- Manages conversations, UI state, theming, and slider-controlled generation settings.
- Custom Markdown parser renders tables, code blocks, and callouts with copy/edit tooling.
- Streams responses by reading `response.body` chunks directly; updates the DOM as tokens arrive.
- Speech module controls MediaRecorder capture, uploads audio with `FormData`, and auto-plays ElevenLabs MP3 responses.

**Server (Express API + Policy Layer)**
- Proxies `/api/chat` to OpenRouter using the official OpenAI SDK, injects per-model system prompts, and streams tokens back through SSE.
- Rate limits traffic (20 req/min/IP), applies Helmet/CORS, and serves the static SPA.
- Detects insults in Arabic/English and halts the request with a friendly warning before it consumes model credits.
- `/api/stt` accepts microphone uploads (Multer), converts to `File`, and calls Whisper; `/api/tts` posts to ElevenLabs and streams MP3 audio back to the browser.

**Data Flow Snapshot**
1. Frontend loads curated model list via `GET /api/models`.
2. Student types or speaks; optional image/upload metadata is appended.
3. `/api/chat` receives the entire conversation history + hyperparameters, adds the correct system prompt, and opens an OpenRouter stream.
4. As chunks arrive, the browser renders them instantaneously, saves the final text to LocalStorage, and offers regenerate/copy/edit actions.
5. For STT, the transcript is inserted and auto-sent; for TTS, the last assistant response is converted to speech on demand.

---

## 🔍 Feature Breakdown

- **Real-Time Streaming** with optimistic UI, typing indicators, and graceful error fallbacks.
- **Multi-Conversation Workspace** with local persistence, delete/rename, and quick model switching.
- **Fine-Tuned Prompting** for both free and paid models to balance cost vs. quality.
- **Safety & Compliance**: rate limiting, profanity filters, secure key handling, and deterministic answer formatting for auditability.
- **Production-Grade UX**: glassmorphism styling, keyboard shortcuts, auto-resizing text area, toast notifications, and responsive layout.
- **Future Hooks**: avatar-based video modal, STT/TTS scaffolding, and multimodal-friendly renderers for easy feature expansion.

---

## 🧠 Assistant Behavior Rules (Server-Enforced)
1. Replies must start with `Model used: <Friendly Name>`.
2. Lists use the `•` bullet—no headings, emojis, or decorative characters.
3. Tone stays warm and instructional, always ending with a quick comprehension check.
4. Bilingual insult detection pauses the conversation until the learner rephrases respectfully.

These rules are injected automatically so every model (even the “creative” ones) behaves like a consistent tutor.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- `npm`
- API keys: [OpenRouter](https://openrouter.ai/), [OpenAI Whisper](https://platform.openai.com/), [ElevenLabs](https://elevenlabs.io/) (optional but recommended)

### Installation
```bash
git clone https://github.com/mohameddsalmann/chatbot_fis_learning.git
cd chatbot_fis_learning
npm install
```

### Environment
Create `.env` in the project root:
```env
OPENROUTER_API_KEY=sk-or-xxxx
OPENAI_WHISPER_API_KEY=sk-xxxx
ELEVENLABS_API_KEY=elevenlabs-xxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

### Run
```bash
npm run dev   # Express server + static SPA
```
Open http://localhost:3000 and start chatting.

---

## 📂 Project Structure
```
chatbot_fis_learining/
├── server.js            # Express server, SSE proxy, moderation, STT/TTS endpoints
├── public/
│   ├── index.html       # Semantic layout
│   ├── styles.css       # Glassmorphic, responsive theme
│   └── app.js           # SPA state, streaming, Markdown, speech logic
├── package.json         # Scripts & dependencies
└── .env.example         # Configuration template
```

---

## 🔌 API Reference

### `GET /api/models`
Returns the curated list of OpenRouter models (id, name, cost tier).

### `POST /api/chat`
Streams a completion from the selected model.
```json
{
  "messages": [{ "role": "user", "content": "Explain recursion" }],
  "model": "google/gemini-2.5-flash-lite",
  "temperature": 0.7,
  "top_p": 1,
  "max_tokens": 1500
}
```
Response: `text/event-stream` payload with `{ content: "..." }` chunks followed by `[DONE]`.

### `POST /api/stt`
Accepts `multipart/form-data` with `audio` (WebM/MP3/etc.). Returns `{ text }` from Whisper.

### `POST /api/tts`
Accepts `{ text }` JSON. Responds with `audio/mpeg` synthesized by ElevenLabs.

---

## 🛠️ Tech Stack Snapshot
- **Runtime:** Node.js 18
- **Backend:** Express, Helmet, express-rate-limit, Multer, undici, OpenAI SDK
- **Frontend:** Vanilla JS (ES2023), custom Markdown renderer, MediaRecorder APIs
- **Styling:** CSS variables, flexbox/grid, light/dark theming, glassmorphism
- **AI Providers:** OpenRouter (Gemini / DeepSeek / GPT‑4o / Qwen), OpenAI Whisper, ElevenLabs TTS

---

If you’re hiring for AI/ML or full-stack roles, this repository is a hands-on proof that I can design delightful user experiences, build resilient APIs, and integrate state-of-the-art models end-to-end. Let’s talk! 
