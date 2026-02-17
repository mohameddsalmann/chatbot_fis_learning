require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const OpenAI = require("openai");
const { File } = require("undici");
const pdfParse = require("pdf-parse");
const path = require("path");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
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

// ── Persistent job store for async video generation ──────────────
const fs = require("fs");
const JOBS_FILE = path.join(__dirname, "data", "video_jobs.json");
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Load jobs from file or initialize empty
function loadJobs() {
    try {
        if (fs.existsSync(JOBS_FILE)) {
            const data = fs.readFileSync(JOBS_FILE, "utf8");
            return new Map(Object.entries(JSON.parse(data)));
        }
    } catch (err) {
        console.error("[Jobs] Failed to load jobs file:", err.message);
    }
    return new Map();
}

// Save jobs to file (debounced to avoid excessive writes)
let saveTimeout = null;
function saveJobs() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const obj = Object.fromEntries(videoJobs);
            fs.writeFileSync(JOBS_FILE, JSON.stringify(obj, null, 2));
        } catch (err) {
            console.error("[Jobs] Failed to save jobs file:", err.message);
        }
    }, 500);
}

// Wrapper to set job and auto-save
function setJob(jobId, job) {
    videoJobs.set(jobId, job);
    saveJobs();
}

const videoJobs = loadJobs();
console.log(`[Jobs] Loaded ${videoJobs.size} jobs from persistent storage`);

// Cleanup old jobs every 5 minutes
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [jobId, job] of videoJobs.entries()) {
        const createdAt = new Date(job.created_at).getTime();
        if (now - createdAt > JOB_TTL_MS) {
            videoJobs.delete(jobId);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        saveJobs();
        console.log(`[Job Cleanup] Removed ${cleaned} expired jobs. Active jobs: ${videoJobs.size}`);
    }
}, 5 * 60 * 1000);

function createJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Structured logging helper
function logJobEvent(jobId, event, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        jobId,
        event,
        ...details
    }));
}

// Retry helper with exponential backoff
async function retryWithBackoff(fn, maxRetries = 2, baseDelay = 2000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

async function extractPdfText(buffer) {
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
}

function validatePdfExtraction(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return { valid: false, error: "PDF appears to be empty or contains only images." };
    }
    if (trimmed.length < 50) {
        return { valid: false, error: "PDF text is too short (less than 50 characters). May be scanned or corrupted." };
    }
    // Check for excessive gibberish (more than 30% non-alphanumeric)
    const alphanumeric = trimmed.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").length;
    const ratio = alphanumeric / trimmed.length;
    if (ratio < 0.3) {
        return { valid: false, error: "PDF text appears corrupted or contains mostly non-text content." };
    }
    return { valid: true };
}

const DID_MAX_CHARS = 1500; // D-ID's typical character limit for script input

function validateScriptLength(script) {
    const words = script.trim().split(/\s+/).length;
    const chars = script.length;
    const estimatedSeconds = (words / 150) * 60; // ~150 words/min

    if (words < 50) {
        return { valid: false, error: "Generated script is too short (less than 50 words).", words, chars, estimatedSeconds };
    }
    if (words > 350) {
        return { valid: false, error: "Generated script is too long (over 350 words). May exceed D-ID limits.", words, chars, estimatedSeconds };
    }
    if (chars > DID_MAX_CHARS) {
        return { valid: false, error: `Script exceeds D-ID's ${DID_MAX_CHARS} character limit (${chars} chars).`, words, chars, estimatedSeconds };
    }
    if (estimatedSeconds < 20 || estimatedSeconds > 150) {
        return { valid: false, error: `Script duration (~${Math.round(estimatedSeconds)}s) is outside 20-150s range.`, words, chars, estimatedSeconds };
    }

    return { valid: true, words, chars, estimatedSeconds };
}

function buildDidAuthHeader() {
    if (!DID_API_KEY) return {};
    const token = Buffer.from(`${DID_API_KEY}:`).toString("base64");
    return { Authorization: `Basic ${token}` };
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

// Direct OpenAI client for speech-to-speech (bypasses OpenRouter)
const directOpenAIClient = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const whisperClient = process.env.OPENAI_WHISPER_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_WHISPER_API_KEY })
    : null;

