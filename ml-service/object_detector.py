"""Object detection stub for proctoring. Replace with real model when ML stack is ready."""
from typing import Dict, Any
import asyncio


class ObjectDetector:
    def __init__(self) -> None:
        self._ready = True

    def is_ready(self) -> bool:
        return self._ready

    async def detect_objects(self, image_contents: bytes) -> Dict[str, Any]:
        await asyncio.sleep(0)
        return {
            "objects": [],
            "object_count": 0,
            "screen_count": 1,
            "screen_confidence": 0.0,
        }
