# Proctoring Feature - Production Implementation

## Overview

The proctoring feature is a comprehensive, production-ready system designed to ensure fair assessment by monitoring user behavior during challenge sessions. It combines browser-based monitoring, ML-powered face/audio analysis, and strict enforcement mechanisms.

## Architecture

### Components

1. **Frontend Monitor (`ProctoringMonitor.tsx`)**
   - Real-time camera/microphone monitoring
   - Frame capture and ML analysis (every 3 seconds)
   - Audio chunk recording and analysis (every 10 seconds)
   - Browser event monitoring (tab switch, copy/paste, inactivity)
   - Draggable, minimizable UI widget
   - Real-time violation alerts

2. **Backend Service (`proctoring.service.ts`)**
   - Session lifecycle management
   - Violation logging and scoring
   - ML service integration
   - Analytics and reporting

3. **ML Service (`ml-service/`)**
   - Face detection and analysis (MediaPipe)
   - Audio analysis (speech recognition, voice detection)
   - Object detection (stub - ready for implementation)

## Features

### Strict Monitoring

- **Camera Enforcement**: Camera must remain active throughout the session. Automatic detection and alerts if camera is turned off or disconnected.
- **Microphone Enforcement**: Microphone must remain active. Audio analysis detects speech, multiple voices, and suspicious keywords.
- **Browser Monitoring**: 
  - Tab switching detection
  - Window blur detection
  - Copy/paste prevention (blocked)
  - Developer tools prevention (F12, Ctrl+Shift+I/J blocked)
  - Right-click context menu disabled
  - Inactivity detection (60 seconds)

### ML-Powered Detection

- **Face Analysis** (every 3 seconds):
  - Face count detection (multiple faces = violation)
  - Gaze direction (looking away detection)
  - Eyes closed detection
  - Face coverage detection (masks, hands)

- **Audio Analysis** (every 10 seconds):
  - Speech detection
  - Multiple voice detection
  - Suspicious keyword detection
  - Background noise analysis

### Violation System

#### Violation Types and Penalties

| Type | Severity | Penalty | Description |
|------|----------|---------|-------------|
| `camera_off` | High | 10 | Camera turned off or disconnected |
| `multiple_faces` | High | 15 | Multiple faces detected |
| `copy_paste` | High | 12 | Copy/paste operation detected |
| `dev_tools` | High | 10 | Developer tools opened |
| `multiple_voices` | High | 20 | Multiple voices detected |
| `forbidden_object` | High | 15 | Forbidden object detected |
| `no_face` | Medium | 8 | No face detected |
| `looking_away` | Medium | 7 | User looking away from screen |
| `speech_detected` | Medium | 8 | Speech detected |
| `face_covered` | Medium | 6 | Face partially covered |
| `tab_switch` | Medium | 5 | Tab switched |
| `multiple_screens` | Medium | 10 | Multiple screens detected |
| `suspicious_conversation` | High | 12 | Suspicious keywords detected |
| `window_blur` | Low | 3 | Window lost focus |
| `eyes_closed` | Low | 4 | Eyes closed |
| `inactivity` | Low | 2 | No activity detected |
| `high_background_noise` | Low | 3 | High background noise |

#### Scoring Logic

Proctoring score starts at 100 points and deducts:
- Total penalty points (max 60 points)
- Violation count × 2 (max 30 points)
- Unique violation types × 3 (max 15 points)
- ML violations × 4 (unlimited, but capped by total score floor of 0)

### Real-Time Alerts

The system provides contextual violation alerts:

- **Camera Off**: "Camera is off. Please open your camera immediately. The longer it's closed, the more your score is being affected."
- **Multiple Faces**: "Multiple faces detected (N). Only you should be visible during the session."
- **Speech Detected**: "Speech detected. Please work in silence. Talking may indicate receiving help."
- **Multiple Voices**: "Multiple voices detected. Only you should be speaking during the session."
- **Tab Switch**: "Please return to the challenge tab. Tab switching is being monitored."
- **Copy/Paste**: "Copy/paste is disabled during proctored sessions. Your score is being affected."

## API Endpoints

### Session Management

- `POST /api/proctoring/session/start` - Start a proctoring session
- `POST /api/proctoring/session/end` - End a proctoring session
- `GET /api/proctoring/session/:sessionId` - Get session details
- `GET /api/proctoring/session/:sessionId/analytics` - Get session analytics
- `GET /api/proctoring/session/:sessionId/status` - Get real-time session status

### Violations

