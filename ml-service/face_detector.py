import asyncio
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

def _get_mediapipe_solutions():
    backend = os.getenv("FACE_DETECTOR_BACKEND", "opencv").lower().strip()
    if backend != "mediapipe":
        return None
    try:
        import mediapipe as mp  # type: ignore
    except Exception:
        return None
    return getattr(mp, "solutions", None)


@dataclass
class FaceAnalysis:
    face_count: int = 0
    gaze_direction: Optional[Dict[str, Any]] = None
    eyes_closed: bool = False
    face_coverage: float = 0.0
    confidence: float = 0.0
    face_box: Optional[Dict[str, float]] = None
    landmarks: Optional[List] = None


class FaceDetector:
    """
    Face detector with two modes:
    1) MediaPipe solutions API (preferred, if available)
    2) OpenCV Haar cascades fallback (keeps service running on constrained hosts)
    """

    def __init__(self):
        self.mode = "opencv"

        self.face_mesh = None
        self.face_detection = None
        self.face_cascade = None
        self.eye_cascade = None

        solutions = _get_mediapipe_solutions()
        if solutions is not None:
            try:
                self.mp_face_mesh = solutions.face_mesh
                self.mp_face_detection = solutions.face_detection
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    max_num_faces=2,
                    refine_landmarks=True,
                    min_detection_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                self.face_detection = self.mp_face_detection.FaceDetection(
                    model_selection=0,
                    min_detection_confidence=0.45,
                )
                self.mode = "mediapipe"
            except Exception:
                self._init_opencv_fallback()
        else:
            self._init_opencv_fallback()

    def _init_opencv_fallback(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
        self.mode = "opencv"

    def is_ready(self) -> bool:
        if self.mode == "mediapipe":
            return self.face_mesh is not None and self.face_detection is not None
        return self.face_cascade is not None and not self.face_cascade.empty()

    async def analyze_frame(self, image_bytes: bytes) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._analyze_frame_sync, image_bytes)

    def _analyze_frame_sync(self, image_bytes: bytes) -> Dict[str, Any]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": "Could not decode image", "face_count": 0, "has_face": False}

        if self.mode == "mediapipe" and self.face_detection is not None and self.face_mesh is not None:
            return self._analyze_with_mediapipe(img)
        return self._analyze_with_opencv(img)

    def _analyze_with_opencv(self, img: np.ndarray) -> Dict[str, Any]:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
        )

        results = FaceAnalysis(face_count=len(faces))
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda f: int(f[2]) * int(f[3]))
            frame_h, frame_w = gray.shape[:2]
            x_center = (x + (w / 2)) / frame_w
            y_center = (y + (h / 2)) / frame_h

            results.face_box = {
                "x_center": float(x_center),
                "y_center": float(y_center),
                "width": float(w / frame_w),
                "height": float(h / frame_h),
            }
            results.confidence = 0.7
            results.gaze_direction = self._gaze_from_face_box(x_center)

            if self.eye_cascade is not None and not self.eye_cascade.empty():
                roi_gray = gray[y : y + h, x : x + w]
                eyes = self.eye_cascade.detectMultiScale(
                    roi_gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(15, 15),
                )
                results.eyes_closed = len(eyes) == 0
            else:
                results.eyes_closed = False

            results.face_coverage = 0.2 if results.eyes_closed else 0.0

        return self._to_dict(results)

    def _gaze_from_face_box(self, x_center: float) -> Dict[str, Any]:
        horizontal_offset = float(x_center - 0.5)
        abs_offset = abs(horizontal_offset)
        looking_away = abs_offset > 0.12
        direction = "center"
        if looking_away:
            direction = "left" if horizontal_offset < 0 else "right"

        confidence = min(0.95, 0.7 + (abs_offset * 1.5))
        return {
            "looking_away": looking_away,
            "direction": direction,
            "horizontal_offset": abs_offset,
            "confidence": float(confidence),
        }

    def _analyze_with_mediapipe(self, img: np.ndarray) -> Dict[str, Any]:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = FaceAnalysis()

        face_results = self.face_detection.process(img_rgb)
        if face_results.detections:
            results.face_count = len(face_results.detections)
            best_detection = max(face_results.detections, key=lambda d: float(d.score[0]))
            best_bbox = best_detection.location_data.relative_bounding_box
            results.confidence = float(best_detection.score[0])
            results.face_box = {
                "x_center": float(best_bbox.xmin + (best_bbox.width / 2)),
                "y_center": float(best_bbox.ymin + (best_bbox.height / 2)),
                "width": float(best_bbox.width),
                "height": float(best_bbox.height),
            }

            mesh_results = self.face_mesh.process(img_rgb)
            if mesh_results.multi_face_landmarks:
                face_landmarks = mesh_results.multi_face_landmarks[0]
                results.gaze_direction = self._analyze_gaze_direction(face_landmarks)
                results.eyes_closed = self._check_eyes_closed(face_landmarks)
                results.face_coverage = self._calculate_face_coverage(face_landmarks, best_bbox)
                results.landmarks = [(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark[:10]]

        return self._to_dict(results)

    def _analyze_gaze_direction(self, landmarks) -> Dict[str, Any]:
        left_eye_inner = landmarks.landmark[133]
        left_eye_outer = landmarks.landmark[33]
        right_eye_inner = landmarks.landmark[362]
        right_eye_outer = landmarks.landmark[263]
        nose_tip = landmarks.landmark[1]

        left_eye_center_x = (left_eye_inner.x + left_eye_outer.x) / 2
        right_eye_center_x = (right_eye_inner.x + right_eye_outer.x) / 2
        eyes_center_x = (left_eye_center_x + right_eye_center_x) / 2

        horizontal_offset = abs(eyes_center_x - nose_tip.x)
        looking_away = horizontal_offset > 0.1
        direction = "center"
        if looking_away:
            direction = "left" if eyes_center_x < nose_tip.x else "right"

        confidence = min(0.9, 0.7 + (horizontal_offset * 2))
        return {
            "looking_away": looking_away,
            "direction": direction,
            "horizontal_offset": float(horizontal_offset),
            "confidence": float(confidence),
        }

    def _check_eyes_closed(self, landmarks) -> bool:
        left_eye_top = landmarks.landmark[159]
        left_eye_bottom = landmarks.landmark[145]
        left_eye_left = landmarks.landmark[33]
        left_eye_right = landmarks.landmark[133]

        right_eye_top = landmarks.landmark[386]
        right_eye_bottom = landmarks.landmark[374]
        right_eye_left = landmarks.landmark[362]
        right_eye_right = landmarks.landmark[263]

        left_ear = self._calculate_ear(left_eye_top, left_eye_bottom, left_eye_left, left_eye_right)
        right_ear = self._calculate_ear(
            right_eye_top, right_eye_bottom, right_eye_left, right_eye_right
        )
        ear = (left_ear + right_ear) / 2
        return ear < 0.25

    def _calculate_ear(self, top, bottom, left, right):
        vertical = self._distance(top, bottom)
        horizontal = self._distance(left, right)
        if horizontal == 0:
            return 0.0
        return vertical / horizontal

    def _distance(self, point1, point2):
        return np.sqrt(
            (point1.x - point2.x) ** 2
            + (point1.y - point2.y) ** 2
            + (point1.z - point2.z) ** 2
        )

    def _calculate_face_coverage(self, landmarks, bbox) -> float:
        key_landmarks = [1, 33, 133, 362, 263, 17, 61]
        visible_count = 0
        for idx in key_landmarks:
            lm = landmarks.landmark[idx]
            if bbox.xmin <= lm.x <= bbox.xmin + bbox.width and bbox.ymin <= lm.y <= bbox.ymin + bbox.height:
                visible_count += 1
        coverage = 1 - (visible_count / len(key_landmarks))
        return max(0.0, min(1.0, coverage))

    def _to_dict(self, analysis: FaceAnalysis) -> Dict[str, Any]:
        return {
            "face_count": analysis.face_count,
            "face_box": analysis.face_box,
            "gaze_direction": analysis.gaze_direction,
            "eyes_closed": analysis.eyes_closed,
            "face_coverage": float(analysis.face_coverage),
            "confidence": float(analysis.confidence),
            "has_face": analysis.face_count > 0,
            "detector_mode": self.mode,
        }
