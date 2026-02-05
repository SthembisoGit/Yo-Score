# Proctoring Feature - Recent Updates

## Changes Made

### 1. Violation Count Updates
- **Issue**: Violation count on challenge page wasn't updating in real-time
- **Fix**: 
  - Added `violationCount` state in `ChallengeDetail.tsx` that updates when violations occur
  - Pass `violationCount` as prop to `ChallengeSession` component
  - Component now displays accurate, real-time violation count

### 2. Camera/Microphone Enforcement
- **Issue**: Camera and microphone could be turned off during session
- **Fix**:
  - Override `track.stop()` methods to prevent disabling
  - Aggressive monitoring every 1 second (was 2 seconds)
  - Automatic restart when camera/mic is detected as off
  - Immediate violation logging when tracks are disabled
  - Check multiple conditions: track state, enabled status, muted status, video dimensions

### 3. Improved Detection Messages
- **Enhanced**: All violation alerts now include "Your score is being affected" message
- **Specific messages**:
  - Camera off: "Camera is off. Please open your camera immediately. The longer it's closed, the more your score is being affected."
  - Multiple faces: "Multiple faces detected (N). Only you should be visible during the session. Your score is being affected."
  - Speech detected: "Speech detected. Please work in silence. Talking may indicate receiving help. Your score is being affected."
  - Multiple voices: "Multiple voices detected (N). Only you should be speaking during the session. Your score is being affected."

### 4. Audio Detection Improvements
- **Enhanced**: Better speech detection focusing on user speech patterns
- **Changes**:
  - Lower threshold (0.02 vs 0.03) to catch more speech
  - Spectral analysis focusing on speech frequency bands (300-3400 Hz)
  - Requires sustained speech (200ms minimum) to reduce false positives from ambient noise
  - Better distinction between user speech and background noise

### 5. Python Dependencies
- **Issue**: `setuptools.build_meta` error when installing requirements
- **Fix**: Updated `requirements.txt` to use flexible version ranges and added `setuptools>=68.0.0`

## Technical Details

### Camera/Mic Enforcement Implementation

```typescript
// Prevent tracks from being stopped
if (videoTrack && videoTrack.readyState === 'live') {
  const originalStop = videoTrack.stop.bind(videoTrack);
  videoTrack.stop = () => {
    logViolation('camera_off', 'Attempted to stop camera track');
    // Re-enable instead of stopping
    if (!videoTrack.enabled) {
      videoTrack.enabled = true;
    }
  };
}
```

### Violation Count Flow

1. `ProctoringMonitor` detects violation → calls `onViolation()`
2. `ChallengeDetail.handleViolationDetected()` updates `violationCount` state
3. `violationCount` prop passed to `ChallengeSession`
4. `ChallengeSession` displays updated count in UI

### Audio Detection Algorithm

1. Calculate short-term energy (25ms frames)
2. Perform spectral analysis focusing on speech frequency bands
3. Combine energy and spectral features
4. Require sustained activity (200ms minimum) to reduce false positives
5. Only flag as speech if pattern matches human speech characteristics

## Testing Checklist

- [x] Violation count updates in real-time on challenge page
- [x] Camera cannot be turned off (attempts are blocked and logged)
- [x] Microphone cannot be turned off (attempts are blocked and logged)
- [x] Violation alerts show appropriate messages
- [x] Camera restart works when disconnected
- [ ] ML service detects multiple faces correctly
- [ ] ML service detects speech vs ambient noise correctly
- [ ] Audio analysis distinguishes user speech from background noise

## Known Limitations

1. **Mouth Movement Detection**: Currently not fully implemented. Requires storing previous frame landmarks for comparison. Future enhancement.

2. **ML Service Dependencies**: Some packages may have compatibility issues with Python 3.14. Consider using Python 3.11 or 3.12 for better compatibility.

3. **Track Stop Override**: The override of `track.stop()` may not work in all browsers. Some browsers may have stricter security preventing this.

## Future Enhancements

1. **Mouth Movement Detection**: 
   - Store previous frame landmarks
   - Compare mouth opening/closing between frames
   - Correlate with audio speech detection for more accurate results

2. **Advanced Audio Analysis**:
   - Voice activity detection (VAD) with better noise filtering
   - Speaker diarization to distinguish between different speakers
   - Real-time audio streaming analysis

3. **Enhanced Camera Monitoring**:
   - Face recognition to ensure same person throughout session
   - Eye tracking for better attention detection
   - Posture detection to ensure user is present

## Installation Notes

To install ML service dependencies:

```bash
cd ml-service
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

If you encounter issues with Python 3.14, consider using Python 3.11 or 3.12:

```bash
# Using pyenv or similar
pyenv install 3.12.0
pyenv local 3.12.0
pip install -r requirements.txt
```

## Running ML Service

```bash
cd ml-service
python -m uvicorn app:app --host 0.0.0.0 --port 5000 --reload
```

The service will be available at `http://localhost:5000` and provides:
- `/api/analyze/face` - Face analysis endpoint
- `/api/analyze/audio` - Audio analysis endpoint
- `/health` - Health check endpoint
