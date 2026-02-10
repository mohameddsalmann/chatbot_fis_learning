/* ═══════════════════════════════════════════════════════════════
   FIS Chatbot — Frontend Application
   ═══════════════════════════════════════════════════════════════ */

// ── DOM References ────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sidebar = $("#sidebar");
const sidebarToggle = $("#sidebarToggle");
const themeToggle = $("#themeToggle");
const sunIcon = $("#themeIconSun");
const moonIcon = $("#themeIconMoon");
const newChatBtn = $("#newChatBtn");
const convList = $("#conversationList");
const modelSelect = $("#modelSelect");
const messagesEl = $("#messagesContainer");
const welcomeEl = $("#welcome");
const chatInput = $("#chatInput");
const sendBtn = $("#sendBtn");
const attachBtn = $("#attachBtn");
const fileInput = $("#fileInput");
const imagePreview = $("#imagePreview");
const previewImg = $("#previewImg");
const removeImgBtn = $("#removeImg");
const sttBtn = $("#sttBtn");
const sttMenu = $("#sttMenu");
const sttWrapper = document.querySelector(".stt-wrapper");
const videoBtn = $("#videoBtn");
const videoModal = $("#videoModal");
const videoModalClose = $("#videoModalClose");
const videoModalCancel = $("#videoModalCancel");
const videoGenerate = $("#videoGenerate");
const avatarGrid = $("#avatarGrid");
const videoPromptEl = $("#videoPrompt");
const settingsToggle = $("#settingsToggle");
const settingsPanel = $("#settingsPanel");
const settingsClose = $("#settingsClose");
const tempSlider = $("#temperatureSlider");
const topPSlider = $("#topPSlider");
const maxTokSlider = $("#maxTokensSlider");
const tempVal = $("#tempVal");
const topPVal = $("#topPVal");
const maxTokVal = $("#maxTokensVal");

// ── State ─────────────────────────────────────────────────────────
let conversations = JSON.parse(localStorage.getItem("fis_conversations") || "[]");
let activeConvId = null;
let isStreaming = false;
let pendingImage = null;  // { base64, mimeType }
let isRecordingSpeech = false;
let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;
let ttsAudioPlayer = null;

// ── Theme ─────────────────────────────────────────────────────────
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fis_theme", theme);
    sunIcon.style.display = theme === "dark" ? "" : "none";
    moonIcon.style.display = theme === "dark" ? "none" : "";
}
applyTheme(localStorage.getItem("fis_theme") || "dark");
themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
});

// ── Sidebar toggle ────────────────────────────────────────────────
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("hidden");
    sidebar.classList.toggle("visible");
});

// ── Settings panel ────────────────────────────────────────────────
settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("open"));
settingsClose.addEventListener("click", () => settingsPanel.classList.remove("open"));

tempSlider.addEventListener("input", () => (tempVal.textContent = tempSlider.value));
topPSlider.addEventListener("input", () => (topPVal.textContent = topPSlider.value));
maxTokSlider.addEventListener("input", () => (maxTokVal.textContent = maxTokSlider.value));

// ── Load models ───────────────────────────────────────────────────
(async () => {
    try {
        const res = await fetch("/api/models");
        const models = await res.json();
        const savedModel = localStorage.getItem("fis_model");
        modelSelect.innerHTML = models
            .map((m) => `<option value="${m.id}" ${m.id === savedModel ? "selected" : ""}>${m.name} (${m.cost})</option>`)
            .join("");

        // Save selection on change
        modelSelect.addEventListener("change", () => {
            localStorage.setItem("fis_model", modelSelect.value);
        });
    } catch {
        modelSelect.innerHTML = `<option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (paid)</option>`;
    }
})();

// Auto-focus input
window.addEventListener("DOMContentLoaded", () => {
    chatInput.focus();
});

// ═══════════════════════════════════════════════════════════════════
//  CONVERSATION MANAGEMENT (localStorage)
// ═══════════════════════════════════════════════════════════════════

function saveConversations() {
    localStorage.setItem("fis_conversations", JSON.stringify(conversations));
}

function newConversation() {
    const conv = {
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [],        // { role, content }
        createdAt: Date.now(),
    };
    conversations.unshift(conv);
    saveConversations();
    switchConversation(conv.id);
}

function switchConversation(id) {
    activeConvId = id;
    renderConversationList();
    renderMessages();
}

