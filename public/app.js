/* 
   FIS Chatbot — Frontend Application
    */

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
const voiceBtn = $("#voiceBtn");
const voiceModal = $("#voiceModal");
const voiceModalClose = $("#voiceModalClose");
const voiceGrid = $("#voiceGrid");
const personalitySelect = $("#personalitySelect");
const speedSlider = $("#speedSlider");
const speedVal = $("#speedVal");
const voiceProvider = $("#voiceProvider");
const voiceEndBtn = $("#voiceEndBtn");
const voiceMicBtn = $("#voiceMicBtn");
const voiceStatus = $("#voiceStatus");
const voiceStatusText = $("#voiceStatusText");
const voiceIndicator = voiceStatus?.querySelector(".voice-indicator");
const userTranscriptEl = $("#userTranscript");
const aiTranscriptEl = $("#aiTranscript");
const voiceProviderBadge = $("#voiceProviderBadge");
const voiceTimer = $("#voiceTimer");
const videoBtn = $("#videoBtn");
const videoModal = $("#videoModal");
const videoModalClose = $("#videoModalClose");
const videoModalCancel = $("#videoModalCancel");
const videoGenerate = $("#videoGenerate");
const apiTypeRadios = document.querySelectorAll('input[name="apiType"]');
const sentimentSelector = $("#sentimentSelector");
const sentimentSelect = $("#sentimentSelect");
const avatarGrid = $("#avatarGrid");
const videoCategorySelect = $("#videoCategory");
const docUpload = $("#docUpload");
const fileDropArea = $("#fileDropArea");
const fileSelectedName = $("#fileSelectedName");
const videoResult = $("#videoResult");
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

voiceProvider?.addEventListener("change", () => {
    updateProviderBadge();
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
    if (voiceProvider) {
        fetch("/api/realtime-provider")
            .then((res) => res.json())
            .then((data) => {
                const preferred = (data?.provider || "gemini").toLowerCase();
                if (preferred === "openai" && !supportsWebRTC) {
                    voiceProvider.value = "gemini";
                } else {
                    voiceProvider.value = preferred;
                }
                updateProviderBadge();
            })
            .catch(() => {
                voiceProvider.value = supportsWebRTC ? "gemini" : "gemini";
                updateProviderBadge();
            });
    }
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
    imagePreview.style.display = "none";
    previewImg.src = "";
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
//  VIDEO GENERATION MODAL
// ═══════════════════════════════════════════════════════════════════

console.log("Video button:", videoBtn, "Video modal:", videoModal);

if (videoBtn && videoModal) {
    videoBtn.addEventListener("click", () => {
        console.log("Video button clicked!");
        videoModal.classList.add("open");
    });
    videoModalClose?.addEventListener("click", () => videoModal.classList.remove("open"));
    videoModalCancel?.addEventListener("click", () => videoModal.classList.remove("open"));
    videoModal.addEventListener("click", (e) => {
        if (e.target === videoModal) videoModal.classList.remove("open");
    });
} else {
    console.error("Video button or modal not found!");
}

// Avatar selection
avatarGrid?.querySelectorAll(".avatar-card").forEach((card) => {
    card.addEventListener("click", () => {
        avatarGrid?.querySelectorAll(".avatar-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
    });
});

// API Type Selection Logic
if (apiTypeRadios && sentimentSelector) {
    apiTypeRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
            if (radio.value === "expressives" && radio.checked) {
                sentimentSelector.style.display = "block";
            } else if (radio.value === "clips" && radio.checked) {
                sentimentSelector.style.display = "none";
            }
        });
    });
}

// File Drop Logic
if (fileDropArea && docUpload) {
    ["dragenter", "dragover"].forEach((eventName) => {
        fileDropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropArea.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        fileDropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropArea.classList.remove("dragover");
        });
    });

    fileDropArea.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            docUpload.files = files;
            updateFileName();
        }
    });

    docUpload.addEventListener("change", updateFileName);
}

