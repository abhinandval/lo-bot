"""
Whisper STT Service with Silero VAD
Provides HTTP and WebSocket endpoints for streaming transcription
"""
import asyncio
import base64
import json
from pathlib import Path
from typing import AsyncGenerator
import numpy as np
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, get_speech_timestamps
import websockets
from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

# Load models (lazy loading)
vad_model = None
whisper_model = None


def get_vad_model():
    global vad_model
    if vad_model is None:
        vad_model = load_silero_vad()
    return vad_model


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return whisper_model


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "whisper-vad"}


@app.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...)):
    """Batch transcription endpoint"""
    audio_data = await file.read()
    audio = np.frombuffer(audio_data, dtype=np.float32)
    
    model = get_whisper_model()
    segments, info = model.transcribe(audio, language="en")
    
    text = " ".join([seg.text for seg in segments])
    return JSONResponse({"text": text, "language": info.language})


@app.websocket("/stream")
async def stream_transcribe(websocket: WebSocket):
    """Streaming VAD + STT WebSocket endpoint"""
    await websocket.accept()
    
    vad = get_vad_model()
    whisper = get_whisper_model()
    
    audio_buffer = []
    speech_detected = False
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            if data.get("type") == "audio":
                pcm = base64.b64decode(data["data"])
                audio = np.frombuffer(pcm, dtype=np.float32)
                
                # VAD detection
                speech_timestamps = get_speech_timestamps(
                    audio, vad, min_speech_duration_ms=250
                )
                
                if speech_timestamps and not speech_detected:
                    speech_detected = True
                    await websocket.send(json.dumps({
                        "type": "vad",
                        "state": "speech-start"
                    }))
                
                if speech_timestamps:
                    # Collect audio for transcription
                    for ts in speech_timestamps:
                        speech_audio = audio[ts["start"]:ts["end"]]
                        audio_buffer.append(speech_audio)
                else:
                    # Silence - check if we had speech to process
                    if speech_detected and audio_buffer:
                        await websocket.send(json.dumps({
                            "type": "vad",
                            "state": "speech-end"
                        }))
                        
                        # Process collected audio
                        full_audio = np.concatenate(audio_buffer)
                        segments, _ = whisper.transcribe(full_audio)
                        
                        for seg in segments:
                            await websocket.send(json.dumps({
                                "type": "transcript",
                                "text": seg.text,
                                "isFinal": True
                            }))
                        
                        audio_buffer = []
                        speech_detected = False
                        
            elif data.get("type") == "stop":
                break
                
    except Exception as e:
        await websocket.send(json.dumps({
            "type": "error",
            "error": str(e)
        }))
    finally:
        await websocket.close()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