function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);
    saveConversations();
    if (activeConvId === id) {
        if (conversations.length) switchConversation(conversations[0].id);
        else newConversation();
    } else {
        renderConversationList();
    }
}

function activeConv() {
    return conversations.find((c) => c.id === activeConvId);
}

function renderConversationList() {
    convList.innerHTML = conversations
        .map(
            (c) => `
    <div class="conv-item ${c.id === activeConvId ? "active" : ""}" data-id="${c.id}">
      <span class="conv-title">${escHtml(c.title)}</span>
      <button class="icon-btn conv-delete" data-del="${c.id}" title="Delete">&times;</button>
    </div>`
        )
        .join("");

    convList.querySelectorAll(".conv-item").forEach((el) => {
        el.addEventListener("click", (e) => {
            if (e.target.closest(".conv-delete")) return;
            switchConversation(el.dataset.id);
        });
    });
    convList.querySelectorAll(".conv-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteConversation(btn.dataset.del);
        });
    });
}

// ── Initialise ────────────────────────────────────────────────────
if (conversations.length === 0) newConversation();
else switchConversation(conversations[0].id);

newChatBtn.addEventListener("click", newConversation);

// ═══════════════════════════════════════════════════════════════════
//  RENDER MESSAGES
// ═══════════════════════════════════════════════════════════════════

function renderMessages() {
    const conv = activeConv();
    if (!conv) return;
    // clear
    messagesEl.innerHTML = "";
    if (conv.messages.length === 0) {
        messagesEl.appendChild(createWelcome());
        return;
    }

    conv.messages.forEach((m, idx) => {
        messagesEl.appendChild(createMsgEl(m, idx));
    });
    scrollToBottom();
}

function createWelcome() {
    const d = document.createElement("div");
    d.className = "welcome";
    d.innerHTML = `<div class="welcome-icon">✦</div><h2>How can I help you today?</h2><p>Choose a model above, type a message, or upload an image.</p>`;
    return d;
}

function createMsgEl(msg, idx) {
    const row = document.createElement("div");
    row.className = `msg ${msg.role}`;
    row.dataset.idx = idx;

    const isAssistant = msg.role === "assistant";
    const isError = Boolean(msg.isError);
    if (isAssistant && isError) {
        row.classList.add("error");
    }

    const avatarLetter = msg.role === "user" ? "U" : "FIS";
    const avatarClasses = ["msg-avatar"];
    if (isAssistant) avatarClasses.push("avatar-fis");
    if (isAssistant && isError) avatarClasses.push("avatar-error");

    let content;
    if (msg.role === "user") {
        content = renderUserContent(msg.content);
    } else if (isError) {
        const errorText = typeof msg.content === "string" ? msg.content : "Unexpected error";
        content = `<span class="msg-error">⚠ ${escHtml(errorText)}</span>`;
    } else {
        content = renderMarkdown(msg.content);
    }

    row.innerHTML = `
    <div class="${avatarClasses.join(" ")}">${avatarLetter}</div>
    <div class="msg-body">
      <div class="msg-bubble">${content}</div>
      <div class="msg-actions">
        <button class="msg-action-btn copy-btn">Copy</button>
        ${msg.role === "user" ? `<button class="msg-action-btn edit-btn">Edit</button>` : ""}
        ${msg.role === "assistant" ? `<button class="msg-action-btn regen-btn">Regenerate</button>` : ""}
      </div>
    </div>`;

    // Copy
    row.querySelector(".copy-btn")?.addEventListener("click", () => {
        const text = typeof msg.content === "string" ? msg.content : msg.content.map(c => c.type === "text" ? c.text : "[image]").join("");
        navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
    });

    // Edit
    row.querySelector(".edit-btn")?.addEventListener("click", () => {
        const text = typeof msg.content === "string" ? msg.content : msg.content.find(c => c.type === "text")?.text || "";
        chatInput.value = text;
        chatInput.focus();
        autoResize();
        // remove this message and everything after
        const conv = activeConv();
        conv.messages = conv.messages.slice(0, idx);
        saveConversations();
        renderMessages();
    });

    // Regenerate
    row.querySelector(".regen-btn")?.addEventListener("click", () => {
        const conv = activeConv();
        conv.messages = conv.messages.slice(0, idx); // remove this assistant msg
        saveConversations();
        renderMessages();
        sendToAPI(); // re-send
    });

    return row;
}