function updateFileName() {
    const file = docUpload.files?.[0];
    if (file) {
        fileSelectedName.textContent = file.name;
        fileSelectedName.style.display = "flex";
    } else {
        fileSelectedName.style.display = "none";
    }
}

videoGenerate.addEventListener("click", () => {
    const file = docUpload.files?.[0];
    if (!file) { toast("Please select a PDF document"); return; }
    if (file.type !== "application/pdf") { toast("PDF files only"); return; }

    // Frontend file size validation (20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        toast(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return;
    }

    const avatar = avatarGrid.querySelector(".avatar-card.selected")?.dataset.avatar || "professional";
    const category = videoCategorySelect?.value || "summarize";
    const apiType = document.querySelector('input[name="apiType"]:checked')?.value || "clips";
    const sentiment = sentimentSelect?.value || "professional";

    const formData = new FormData();
    formData.append("document", file);
    formData.append("avatar", avatar);
    formData.append("category", category);
    formData.append("model", modelSelect.value);
    formData.append("apiType", apiType);
    formData.append("sentiment", sentiment);

    videoGenerate.disabled = true;
    videoGenerate.textContent = "Starting…";
    videoResult.style.display = "block";
    videoResult.innerHTML = '<div class="progress-indicator">⏳ Initializing...</div>';

    // Start the job
    fetch("/api/doc-to-video", {
        method: "POST",
        body: formData,
    })
        .then(async (res) => {
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Failed to start" }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then((data) => {
            const { job_id } = data;
            if (!job_id) {
                throw new Error("No job ID returned");
            }
            // Save job ID to localStorage for recovery
            localStorage.setItem("lastVideoJobId", job_id);
            localStorage.setItem("lastVideoJobTime", Date.now().toString());

            // Start polling for status
            pollVideoJobStatus(job_id);
        })
        .catch((err) => {
            console.error("doc-to-video start error", err);
            videoResult.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
            videoGenerate.disabled = false;
            videoGenerate.textContent = "Generate Video";
        });
});

// Check for pending job on page load
window.addEventListener("DOMContentLoaded", () => {
    const lastJobId = localStorage.getItem("lastVideoJobId");
    const lastJobTime = localStorage.getItem("lastVideoJobTime");

    if (lastJobId && lastJobTime) {
        const elapsed = Date.now() - parseInt(lastJobTime);
        // Only recover jobs from last 30 minutes
        if (elapsed < 30 * 60 * 1000) {
            fetch(`/api/video-status/${lastJobId}`)
                .then(res => res.json())
                .then(job => {
                    if (job.status === "processing") {
                        const recover = confirm(`You have a pending video generation job. Would you like to check its status?`);
                        if (recover) {
                            videoModal.classList.add("open");
                            videoResult.style.display = "block";
                            pollVideoJobStatus(lastJobId);
                        }
                    } else if (job.status === "completed") {
                        toast("✅ Your previous video is ready! Check the video modal.");
                    }
                })
                .catch(() => {
                    // Job not found or expired, clear localStorage
                    localStorage.removeItem("lastVideoJobId");
                    localStorage.removeItem("lastVideoJobTime");
                });
        } else {
            // Job too old, clear it
            localStorage.removeItem("lastVideoJobId");
            localStorage.removeItem("lastVideoJobTime");
        }
    }
});

