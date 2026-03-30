# ML Service Workspace

This folder contains the FastAPI-based ML service used for proctoring checks and degraded-mode
analysis support.

## Main files

- `app.py`: service entry point and route definitions
- `audio_analyzer.py`: audio-processing helpers
- `requirements.txt`: Python dependencies
- `SETUP.md`: local setup and health-check instructions

## Local development

```bash
cd ml-service
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 5000
```

If you want local audio analysis enabled, set `ENABLE_AUDIO_ANALYZER=true` in `ml-service/.env`.
