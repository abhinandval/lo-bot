# Whisper STT Service with Silero VAD
FROM python:3.11-slim

# Install dependencies
RUN pip install --no-cache-dir \
    faster-whisper \
    silero-vad \
    onnxruntime \
    websockets \
    fastapi \
    uvicorn \
    numpy

# Copy service
COPY whisper-service.py /app/
WORKDIR /app

# Expose ports
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "whisper-service.py"]