// Poll job status with progress updates
function pollVideoJobStatus(jobId) {
    let pollInterval;
    let pollCount = 0;
    const maxPolls = 360; // 12 minutes max (2s intervals)

    const poll = () => {
        pollCount++;

        if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            videoResult.innerHTML = '<div class="error-msg">⏱️ Polling timeout. Job may still be processing. Check back later.</div>';
            videoGenerate.disabled = false;
            videoGenerate.textContent = "Generate Video";
            return;
        }

        fetch(`/api/video-status/${jobId}`)
            .then(res => res.json())
            .then(job => {
                // Update progress display
                videoResult.innerHTML = `
                    <div class="progress-indicator">
                        <div class="progress-status">${job.status === "processing" ? "⏳" : job.status === "completed" ? "✅" : "❌"} ${job.progress || "Processing..."}</div>
                        ${job.script_stats ? `<div class="progress-detail">Script: ${job.script_stats.words} words (~${job.script_stats.estimated_duration}s)</div>` : ""}
                    </div>
                `;

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    const apiLabel = job.apiType === "expressives" ? "Expressive V4" : "Full-HD Clips";
                    videoResult.innerHTML = `
                        <div class="success-msg">✅ Video ready!</div>
                        <strong>Video URL (${apiLabel}):</strong> <a href="${job.video_url}" target="_blank" rel="noopener">${job.video_url}</a>
                        ${job.script ? `<strong>Script (${job.script_stats?.words || "?"} words, ~${job.script_stats?.estimated_duration || "?"}s):</strong>
                        <div class="msg-bubble">${renderMarkdown(job.script)}</div>` : ""}
                    `;
                    toast("✅ Video generated successfully");
                    videoGenerate.disabled = false;
                    videoGenerate.textContent = "Generate Video";

                    // Auto-close modal after 2 seconds
                    setTimeout(() => {
                        videoModal.classList.remove("open");
                        if (videoCategorySelect) {
                            videoCategorySelect.value = "summarize";
                        }
                        docUpload.value = "";
                        updateFileName();
                    }, 2000);
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    videoResult.innerHTML = `<div class="error-msg">❌ ${job.error || "Video generation failed"}</div>`;
                    toast(`Video failed: ${job.error}`);
                    videoGenerate.disabled = false;
                    videoGenerate.textContent = "Generate Video";
                }
            })
            .catch(err => {
                console.error("Polling error:", err);
                // Don't stop polling on network errors, just log
            });
    };

    // Poll immediately, then every 2 seconds
    poll();
    pollInterval = setInterval(poll, 2000);
}

// ═══════════════════════════════════════════════════════════════════
//  SPEECH-TO-SPEECH (Grok-style)
// ═══════════════════════════════════════════════════════════════════

// Voice state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let conversationHistory = [];
let selectedVoice = "alloy";
let selectedSpeed = 1.0;

// WebRTC Realtime API state
let peerConnection = null;
let dataChannel = null;
let audioElement = null;
let micStream = null;
let isRealtimeActive = false;
let sessionStartTime = null;
let sessionTimer = null;
const MAX_SESSION_DURATION = 60 * 60 * 1000; // 60 minutes
const OPENAI_SESSION_LIMIT = 60 * 60 * 1000;
const GEMINI_SESSION_LIMIT = 15 * 60 * 1000;
const SESSION_WARN_MS = 5 * 60 * 1000;

// Gemini Live state
let geminiWs = null;
let geminiMicStream = null;
let geminiAudioContext = null;
let geminiProcessor = null;
let geminiPlaybackContext = null;
let geminiNextPlayTime = 0;
let isGeminiActive = false;

let liveSessionTimer = null;
let liveSessionStart = null;

function updateProviderBadge() {
    if (!voiceProviderBadge) return;
    const provider = getSelectedProvider();
    if (provider === "openai") {
        voiceProviderBadge.textContent = "OpenAI Realtime";
        voiceProviderBadge.classList.remove("gemini");
        voiceProviderBadge.classList.add("openai");
    } else {
        voiceProviderBadge.textContent = "Gemini Live";
        voiceProviderBadge.classList.remove("openai");
        voiceProviderBadge.classList.add("gemini");
    }
}

function setTimerState(remainingMs) {
    if (!voiceTimer) return;
    voiceTimer.classList.toggle("warn", remainingMs <= SESSION_WARN_MS && remainingMs > 60000);
    voiceTimer.classList.toggle("danger", remainingMs <= 60000);
}