const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const DID_API_KEY = process.env.DID_API_KEY;
const DID_BASE_URL = process.env.DID_BASE_URL || "https://api.d-id.com";

// D-ID Avatar/Presenter configuration for both APIs
// Clips API uses presenter_id (e.g., v2_public_Amber@0zSz8kflCN)
// Expressives API uses avatar_id (e.g., public_amber_casual@avt_PfMblk)
const DID_AVATARS = {
    professional: {
        clips: process.env.DID_CLIPS_PROFESSIONAL || "v2_public_Amber@0zSz8kflCN",
        expressives: process.env.DID_EXPRESSIVE_PROFESSIONAL || "public_amber_casual@avt_PfMblk"
    },
    casual: {
        clips: process.env.DID_CLIPS_CASUAL || "v2_public_Adam@0GLJgELXjc",
        expressives: process.env.DID_EXPRESSIVE_CASUAL || "public_amber_casual@avt_PfMblk"
    },
    cartoon: {
        clips: process.env.DID_CLIPS_CARTOON || "v2_public_Amber@0zSz8kflCN",
        expressives: process.env.DID_EXPRESSIVE_CARTOON || "public_amber_casual@avt_PfMblk"
    },
    anime: {
        clips: process.env.DID_CLIPS_ANIME || "v2_public_Amber@0zSz8kflCN",
        expressives: process.env.DID_EXPRESSIVE_ANIME || "public_amber_casual@avt_PfMblk"
    },
    realistic: {
        clips: process.env.DID_CLIPS_REALISTIC || "v2_public_Amber@0zSz8kflCN",
        expressives: process.env.DID_EXPRESSIVE_REALISTIC || "public_amber_casual@avt_PfMblk"
    },
    minimal: {
        clips: process.env.DID_CLIPS_MINIMAL || "v2_public_Adam@0GLJgELXjc",
        expressives: process.env.DID_EXPRESSIVE_MINIMAL || "public_amber_casual@avt_PfMblk"
    }
};

// Available sentiments for Expressives API
const DID_SENTIMENTS = {
    professional: "snt_professional",
    empathetic: "snt_empathetic",
    excited: "snt_excited",
    friendly: "snt_friendly",
    serious: "snt_serious",
    calm: "snt_calm"
};

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ type: ['application/sdp', 'text/plain'] }));

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests — slow down." },
});
app.use("/api/", limiter);

// ── GET /api/realtime-provider (frontend default) ────────────────
app.get("/api/realtime-provider", (_req, res) => {
    const provider = (process.env.REALTIME_PROVIDER || "gemini").toLowerCase();
    res.json({ provider });
});

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

