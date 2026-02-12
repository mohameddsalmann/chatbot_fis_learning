# FIS Chatbot

<div align="center">

<!-- ┌──────────────────────────────────────────────────────────┐ -->
<!-- │  🔴 REPLACE: Record a 30s GIF of streaming + mic usage  │ -->
<!-- │  Use Gifski, LICEcap, or OBS → gifski to create it.     │ -->
<!-- └──────────────────────────────────────────────────────────┘ -->

<a href="https://github.com/mohameddsalmann/chatbot_fis_learning">
  <img src="docs/demo.gif" alt="FIS Chatbot — streaming AI tutor demo" width="720" />
</a>

<br />
<br />

### A ChatGPT-grade AI tutor — zero frameworks, pure craft.

Multi-model routing · SSE streaming · Speech-to-Text · Text-to-Speech · Bilingual safety rails<br />
Built end-to-end with Node.js, Express, and Vanilla JavaScript.

<br />

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES2023-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Model-6366F1?style=for-the-badge)](#)
[![Whisper](https://img.shields.io/badge/Whisper-STT-412991?style=for-the-badge&logo=openai&logoColor=white)](#)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-000000?style=for-the-badge)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br />

[Live Demo](#) · [What It Does](#-what-it-does) · [Architecture](#-how-it-works) · [Quick Start](#-quick-start) · [API Docs](#-api-reference)

</div>

<br />

---

<br />

## What This Project Proves

Most chatbot portfolios are a text input wired to an API key. This one is an **entire product**.

I built FIS Chatbot from scratch for a real bilingual classroom — Arabic and English speaking students who need an AI tutor that streams answers in real time, listens to their voice, speaks back, routes prompts across five different LLMs, and filters inappropriate language in both languages *before a single token is spent*. The entire frontend is a hand-rolled SPA with no React, no Vue, no framework at all — just vanilla JavaScript managing state, rendering a custom Markdown parser, reading SSE chunks off `response.body`, and controlling the MediaRecorder API for audio capture.

This is the kind of work I do: **full-stack, AI-integrated, user-centered, production-minded**.

<br />

> **Hiring for AI, full-stack, or product engineering?**<br />
> Clone this repo. Run it. Read the code. Then [let's talk](https://linkedin.com/in/mohameddsalmann).

<br />

---

<br />

## Why It Stands Out

<table>
<tr>
<td width="50%" valign="top">

**Product, Not Prototype**

This isn't a tutorial follow-along. It has streaming UI with typing indicators, regenerate/copy/edit controls, conversation persistence, theme toggling, model switching with slider-controlled generation parameters, and speech workflows — the same feature surface you'd expect from a shipped product.

</td>
<td width="50%" valign="top">

**Zero-Framework Frontend**

No React. No Next.js. No Tailwind. The SPA — state management, DOM diffing, custom Markdown renderer, SSE stream consumer, MediaRecorder integration — is written in plain JavaScript. This demonstrates that I understand the platform itself, not just the abstractions on top of it.

</td>
</tr>
<tr>
<td width="50%" valign="top">

**Full-Stack Ownership**

One developer, every layer. CSS glassmorphism and responsive design on the frontend. Express middleware stack (Helmet, CORS, rate limiting, Multer) on the backend. Multi-provider AI orchestration via OpenRouter. Whisper transcription. ElevenLabs synthesis. Bilingual profanity filtering. All wired together.

</td>
<td width="50%" valign="top">

**Designed for Real People**

Built for students in bilingual classrooms who need an AI that stays patient, consistent, and safe. Every model gets injected system prompts that enforce a warm instructional tone, deterministic formatting, and a comprehension check at the end of every response. User empathy isn't listed as a skill here — it shaped the architecture.

</td>
</tr>
</table>

<br />

---

<br />

## ✨ What It Does

<table>
<tr>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/artificial-intelligence.png" alt="AI icon"/>
  <br /><br />
  <strong>Multi-Model Routing</strong>
  <br /><br />
  <sub>Switch between <strong>Gemini 2.5 Flash Lite</strong>, <strong>DeepSeek V3.2</strong>, <strong>GPT-4o mini</strong>, <strong>Qwen 235B</strong>, and more through a single OpenRouter proxy. Each model receives a tuned system prompt so it behaves like a consistent classroom tutor.</sub>
  <br /><br />
</td>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/lightning-bolt.png" alt="streaming icon"/>
  <br /><br />
  <strong>Real-Time Streaming</strong>
  <br /><br />
  <sub>SSE-driven token delivery mirrors the ChatGPT experience. Typing indicators appear while tokens arrive, then regenerate, copy, and edit controls surface on the completed message — all rendered instantaneously from raw <code>response.body</code> chunks.</sub>
  <br /><br />
</td>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/microphone.png" alt="microphone icon"/>
  <br /><br />
  <strong>Speech Intelligence</strong>
  <br /><br />
  <sub>One button opens both pipelines. <strong>Speech → Text</strong> via OpenAI Whisper transcribes the student's voice and auto-sends the message. <strong>Text → Speech</strong> via ElevenLabs reads the AI's answer back aloud. No page reload, no separate UI.</sub>
  <br /><br />
</td>
</tr>
<tr>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/image.png" alt="image icon"/>
  <br /><br />
  <strong>Multimodal Input</strong>
  <br /><br />
  <sub>Drag-and-drop or click to attach images with live preview. The upload pipeline is wired and ready for vision-capable models — attach a photo, ask a question, get an answer.</sub>
  <br /><br />
</td>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/chat.png" alt="chat icon"/>
  <br /><br />
  <strong>Conversation Workspace</strong>
  <br /><br />
  <sub>Full conversation management backed by LocalStorage: create, rename, delete, and switch between threads. Sidebar navigation, theme toggle, model selection, and slider-controlled temperature / top-p / max-tokens settings.</sub>
  <br /><br />
</td>
<td align="center" width="33%">
  <br />
  <img width="48" src="https://img.icons8.com/fluency/48/shield.png" alt="shield icon"/>
  <br /><br />
  <strong>Safety & Compliance</strong>
  <br /><br />
  <sub>Bilingual insult detection (Arabic + English) halts requests <em>before</em> they reach the model and consume credits. Rate limiting at 20 req/min/IP, Helmet headers, CORS policy, and deterministic answer formatting ensure the app is auditable and secure.</sub>
  <br /><br />
</td>
</tr>
</table>

<br />

---

<br />

## 🏗 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT · Vanilla JS SPA                                         │
│                                                                 │
│  ┌───────────┐  ┌────────────┐  ┌───────────┐  ┌───────────────┐ │
│  │ Chat UI   │  │ Markdown   │  │ Speech    │  │ Settings &    │ │
│  │ & State   │  │ Renderer   │  │ Module    │  │ Theme         │ │
│  └─────┬─────┘  └────────────┘  └─────┬─────┘  └───────────────┘ │
│        │              SSE stream + fetch  │ MediaRecorder + Audio │
└────────┼──────────────────────────┬───────┼──────────────────────┘
         │                          │       │
═══════ HTTP ═══════════════════════╪═══════╪═══════════════════════
         │                          │       │
┌────────┼──────────────────────────┴───────┼──────────────────────┐
│ SERVER · Express                                                      │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐       │
│  │ /api/chat │ │ /api/stt │ │ /api/tts │ │ /api/models   │       │
│  │ SSE Proxy │ │ Whisper  │ │ ElevenL. │ │ Curated List  │       │
│  └─────┬─────┘ └──────────┘ └──────────┘ └───────────────┘       │
│        │                                                        │
│  POLICY LAYER: Rate Limiter · Helmet · CORS · Bilingual Filter   │
│                 System Prompt Injection · Logging                │
└────────┼────────────────────────────────────────────────────────┘
         │
══════ External APIs ═════════════════════════════════════════════
         │
   ┌─────▼─────┐   ┌────────┐   ┌────────────┐
   │ OpenRouter│   │Whisper │   │ ElevenLabs │
   │ (5+ LLMs) │   │  STT   │   │    TTS     │
   └───────────┘   └────────┘   └────────────┘
```

**Client** — The SPA manages conversations, UI state, and theming. A hand-built Markdown parser renders tables, fenced code blocks, and callout panels with integrated copy/edit tooling. Streaming works by reading chunks directly from `response.body` via the Fetch API and patching the DOM as each token arrives. The speech module wraps the MediaRecorder API to capture microphone input, uploads the recording as `FormData`, and auto-plays the returned ElevenLabs MP3 without a page transition.

**Server** — Express proxies `/api/chat` to OpenRouter through the OpenAI SDK, injecting per-model system prompts and streaming tokens back as SSE events. A policy layer wraps every route: Helmet sets security headers, CORS restricts origins, `express-rate-limit` caps traffic at 20 requests per minute per IP, and a bilingual insult filter inspects every message in Arabic and English — rejecting anything inappropriate with a friendly warning *before* the request reaches the model. Multer handles multipart uploads on `/api/stt` for Whisper transcription, and `/api/tts` streams ElevenLabs audio directly back to the browser.

**Data Flow** — The frontend fetches the curated model list from `GET /api/models` on load. When the student types or speaks, the full conversation history plus generation hyperparameters are sent to `/api/chat`. The server adds the correct system prompt, opens an OpenRouter stream, and forwards each chunk as an SSE event. The browser renders tokens in real time, persists the completed message to LocalStorage, and surfaces regenerate / copy / edit controls. For speech, the Whisper transcript is inserted into the input and auto-sent; for TTS, the last assistant message is synthesized and played on demand.

<br />

---

<br />

## 🚀 Quick Start

**Prerequisites:** Node.js 18+, npm, and API keys for [OpenRouter](https://openrouter.ai/), [OpenAI](https://platform.openai.com/) (Whisper), and optionally [ElevenLabs](https://elevenlabs.io/).

### 1 — Clone and install

```bash
git clone https://github.com/mohameddsalmann/chatbot_fis_learning.git
cd chatbot_fis_learning
npm install
```

### 2 — Set up environment variables

```bash
cp .env.example .env
```

Fill in your keys:

```env
OPENROUTER_API_KEY=sk-or-xxxx
OPENAI_WHISPER_API_KEY=sk-xxxx
ELEVENLABS_API_KEY=elevenlabs-xxxx          # optional
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # optional
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

### 3 — Run

```bash
npm run dev
```

Open http://localhost:3000 and start a conversation.

<br />

## 📂 Project Structure

```
chatbot_fis_learning/
│
├── server.js            # Express server — SSE proxy, policy layer, STT/TTS endpoints
│
├── public/
│   ├── index.html       # Semantic SPA shell
│   ├── styles.css       # Glassmorphic responsive theme (light + dark)
│   └── app.js           # SPA engine — state, streaming, Markdown parser, speech
│
├── .env.example         # Configuration template
└── package.json         # Scripts and dependencies
```

<br />

## 🔌 API Reference

### `GET /api/models`
Returns the curated list of available OpenRouter models. Each entry includes id, display name, and cost tier.

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

Response: `text/event-stream` — each SSE event carries `{ content: "..." }`, terminated by `[DONE]`.

### `POST /api/stt`
Accepts `multipart/form-data` with an `audio` field (WebM, MP3, WAV, etc.). Returns `{ text }` transcribed by OpenAI Whisper.

### `POST /api/tts`
Accepts `{ text }` as JSON. Returns `audio/mpeg` synthesized by ElevenLabs, streamed directly to the client.

<br />

## 🛠 Tech Stack

| Layer | Technologies |
| --- | --- |
| Runtime | Node.js 18 |
| Server | Express 4 · Helmet · express-rate-limit · Multer · OpenAI SDK |
| Client | Vanilla JavaScript (ES2023) · Custom Markdown renderer · MediaRecorder API |
| Styling | CSS custom properties · Flexbox / Grid · Glassmorphism · Light + Dark themes |
| AI Services | OpenRouter (Gemini · DeepSeek · GPT-4o · Qwen) · OpenAI Whisper · ElevenLabs TTS |

<br />

## 🧠 Tutor Behavior — Server-Enforced

- **Attribution** — Every reply begins with `Model used: <Friendly Name>` so students always know which AI they are talking to.
- **Formatting** — Answers use `•` bullet lists only. No markdown headings, no emojis, no decorative characters inside responses.
- **Tone** — Warm, patient, and instructional. Every response ends with a brief comprehension check to keep the learner engaged.
- **Moderation** — The bilingual insult filter (Arabic + English) intercepts messages server-side. If profanity is detected, the request is halted with a polite prompt to rephrase — no tokens consumed, no model credits spent.

These constraints are injected automatically, so even the most "creative" model behaves like a disciplined, consistent tutor.

<br />

## 🗺 Roadmap

- Avatar-based video responses (scaffolding in place)
- Persistent storage (MongoDB / PostgreSQL) for multi-device sync
- Teacher-facing analytics dashboard
- WebSocket upgrade for sub-50ms streaming latency
- Plugin architecture for custom model providers
- Classroom session management with student accounts

<br />

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to open an issue or submit a pull request.

<br />

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

<br />

Built by **Mohamed Salman** — a hands-on proof that I can design thoughtful user experiences, build resilient APIs, and integrate state-of-the-art AI models end-to-end.

If you're hiring — I'd love to hear from you.

[LinkedIn](https://linkedin.com/in/mohameddsalmann) · [GitHub](https://github.com/mohameddsalmann) · [Email](mailto:contact@mohamedsalman.dev)
