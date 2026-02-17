# FIS Chatbot - System Flows Documentation

## 🔄 Complete System Architecture Flows

---

## 1️⃣ LLM Chat (Text-to-Text)

### **User Flow**
1. User types message in text input
2. (Optional) User attaches image via 📎 button
3. User clicks send button or presses Enter
4. Message appears in chat with user avatar
5. AI typing indicator shows "FIS is thinking..."
6. AI response streams in real-time word-by-word
7. Response rendered with markdown formatting

### **Technical Flow**

#### **Frontend** (`public/app.js`)
```
handleSend()
├── Validate input (text or image)
├── Build message content
│   ├── Text: { role: "user", content: "text" }
│   └── Image: { role: "user", content: [{ type: "text" }, { type: "image_url" }] }
├── Update conversation in localStorage
├── Render user message bubble
└── Call sendToAPI()

sendToAPI()
├── POST /api/chat
├── Headers: { "Content-Type": "application/json" }
├── Body: { messages, model, temperature, top_p, max_tokens }
├── Show typing indicator
├── Read SSE stream
│   ├── Parse "data: " lines
│   ├── Accumulate text chunks
│   ├── Render markdown in real-time
│   └── Handle [DONE] signal
└── Save final message to localStorage
```

#### **Backend** (`server.js`)
```
POST /api/chat
├── Validate request body
├── Check for insults (filter profanity)
├── Set SSE headers
│   ├── Content-Type: text/event-stream
│   ├── Cache-Control: no-cache
│   └── Connection: keep-alive
├── Call OpenRouter API with streaming
│   ├── Model: user-selected (gpt-4o, claude-3.5, etc.)
│   ├── Messages: conversation history
│   └── stream: true
├── Stream response chunks
│   └── For each chunk:
│       ├── Extract delta.content
│       ├── Send: data: {"content": "..."}\n\n
│       └── Flush to client
└── Send: data: [DONE]\n\n
```

#### **Data Flow**
```
User Input → Frontend Validation → localStorage Update → API Request
                                                              ↓
                                                    OpenRouter API
                                                              ↓
SSE Stream ← Response Chunks ← Token Generation ← LLM Processing
     ↓
Frontend Rendering (Markdown) → Chat Bubble → User Sees Response
```

---

## 2️⃣ Audio Speech-to-Speech

### **User Flow**
1. User clicks 🎤 microphone button
2. Voice modal opens with settings
3. User selects voice (Alloy, Echo, Fable, etc.)
4. User adjusts personality & speed
5. User clicks large mic button to start recording
6. Status: "Recording... Click to stop" (red pulsing)
7. User speaks their message
8. User clicks mic again to stop
9. Status: "Processing your speech..."
10. Status: "🔊 AI is responding..."
11. Audio plays in real-time as AI speaks
12. Transcript appears in chat
13. Status: "Click mic to start speaking"

### **Technical Flow**

#### **Frontend** (`public/app.js`)
```
Voice Button Click
├── Open voiceModal
├── User selects voice/personality/speed
└── User clicks voiceMicBtn

startRecording()
├── Request microphone access
│   └── navigator.mediaDevices.getUserMedia({ audio: true })
├── Create MediaRecorder
│   ├── mimeType: "audio/webm"
│   └── Collect audio chunks
├── Update UI
│   ├── voiceMicBtn.classList.add("recording")
│   ├── voiceIndicator.classList.add("recording")
│   └── Status: "Recording..."
└── Wait for user to stop

stopRecording()
├── mediaRecorder.stop()
├── Trigger mediaRecorder.onstop
│   ├── Create Blob from audioChunks
│   └── Call sendSpeechToSpeech(audioBlob)
└── Update status: "Processing..."

sendSpeechToSpeech(audioBlob)
├── Create FormData
│   ├── audio: audioBlob
│   ├── voice: selectedVoice
│   ├── speed: selectedSpeed
│   └── conversationHistory: JSON
├── POST /api/speech-to-speech
├── Read SSE stream
│   ├── Parse streaming chunks
│   ├── type: 'text' → Accumulate text
│   ├── type: 'audio' → Queue audio chunks
│   │   └── playAudioStream(audioQueue)
│   └── type: 'done' → Update history & display
└── Wait for audio completion

playAudioStream(audioQueue)
├── Create Web Audio API context
├── For each audio chunk:
│   ├── Decode base64 PCM16
│   ├── Convert to AudioBuffer
│   ├── Create BufferSource
│   ├── Connect to destination
│   ├── Play chunk
│   └── Wait for chunk to finish
└── Real-time audio playback
```

