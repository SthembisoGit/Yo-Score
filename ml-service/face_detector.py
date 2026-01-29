import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, Any, Optional, List
import asyncio
from dataclasses import dataclass

@dataclass
class FaceAnalysis:
    face_count: int = 0
    gaze_direction: Optional[Dict[str, Any]] = None
    eyes_closed: bool = False
    face_coverage: float = 0.0  # 0-1, percentage of face covered
    confidence: float = 0.0
    landmarks: Optional[List] = None

class FaceDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_face_detection = mp.solutions.face_detection
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 0 for short-range, 1 for full-range
            min_detection_confidence=0.5
        )
        
    def is_ready(self) -> bool:
        return self.face_mesh is not None and self.face_detection is not None
    
    async def analyze_frame(self, image_bytes: bytes) -> Dict[str, Any]:
        """Analyze a single frame for face detection and attention"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._analyze_frame_sync, image_bytes)
    
    def _analyze_frame_sync(self, image_bytes: bytes) -> Dict[str, Any]:
        # Convert bytes to image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": "Could not decode image", "face_count": 0}
        
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        results = FaceAnalysis()
        
        # Detect faces
        face_results = self.face_detection.process(img_rgb)
        
        if face_results.detections:
            results.face_count = len(face_results.detections)
            
            # Analyze each face
            for detection in face_results.detections:
                bbox = detection.location_data.relative_bounding_box
                confidence = detection.score[0]
                
                # Face mesh for detailed analysis
                mesh_results = self.face_mesh.process(img_rgb)
                
                if mesh_results.multi_face_landmarks:
                    for face_landmarks in mesh_results.multi_face_landmarks:
                        # Analyze gaze direction
                        gaze = self._analyze_gaze_direction(face_landmarks, img.shape)
                        results.gaze_direction = gaze
                        
                        # Check if eyes are closed
                        results.eyes_closed = self._check_eyes_closed(face_landmarks)
                        
                        # Calculate face coverage (simplified)
                        results.face_coverage = self._calculate_face_coverage(face_landmarks, bbox)
                        
                        results.confidence = confidence
                        results.landmarks = [(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark[:10]]
        
        return self._to_dict(results)
    
    def _analyze_gaze_direction(self, landmarks, image_shape) -> Dict[str, Any]:
        """Estimate where the user is looking"""
        # Simplified gaze estimation using eye landmarks
        # MediaPipe landmarks indices: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
        
        # Left eye inner/outer corners
        left_eye_inner = landmarks.landmark[133]  # Left eye inner corner
        left_eye_outer = landmarks.landmark[33]   # Left eye outer corner
        
        # Right eye inner/outer corners
        right_eye_inner = landmarks.landmark[362]  # Right eye inner corner
        right_eye_outer = landmarks.landmark[263]  # Right eye outer corner
        
        # Nose tip
        nose_tip = landmarks.landmark[1]
        
        # Calculate horizontal gaze
        eye_width_left = abs(left_eye_outer.x - left_eye_inner.x)
        eye_width_right = abs(right_eye_outer.x - right_eye_inner.x)
        
        # Normalize positions
        left_eye_center_x = (left_eye_inner.x + left_eye_outer.x) / 2
        right_eye_center_x = (right_eye_inner.x + right_eye_outer.x) / 2
        eyes_center_x = (left_eye_center_x + right_eye_center_x) / 2
        
        # Determine gaze direction
        looking_away = False
        direction = "center"
        confidence = 0.7
        
        # Simple heuristic: if eyes are significantly offset from nose
        horizontal_offset = abs(eyes_center_x - nose_tip.x)
        
        if horizontal_offset > 0.1:  # Threshold
            looking_away = True
            direction = "left" if eyes_center_x < nose_tip.x else "right"
            confidence = min(0.9, 0.7 + horizontal_offset * 2)
        
        return {
            "looking_away": looking_away,
            "direction": direction,
            "horizontal_offset": float(horizontal_offset),
            "confidence": float(confidence)
        }
    
    def _check_eyes_closed(self, landmarks) -> bool:
        """Check if eyes are closed using EAR (Eye Aspect Ratio)"""
        # Eye landmark indices for MediaPipe
        # Left eye
        left_eye_top = landmarks.landmark[159]  # Upper lid
        left_eye_bottom = landmarks.landmark[145]  # Lower lid
        left_eye_left = landmarks.landmark[33]  # Left corner
        left_eye_right = landmarks.landmark[133]  # Right corner
        
        # Calculate Eye Aspect Ratio for left eye
        left_ear = self._calculate_ear(
            left_eye_top, left_eye_bottom,
            left_eye_left, left_eye_right
        )
        
        # Right eye
        right_eye_top = landmarks.landmark[386]
        right_eye_bottom = landmarks.landmark[374]
        right_eye_left = landmarks.landmark[362]
        right_eye_right = landmarks.landmark[263]
        
        right_ear = self._calculate_ear(
            right_eye_top, right_eye_bottom,
            right_eye_left, right_eye_right
        )
        
        # Average EAR
        ear = (left_ear + right_ear) / 2
        
        # Threshold for closed eyes (typically ~0.2-0.3)
        return ear < 0.25
    
    def _calculate_ear(self, top, bottom, left, right):
        """Calculate Eye Aspect Ratio"""
        # Vertical distances
        A = self._distance(top, bottom)
        # Horizontal distance
        B = self._distance(left, right)
        
        if B == 0:
            return 0
        
        return A / B
    
    def _distance(self, point1, point2):
        """Calculate Euclidean distance between two points"""
        return np.sqrt(
            (point1.x - point2.x) ** 2 +
            (point1.y - point2.y) ** 2 +
            (point1.z - point2.z) ** 2
        )
    
    def _calculate_face_coverage(self, landmarks, bbox) -> float:
        """Estimate how much of the face is covered"""
        # Simplified: check if key facial landmarks are visible
        key_landmarks = [
            1,   # Nose tip
            33,  # Left eye outer
            133, # Left eye inner
            362, # Right eye inner
            263, # Right eye outer
            17,  # Left mouth corner
            61,  # Right mouth corner
        ]
        
        visible_count = 0
        total_count = len(key_landmarks)
        
        for idx in key_landmarks:
            lm = landmarks.landmark[idx]
            # Check if landmark is within face bounding box with some margin
            if (bbox.xmin <= lm.x <= bbox.xmin + bbox.width and
                bbox.ymin <= lm.y <= bbox.ymin + bbox.height):
                visible_count += 1
        
        coverage = 1 - (visible_count / total_count)
        return max(0, min(1, coverage))
    
    def _to_dict(self, analysis: FaceAnalysis) -> Dict[str, Any]:
        return {
            "face_count": analysis.face_count,
            "gaze_direction": analysis.gaze_direction,
            "eyes_closed": analysis.eyes_closed,
            "face_coverage": float(analysis.face_coverage),
            "confidence": float(analysis.confidence),
            "has_face": analysis.face_count > 0
        }