- `POST /api/proctoring/violation` - Log a single violation
- `POST /api/proctoring/violations/batch` - Log multiple violations

### ML Analysis

- `POST /api/proctoring/analyze-face` - Analyze face frame (binary image data)
- `POST /api/proctoring/analyze-audio` - Analyze audio chunk (binary audio data)

### User Data

- `GET /api/proctoring/user/:userId/sessions` - Get user's proctoring sessions
- `GET /api/proctoring/user/:userId/violations/summary` - Get user violation summary

### Settings

- `GET /api/proctoring/settings` - Get proctoring settings
- `PUT /api/proctoring/settings` - Update proctoring settings

### Health

- `GET /api/proctoring/health` - Health check (database + ML service)

## UI Components

### ProctoringModal

- **Draggable**: Users can move the modal to see content behind it
- **Non-dismissible**: Cannot be closed once opened (only "Start Proctored Session" button)
- **Information**: Clear explanation of monitoring requirements

### ProctoringMonitor

- **Draggable**: Can be moved around the screen
- **Minimizable**: Can be minimized to a small icon (not closable)
- **Real-time Status**: Shows camera/mic status, violation count
- **Live Preview**: Shows camera feed
- **Alert Display**: Shows recent violation alerts

## Database Schema

### Tables

- `proctoring_sessions`: Session metadata
- `proctoring_logs`: Individual violations
- `ml_analysis_results`: ML analysis results

See `backend/scripts/add-proctoring-columns.js` for schema details.

## Configuration

### Environment Variables

- `ML_SERVICE_URL`: ML service URL (default: `http://localhost:5000`)
- `FRONTEND_URL`: Frontend URL for CORS

### Settings

Default proctoring settings:
- `requireCamera`: true
- `requireMicrophone`: true
- `strictMode`: false
- `allowedViolationsBeforeWarning`: 3
- `autoPauseOnViolation`: false

## Security Considerations

1. **Privacy**: No raw video/audio stored, only analysis results
2. **Access Control**: Users can only view their own sessions (admins can view all)
3. **Data Protection**: Evidence data stored as JSONB, encrypted in transit
4. **Fairness**: Scoring logic is transparent and bounded to prevent false positives

## Performance

- Frame capture: Every 3 seconds
- Audio chunks: Every 10 seconds
- Camera health check: Every 2 seconds
- Violation status polling: Every 5 seconds
- ML analysis timeout: 10s (face), 15s (audio)

## Error Handling

- ML service failures: Graceful degradation (no false positives)
- Camera/mic failures: Automatic retry and alerts
- Network failures: Violations cached locally, synced when connection restored

## Testing Recommendations

1. **Camera Off Test**: Turn off camera mid-session, verify alerts and violations
2. **Multiple Faces Test**: Have another person visible, verify detection
3. **Speech Test**: Speak during session, verify detection
4. **Tab Switch Test**: Switch tabs, verify detection
5. **Copy/Paste Test**: Attempt copy/paste, verify blocking
6. **Long Session Test**: Run for extended period, verify stability
7. **ML Service Down Test**: Stop ML service, verify graceful degradation

## Future Enhancements

1. **Object Detection**: Implement full object detection for forbidden items
2. **Screen Recording**: Optional screen recording for review
3. **Biometric Verification**: Face matching for identity verification
4. **Network Monitoring**: Detect VPN/proxy usage
5. **Advanced ML**: Better gaze detection, emotion analysis

## Deployment Checklist

- [ ] Run database migrations (`add-proctoring-columns.js`, `add-submission-session.js`)
- [ ] Configure ML service URL
- [ ] Test camera/mic permissions
- [ ] Verify ML service is running
- [ ] Test violation detection end-to-end
- [ ] Monitor performance under load
- [ ] Review privacy compliance (GDPR, FERPA)

## Recent Updates (See docs/Proctoring-Updates.md)

- ✅ Violation count now updates in real-time on challenge page
- ✅ Camera/microphone cannot be turned off (strict enforcement)
- ✅ Improved audio detection focusing on user speech patterns
- ✅ Enhanced violation alert messages
- ✅ More aggressive camera monitoring (every 1 second)

## Known Limitations

1. Object detection is currently a stub
2. Settings are not persisted per-user (global defaults)
3. No WebSocket support (polling-based status updates)
4. ML analysis requires internet connection for speech recognition
5. Mouth movement detection requires frame history (future enhancement)

## Support

For issues or questions:
- Check logs: `backend/logs/` and `ml-service/logs/`
- Review violation logs in database
- Check ML service health: `GET /api/proctoring/health`
