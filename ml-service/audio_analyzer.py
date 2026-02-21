import librosa
import numpy as np
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Dict, Any, List, Optional
import asyncio

try:
    import imageio_ffmpeg  # type: ignore
except Exception:
    imageio_ffmpeg = None

class AudioAnalyzer:
    def __init__(self):
        self._configure_ffmpeg_binary()
        self.transcription_mode = os.getenv('AUDIO_TRANSCRIPTION_MODE', 'disabled').strip().lower()
        self.enable_cloud_transcription = self.transcription_mode == 'google'
        self.recognizer = sr.Recognizer() if self.enable_cloud_transcription else None
        # Common cheating-related keywords
        self.suspicious_keywords = [
            'help', 'answer', 'solution', 'cheat', 'google',
            'search', 'copy', 'paste', 'phone', 'friend',
            'whatsapp', 'telegram', 'look up', 'find'
        ]

    def _configure_ffmpeg_binary(self) -> None:
        if imageio_ffmpeg is None:
            return
        try:
            AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            # Keep default pydub behavior when bundled ffmpeg cannot be loaded.
            pass

    def _load_audio_segment(self, audio_path: str) -> AudioSegment:
        _, extension = os.path.splitext(audio_path)
        normalized = extension.lower().replace('.', '')
        if normalized:
            try:
                return AudioSegment.from_file(audio_path, format=normalized)
            except Exception:
                pass
        return AudioSegment.from_file(audio_path)
        
    def is_ready(self) -> bool:
        # Local VAD remains available even when cloud transcription is disabled.
        return True
    
    async def analyze_audio(self, audio_path: str, duration_ms: int) -> Dict[str, Any]:
        """Analyze audio file for speech and suspicious activity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._analyze_audio_sync, audio_path, duration_ms
        )

    def _recognize_google_with_timeout(self, audio_data: sr.AudioData, timeout_seconds: float = 4.0) -> str:
        if self.recognizer is None:
            raise sr.RequestError('Cloud transcription disabled')
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                self.recognizer.recognize_google,
                audio_data,
                language='en-US',
                show_all=False,
            )
            try:
                return future.result(timeout=timeout_seconds)
            except FuturesTimeoutError as exc:
                raise sr.RequestError('Speech API timeout') from exc
    
    def _analyze_audio_sync(self, audio_path: str, duration_ms: int) -> Dict[str, Any]:
        results = {
            'has_speech': False,
            'speech_confidence': 0.0,
            'voice_count': 0,
            'noise_level': 0.0,
            'suspicious_keywords': [],
            'transcript': '',
            'duration_ms': duration_ms,
            'analysis_mode': 'local_vad'
        }
        
        try:
            # Load audio file
            audio = self._load_audio_segment(audio_path)
            
            # Convert to WAV for speech recognition
            fd, tmp_wav_path = tempfile.mkstemp(suffix='.wav')
            os.close(fd)
            try:
                audio.export(tmp_wav_path, format='wav')

                # Analyze with librosa
                y, sr_rate = librosa.load(tmp_wav_path, sr=None)

                # Calculate noise level
                rms = librosa.feature.rms(y=y)
                avg_rms = np.mean(rms)
                results['noise_level'] = float(min(avg_rms * 10, 1.0))  # Normalize

                # Voice activity detection
                speech_intervals = self._detect_speech(y, sr_rate)
                results['has_speech'] = len(speech_intervals) > 0

                if results['has_speech']:
                    # Local-first mode for live detection.
                    results['speech_confidence'] = 0.68
                    results['voice_count'] = 1

                    if self.enable_cloud_transcription:
                        # Optional cloud transcription for post-review mode.
                        with sr.AudioFile(tmp_wav_path) as source:
                            audio_data = self.recognizer.record(source)

                            try:
                                transcript = self._recognize_google_with_timeout(audio_data)

                                results['analysis_mode'] = 'cloud_transcription'
                                results['transcript'] = transcript.lower()
                                results['speech_confidence'] = 0.85

                                found_keywords = []
                                for keyword in self.suspicious_keywords:
                                    if keyword in results['transcript']:
                                        found_keywords.append(keyword)

                                results['suspicious_keywords'] = found_keywords

                                sentences = [s.strip() for s in results['transcript'].split('.') if s.strip()]
                                results['voice_count'] = min(len(sentences), 3)

                            except sr.UnknownValueError:
                                results['speech_confidence'] = 0.45
                                results['transcript'] = "[Unintelligible speech]"
                            except sr.RequestError as e:
                                results['transcript'] = f"[Speech API error: {e}]"
            finally:
                if os.path.exists(tmp_wav_path):
                    os.unlink(tmp_wav_path)
                
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
