require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const OpenAI = require("openai");
const { File } = require("undici");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Available Models ──────────────────────────────────────────────
const MODELS = [
    // Free models (full educational prompt — tokens are free)
    { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B (Free)", cost: "free" },
    { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder 480B (Free)", cost: "free" },
    { id: "qwen/qwen3-4b:free", name: "Qwen3 4B (Free)", cost: "free" },
    // Paid models (compact prompt to save tokens)
    { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", cost: "paid" },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", cost: "paid" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o-mini", cost: "paid" },
    { id: "qwen/qwen3-235b-a22b-2507", name: "Qwen3 235B A22B", cost: "paid" },
    { id: "qwen/qwen3-8b", name: "Qwen3 8B", cost: "paid" },
];

const FREE_MODELS = MODELS.filter(m => m.cost === "free").map(m => m.id);

// ── Disallowed language (Arabic & English insults) ────────────────
const BANNED_TERMS = [
    /\b(fuck|shit|bitch|asshole|bastard|dumbass|idiot|moron|jerk)\b/i,
    /(احا|كسم|قحب|شرموط|خرا|زب|منيك|يلعن|تفوو|وسخ)/i,
];

function containsInsults(content) {
    const texts = [];
    if (typeof content === "string") {
        texts.push(content);
    } else if (Array.isArray(content)) {
        content.forEach((part) => {
            if (part?.type === "text" && typeof part.text === "string") {
                texts.push(part.text);
            }
        });
    }
    return texts.some((text) => BANNED_TERMS.some((regex) => regex.test(text)));
}

// ===== EDUCATIONAL SYSTEM PROMPTS =====

// Full prompt for free models (no token cost concern)
const buildEducationPrompt = (modelName) => ({
    role: "system",
    content: `You are FIS Learning Assistant — an expert educational tutor designed for university and school students. You operate fluently in both Arabic (العربية) and English.

## Core Behavior Rules

1. **Language Matching**: Always respond in the same language the student uses. If they write in Arabic, respond entirely in Arabic (including technical terms with English originals in parentheses where helpful). If they write in English, respond in English. Never mix languages unless the student does.

2. **Educational Approach — Scaffolded Teaching**:
   - Never just give the final answer. Guide the student toward understanding.
   - Start with what the student likely already knows, then build upward.
   - Break complex topics into digestible steps.
   - Use analogies and real-world examples relevant to the student's context.
   - After explaining, ask ONE follow-up question to check understanding.

3. **Response Structure for Explanations**:
   - Start with a brief, clear definition or overview (2-3 sentences max).
   - Then provide a detailed explanation with examples.
   - Include a practical example or worked problem when relevant.
   - End with a brief summary or a check-for-understanding question.

4. **When a Student Asks to Solve a Problem (Math, Physics, Programming, etc.)**:
   - Show the solution step-by-step.
   - Explain the reasoning behind EACH step, not just the mechanical process.
   - Highlight common mistakes students make at each step.
   - If the problem involves a formula, explain what each variable represents.

5. **When a Student Asks for Help with Writing (Essays, Reports, Research)**:
   - Help them structure their ideas, don't write it for them.
   - Suggest outlines, thesis statements, or argument frameworks.
   - Offer feedback on drafts if provided, pointing out strengths first, then improvements.

6. **Academic Integrity**:
   - Encourage original thinking. If a student seems to want you to do their homework verbatim, guide them through the process instead.
   - When providing information, mention the general academic field or concept name so they can verify and cite properly.

7. **Tone**: Warm, encouraging, patient. Like the best tutor they've ever had. Celebrate when they grasp something. Never condescending.

8. **Formatting**:
   - Begin every response with the exact line: Model used: ${modelName} (no extra symbols).
   - After that, use plain text only. Absolutely avoid markdown headings (#, ##, ###), bullets made with *, -, or other decorative symbols (@, $, %, ^, &, *, !, ~, =), or emojis.
   - When listing information, start each line with a single bullet made of a big period character: • (U+2022). Do not use numbers like 1. or other bullet styles.
   - Separate sections with blank lines so the text stays readable.
   - For emphasis, rely on wording or parentheses instead of special characters.
   - Describe code in plain text sentences or simple indented lines.
   - Keep paragraphs short (3-4 sentences max) for readability.

9. **Respectful Conduct**:
   - If the student uses insulting or offensive language in Arabic or English, politely ask them to restate their question without the insults before continuing. Do not mirror their wording.

9. **Subjects Covered**: All academic subjects including but not limited to: Mathematics, Physics, Chemistry, Biology, Computer Science, Programming, Literature (Arabic & English), History, Geography, Islamic Studies, Business, Economics, Engineering, Medicine fundamentals, and Language Learning.

10. **When You Don't Know Something**: Say so honestly. Suggest where the student might find reliable information (textbook chapters, academic databases, university resources). Never fabricate academic information.`
});

// Compact prompt for paid models (saves ~250 tokens per request)
const buildCompactPrompt = (modelName) => ({
    role: "system",
    content: `You are FIS Learning Assistant, an educational tutor for university/school students. Respond in the student's language (Arabic or English). Teach using scaffolding: explain concepts step-by-step with examples, show reasoning behind each step, and end with a check-for-understanding question. For problem-solving, explain each step's logic and highlight common mistakes. For writing help, guide structure rather than writing for them. Be warm, patient, encouraging. Never fabricate information.

Formatting rules:
• Start with the exact line: Model used: ${modelName}
• After that, stick to plain text paragraphs. Whenever you list points, begin each line with the big period bullet (•). Do not use markdown headings, other bullets, emojis, or symbols such as @ # $ % ^ & * ! ~ =.
• Keep sentences concise and use blank lines between sections for readability.

Respectful conduct:
- If any user message contains insults (Arabic or English), gently remind them to use respectful language and pause the explanation until they comply.`
});

// ── OpenAI SDK pointed at OpenRouter ──────────────────────────────
const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FIS Chatbot",
    },
});

