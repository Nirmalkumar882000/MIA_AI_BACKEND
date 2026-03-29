import sys
import os
import json
from groq import Groq
import dotenv

# LOAD PERIPHERAL ENV
dotenv.load_dotenv()

def transcribe_audio(file_path):
    # Retrieve API Key from environment
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print(json.dumps({"type": "error", "message": "GROQ_API_KEY not found"}), flush=True)
        return
    client = Groq(api_key=api_key)

    try:
        with open(file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(file_path, audio_file.read()),
                model="whisper-large-v3-turbo",
                prompt="Iron Man HUD interact J.A.R.V.I.S.",
                response_format="json",
                language="en"
            )
        
        # J.A.R.V.I.S. v13.0 Neural Sync Refinement
        transcript_text = transcription.text if transcription and transcription.text else ""
        sys.stderr.write(f"[DEBUG] Heartbeat: [STT_ACTIVE] Transcribed {len(transcript_text)} chars\n")
        
        # Output clean JSON for Node.js IPC
        print(json.dumps({"type": "transcription", "text": transcript_text}), flush=True)

    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}), flush=True)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        transcribe_audio(sys.argv[1])
    else:
        print(json.dumps({"type": "error", "message": "No audio file provided"}), flush=True)