#### **Backend** (`server.js`)
```
POST /api/speech-to-speech
├── Validate audio file (multer)
├── Extract parameters
│   ├── voice (alloy, echo, fable, onyx, nova, shimmer)
│   ├── speed (0.5x - 2.0x)
│   └── conversationHistory
├── Convert audio to base64
├── Build messages array
│   └── Add: { role: "user", content: [{ type: "input_audio", input_audio: { data, format: "wav" }}]}
├── Set SSE headers
├── Call OpenAI API
│   ├── model: "gpt-4o-audio-preview"
│   ├── modalities: ["text", "audio"]
│   ├── audio: { voice, format: "pcm16" }
│   ├── stream: true (REQUIRED for audio)
│   └── messages: conversation history
├── Stream response
│   └── For each chunk:
│       ├── delta.content → Send: data: {"type":"text","content":"..."}\n\n
│       ├── delta.audio → Send: data: {"type":"audio","data":"..."}\n\n
│       └── finish_reason → Extract transcript
├── Send final message
│   └── data: {"type":"done","text":"...","transcript":"...","conversationHistory":[...]}\n\n
└── End stream
```

#### **Data Flow**
```
User Voice → MediaRecorder → Audio Blob → FormData
                                              ↓
                                    POST /api/speech-to-speech
                                              ↓
                                    Audio → Base64 → OpenAI
                                              ↓
                          SSE Stream ← Audio Chunks ← AI Voice Generation
                                              ↓
                          Frontend ← PCM16 Chunks ← Real-time Playback
                                              ↓
                          Web Audio API → Speakers → User Hears Response
```

---

## 3️⃣ Video Generation (PDF to D-ID Video)

### **User Flow**
1. User clicks 📹 video button
2. Video modal opens
3. User selects API type (Clips or Expressives)
4. User selects avatar style (Professional, Casual, etc.)
5. User uploads PDF document (drag & drop or click)
6. User enters optional prompt
7. User clicks "Generate Video"
8. Progress indicator shows:
   - ⏳ Initializing...
   - 📄 Extracting PDF text...
   - 🤖 Generating script with AI...
   - 🎬 Creating video with D-ID...
   - ✅ Video ready!
9. Video URL and script displayed
10. User can download or view video

### **Technical Flow**

#### **Frontend** (`public/app.js`)
```
Video Button Click
├── Open videoModal
├── User configures settings
│   ├── API Type: Clips or Expressives
│   ├── Avatar: professional, casual, cartoon, etc.
│   ├── Sentiment: (if Expressives) professional, friendly, serious
│   └── Prompt: optional customization
├── User uploads PDF
│   ├── Validate: PDF only
│   ├── Validate: Max 20MB
│   └── Display filename
└── User clicks "Generate Video"

videoGenerate.click()
├── Create FormData
│   ├── document: PDF file
│   ├── avatar: selected avatar
│   ├── prompt: user prompt
│   ├── model: LLM model
│   ├── apiType: clips/expressives
│   └── sentiment: (if expressives)
├── POST /api/doc-to-video
├── Receive job_id
├── Save to localStorage (for recovery)
└── Start pollVideoJobStatus(job_id)

pollVideoJobStatus(job_id)
├── Poll every 2 seconds
├── GET /api/video-status/:jobId
├── Update progress UI
│   ├── status: "processing" → Show progress
│   ├── status: "completed" → Show video URL
│   └── status: "failed" → Show error
├── Max 360 polls (12 minutes)
└── Clear localStorage on completion
```

