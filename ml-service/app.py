from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import asyncio
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

app = FastAPI(title="YoScore ML Proctoring Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _safe_init(name: str, factory):
    try:
        detector = factory()
        print(f"[ml-service] {name} initialized")
        return detector
    except Exception as exc:
        print(f"[ml-service] {name} failed to initialize: {exc}")
        return None

ENABLE_FACE_DETECTOR = os.getenv("ENABLE_FACE_DETECTOR", "true").lower() == "true"
ENABLE_AUDIO_ANALYZER = os.getenv("ENABLE_AUDIO_ANALYZER", "false").lower() == "true"
ENABLE_OBJECT_DETECTOR = os.getenv("ENABLE_OBJECT_DETECTOR", "false").lower() == "true"
DEEP_REVIEW_AVAILABLE = os.getenv("ENABLE_DEEP_REVIEW", "true").lower() == "true"


def _build_face_detector():
    from face_detector import FaceDetector

    return FaceDetector()


def _build_audio_analyzer():
    from audio_analyzer import AudioAnalyzer

    return AudioAnalyzer()


def _build_object_detector():
    from object_detector import ObjectDetector

    return ObjectDetector()


# Initialize detectors (safe, do not crash process)
face_detector = _safe_init("face detector", _build_face_detector) if ENABLE_FACE_DETECTOR else None
audio_analyzer = _safe_init("audio analyzer", _build_audio_analyzer) if ENABLE_AUDIO_ANALYZER else None
object_detector = _safe_init("object detector", _build_object_detector) if ENABLE_OBJECT_DETECTOR else None

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
        if face_detector is None or not face_detector.is_ready():
            raise HTTPException(status_code=503, detail="Face detector is unavailable")

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
        
    except HTTPException:
        raise
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
    tmp_path = None
    try:
        if audio_analyzer is None or not audio_analyzer.is_ready():
            raise HTTPException(status_code=503, detail="Audio analyzer is unavailable")

        # Read audio
        contents = await audio.read()
        
        # Save temporarily. Preserve upload format so decoding can choose the right backend.
        import tempfile

        extension = os.path.splitext(audio.filename or '')[1].lower()
        content_type = (audio.content_type or '').lower()
        if extension not in {'.webm', '.wav', '.ogg', '.mp3', '.m4a', '.mp4'}:
            if 'wav' in content_type:
                extension = '.wav'
            elif 'ogg' in content_type:
                extension = '.ogg'
            elif 'mpeg' in content_type or 'mp3' in content_type:
                extension = '.mp3'
            elif 'mp4' in content_type or 'm4a' in content_type:
                extension = '.mp4'
            else:
                extension = '.webm'

        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        # Analyze audio
        results = await audio_analyzer.analyze_audio(tmp_path, duration_ms)

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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.post("/api/analyze/object")
async def analyze_object(
    image: UploadFile = File(...),
    session_id: str = Query(...),
    timestamp: str = Query(...),
    analysis_type: str = Query("object")
):
    """Detect forbidden objects (phones, books, second monitor)"""
    try:
        if object_detector is None or not object_detector.is_ready():
            raise HTTPException(status_code=503, detail="Object detector is unavailable")

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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    face_live = bool(face_detector and face_detector.is_ready())
    audio_live = bool(audio_analyzer and audio_analyzer.is_ready())
    object_live = bool(object_detector and object_detector.is_ready())
    degraded_reasons = []

    if ENABLE_FACE_DETECTOR and not face_live:
        degraded_reasons.append("face_detector_unavailable")
    if ENABLE_AUDIO_ANALYZER and not audio_live:
        degraded_reasons.append("audio_detector_unavailable")
    if ENABLE_OBJECT_DETECTOR and not object_live:
        degraded_reasons.append("object_detector_unavailable")

    return {
        "status": "healthy",
        "service": "ML Proctoring",
        "mode": "two_phase_lite",
        "timestamp": datetime.utcnow().isoformat(),
        "detectors": {
            "face": face_live,
            "audio": audio_live,
            "object": object_live
        },
        "flags": {
            "enable_face_detector": ENABLE_FACE_DETECTOR,
            "enable_audio_analyzer": ENABLE_AUDIO_ANALYZER,
            "enable_object_detector": ENABLE_OBJECT_DETECTOR,
        },
        "capabilities": {
            "face_live": face_live,
            "audio_live": audio_live,
            "deep_review_available": DEEP_REVIEW_AVAILABLE,
            "browser_consensus": True,
        },
        "degraded_reasons": degraded_reasons,
    }

@app.get("/capabilities")
async def capabilities():
    health = await health_check()
    return {
        "success": True,
        "data": {
            "capabilities": health.get("capabilities", {}),
            "degraded_reasons": health.get("degraded_reasons", []),
            "detectors": health.get("detectors", {}),
        },
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