// ── POST /api/realtime-session (WebRTC Realtime API) ────────
app.post("/api/realtime-session", async (req, res) => {
    if (!directOpenAIClient) {
        return res.status(500).json({ error: "OPENAI_API_KEY not configured." });
    }

    const sdpOffer = req.body;
    if (!sdpOffer || typeof sdpOffer !== 'string') {
        return res.status(400).json({ error: "SDP offer is required as request body." });
    }

    try {
        const FormData = require('form-data');
        const formData = new FormData();

        // Add SDP offer
        formData.append('sdp', sdpOffer);

        // Add session config
        const sessionConfig = {
            type: "realtime",
            model: "gpt-realtime-mini",
            audio: {
                input: {
                    format: { type: "audio/pcm", rate: 24000 },
                    turn_detection: { type: "semantic_vad" }
                },
                output: {
                    format: { type: "audio/pcm" },
                    voice: "alloy"
                }
            },
            instructions: "You are a helpful educational AI tutor. You help students learn and understand concepts. Be clear, encouraging, and concise. If the student speaks Arabic, respond in Arabic. If they speak English, respond in English. Always adapt to the student's language."
        };
        formData.append('session', JSON.stringify(sessionConfig));

        // POST to OpenAI Realtime API
        const response = await fetch('https://api.openai.com/v1/realtime/calls', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Realtime API error (${response.status}):`, errorText);
            return res.status(response.status).json({
                error: `Failed to create realtime session: ${response.status}`
            });
        }

        // Return SDP answer
        const sdpAnswer = await response.text();
        res.setHeader('Content-Type', 'application/sdp');
        res.send(sdpAnswer);

    } catch (err) {
        console.error("Realtime session creation error:", err);
        res.status(500).json({ error: err.message || "Failed to create realtime session." });
    }
});

// ── POST /api/speech-to-speech (Direct OpenAI fallback) ────────
app.post("/api/speech-to-speech", upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Audio file is required." });
    }

    const { voice = "alloy", speed = 1.0, conversationHistory } = req.body;
    const audioBuffer = req.file.buffer;

    // Parse conversation history
    let messages = [];
    if (conversationHistory) {
        try {
            messages = JSON.parse(conversationHistory);
        } catch (e) {
            console.error("Failed to parse conversation history:", e);
        }
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Helper function to try OpenAI with timeout
    const tryOpenAI = async () => {
        if (!directOpenAIClient) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const audioBase64 = audioBuffer.toString('base64');

        const audioMessages = [{
            role: "user",
            content: [{
                type: "input_audio",
                input_audio: { data: audioBase64, format: "wav" }
            }]
        }];

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('OpenAI timeout after 15s')), 15000);
        });

        // Race between OpenAI call and timeout
        const streamPromise = directOpenAIClient.chat.completions.create({
            model: "gpt-audio-mini",
            modalities: ["text", "audio"],
            audio: { voice: voice, format: "pcm16" },
            messages: [...messages, ...audioMessages],
            temperature: 0.7,
            stream: true
        });

        return await Promise.race([streamPromise, timeoutPromise]);
    };

    // Try OpenAI with retry before giving up
    let openaiError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const stream = await tryOpenAI();

            // OpenAI succeeded - stream response
            res.setHeader('X-STS-Provider', 'openai');

            let fullText = "";
            let audioChunks = [];
            let transcript = "";

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;

                if (delta?.content) {
                    fullText += delta.content;
                    res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
                }

                if (delta?.audio) {
                    audioChunks.push(delta.audio);
                    res.write(`data: ${JSON.stringify({ type: 'audio', data: delta.audio })}\n\n`);
                }

                if (chunk.choices[0]?.finish_reason) {
                    transcript = chunk.choices[0]?.message?.audio?.transcript || "";
                }
            }

            const finalMessage = {
                role: "assistant",
                content: fullText,
                audio: audioChunks.length > 0 ? { transcript } : null
            };

            res.write(`data: ${JSON.stringify({
                type: 'done',
                text: fullText,
                transcript: transcript,
                conversationHistory: [...messages, finalMessage]
            })}\n\n`);

            res.end();
            return; // Success - exit function

        } catch (err) {
            openaiError = err;
            if (attempt === 1) {
                console.log(`[RETRY] OpenAI attempt ${attempt} failed (${err.status || err.message}), retrying in 2s...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    // Both OpenAI attempts failed
    console.error("OpenAI speech-to-speech failed after retries:", openaiError);
    if (!res.headersSent) {
        res.status(503).json({
            error: "Speech service temporarily unavailable. Please try again or use text input."
        });
    } else {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: "Speech service temporarily unavailable. Please try again or use text input."
        })}\n\n`);
        res.end();
    }
});

// IP-based rate limiter for video generation (5 requests per 10 minutes per IP)
const videoRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many video generation requests. Please wait 10 minutes before trying again." },
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || "unknown";
    }
});

// ── POST /api/doc-to-video  (PDF → LLM script → D-ID video - ASYNC) ──────
app.post("/api/doc-to-video", videoRateLimiter, upload.single("document"), async (req, res) => {
    const startTime = Date.now();

    try {
        // Handle multer file size errors
        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        if (!req.file) {
            return res.status(400).json({ error: "A PDF document is required." });
        }

        if (req.file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        }

        if (!DID_API_KEY) {
            return res.status(500).json({ error: "D-ID API is not configured on the server." });
        }

        if (!req.file.mimetype?.includes("pdf")) {
            return res.status(400).json({ error: "Only PDF files are supported." });
        }

        const { avatar = "professional", model, apiType = "clips", sentiment, category = "summarize" } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Create job immediately and return to user
        const jobId = createJobId();
        setJob(jobId, {
            status: "processing",
            progress: "Extracting PDF text...",
            created_at: new Date().toISOString(),
            avatar,
            apiType,
            category,
            ip: clientIp,
            fileSize: req.file.size,
        });

        logJobEvent(jobId, "job_created", {
            avatar,
            apiType,
            fileSize: req.file.size,
            ip: clientIp
        });

        // Return job ID immediately (non-blocking)
        res.json({ job_id: jobId, status: "processing" });

        // Process in background (don't await)
        processVideoJob(jobId, req.file.buffer, { avatar, model, apiType, sentiment, category }).catch((err) => {
            console.error(`Job ${jobId} failed:`, err);
            logJobEvent(jobId, "job_failed", { error: err.message, duration: Date.now() - startTime });
            setJob(jobId, {
                ...videoJobs.get(jobId),
                status: "failed",
                error: err.message || "Unknown error",
                progress: "Failed",
            });
        });

    } catch (err) {
        console.error("doc-to-video error:", err);

        // Handle multer errors specifically
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        }

        res.status(500).json({ error: err.message || "Failed to start video generation." });
    }
});

// Background job processor
async function processVideoJob(jobId, pdfBuffer, options) {
    const { avatar, model, apiType, sentiment, category = "summarize" } = options;
    const job = videoJobs.get(jobId);

    try {
        // 1) Extract and validate PDF text
        job.progress = "Extracting PDF text...";
        setJob(jobId, job);

        const pdfText = await extractPdfText(pdfBuffer);
        const pdfValidation = validatePdfExtraction(pdfText);

        if (!pdfValidation.valid) {
            throw new Error(pdfValidation.error);
        }

        // 2) Generate script via LLM
        const normalizedCategory = category === "explanation" ? "explanation" : "summarize";
        job.progress = normalizedCategory === "explanation"
            ? "Generating explanation script..."
            : "Generating summary script...";
        setJob(jobId, job);

        const basePrompt = normalizedCategory === "explanation"
            ? "You are an educational presenter. Given the PDF lecture text below, write a clear spoken explanation (90-150 seconds when read aloud). Explain step-by-step like a tutor, keeping a friendly tone. Match the PDF language (Arabic or English). End with one reflective question. Use plain text sentences, no markdown."
            : "You are an educational presenter. Given the PDF lecture text below, write a concise spoken summary (60-90 seconds when read aloud). Highlight key points and outcomes. Match the PDF language (Arabic or English). End with one reflective question. Use plain text sentences, no markdown.";
        const combinedText = `${basePrompt}\n\nPDF content:\n${pdfText.slice(0, 12000)}`;

        const selectedModel = model || MODELS[0].id;
        let scriptText;

        // Retry OpenRouter with exponential backoff for transient errors
        try {
            const completion = await retryWithBackoff(async () => {
                logJobEvent(jobId, "llm_request", { model: selectedModel });
                return await openRouterClient.chat.completions.create({
                    model: selectedModel,
                    messages: [{ role: "system", content: combinedText }],
                    temperature: 0.6,
                    max_tokens: 600,
                });
            }, 2, 2000);

            scriptText = completion.choices?.[0]?.message?.content?.trim();

            if (!scriptText) {
                throw new Error("LLM returned empty script");
            }

            logJobEvent(jobId, "llm_success", { words: scriptText.split(/\s+/).length });
        } catch (llmErr) {
            logJobEvent(jobId, "llm_error", { error: llmErr.message, status: llmErr.status });
            if (llmErr.status === 429) {
                throw new Error("OpenRouter rate limit exceeded after retries. Please try again later.");
            }
            throw new Error(`LLM error: ${llmErr.message}`);
        }

        // 3) Validate script length
        const scriptValidation = validateScriptLength(scriptText);
        if (!scriptValidation.valid) {
            throw new Error(`${scriptValidation.error} (${scriptValidation.words} words, ~${Math.round(scriptValidation.estimatedSeconds)}s)`);
        }

        job.script = scriptText;
        job.script_stats = { words: scriptValidation.words, estimated_duration: Math.round(scriptValidation.estimatedSeconds) };

        // 4) Request D-ID video
        job.progress = `Creating ${apiType === "expressives" ? "Expressive V4" : "Full-HD"} video...`;
        setJob(jobId, job);

        const avatarConfig = DID_AVATARS[avatar] || DID_AVATARS.professional;
        let videoId, pollEndpoint;

        try {
            if (apiType === "expressives") {
                const avatarId = avatarConfig.expressives;
                const sentimentId = DID_SENTIMENTS[sentiment] || DID_SENTIMENTS.professional;

                const expressiveResp = await fetch(`${DID_BASE_URL}/expressives`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...buildDidAuthHeader(),
                    },
                    body: JSON.stringify({
                        avatar_id: avatarId,
                        sentiment_id: sentimentId,
                        script: { type: "text", input: scriptText },
                    }),
                });

                if (!expressiveResp.ok) {
                    const errText = await expressiveResp.text();
                    throw new Error(`D-ID Expressives API error (${expressiveResp.status}): ${errText}`);
                }

                const expressive = await expressiveResp.json();
                videoId = expressive.id;
                pollEndpoint = `${DID_BASE_URL}/expressives/${videoId}`;
            } else {
                const presenterId = avatarConfig.clips;

                const clipResp = await fetch(`${DID_BASE_URL}/clips`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...buildDidAuthHeader(),
                    },
                    body: JSON.stringify({
                        presenter_id: presenterId,
                        script: { type: "text", input: scriptText },
                    }),
                });

                if (!clipResp.ok) {
                    const errText = await clipResp.text();
                    throw new Error(`D-ID Clips API error (${clipResp.status}): ${errText}`);
                }

                const clip = await clipResp.json();
                videoId = clip.id;
                pollEndpoint = `${DID_BASE_URL}/clips/${videoId}`;
            }
        } catch (didErr) {
            throw new Error(`D-ID request failed: ${didErr.message}`);
        }

        job.video_id = videoId;
        job.progress = "Waiting for D-ID to render video...";
        setJob(jobId, job);

        // 5) Poll D-ID for completion (no hard timeout - keep polling until done or error)
        let pollAttempts = 0;
        const maxAttempts = 300; // 10 minutes max (2s intervals)

        while (pollAttempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000));
            pollAttempts++;

            try {
                const statusResp = await fetch(pollEndpoint, {
                    headers: buildDidAuthHeader(),
                });

                if (!statusResp.ok) {
                    const txt = await statusResp.text();
                    throw new Error(`D-ID status check failed (${statusResp.status}): ${txt}`);
                }

                const data = await statusResp.json();

                if (data.status === "done" && data.result_url) {
                    job.status = "completed";
                    job.progress = "Video ready!";
                    job.video_url = data.result_url;
                    job.completed_at = new Date().toISOString();
                    setJob(jobId, job);
                    return;
                }

                if (data.status === "error" || data.status === "failed") {
                    throw new Error(`D-ID video generation failed: ${data.error || "Unknown D-ID error"}`);
                }

                // Update progress with attempt count
                job.progress = `Rendering video... (${pollAttempts * 2}s elapsed)`;
                setJob(jobId, job);

            } catch (pollErr) {
                throw new Error(`D-ID polling error: ${pollErr.message}`);
            }
        }

        throw new Error("Video generation timed out after 10 minutes. D-ID may be experiencing delays.");

    } catch (err) {
        job.status = "failed";
        job.error = err.message;
        job.progress = "Failed";
        job.failed_at = new Date().toISOString();
        setJob(jobId, job);
        throw err;
    }
}

// ── GET /api/video-status/:jobId (poll job status) ──────────────────
app.get("/api/video-status/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = videoJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
});


// ── Fallback → index.html (SPA) ──────────────────────────────────
app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────
// ── Gemini Live WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/gemini-live") {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});

wss.on("connection", (browserWs) => {
    let geminiSession = null;
    let pendingMessages = [];

    const initSession = async () => {
        try {
            const { GoogleGenAI, Modality } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            geminiSession = await ai.live.connect({
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: "You are a helpful educational AI tutor. Help students learn and understand concepts. Be clear, encouraging, and concise. If the student speaks Arabic, respond in Arabic. If they speak English, respond in English.",
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Kore" }
                        }
                    },
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        browserWs.send(JSON.stringify({ type: "status", state: "ready" }));
                    },
                    onmessage: (message) => {
                        const parts = message.serverContent?.modelTurn?.parts || [];
                        for (const part of parts) {
                            if (part.inlineData?.data) {
                                browserWs.send(JSON.stringify({
                                    type: "audio",
                                    data: part.inlineData.data,
                                }));
                            }
                        }

                        if (message.serverContent?.outputTranscription?.text) {
                            browserWs.send(JSON.stringify({
                                type: "output_transcript",
                                text: message.serverContent.outputTranscription.text,
                            }));
                            browserWs.send(JSON.stringify({ type: "status", state: "thinking" }));
                        }
                        if (message.serverContent?.inputTranscription?.text) {
                            browserWs.send(JSON.stringify({
                                type: "input_transcript",
                                text: message.serverContent.inputTranscription.text,
                            }));
                            browserWs.send(JSON.stringify({ type: "status", state: "listening" }));
                        }
                        if (message.serverContent?.interrupted) {
                            browserWs.send(JSON.stringify({ type: "interrupted" }));
                        }
                        if (message.serverContent?.turnComplete) {
                            browserWs.send(JSON.stringify({ type: "turn_complete" }));
                            browserWs.send(JSON.stringify({ type: "status", state: "ready" }));
                        }
                    },
                    onerror: (e) => {
                        browserWs.send(JSON.stringify({ type: "error", message: e.message }));
                    },
                    onclose: (e) => {
                        const reason = e?.reason || "unknown";
                        const isExpired = reason.includes("timeout") || reason.includes("limit") || reason.includes("exceeded");
                        browserWs.send(JSON.stringify({
                            type: isExpired ? "session_expired" : "session_end",
                            reason: reason,
                            message: isExpired ? "Session ended — 15-minute limit reached. Start a new conversation." : "Session closed."
                        }));
                        browserWs.close();
                    },
                },
            });

            if (pendingMessages.length > 0) {
                pendingMessages.forEach((data) => handleBrowserMessage(data));
                pendingMessages = [];
            }
        } catch (err) {
            browserWs.send(JSON.stringify({ type: "error", message: "Failed to connect to Gemini" }));
            browserWs.close();
        }
    };

    const handleBrowserMessage = (data) => {
        if (!geminiSession) return;
        if (typeof data === "string") {
            try {
                const msg = JSON.parse(data);
                if (msg.type === "audio_end") {
                    geminiSession.sendRealtimeInput({ audioStreamEnd: true });
                }
            } catch (err) {
                browserWs.send(JSON.stringify({ type: "error", message: "Invalid JSON message" }));
            }
            return;
        }

        const base64Audio = Buffer.from(data).toString("base64");
        geminiSession.sendRealtimeInput({
            audio: {
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000",
            },
        });
    };

    browserWs.on("message", (data) => {
        if (!geminiSession) {
            pendingMessages.push(data);
            return;
        }
        handleBrowserMessage(data);
    });

    browserWs.on("close", () => {
        if (geminiSession) {
            geminiSession.close();
            geminiSession = null;
        }
    });

    initSession();
});

server.listen(PORT, () => {
    console.log(`✓ FIS Chatbot server running → http://localhost:${PORT}`);
});