#### **Backend** (`server.js`)
```
POST /api/doc-to-video
├── Rate limiting (5 requests/10min per IP)
├── Validate file
│   ├── Check: PDF type
│   ├── Check: Max 20MB
│   └── Multer upload
├── Create job
│   ├── Generate job_id
│   ├── Store in videoJobs Map
│   └── Set TTL (30 minutes)
├── Return job_id immediately
└── Process async: processVideoJob(job_id)

processVideoJob(job_id)
├── Update: status = "processing", progress = 10%
├── STEP 1: Extract PDF text
│   ├── Use pdf-parse library
│   ├── Validate: min 50 chars
│   ├── Validate: max 5000 chars (script length)
│   └── Update: progress = 30%
├── STEP 2: Generate script with LLM
│   ├── Call OpenRouter API
│   ├── Model: user-selected
│   ├── Prompt: "Create 30-60 second video script..."
│   ├── Retry with exponential backoff (3 attempts)
│   ├── Validate: script length < 500 chars
│   └── Update: progress = 60%
├── STEP 3: Create D-ID video
│   ├── Select API: Clips or Expressives
│   ├── Get avatar ID from DID_AVATARS config
│   ├── Build request
│   │   ├── Clips API: /clips
│   │   └── Expressives API: /talks
│   ├── POST to D-ID API
│   ├── Receive result_url
│   └── Update: progress = 100%
├── Update job: status = "completed"
└── Store: videoUrl, script, result

GET /api/video-status/:jobId
├── Find job in videoJobs Map
├── Return job data
│   ├── status: processing/completed/failed
│   ├── progress: 0-100
│   ├── videoUrl: (if completed)
│   ├── script: (if completed)
│   └── error: (if failed)
└── Auto-cleanup after TTL (30 min)
```

#### **Data Flow**
```
PDF Upload → Frontend Validation → FormData
                                       ↓
                              POST /api/doc-to-video
                                       ↓
                              Create Job → Return job_id
                                       ↓
                              Background Processing:
                                       ↓
PDF → pdf-parse → Text Extraction → Validation
                                       ↓
Text → OpenRouter API → LLM Script Generation → Retry Logic
                                       ↓
Script → D-ID API (Clips/Expressives) → Video Creation
                                       ↓
Video URL ← Job Completion ← Status Updates ← Progress Tracking
     ↓
Frontend Polling → Display Video → User Downloads
```

---

## 🔧 Key Technical Components

### **State Management**
- **Frontend**: localStorage for conversations, pending jobs
- **Backend**: In-memory Map for video jobs (30min TTL)

### **API Integrations**
1. **OpenRouter**: LLM chat, script generation
2. **OpenAI**: Speech-to-speech (gpt-4o-audio-preview)
3. **D-ID**: Video generation (Clips & Expressives APIs)

### **Streaming Technologies**
- **SSE (Server-Sent Events)**: Text chat, speech-to-speech
- **Web Audio API**: Real-time audio playback
- **MediaRecorder API**: Voice recording

### **Error Handling**
- Rate limiting (video: 5/10min)
- File validation (PDF, 20MB max)
- Retry logic (OpenRouter: 3 attempts, exponential backoff)
- Job recovery (localStorage for page refresh)
- Structured logging (JSON format)

### **Security**
- Helmet.js (CSP, XSS protection)
- Profanity filter (insult detection)
- CORS enabled
- File size limits
- IP-based rate limiting

---

## 📊 Performance Metrics

### **Response Times**
- **Text Chat**: ~1-3s (streaming starts immediately)
- **Speech-to-Speech**: ~2-5s (real-time audio streaming)
- **Video Generation**: ~30-90s (async with progress updates)

### **Resource Usage**
- **Memory**: In-memory job store with TTL cleanup
- **Bandwidth**: Streaming reduces initial payload
- **Storage**: No persistent storage (all in-memory)

---

## 🚀 Next Steps for Production

1. **Persistent Storage**: Redis/PostgreSQL for jobs
2. **Webhooks**: D-ID webhook support
3. **Cost Tracking**: API usage monitoring
4. **Concurrent Limits**: Max jobs per user
5. **Multilingual**: Script length per language
6. **Testing**: Unit tests, integration tests, E2E tests

---

*Last Updated: Feb 17, 2026*
