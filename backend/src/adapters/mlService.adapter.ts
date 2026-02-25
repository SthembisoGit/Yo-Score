import axios from 'axios';
import FormData from 'form-data';

const FACE_ANALYSIS_TIMEOUT_MS = 10_000;
const AUDIO_ANALYSIS_TIMEOUT_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export type MlViolationPayload = {
  type: string;
  description?: string;
  confidence?: number;
};

export type MlAnalyzeFaceResponse = {
  success: boolean;
  results: Record<string, unknown>;
  violations?: MlViolationPayload[];
};

export type MlAnalyzeAudioResponse = {
  success: boolean;
  results: Record<string, unknown>;
  violations?: MlViolationPayload[];
};

export type MlHealthResponse = {
  status?: string;
  flags?: Record<string, unknown>;
  detectors?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  degraded_reasons?: string[];
};

export class MlServiceAdapter {
  constructor(private readonly baseUrl: string) {}

  async analyzeFace(request: {
    sessionId: string;
    timestamp: string;
    imageBuffer: Buffer;
  }): Promise<MlAnalyzeFaceResponse> {
    const formData = new FormData();
    formData.append('image', request.imageBuffer, {
      filename: 'frame.jpg',
      contentType: 'image/jpeg',
    });

    const response = await axios.post(`${this.baseUrl}/api/analyze/face`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      params: {
        session_id: request.sessionId,
        timestamp: request.timestamp,
        analysis_type: 'face',
      },
      timeout: FACE_ANALYSIS_TIMEOUT_MS,
    });

    return response.data as MlAnalyzeFaceResponse;
  }

  async analyzeAudio(request: {
    sessionId: string;
    timestamp: string;
    audioBuffer: Buffer;
    durationMs: number;
  }): Promise<MlAnalyzeAudioResponse> {
    const formData = new FormData();
    formData.append('audio', request.audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });

    const response = await axios.post(`${this.baseUrl}/api/analyze/audio`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      params: {
        session_id: request.sessionId,
        timestamp: request.timestamp,
        analysis_type: 'audio',
        duration_ms: request.durationMs,
      },
      timeout: AUDIO_ANALYSIS_TIMEOUT_MS,
    });

    return response.data as MlAnalyzeAudioResponse;
  }

  async health(): Promise<MlHealthResponse> {
    const response = await axios.get(`${this.baseUrl}/health`, {
      timeout: HEALTH_CHECK_TIMEOUT_MS,
    });
    return response.data as MlHealthResponse;
  }
}