function startLiveTimer() {
    if (!voiceTimer) return;
    stopLiveTimer();
    liveSessionStart = Date.now();
    voiceTimer.textContent = "00:00";
    voiceTimer.classList.add("active");
    liveSessionTimer = setInterval(() => {
        const elapsed = Date.now() - liveSessionStart;
        const limitMs = getSelectedProvider() === "gemini" ? GEMINI_SESSION_LIMIT : null;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        voiceTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        if (limitMs) {
            const remaining = limitMs - elapsed;
            setTimerState(remaining);
            if (remaining <= 0) {
                endGeminiSession();
            }
        }
    }, 1000);
}

function stopLiveTimer() {
    if (liveSessionTimer) {
        clearInterval(liveSessionTimer);
        liveSessionTimer = null;
    }
    if (voiceTimer) {
        voiceTimer.textContent = "00:00";
        voiceTimer.classList.remove("active");
    }
}

function getSelectedProvider() {
    return voiceProvider?.value || "gemini";
}

function resetTranscripts() {
    if (userTranscriptEl) userTranscriptEl.textContent = "You: …";
    if (aiTranscriptEl) aiTranscriptEl.textContent = "AI: …";
}

// Feature detection
const supportsWebRTC = !!(window.RTCPeerConnection && navigator.mediaDevices);

console.log("Voice button:", voiceBtn, "Voice modal:", voiceModal);

// Open voice modal
if (voiceBtn && voiceModal) {
    voiceBtn.addEventListener("click", () => {
        console.log("Voice button clicked!");
        voiceModal.classList.add("open");
    });
} else {
    console.error("Voice button or modal not found!");
}

// Close voice modal
voiceModalClose?.addEventListener("click", () => {
    voiceModal.classList.remove("open");
    if (isGeminiActive) {
        endGeminiSession();
    } else if (isRealtimeActive) {
        endRealtimeSession();
    } else {
        stopRecording();
    }
});

voiceModal?.addEventListener("click", (e) => {
    if (e.target === voiceModal) {
        voiceModal.classList.remove("open");
        if (isGeminiActive) {
            endGeminiSession();
        } else if (isRealtimeActive) {
            endRealtimeSession();
        } else {
            stopRecording();
        }
    }
});

voiceEndBtn?.addEventListener("click", () => {
    if (isGeminiActive) {
        endGeminiSession();
    } else if (isRealtimeActive) {
        endRealtimeSession();
    } else if (isRecording) {
        stopRecording();
    }
});