function renderUserContent(content) {
    if (typeof content === "string") return escHtml(content);
    // multimodal array
    return content
        .map((c) => {
            if (c.type === "text") return `<p>${escHtml(c.text)}</p>`;
            if (c.type === "image_url") return `<img src="${c.image_url.url}" alt="uploaded image" />`;
            return "";
        })
        .join("");
}

// ═══════════════════════════════════════════════════════════════════
//  MARKDOWN RENDERER (lightweight)
// ═══════════════════════════════════════════════════════════════════

function renderMarkdown(text) {
    if (!text) return "";
    let html = escHtml(text);

    // Code blocks (```lang ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const id = "code-" + Math.random().toString(36).slice(2, 8);
        return `<pre id="${id}"><button class="code-copy-btn" onclick="copyCode('${id}')">Copy</button><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Tables  (simple: | h | h |\n|---|---|\n| d | d |)
    html = html.replace(/((?:\|.+\|\n?)+)/g, (block) => {
        const lines = block.trim().split("\n").filter(Boolean);
        if (lines.length < 2) return block;
        const toRow = (line, tag) =>
            "<tr>" +
            line.split("|").filter(Boolean).map((c) => `<${tag}>${c.trim()}</${tag}>`).join("") +
            "</tr>";
        const headerLine = lines[0];
        const sep = lines[1];
        if (!/^[\s|:-]+$/.test(sep)) return block;
        const bodyLines = lines.slice(2);
        return `<table><thead>${toRow(headerLine, "th")}</thead><tbody>${bodyLines.map((l) => toRow(l, "td")).join("")}</tbody></table>`;
    });

    // Unordered lists
    html = html.replace(/((?:^|\n)- .+)+/g, (m) => {
        const items = m.trim().split("\n").map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/((?:^|\n)\d+\. .+)+/g, (m) => {
        const items = m.trim().split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
        return `<ol>${items}</ol>`;
    });

    // Paragraphs (double newline)
    html = html.replace(/\n{2,}/g, "</p><p>");
    html = `<p>${html}</p>`;
    // Single newlines → <br>
    html = html.replace(/\n/g, "<br>");
    // Clean empty <p> tags
    html = html.replace(/<p>\s*<\/p>/g, "");

    return html;
}

// global helper for code copy buttons
window.copyCode = function (id) {
    const code = document.getElementById(id)?.querySelector("code")?.textContent;
    if (code) { navigator.clipboard.writeText(code); toast("Code copied"); }
};

// ═══════════════════════════════════════════════════════════════════
//  SEND / STREAM
// ═══════════════════════════════════════════════════════════════════

async function handleSend() {
    if (isStreaming) return;
    const text = chatInput.value.trim();
    if (!text && !pendingImage) return;

    const conv = activeConv();
    if (!conv) return;

    // Remove welcome
    const wel = messagesEl.querySelector(".welcome");
    if (wel) wel.remove();

    // Build user message content
    let content;
    if (pendingImage) {
        content = [];
        if (text) content.push({ type: "text", text });
        content.push({ type: "image_url", image_url: { url: `data:${pendingImage.mimeType};base64,${pendingImage.base64}` } });
        clearImagePreview();
    } else {
        content = text;
    }

    // Push user message
    conv.messages.push({ role: "user", content });
    // Auto-title
    if (conv.messages.length === 1) {
        conv.title = (typeof content === "string" ? content : text || "Image chat").slice(0, 40);
        renderConversationList();
    }
    saveConversations();

    // Render user message
    messagesEl.appendChild(createMsgEl(conv.messages[conv.messages.length - 1], conv.messages.length - 1));
    scrollToBottom();

    // Clear input
    chatInput.value = "";
    autoResize();

    await sendToAPI();
}

async function sendToAPI() {
    const conv = activeConv();
    if (!conv) return;

    isStreaming = true;
    sendBtn.disabled = true;

    // Show typing indicator styled like chat completion
    const typing = document.createElement("div");
    typing.className = "msg assistant typing";
    typing.id = "typingIndicator";
    typing.innerHTML = `
    <div class="msg-avatar avatar-fis loading">FIS</div>
    <div class="msg-body">
      <div class="msg-bubble thinking-bubble">
        <div class="typing-status">FIS is thinking</div>
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>`;
    messagesEl.appendChild(typing);
    scrollToBottom();

    // Prepare messages for API (convert multimodal format)
    const apiMessages = conv.messages.map((m) => ({ role: m.role, content: m.content }));

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: apiMessages,
                model: modelSelect.value,
                temperature: parseFloat(tempSlider.value),
                top_p: parseFloat(topPSlider.value),
                max_tokens: parseInt(maxTokSlider.value),
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Request failed" }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        // Remove typing indicator
        typing.remove();

        // Create assistant message element placeholder
        conv.messages.push({ role: "assistant", content: "", isError: false });
        saveConversations();
        const assistantIdx = conv.messages.length - 1;
        const msgEl = createMsgEl(conv.messages[assistantIdx], assistantIdx);
        messagesEl.appendChild(msgEl);
        const bubbleEl = msgEl.querySelector(".msg-bubble");

        // Read SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let streamError = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        streamError = parsed.error;
                        bubbleEl.innerHTML = `<span class="msg-error">⚠ ${escHtml(parsed.error)}</span>`;
                        break;
                    }
                    if (parsed.content) {
                        fullText += parsed.content;
                        bubbleEl.innerHTML = renderMarkdown(fullText);
                        scrollToBottom();
                    }
                } catch {
                    /* ignore non-JSON lines */
                }
            }

            if (streamError) break;
        }

        if (streamError) {
            conv.messages[assistantIdx].content = streamError;
            conv.messages[assistantIdx].isError = true;
            saveConversations();
            const finalEl = createMsgEl(conv.messages[assistantIdx], assistantIdx);
            msgEl.replaceWith(finalEl);
            return;
        }

        // Save final text
        conv.messages[assistantIdx].content = fullText;
        conv.messages[assistantIdx].isError = false;
        saveConversations();

        // Re-render to attach proper action handlers
        const finalEl = createMsgEl(conv.messages[assistantIdx], assistantIdx);
        msgEl.replaceWith(finalEl);
    } catch (err) {
        if (typing.isConnected) typing.remove();
        const conv = activeConv();
        if (conv) {
            conv.messages.push({ role: "assistant", content: err.message, isError: true });
            saveConversations();
            const idx = conv.messages.length - 1;
            messagesEl.appendChild(createMsgEl(conv.messages[idx], idx));
        }
        scrollToBottom();
    } finally {
        isStreaming = false;
        sendBtn.disabled = false;
    }
}

// ── Send triggers ─────────────────────────────────────────────────
sendBtn.addEventListener("click", handleSend);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

// ── Auto-resize textarea ──────────────────────────────────────────
function autoResize() {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + "px";
}
chatInput.addEventListener("input", autoResize);

// ── Smooth scroll ─────────────────────────────────────────────────
function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    });
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE UPLOAD
// ═══════════════════════════════════════════════════════════════════

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        pendingImage = { base64, mimeType: file.type };
        previewImg.src = reader.result;
        imagePreview.style.display = "flex";
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
});
removeImgBtn.addEventListener("click", clearImagePreview);

function clearImagePreview() {
    pendingImage = null;
    previewImg.src = "";
    imagePreview.style.display = "none";
}

// ═══════════════════════════════════════════════════════════════════
//  SPEECH CONTROLS (STT / TTS)
// ═══════════════════════════════════════════════════════════════════

function closeSttMenu() {
    sttWrapper?.classList.remove("open");
}

if (sttBtn && sttWrapper && sttMenu) {
    sttBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isRecordingSpeech) {
            stopSpeechRecording();
            return;
        }
        sttWrapper.classList.toggle("open");
        if (sttWrapper.classList.contains("open")) {
            sttMenu.querySelector("button")?.focus();
        }
    });

    document.addEventListener("click", (e) => {
        if (!sttWrapper.contains(e.target)) {
            closeSttMenu();
        }
    });

    sttMenu.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const action = btn.dataset.action;
            closeSttMenu();
            if (action === "stt") {
                if (isRecordingSpeech) {
                    stopSpeechRecording();
                } else {
                    await startSpeechRecording();
                }
            } else if (action === "tts") {
                await playLastAssistantAsAudio();
            }
        });
    });
}

async function startSpeechRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
        toast("Microphone access is not supported in this browser.");
        return;
    }
    try {
        recordedChunks = [];
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });
        mediaRecorder.addEventListener("dataavailable", (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        });
        mediaRecorder.addEventListener("stop", async () => {
            if (recordedChunks.length) {
                const blob = new Blob(recordedChunks, { type: "audio/webm" });
                recordedChunks = [];
                await sendAudioForTranscription(blob);
            }
            releaseMediaStream();
        });
        mediaRecorder.start();
        isRecordingSpeech = true;
        sttBtn.classList.add("recording");
        toast("🎤 Recording… tap the mic to finish");
    } catch (err) {
        console.error("Recording error:", err);
        toast("Unable to access microphone. Check permissions and try again.");
        releaseMediaStream();
    }
}

function stopSpeechRecording() {
    if (!isRecordingSpeech) return;
    isRecordingSpeech = false;
    sttBtn.classList.remove("recording");
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    } else {
        recordedChunks = [];
        releaseMediaStream();
    }
}

function releaseMediaStream() {
    mediaStream?.getTracks()?.forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
}

async function sendAudioForTranscription(blob) {
    try {
        const formData = new FormData();
        formData.append("audio", blob, "speech.webm");
        const res = await fetch("/api/stt", {
            method: "POST",
            body: formData,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Transcription failed" }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const { text } = await res.json();
        if (text) {
            chatInput.value = `${chatInput.value ? chatInput.value + " " : ""}${text}`.trim();
            autoResize();
            toast("✅ Transcript captured. Sending to FISChat…");
            if (!isStreaming) {
                await handleSend();
            }
        } else {
            toast("No speech detected in the recording.");
        }
    } catch (err) {
        console.error("STT error:", err);
        toast(`STT failed: ${err.message}`);
    }
}

async function playLastAssistantAsAudio() {
    const text = getLastAssistantPlainText();
    if (!text) {
        toast("No assistant response available for TTS yet.");
        return;
    }
    try {
        const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "TTS failed" }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        playAudioBlob(blob);
        toast("🔊 Playing assistant response");
    } catch (err) {
        console.error("TTS error:", err);
        toast(`TTS failed: ${err.message}`);
    }
}

function playAudioBlob(blob) {
    if (ttsAudioPlayer) {
        ttsAudioPlayer.pause();
        ttsAudioPlayer.src = "";
    }
    const url = URL.createObjectURL(blob);
    ttsAudioPlayer = new Audio(url);
    ttsAudioPlayer.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        ttsAudioPlayer = null;
    }, { once: true });
    ttsAudioPlayer.play().catch((err) => {
        console.error("Audio playback error:", err);
        toast("Unable to play audio in this browser.");
        URL.revokeObjectURL(url);
    });
}

function getLastAssistantPlainText() {
    const conv = activeConv();
    if (!conv) return "";
    for (let i = conv.messages.length - 1; i >= 0; i -= 1) {
        const msg = conv.messages[i];
        if (msg.role === "assistant" && !msg.isError && msg.content) {
            return typeof msg.content === "string"
                ? msg.content
                : msg.content
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join(" ");
        }
    }
    return "";
}

// ═══════════════════════════════════════════════════════════════════
//  VIDEO GENERATION MODAL (placeholder)
// ═══════════════════════════════════════════════════════════════════

videoBtn.addEventListener("click", () => videoModal.classList.add("open"));
videoModalClose.addEventListener("click", () => videoModal.classList.remove("open"));
videoModalCancel.addEventListener("click", () => videoModal.classList.remove("open"));
videoModal.addEventListener("click", (e) => { if (e.target === videoModal) videoModal.classList.remove("open"); });

// Avatar selection
avatarGrid.querySelectorAll(".avatar-card").forEach((card) => {
    card.addEventListener("click", () => {
        avatarGrid.querySelectorAll(".avatar-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
    });
});

videoGenerate.addEventListener("click", () => {
    const avatar = avatarGrid.querySelector(".avatar-card.selected")?.dataset.avatar || "professional";
    const prompt = videoPromptEl.value.trim();
    if (!prompt) { toast("Please enter a prompt"); return; }
    toast(`🎬 Video generation requested (Avatar: ${avatar}). API will be connected later.`);
    videoModal.classList.remove("open");
    videoPromptEl.value = "";
    // TODO: Call video generation API with { avatar, prompt }
});

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════

function escHtml(str) {
    if (typeof str !== "string") return str;
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}
