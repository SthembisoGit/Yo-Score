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
    
    def _detect_speech(self, y, sr, threshold=0.02):
        """Enhanced speech detection focusing on user speech patterns (not just ambient noise)"""
        # Calculate short-term energy
        frame_length = int(0.025 * sr)  # 25ms
        hop_length = int(0.01 * sr)     # 10ms
        
        energy = np.array([
            np.sum(y[i:i+frame_length]**2)
            for i in range(0, len(y)-frame_length, hop_length)
        ])
        
        # Calculate spectral features for better speech detection
        # Speech has more energy in certain frequency bands
        stft = librosa.stft(y, hop_length=hop_length, n_fft=frame_length*4)
        magnitude = np.abs(stft)
        
        # Focus on speech frequency range (300-3400 Hz for human speech)
        freq_bins = librosa.fft_frequencies(sr=sr, n_fft=frame_length*4)
        speech_mask = (freq_bins >= 300) & (freq_bins <= 3400)
        speech_energy = np.mean(magnitude[speech_mask, :], axis=0)
        
        # Normalize both energy measures
        if len(energy) > 0:
            energy = energy / (np.max(energy) + 1e-10)
        if len(speech_energy) > 0:
            speech_energy = speech_energy / (np.max(speech_energy) + 1e-10)
        
        # Combine energy and spectral features
        # Speech typically has higher spectral energy in speech bands
        min_length = min(len(energy), len(speech_energy))
        combined_signal = (energy[:min_length] + speech_energy[:min_length]) / 2
        
        # Lower threshold to catch more speech, but require sustained activity
        # This helps distinguish user speech from brief ambient noise
        speech_frames = combined_signal > threshold
        
        # Require at least 200ms of continuous speech (reduces false positives from noise)
        min_speech_frames = int(0.2 * sr / hop_length)  # 200ms
        
        speech_intervals = []
        in_speech = False
        start = 0
        consecutive_frames = 0
        
        for i, is_speech in enumerate(speech_frames):
            if is_speech:
                consecutive_frames += 1
                if not in_speech:
                    start = i * hop_length / sr
                    in_speech = True
            else:
                consecutive_frames = 0
                if in_speech and consecutive_frames == 0:
                    # Only add interval if it was long enough
                    duration = (i * hop_length / sr) - start
                    if duration >= 0.2:  # At least 200ms
                        speech_intervals.append((start, i * hop_length / sr))
                    in_speech = False
        
        if in_speech:
            end = len(y) / sr
            duration = end - start
            if duration >= 0.2:
                speech_intervals.append((start, end))
        
        return speech_intervals