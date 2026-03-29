import asyncio
import edge_tts
import sys
import base64
import json
import io
import re

# J.A.R.V.I.S. Persistent TTS Engine v17.0
# Eliminates 300ms startup lag by keeping the process alive.

def contains_tamil(text):
    # Regex to detect Tamil Unicode range (U+0B80 to U+0BFF)
    return bool(re.search(r'[\u0b80-\u0bff]', text))

async def process_tts():
    # v18.1 NATURAL FEMALE PERSONA (Sonia)
    ENGLISH_VOICE = "en-GB-SoniaNeural"
    
    # Ready signal to Node
    print(json.dumps({"type": "status", "message": "TTS_READY"}), flush=True)

    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        if not line:
            break
            
        try:
            data = json.loads(line)
            text = data.get("text", "")
            if not text:
                continue

            rate = "+25%"
            pitch = "-5Hz"

            communicate = edge_tts.Communicate(text, ENGLISH_VOICE, rate=rate, pitch=pitch)
            audio_data = io.BytesIO()
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.write(chunk["data"])
            
            full_audio = audio_data.getvalue()
            if full_audio:
                b64_data = base64.b64encode(full_audio).decode('utf-8')
                print(json.dumps({"type": "audio", "data": b64_data}), flush=True)
                
        except Exception as e:
            print(json.dumps({"type": "error", "message": str(e)}), flush=True)

if __name__ == "__main__":
    try:
        asyncio.run(process_tts())
    except KeyboardInterrupt:
        pass
