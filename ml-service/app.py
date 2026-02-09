from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any

from face_detector import FaceDetector
from audio_analyzer import AudioAnalyzer
from object_detector import ObjectDetector

app = FastAPI(title="YoScore ML Proctoring Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detectors
face_detector = FaceDetector()
audio_analyzer = AudioAnalyzer()
object_detector = ObjectDetector()

class AnalysisRequest(BaseModel):
    session_id: str
    analysis_type: str  # 'face', 'audio', 'object'
    timestamp: str
    metadata: Optional[Dict[str, Any]] = None

class FaceAnalysisRequest(AnalysisRequest):
    analysis_type: str = "face"

class AudioAnalysisRequest(AnalysisRequest):
    analysis_type: str = "audio"
    duration_ms: int

class ObjectAnalysisRequest(AnalysisRequest):
    analysis_type: str = "object"

@app.post("/api/analyze/face")
async def analyze_face(
    image: UploadFile = File(...),
    session_id: str = Query(...),
    timestamp: str = Query(...),
    analysis_type: str = Query("face")
):
    """Analyze face for focus, attention, and cheating detection"""
    try:
        # Read image
        contents = await image.read()
        
        # Analyze face
        results = await face_detector.analyze_frame(contents)
        
        # Detect violations
        violations = []
        
        # Multiple faces detection
        if results.get('face_count', 0) > 1:
            violations.append({
                'type': 'multiple_faces',
                'confidence': results.get('confidence', 0.8),
                'description': f'Detected {results["face_count"]} faces'
            })
        
        # No face detection
        elif results.get('face_count', 0) == 0:
            violations.append({
                'type': 'no_face',
                'confidence': 0.9,
                'description': 'No face detected in frame'
            })
        
        # Face direction (looking away)
        if results.get('gaze_direction'):
            gaze = results['gaze_direction']
            if gaze.get('looking_away', False):
                violations.append({
                    'type': 'looking_away',
                    'confidence': gaze.get('confidence', 0.7),
                    'description': f'User looking {gaze.get("direction", "away")}'
                })
        
        # Eyes closed
        if results.get('eyes_closed', False):
            violations.append({
                'type': 'eyes_closed',
                'confidence': results.get('eye_confidence', 0.8),
                'description': 'Eyes detected as closed'
            })
        
        # Face coverage (mask, hand)
        if results.get('face_coverage', 0) > 0.3:
            violations.append({
                'type': 'face_covered',
                'confidence': results.get('coverage_confidence', 0.75),
                'description': f'Face covered ({results["face_coverage"]*100:.1f}%)'
            })
        
        return {
            'success': True,
            'session_id': session_id,
            'timestamp': timestamp,
            'analysis_type': analysis_type,
            'results': results,
            'violations': violations,
            'violation_count': len(violations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/audio")
async def analyze_audio(
    audio: UploadFile = File(...),
    session_id: str = Query(...),
    timestamp: str = Query(...),
    duration_ms: int = Query(10000),
    analysis_type: str = Query("audio")
):
    """Analyze audio for speech, external help, and unusual sounds"""
    try:
        # Read audio
        contents = await audio.read()
        
        # Save temporarily
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        # Analyze audio
        results = await audio_analyzer.analyze_audio(tmp_path, duration_ms)
        
        # Clean up
        os.unlink(tmp_path)
        
        # Detect violations
        violations = []
        
        # Speech detection
        if results.get('has_speech', False):
            violations.append({
                'type': 'speech_detected',
                'confidence': results.get('speech_confidence', 0.85),
                'description': f'Speech detected: "{results.get("transcript", "...")[:50]}"'
            })
        
        # Multiple voices
        if results.get('voice_count', 0) > 1:
            violations.append({
                'type': 'multiple_voices',
                'confidence': results.get('voice_confidence', 0.7),
                'description': f'Detected {results["voice_count"]} distinct voices'
            })
        
        # Background noise level
        if results.get('noise_level', 0) > 0.7:
            violations.append({
                'type': 'high_background_noise',
                'confidence': 0.65,
                'description': f'High background noise ({results["noise_level"]*100:.1f}%)'
            })
        
        # Keyword detection (cheating related)
        suspicious_keywords = results.get('suspicious_keywords', [])
        if suspicious_keywords:
            violations.append({
                'type': 'suspicious_conversation',
                'confidence': 0.8,
                'description': f'Detected suspicious keywords: {", ".join(suspicious_keywords[:3])}'
            })
        
        return {
            'success': True,
            'session_id': session_id,
            'timestamp': timestamp,
            'analysis_type': analysis_type,
            'results': results,
            'violations': violations,
            'violation_count': len(violations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/object")
async def analyze_object(
    image: UploadFile = File(...),
    session_id: str = Query(...),
    timestamp: str = Query(...),
    analysis_type: str = Query("object")
):
    """Detect forbidden objects (phones, books, second monitor)"""
    try:
        # Read image
        contents = await image.read()
        
        # Analyze objects
        results = await object_detector.detect_objects(contents)
        
        # Detect violations
        violations = []
        forbidden_objects = []
        
        # Check for forbidden objects
        forbidden_categories = ['cell phone', 'book', 'laptop', 'monitor', 'tablet']
        
        for obj in results.get('objects', []):
            if obj['category'] in forbidden_categories and obj['confidence'] > 0.6:
                forbidden_objects.append({
                    'object': obj['category'],
                    'confidence': obj['confidence']
                })
        
        if forbidden_objects:
            violations.append({
                'type': 'forbidden_object',
                'confidence': max([o['confidence'] for o in forbidden_objects]),
                'description': f'Detected forbidden objects: {", ".join([o["object"] for o in forbidden_objects])}'
            })
        
        # Screen sharing detection (multiple screens)
        if results.get('screen_count', 0) > 1:
            violations.append({
                'type': 'multiple_screens',
                'confidence': results.get('screen_confidence', 0.75),
                'description': f'Detected {results["screen_count"]} screens'
            })
        
        return {
            'success': True,
            'session_id': session_id,
            'timestamp': timestamp,
            'analysis_type': analysis_type,
            'results': results,
            'violations': violations,
            'violation_count': len(violations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ML Proctoring",
        "timestamp": datetime.utcnow().isoformat(),
        "detectors": {
            "face": face_detector.is_ready(),
            "audio": audio_analyzer.is_ready(),
            "object": object_detector.is_ready()
        }
    }

if __name__ == "__main__":
    # reload=False avoids multiprocessing/WatchFiles errors on Windows (especially Python 3.14)
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5000,
        reload=False,
        log_level="info"
    )