const whisperClient = process.env.OPENAI_WHISPER_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_WHISPER_API_KEY })
    : null;

const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests — slow down." },
});
app.use("/api/", limiter);

// ── Static frontend ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── GET /api/models ───────────────────────────────────────────────
app.get("/api/models", (_req, res) => {
    res.json(MODELS);
});

// ── POST /api/chat  (streaming SSE) ──────────────────────────────
app.post("/api/chat", async (req, res) => {
    const { messages, model, temperature, top_p, max_tokens } = req.body;

    // 1. Validate messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required." });
    }

    // 2. Determine selected model
    const selectedModel = model || MODELS[0].id;
    const selectedModelMeta = MODELS.find((m) => m.id === selectedModel);

    // 3. Validate model is in our allowed list
    if (!selectedModelMeta) {
        return res.status(400).json({ error: "Invalid model." });
    }

    // 4. Choose full or compact prompt based on whether model is free
    const modelName = selectedModelMeta.name || selectedModel;
    const systemPrompt = FREE_MODELS.includes(selectedModel)
        ? buildEducationPrompt(modelName)
        : buildCompactPrompt(modelName);

    // 5. Inject system prompt only if not already present
    const hasSystemPrompt = messages.length > 0 && messages[0].role === "system";
    const enhancedMessages = hasSystemPrompt
        ? messages
        : [systemPrompt, ...messages];

    // 6. Validate last message has content
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || (!lastMsg.content && !Array.isArray(lastMsg.content))) {
        return res.status(400).json({ error: "Last message content is empty." });
    }

    if (containsInsults(lastMsg.content)) {
        return res.status(400).json({
            error: "Please keep the conversation respectful. The assistant cannot continue while insults are being used.",
        });
    }

    // 7. SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
        // 8. Call OpenRouter with enhanced messages
        const stream = await openRouterClient.chat.completions.create({
            model: selectedModel,
            messages: enhancedMessages,
            stream: true,
            temperature: temperature ?? 0.7,
            top_p: top_p ?? 1,
            max_tokens: max_tokens ?? 2048,
        });

        // 9. Stream response tokens to client
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
            }
            if (chunk.choices?.[0]?.finish_reason) {
                const usage = chunk.usage || null;
                res.write(
                    `data: ${JSON.stringify({ finish_reason: chunk.choices[0].finish_reason, usage })}\n\n`
                );
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (err) {
        console.error("OpenRouter error:", err.message);
        const status = err.status || 500;
        const msg =
            status === 429
                ? "Rate limited by OpenRouter. Please wait."
                : err.message || "Upstream error.";
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
        } else {
            res.status(status).json({ error: msg });
        }
    }
});

// ── POST /api/stt  (OpenAI Whisper) ──────────────────────────────
app.post("/api/stt", upload.single("audio"), async (req, res) => {
    if (!whisperClient) {
        return res.status(500).json({ error: "Whisper API is not configured on the server." });
    }
    if (!req.file) {
        return res.status(400).json({ error: "Audio file is required." });
    }
    try {
        const audioFile = new File([req.file.buffer], `speech-${Date.now()}.webm`, {
            type: req.file.mimetype || "audio/webm",
        });
        const transcription = await whisperClient.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            response_format: "text",
        });
        const text = typeof transcription === "string" ? transcription : transcription.text;
        res.json({ text: text || "" });
    } catch (err) {
        console.error("Whisper error:", err);
        res.status(err.status || 500).json({ error: err.message || "Failed to transcribe audio." });
    }
});

// ── POST /api/tts  (ElevenLabs) ──────────────────────────────────
app.post("/api/tts", async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "text is required." });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "ElevenLabs API is not configured on the server." });
    }
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": apiKey,
            },
            body: JSON.stringify({
                text,
                voice_settings: {
                    stability: 0.45,
                    similarity_boost: 0.7,
                },
            }),
        });
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`TTS error ${response.status}: ${errBody}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        res.setHeader("Content-Type", "audio/mpeg");
        res.send(audioBuffer);
    } catch (err) {
        console.error("ElevenLabs error:", err);
        res.status(500).json({ error: err.message || "Failed to synthesize speech." });
    }
});

// ── Fallback → index.html (SPA) ──────────────────────────────────
app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✓ FIS Chatbot server running → http://localhost:${PORT}`);
});