// Voice selection
voiceGrid?.querySelectorAll(".voice-card").forEach((card) => {
    card.addEventListener("click", () => {
        voiceGrid.querySelectorAll(".voice-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedVoice = card.dataset.voice;
    });
});

// Speed slider
speedSlider?.addEventListener("input", (e) => {
    selectedSpeed = parseFloat(e.target.value);
    speedVal.textContent = `${selectedSpeed.toFixed(1)}x`;
});

// Microphone button - toggle conversation
voiceMicBtn?.addEventListener("click", async () => {
    const provider = getSelectedProvider();
    if (provider === "gemini") {
        if (isGeminiActive) {
            await endGeminiSession();
        } else {
            await startGeminiSession();
        }
        return;
    }

    if (supportsWebRTC) {
        if (isRealtimeActive) {
            await endRealtimeSession();
        } else {
            await startRealtimeSession();
        }
    } else {
        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    }
});

// ═══════════════════════════════════════════════════════════════════
//  GEMINI LIVE (WebSocket)
// ═══════════════════════════════════════════════════════════════════

async function startGeminiSession() {
    try {
        resetTranscripts();
        voiceStatusText.textContent = "🔄 Starting Gemini live...";

        const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/gemini-live`;
        geminiWs = new WebSocket(wsUrl);
        geminiWs.binaryType = "arraybuffer";

        geminiWs.onopen = async () => {
            await startGeminiAudioCapture();
            startGeminiPlayback();
            isGeminiActive = true;
            startLiveTimer();
            voiceMicBtn.classList.add("recording");
            voiceIndicator?.classList.add("recording");
            voiceStatusText.textContent = "🎤 Live (Gemini) - Speak naturally";
        };

        geminiWs.onmessage = (event) => {
            if (typeof event.data === "string") {
                try {
                    const msg = JSON.parse(event.data);
                    handleGeminiMessage(msg);
                } catch (err) {
                    console.error("Gemini message parse error:", err);
                }
            }
        };

        geminiWs.onerror = (err) => {
            console.error("Gemini WS error:", err);
            toast("❌ Gemini connection error");
        };

        geminiWs.onclose = () => {
            if (isGeminiActive) {
                endGeminiSession();
            }
        };
    } catch (err) {
        console.error("Gemini session error:", err);
        toast(`❌ ${err.message}`);
        await endGeminiSession();
    }
}

async function startGeminiAudioCapture() {
    geminiMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    geminiAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = geminiAudioContext.createMediaStreamSource(geminiMicStream);
    geminiProcessor = geminiAudioContext.createScriptProcessor(4096, 1, 1);
    source.connect(geminiProcessor);
    geminiProcessor.connect(geminiAudioContext.destination);

    geminiProcessor.onaudioprocess = (e) => {
        if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, Math.floor(float32[i] * 32768)));
        }
        geminiWs.send(pcm16.buffer);
    };
}

function startGeminiPlayback() {
    geminiPlaybackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    geminiNextPlayTime = 0;
}

function handleGeminiMessage(msg) {
    if (msg.type === "audio" && msg.data) {
        const binary = atob(msg.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

        const audioBuffer = geminiPlaybackContext.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        const source = geminiPlaybackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(geminiPlaybackContext.destination);

        const now = geminiPlaybackContext.currentTime;
        if (geminiNextPlayTime < now) geminiNextPlayTime = now;
        source.start(geminiNextPlayTime);
        geminiNextPlayTime += audioBuffer.duration;
        return;
    }

    if (msg.type === "status") {
        if (msg.state === "listening") {
            voiceStatusText.textContent = "👂 Listening...";
            voiceIndicator?.classList.add("listening");
        } else if (msg.state === "thinking") {
            voiceStatusText.textContent = "🤔 Thinking...";
            voiceIndicator?.classList.remove("listening");
            voiceIndicator?.classList.add("thinking");
        } else if (msg.state === "ready") {
            voiceStatusText.textContent = "🎤 Ready - Speak naturally";
            voiceIndicator?.classList.remove("thinking");
        }
    }

    if (msg.type === "input_transcript" && userTranscriptEl) {
        userTranscriptEl.textContent = `You: ${msg.text || ""}`;
    }
    if (msg.type === "output_transcript" && aiTranscriptEl) {
        aiTranscriptEl.textContent = `AI: ${msg.text || ""}`;
    }

    if (msg.type === "interrupted") {
        geminiNextPlayTime = 0;
    }

    if (msg.type === "turn_complete") {
        voiceStatusText.textContent = "🎤 Ready - Speak naturally";
        voiceIndicator?.classList.remove("thinking");
    }

    if (msg.type === "error") {
        toast(`❌ ${msg.message || "Gemini error"}`);
    }

    if (msg.type === "session_expired") {
        voiceStatusText.textContent = "⏱️ Session ended — 15-minute limit reached";
        voiceIndicator?.classList.remove("recording", "listening", "thinking");
        voiceIndicator?.classList.add("expired");
        toast(msg.message || "Session expired — start a new conversation");
        endGeminiSession();
    }

    if (msg.type === "session_end") {
        voiceStatusText.textContent = "Session closed";
        endGeminiSession();
    }
}

async function endGeminiSession() {
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(JSON.stringify({ type: "audio_end" }));
        geminiWs.close();
    }
    geminiWs = null;

    if (geminiProcessor) {
        geminiProcessor.disconnect();
        geminiProcessor = null;
    }
    if (geminiAudioContext) {
        await geminiAudioContext.close();
        geminiAudioContext = null;
    }
    if (geminiMicStream) {
        geminiMicStream.getTracks().forEach((t) => t.stop());
        geminiMicStream = null;
    }
    if (geminiPlaybackContext) {
        await geminiPlaybackContext.close();
        geminiPlaybackContext = null;
    }

    isGeminiActive = false;
    stopLiveTimer();
    voiceMicBtn.classList.remove("recording");
    voiceIndicator?.classList.remove("recording", "listening", "thinking");
    voiceStatusText.textContent = "Click mic to start speaking";
}

// ═══════════════════════════════════════════════════════════════════
//  WEBRTC REALTIME API (Primary)
// ═══════════════════════════════════════════════════════════════════

async function startRealtimeSession() {
    try {
        voiceStatusText.textContent = "🔄 Starting live conversation...";

        // Get microphone access
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create peer connection
        peerConnection = new RTCPeerConnection();

        // Add microphone track
        micStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, micStream);
        });

        // Create data channel for events
        dataChannel = peerConnection.createDataChannel('oai-events');
        setupDataChannel();

        // Handle incoming audio
        audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        peerConnection.ontrack = (event) => {
            audioElement.srcObject = event.streams[0];
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'failed') {
                toast('❌ Connection lost');
                endRealtimeSession();
            }
        };

        // Create SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send SDP to server
        const response = await fetch('/api/realtime-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: offer.sdp
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create session' }));
            throw new Error(error.error || 'Failed to create session');
        }

        // Set remote description (SDP answer)
        const answerSdp = await response.text();
        await peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp
        });

        // Session started successfully
        isRealtimeActive = true;
        sessionStartTime = Date.now();
        startSessionTimer();
        startLiveTimer();

        voiceMicBtn.classList.add('recording');
        voiceIndicator?.classList.add('recording');
        voiceStatusText.textContent = "🎤 Live conversation - Speak naturally";
        toast('✅ Live conversation started');

    } catch (err) {
        console.error('Realtime session error:', err);
        toast(`❌ ${err.message}`);
        await endRealtimeSession();
    }
}

function setupDataChannel() {
    if (!dataChannel) return;

    dataChannel.onopen = () => {
        console.log('Data channel opened');
    };

    dataChannel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleRealtimeEvent(message);
        } catch (err) {
            console.error('Data channel message error:', err);
        }
    };

    dataChannel.onerror = (err) => {
        console.error('Data channel error:', err);
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
    };
}

function handleRealtimeEvent(event) {
    const eventType = event.type;

    if (eventType === 'input_audio_buffer.speech_started') {
        voiceStatusText.textContent = "👂 Listening...";
        voiceIndicator?.classList.add('listening');
    }
    else if (eventType === 'input_audio_buffer.speech_stopped') {
        voiceStatusText.textContent = "🤔 Thinking...";
        voiceIndicator?.classList.remove('listening');
        voiceIndicator?.classList.add('thinking');
    }
    else if (eventType === 'response.audio_transcript.delta') {
        // Live transcript - could display in UI
        const delta = event.delta || '';
        // Optionally update a transcript display element
    }
    else if (eventType === 'response.done') {
        voiceStatusText.textContent = "🎤 Ready - Speak naturally";
        voiceIndicator?.classList.remove('thinking');

        // Could update conversation history here if needed
        const transcript = event.response?.output?.[0]?.content?.[0]?.transcript;
        if (transcript) {
            // Optionally add to chat display
        }
    }
    else if (eventType === 'error') {
        console.error('Realtime API error:', event.error);
        toast(`❌ Error: ${event.error?.message || 'Unknown error'}`);
    }
}

function startSessionTimer() {
    if (sessionTimer) clearInterval(sessionTimer);

    sessionTimer = setInterval(() => {
        const elapsed = Date.now() - sessionStartTime;
        const remaining = OPENAI_SESSION_LIMIT - elapsed;

        setTimerState(remaining);
        if (remaining <= 0) {
            endRealtimeSession();
        }
    }, 60000); // Check every minute
}

async function endRealtimeSession() {
    try {
        // Close data channel
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }

        // Close peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        // Stop microphone
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }

        // Stop audio element
        if (audioElement) {
            audioElement.srcObject = null;
            audioElement = null;
        }

        // Clear timer
        if (sessionTimer) {
            clearInterval(sessionTimer);
            sessionTimer = null;
        }

        isRealtimeActive = false;
        sessionStartTime = null;

        voiceMicBtn.classList.remove('recording');
        voiceIndicator?.classList.remove('recording', 'listening', 'thinking');
        voiceStatusText.textContent = "Click mic to start conversation";
        stopLiveTimer();

    } catch (err) {
        console.error('Error ending session:', err);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (isRealtimeActive) {
        endRealtimeSession();
    }
});

// ═══════════════════════════════════════════════════════════════════
//  FALLBACK: OLD RECORDING APPROACH
// ═══════════════════════════════════════════════════════════════════

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await sendSpeechToSpeech(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;

        voiceMicBtn.classList.add("recording");
        voiceIndicator?.classList.add("recording");
        voiceStatusText.textContent = "Recording... Click to stop";

    } catch (err) {
        console.error("Microphone access error:", err);
        toast("❌ Microphone access denied");
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;

        voiceMicBtn.classList.remove("recording");
        voiceIndicator?.classList.remove("recording");
        voiceIndicator?.classList.add("processing");
        voiceStatusText.textContent = "Processing your speech...";
    }
}

async function sendSpeechToSpeech(audioBlob) {
    try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "speech.wav");
        formData.append("voice", selectedVoice);
        formData.append("speed", selectedSpeed);
        formData.append("conversationHistory", JSON.stringify(conversationHistory));

        const response = await fetch("/api/speech-to-speech", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Failed to process speech" }));
            throw new Error(error.error || "Failed to process speech");
        }

        // Handle streaming response (SSE)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let audioContext = null;
        let audioQueue = [];
        let isPlaying = false;

        voiceStatusText.textContent = "🔊 AI is responding...";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                    const parsed = JSON.parse(data);

                    if (parsed.type === 'text') {
                        fullText += parsed.content;
                        // Update UI with streaming text (optional)
                    } else if (parsed.type === 'audio') {
                        // Queue audio chunks for real-time playback
                        audioQueue.push(parsed.data);
                        if (!isPlaying) {
                            playAudioStream(audioQueue);
                            isPlaying = true;
                        }
                    } else if (parsed.type === 'done') {
                        // Update conversation history
                        conversationHistory = parsed.conversationHistory || [];

                        // Display messages in chat
                        if (parsed.transcript) {
                            addMessage("user", `🎤 ${parsed.transcript}`);
                        }
                        if (parsed.text) {
                            addMessage("assistant", parsed.text);
                        }
                    } else if (parsed.type === 'error') {
                        throw new Error(parsed.error);
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            }
        }

        // Wait for audio to finish
        await waitForAudioComplete(audioQueue);

        voiceIndicator?.classList.remove("processing");
        voiceStatusText.textContent = "Click mic to start speaking";

    } catch (err) {
        console.error("Speech-to-speech error:", err);
        toast(`❌ ${err.message}`);
        voiceIndicator?.classList.remove("processing");
        voiceStatusText.textContent = "Error - Click mic to retry";
    }
}

// Play audio chunks as they arrive (real-time streaming)
async function playAudioStream(audioQueue) {
    if (!window.AudioContext && !window.webkitAudioContext) {
        console.error("Web Audio API not supported");
        return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();

    for (const chunk of audioQueue) {
        try {
            // Decode base64 PCM16 audio
            const binaryString = atob(chunk);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert PCM16 to AudioBuffer
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();

            // Wait for this chunk to finish
            await new Promise(resolve => {
                source.onended = resolve;
            });
        } catch (err) {
            console.error("Audio chunk playback error:", err);
        }
    }
}

function waitForAudioComplete(audioQueue) {
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            if (audioQueue.length === 0) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        // Timeout after 30 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 30000);
    });
}

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
