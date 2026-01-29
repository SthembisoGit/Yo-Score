import librosa
import numpy as np
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
import os
from typing import Dict, Any, List, Optional
import asyncio

class AudioAnalyzer:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        # Common cheating-related keywords
        self.suspicious_keywords = [
            'help', 'answer', 'solution', 'cheat', 'google',
            'search', 'copy', 'paste', 'phone', 'friend',
            'whatsapp', 'telegram', 'look up', 'find'
        ]
        
    def is_ready(self) -> bool:
        return self.recognizer is not None
    
    async def analyze_audio(self, audio_path: str, duration_ms: int) -> Dict[str, Any]:
        """Analyze audio file for speech and suspicious activity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._analyze_audio_sync, audio_path, duration_ms
        )
    
    def _analyze_audio_sync(self, audio_path: str, duration_ms: int) -> Dict[str, Any]:
        results = {
            'has_speech': False,
            'speech_confidence': 0.0,
            'voice_count': 0,
            'noise_level': 0.0,
            'suspicious_keywords': [],
            'transcript': '',
            'duration_ms': duration_ms
        }
        
        try:
            # Load audio file
            audio = AudioSegment.from_file(audio_path)
            
            # Convert to WAV for speech recognition
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_wav:
                audio.export(tmp_wav.name, format='wav')
                
                # Analyze with librosa
                y, sr_rate = librosa.load(tmp_wav.name, sr=None)
                
                # Calculate noise level
                rms = librosa.feature.rms(y=y)
                avg_rms = np.mean(rms)
                results['noise_level'] = float(min(avg_rms * 10, 1.0))  # Normalize
                
                # Voice activity detection
                speech_intervals = self._detect_speech(y, sr_rate)
                results['has_speech'] = len(speech_intervals) > 0
                
                if results['has_speech']:
                    # Try speech recognition
                    with sr.AudioFile(tmp_wav.name) as source:
                        audio_data = self.recognizer.record(source)
                        
                        try:
                            # Use Google Web Speech API (requires internet)
                            transcript = self.recognizer.recognize_google(
                                audio_data,
                                language='en-US',
                                show_all=False
                            )
                            
                            results['transcript'] = transcript.lower()
                            results['speech_confidence'] = 0.85
                            
                            # Check for suspicious keywords
                            found_keywords = []
                            for keyword in self.suspicious_keywords:
                                if keyword in results['transcript']:
                                    found_keywords.append(keyword)
                            
                            results['suspicious_keywords'] = found_keywords
                            
                            # Simple voice counting (by sentence segmentation)
                            sentences = [s.strip() for s in results['transcript'].split('.') if s.strip()]
                            results['voice_count'] = min(len(sentences), 3)  # Estimate
                            
                        except sr.UnknownValueError:
                            results['speech_confidence'] = 0.3
                            results['transcript'] = "[Unintelligible speech]"
                        except sr.RequestError as e:
                            results['transcript'] = f"[Speech API error: {e}]"
                
                os.unlink(tmp_wav.name)
                
        except Exception as e:
            results['error'] = str(e)
        
        return results
    
    def _detect_speech(self, y, sr, threshold=0.03):
        """Simple speech detection using energy threshold"""
        # Calculate short-term energy
        frame_length = int(0.025 * sr)  # 25ms
        hop_length = int(0.01 * sr)     # 10ms
        
        energy = np.array([
            np.sum(y[i:i+frame_length]**2)
            for i in range(0, len(y)-frame_length, hop_length)
        ])
        
        # Normalize
        if len(energy) > 0:
            energy = energy / np.max(energy)
        
        # Find speech segments
        speech_frames = energy > threshold
        speech_intervals = []
        
        in_speech = False
        start = 0
        
        for i, is_speech in enumerate(speech_frames):
            if is_speech and not in_speech:
                start = i * hop_length / sr
                in_speech = True
            elif not is_speech and in_speech:
                end = i * hop_length / sr
                speech_intervals.append((start, end))
                in_speech = False
        
        if in_speech:
            speech_intervals.append((start, len(y) / sr))
        
        return speech_intervals