import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleCommand } from './action_core.js'; // v15.0

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
   cors: { origin: "*", methods: ["GET", "POST"] }
});

const port = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
   console.error('[CRITICAL] GROQ_API_KEY is missing from environment variables.');
   process.exit(1);
}
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Mia v15.0 NEURAL LINK DATA TRACE
io.on('connection', (socket) => {
   console.log('[Mia v15.0] Neural Link Established.');
   let audioBuffer = [];
   let chunkCounter = 0;

   // v21.0 ADVANCED SESSION & INPUT LOCKS
   let isAwake = true;
   let isProcessing = false;
   let lastProcessedText = ""; // Duplicate Shield
   let lastProcessedTime = 0;   // Duplicate Shield
   let hasSaidWelcome = false;  // Polite Mode
   let sleepTimeout = setTimeout(() => {
      isAwake = false;
      socket.emit('awake-status', false);
   }, 30000);

   // Emit initial status
   socket.emit('awake-status', true);

   // v17.0 PERSISTENT TTS ENGINE IPC
   const ttsServer = spawn('python', ['tts_server.py']);
   ttsServer.stdout.on('data', (data) => {
      data.toString().split('\n').forEach(line => {
         if (line.trim()) {
            try {
               const json = JSON.parse(line);
               if (json.type === 'audio') {
                  socket.emit('audio-payload', json.data);
               } else if (json.type === 'status') {
                  console.log(`[TTS] ${json.message}`);
               }
            } catch (e) { }
         }
      });
   });

   // 1. RECEIVE AUDIO CHUNK (REAL-TIME STREAM)
   socket.on('audio-chunk', (chunk) => {
      audioBuffer.push(Buffer.from(chunk));
      chunkCounter++;
   });

   // 2. PROCESS NEURAL UTTERANCE (VAD TRIGGERED)
   socket.on('process-utterance', async () => {
      if (isProcessing) return; // Ignore if already processing to avoid duplicate/delayed responses
      if (audioBuffer.length === 0) return;

      console.log(`[J.A.R.V.I.S.] Processing Utterance...`);
      isProcessing = true;
      const fullAudio = Buffer.concat(audioBuffer);
      audioBuffer = [];
      chunkCounter = 0;

      try {
         // v16.0 ZERO-DISK STT CONVERSION (Native Memory Processing)
         const blob = new Blob([fullAudio], { type: 'audio/webm' });
         const formData = new FormData();
         formData.append('file', blob, 'audio.webm');
         formData.append('model', 'whisper-large-v3');

         // v18.0 AUTOMATIC ENGLISH TRANSLATION (Bridges Tamil/Thanglish Input)
         const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: formData
         });

         if (!response.ok) {
            throw new Error(`Groq API Error: ${response.statusText}`);
         }

         const result = await response.json();
         const transcript = (result.text || "").trim();
         console.log(`[STT RESULT] RAW: "${transcript}"`);

         if (transcript.length > 1) {

            // v20.0 IMMEDIATE FEEDBACK - Emit transcription before LLM processing
            socket.emit('transcription', transcript);
            console.log(`> USER: ${transcript}`);

            // v21.0 WAKE WORD NORMALIZATION (Mia / Jarvis / Hey ...)
            const awakeRegex = /^(?:mia|jarvis|hey mia|hey jarvis|hello mia|hello jarvis|hi mia|hi jarvis|ok mia|ok jarvis|mia,|jarvis,)\.?\s*(.*)$/i;
            const match = transcript.trim().match(awakeRegex);
            const hasWakeWord = !!match;
            const strippedTranscript = hasWakeWord ? match[1].trim() : transcript.trim();

            // v21.0 DUPLICATE SHIELD (3s Cooldown for identical inputs)
            const currentTime = Date.now();
            if (strippedTranscript === lastProcessedText && (currentTime - lastProcessedTime) < 3000) {
               console.log(`[MIA] Blocked Duplicate: "${strippedTranscript}"`);
               socket.emit('silence-filtered');
               isProcessing = false;
               return;
            }

            // v21.2 STRICT FILLER & HALLUCINATION SHIELD
            const hallucinationRegex = /^(thank you|thanks|thanks for watching|subscribe|okay|ok|hmm|uh|um|umm|hmm|well|basically|actually|kind of|you know|means)\.?$/i;

            if (hallucinationRegex.test(strippedTranscript)) {
               // v22.0 POLITE PERSISTENCE (Always acknowledge 'Thank you')
               if (strippedTranscript.toLowerCase().includes('thank')) {
                  const welcomeMsg = "You're very welcome!";
                  socket.emit('speech-start');
                  socket.emit('text-chunk', welcomeMsg);
                  ttsServer.stdin.write(JSON.stringify({ text: welcomeMsg }) + '\n');
                  socket.emit('ai-response', welcomeMsg);
                  socket.emit('speech-end');
                  lastProcessedText = strippedTranscript;
                  lastProcessedTime = currentTime;
                  isProcessing = false;
                  return;
               }
               console.log(`[MIA] Filtered Hallucination: "${strippedTranscript}"`);
               socket.emit('silence-filtered');
               isProcessing = false;
               return;
            }

            if (!isAwake && !hasWakeWord) {
               socket.emit('silence-filtered');
               isProcessing = false;
               return;
            }

            if (hasWakeWord) {
               isAwake = true;
               socket.emit('awake-status', true);
               console.log(`\x1b[33m[STT] WAKE-WORD DETECTED! (Normalization: ${hasWakeWord ? 'Triggered' : 'Persistent'}).\x1b[0m`);
            }

            // Update Duplicate Shield State
            lastProcessedText = strippedTranscript;
            lastProcessedTime = currentTime;

            // Session persistence: Reset timer on *any* successful interaction
            clearTimeout(sleepTimeout);
            sleepTimeout = setTimeout(() => {
               isAwake = false;
               hasSaidWelcome = false; // Reset polite mode on sleep
               socket.emit('awake-status', false);
               console.log(`[MIA] Core Entering Sleep Mode.`);
            }, 30000); // 30 second active session

            // v21.0 DIRECT ACTIVATION FEEDBACK (If no command follows wake word)
            if (hasWakeWord && strippedTranscript === "") {
               const responseText = "I'm here for you! How can I help you today?";
               socket.emit('speech-start');
               socket.emit('text-chunk', responseText);
               ttsServer.stdin.write(JSON.stringify({ text: responseText }) + '\n');
               socket.emit('ai-response', responseText);
               socket.emit('speech-end');
               isProcessing = false;
               return;
            }

            // v15.0 ACTION INTERCEPTOR (OS CONTROL)
            const action = handleCommand(strippedTranscript);
            if (action.intercepted) {
               socket.emit('speech-start'); // v19.0 SYNC
               socket.emit('text-chunk', action.responseText);
               // v17.0 PERSISTENT IPC PUSH
               ttsServer.stdin.write(JSON.stringify({ text: action.responseText }) + '\n');
               console.log(`\x1b[36m> Mia: [SYSTEM ACTION] ${action.responseText}\x1b[0m`);
               socket.emit('ai-response', action.responseText); // v19.2 History Log
               socket.emit('speech-end'); // v19.0 SYNC
               isProcessing = false;
               return; // Bypass LLM entirely for zero-latency execution
            }

            // LLM STREAMING (LLAMA 3.1)
            socket.emit('speech-start'); // v19.0 SYNC
            const chatStream = await groq.chat.completions.create({
               messages: [
                  {
                     role: "system",
                     content: `You are Mia, a warm, friendly, and highly intelligent AI assistant.
                     Linguistic Protocol:
                     - ALWAYS respond in a friendly, conversational, and helpful tone.
                     - Use sleek and professional English, but keep it warm.
                     - Do NOT call the user 'Sir' or 'Master'. Just be direct and friendly.
                     - Be brief and to the point (Maximum 2 sentences).`
                  },
                  { role: "user", content: strippedTranscript }
               ],
               model: "llama-3.1-8b-instant",
               stream: true,
            });

            let sentenceBuffer = "";
            let fullResponse = ""; // v14.2 TRACK FULL NEURAL RESPONSE
            for await (const chunk of chatStream) {
               const content = chunk.choices[0]?.delta?.content || "";
               if (content) {
                  sentenceBuffer += content;
                  fullResponse += content;
                  socket.emit('text-chunk', content);

                  // v15.1 HYPER-SPEED TTS STREAMING (Chunking at punctuation to drop latency)
                  if (content.match(/[.,!?]/) || sentenceBuffer.split(' ').length > 8) {
                     if (sentenceBuffer.trim().length > 2) {
                        // v17.0 PERSISTENT IPC PUSH
                        ttsServer.stdin.write(JSON.stringify({ text: sentenceBuffer.trim() }) + '\n');
                     }
                     sentenceBuffer = "";
                  }
               }
            }
            if (sentenceBuffer.trim().length > 1) {
               ttsServer.stdin.write(JSON.stringify({ text: sentenceBuffer.trim() }) + '\n');
            }

            // v19.0 SYNC - Notify frontend that generation is complete
            socket.emit('speech-end');
            socket.emit('ai-response', fullResponse.trim()); // v19.2 History Log
            isProcessing = false;

            // PRINT FULL RESPONSE TO BACKEND TERMINAL
            console.log(`\x1b[36m> Mia: ${fullResponse.trim()}\x1b[0m`);
         } else {
            socket.emit('silence-filtered');
            isProcessing = false;
         }

      } catch (error) {
         console.error('[MIA ERROR]', error);
         socket.emit('system-error', 'Neural Sync Failure.');
         isProcessing = false;
      }
   });

   socket.on('speak-text', (text) => {
      if (text) ttsServer.stdin.write(JSON.stringify({ text }) + '\n');
   });

   socket.on('disconnect', () => {
      console.log('[Mia v17.0] Neural Link Offline.');
      try { ttsServer.kill(); } catch (e) { }
   });
});

// START SERVER
httpServer.listen(port, () => {
   console.log(`[Mia v17.0] Neural Core on port ${port}`);
});
