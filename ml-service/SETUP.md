# ML Service Setup Guide

## Prerequisites

- Python 3.11 or 3.12 (recommended - Python 3.14 may have compatibility issues)
- pip (Python package manager)

## Installation

### Step 1: Install Python Dependencies

```bash
# Navigate to ml-service directory
cd ml-service

# Upgrade pip and setuptools first
python -m pip install --upgrade pip setuptools wheel

# Install requirements
pip install -r requirements.txt
```

### Step 2: Verify Installation

```bash
# Check if all packages are installed
python -c "import cv2, numpy, librosa, fastapi, uvicorn; print('All packages installed successfully')"
```

### Step 3: Run the Service

```bash
# Start the ML service (no reload — avoids Windows/Python 3.14 multiprocessing errors)
python -m uvicorn app:app --host 0.0.0.0 --port 5000
```

Or run the app directly:
```bash
python app.py
```

The service will be available at `http://localhost:5000`

**Note:** Do not use `--reload` on Windows with Python 3.14; it can cause a multiprocessing/WatchFiles traceback. Use the commands above without `--reload`.

## Troubleshooting

### Issue: Traceback in multiprocessing / WatchFiles (Windows, Python 3.14)

**Solution:** Run without reload:
```bash
python -m uvicorn app:app --host 0.0.0.0 --port 5000
```
Or: `python app.py`

### Issue: "Cannot import 'setuptools.build_meta'"

**Solution**: Upgrade setuptools first:
```bash
pip install --upgrade setuptools wheel
pip install -r requirements.txt
```

### Issue: "No module named uvicorn"

**Solution**: Install uvicorn explicitly (run in PowerShell or Command Prompt):
```bash
pip install uvicorn
```
Or with optional dependencies:
```bash
pip install "uvicorn[standard]"
```
Then start the service:
```bash
cd ml-service
python -m uvicorn app:app --host 0.0.0.0 --port 5000
```

### Issue: Package installation fails for numpy/opencv-python

**Solution**: Install build dependencies first:
```bash
pip install --upgrade pip setuptools wheel
pip install numpy opencv-python --no-cache-dir
pip install -r requirements.txt
```

### Issue: MediaPipe installation fails

**Solution**: MediaPipe requires specific Python versions. Use Python 3.11 or 3.12:
```bash
# Using pyenv (recommended)
pyenv install 3.12.0
pyenv local 3.12.0
pip install -r requirements.txt
```

## Testing the Service

### Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "ML Proctoring",
  "mode": "two_phase_lite",
  "timestamp": "2026-02-04T...",
  "detectors": {
    "face": true,
    "audio": false,
    "object": false
  },
  "capabilities": {
    "face_live": true,
    "audio_live": false,
    "deep_review_available": true,
    "browser_consensus": true
  },
  "degraded_reasons": []
}
```

### Test Face Analysis

```bash
# Using curl (replace with actual image file)
curl -X POST "http://localhost:5000/api/analyze/face?session_id=test&timestamp=2026-02-04T00:00:00Z&analysis_type=face" \
  -F "image=@test_image.jpg"
```

### Test Audio Analysis

```bash
# Using curl (replace with actual audio file)
curl -X POST "http://localhost:5000/api/analyze/audio?session_id=test&timestamp=2026-02-04T00:00:00Z&analysis_type=audio&duration_ms=10000" \
  -F "audio=@test_audio.webm"
```

## Configuration

Set the ML service URL in your backend `.env`:

```env
ML_SERVICE_URL=http://localhost:5000
ENABLE_FACE_DETECTOR=true
ENABLE_AUDIO_ANALYZER=false
ENABLE_OBJECT_DETECTOR=false
AUDIO_TRANSCRIPTION_MODE=disabled
```

## Production Deployment

For production, use a process manager like `systemd` or `supervisor`:

### systemd Example

Create `/etc/systemd/system/ml-proctoring.service`:

```ini
[Unit]
Description=YoScore ML Proctoring Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/ml-service
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 5000
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ml-proctoring
sudo systemctl start ml-proctoring
```

## Performance Notes

- Face analysis: ~100-300ms per frame
- Audio analysis: ~500-1000ms per 10-second chunk
- Memory usage: ~200-500MB
- CPU usage: Moderate (depends on analysis frequency)

## Security Notes

- The service should only be accessible from the backend server
- Use firewall rules to restrict access
- Consider using HTTPS in production
- Validate all inputs to prevent injection attacks
