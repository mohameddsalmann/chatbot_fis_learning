# FIS Chatbot

A production-ready, full-stack AI chat application built with **Node.js**, **Express**, and **Vanilla JavaScript**. It mimics the ChatGPT experience, offering real-time streaming responses, multimodal support (text/image), and integration with various LLMs (Gemini, DeepSeek, GPT-4o, Qwen, etc.) via the **OpenRouter API**.

The backend now enforces consistent assistant formatting (each reply starts with `Model used: …` and uses the `•` bullet) and actively blocks both Arabic and English insults before relaying messages to OpenRouter. This keeps the user experience clean, respectful, and predictable.

## 🏗️ Architecture

The application follows a pragmatic **Client-Server** architecture (SPA + API):

### Backend (Node.js/Express)
- **Role**: API Gateway & Policy Enforcement layer.
- **Responsibilities**:
  - Securely handles API keys (OpenRouter key stays on server).
  - Proxy requests to OpenRouter to avoid CORS issues and expose a unified internal API.
  - Implements **Server-Sent Events (SSE)** for real-time token streaming.
  - Enforces **Rate Limiting** (20 requests/minute per IP) using `express-rate-limit` and standard security headers via `helmet`.
  - Injects curated system prompts per model (free models get a full tutor prompt, paid models get a compact prompt) so each response:
    - Opens with `Model used: <model name>`.
    - Uses plain text paragraphs and the big bullet `•` when listing.
    - Avoids decorative characters/emojis and maintains scaffolding-based teaching.
  - Rejects the request before hitting OpenRouter if the latest user message contains insults in **Arabic or English**, prompting the user to rephrase.
- **Key Modules**:
  - `server.js`: Main entry point with middleware, moderation, and SSE streaming logic.
  - `openai`: Official SDK used to interface with OpenRouter.

### Frontend (Vanilla JS)
- **Role**: Single Page Application (SPA).
- **Responsibilities**:
  - Manages application state (`conversations`, `activeConvId`, `theme`, `settings`).
  - Persists data to standard Browser **LocalStorage** (privacy-focused, no database required).
  - Renders UI with a custom **Markdown Engine** (supports code blocks, syntax highlighting, copy buttons).
  - Handles **Streaming Responses** by reading the raw `response.body` stream from the backend.
  - Provides placeholder flows for Speech-to-Text recording and video generation so the UI is future-ready.
- **Key Files**:
  - `app.js`: Core logic (~600 lines) handling events, API calls, and state management.
  - `styles.css`: Comprehensive styling (~470 lines) implementing a responsive dark/light theme, glassmorphism, and animations.
  - `index.html`: Semantic HTML5 structure.

### Data Flow
1. **Model Loading**: On startup, Frontend fetches available models from `GET /api/models`.
2. **User Input**: User types a message and clicks Send.
3. **Optimistic UI**: Frontend immediately displays user message and shows a "Thinking..." indicator.
4. **API Request**: Frontend sends a JSON POST request to `/api/chat` containing:
   - Full conversation history (for context).
   - Selected Model ID (e.g., `google/gemini-2.5-flash-lite`).
   - Generation parameters (Temperature, Top-P).
5. **Streaming**: 
   - Backend validates request and opens a stream to OpenRouter.
   - As OpenRouter receives tokens, Backend pushes them to Frontend via SSE (`data: {...}`).
   - Frontend appends chunks to the DOM in real-time, parsing Markdown on the fly.
6. **Persistence**: Once generation completes, the full message is saved to `localStorage`.

---

## ✨ Key Features

- **Real-Time Streaming**: seamless token-by-token generation using Server-Sent Events (SSE).
- **Multi-Model Support**: Switch instantly between Gemini 2.5, DeepSeek V3.2, GPT-4o-mini, and Qwen Models.
- **Conversation Management**: Create, delete, and switch between multiple chat sessions (persisted locally).
- **Markdown Rendering**: 
  - Syntax-highlighted code blocks with "Copy" buttons.
  - Tables, Lists, Bold/Italic, Links.
- **Customizable generation**: Adjust Temperature (Creativity), Top-P, and Max Tokens via the Settings panel.
- **Responsive Design**: Mobile-friendly sidebar and layout.
- **Theming**: Toggle between Dark (default) and Light modes.
- **Security & Moderation**: Rate limiting, localized data storage, environment variable configuration, and server-side filtering that blocks insults plus enforces deterministic formatting in every assistant response.
- **Future Hooks**: UI affordances for speech-to-text capture, image attachments, and avatar-based video generation so new modalities can be wired in quickly.

## 🧠 Assistant Behavior & Formatting Rules

To keep answers consistent and safe for students, the backend injects a system message before every request:

1. Replies always start with `Model used: <Friendly Model Name>`.
2. Lists use only the big bullet (`•`) character—no numbered lists or other bullets.
3. No decorative symbols (such as `@ # $ % ^ & * ! ~ =`) or emojis appear after the title line.
4. Tone remains encouraging, with scaffolded teaching and a short comprehension check.
5. If a user sends insults in Arabic or English, the API rejects the request and asks the user to restate their question politely before proceeding.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v14+
- `npm`
- An [OpenRouter API Key](https://openrouter.ai/)

### Installation

1. **Clone/Download the repository**.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**:
   - Create a `.env` file in the root directory.
   - Add your API key:
     ```env
     OPENROUTER_API_KEY=sk-or-your-key-here
     PORT=3000
     RATE_LIMIT_WINDOW_MS=60000
     RATE_LIMIT_MAX=20
     ```

### Running the App

Start the development server (with auto-reload):
```bash
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 📂 Project Structure

```
chatbot_fis_learining/
├── .env                 # Environment variables (API Keys)
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies & scripts
├── server.js            # [Backend] Express Server & API Routes
└── public/              # [Frontend] Static Assets
    ├── index.html       # Main HTML structure
    ├── style.css        # CSS Styling (Dark/Light mode)
    └── app.js           # Client-side logic, streaming UI & State management
```

## 🔌 API Reference

### `GET /api/models`
Returns the list of enabled models configured in the backend.
**Response**: `[{ id: string, name: string, cost: string }, ...]`

### `POST /api/chat`
Stream a chat completion.
**Body**:
```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "google/gemini-2.5-flash-lite",
  "temperature": 0.7,
  "top_p": 1,
  "max_tokens": 2048
}
```
**Response**: Server-Sent Events stream.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **AI Integration**: OpenAI Node SDK (configured for OpenRouter)
- **Styling**: Vanilla CSS3 (Variables, Flexbox, Grid)
- **Interactivity**: Vanilla JavaScript (ES6+)
