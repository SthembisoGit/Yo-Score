import { query } from '../db';
import axios from 'axios';
import { config } from '../config';



export interface ProctoringViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  penalty: number;
  confidence?: number;
  evidence?: any;
}

export interface FaceAnalysisResult {
  faceCount: number;
  gazeDirection?: {
    lookingAway: boolean;
    direction: string;
    confidence: number;
  };
  eyesClosed: boolean;
  faceCoverage: number;
  confidence: number;
  hasFace: boolean;
}

export interface AudioAnalysisResult {
  hasSpeech: boolean;
  speechConfidence: number;
  voiceCount: number;
  noiseLevel: number;
  suspiciousKeywords: string[];
  transcript: string;
}

export interface ObjectAnalysisResult {
  objects: Array<{
    category: string;
    confidence: number;
    boundingBox: number[];
  }>;
  screenCount: number;
}

export class ProctoringService {
  private violationWeights: Record<string, ProctoringViolation> = {
    'tab_switch': { type: 'tab_switch', severity: 'medium', description: 'User switched to another tab', penalty: 5 },
    'window_blur': { type: 'window_blur', severity: 'low', description: 'Window lost focus', penalty: 3 },
    'camera_off': { type: 'camera_off', severity: 'high', description: 'Camera turned off or not available', penalty: 10 },
    'multiple_faces': { type: 'multiple_faces', severity: 'high', description: 'Multiple faces detected', penalty: 15 },
    'no_face': { type: 'no_face', severity: 'medium', description: 'No face detected', penalty: 8 },
    'looking_away': { type: 'looking_away', severity: 'medium', description: 'User looking away from screen', penalty: 7 },
    'eyes_closed': { type: 'eyes_closed', severity: 'low', description: 'Eyes closed for extended period', penalty: 4 },
    'face_covered': { type: 'face_covered', severity: 'medium', description: 'Face partially covered', penalty: 6 },
    'inactivity': { type: 'inactivity', severity: 'low', description: 'No activity detected', penalty: 2 },
    'copy_paste': { type: 'copy_paste', severity: 'high', description: 'Copy/paste detected', penalty: 12 },
    'dev_tools': { type: 'dev_tools', severity: 'high', description: 'Developer tools opened', penalty: 10 },
    'speech_detected': { type: 'speech_detected', severity: 'medium', description: 'Speech detected', penalty: 8 },
    'multiple_voices': { type: 'multiple_voices', severity: 'high', description: 'Multiple voices detected', penalty: 20 },
    'forbidden_object': { type: 'forbidden_object', severity: 'high', description: 'Forbidden object detected', penalty: 15 },
    'multiple_screens': { type: 'multiple_screens', severity: 'medium', description: 'Multiple screens detected', penalty: 10 },
    'high_background_noise': { type: 'high_background_noise', severity: 'low', description: 'High background noise', penalty: 3 },
    'suspicious_conversation': { type: 'suspicious_conversation', severity: 'high', description: 'Suspicious conversation detected', penalty: 12 }
  };

  private mlServiceUrl: string;

 constructor() {
    this.mlServiceUrl = config.ML_SERVICE_URL || 'http://localhost:5000';
  }

  // Session Management
  async startSession(userId: string, challengeId: string): Promise<string> {
    const result = await query(
      `INSERT INTO proctoring_sessions (user_id, challenge_id, start_time, status)
       VALUES ($1, $2, NOW(), 'active')
       RETURNING id`,
      [userId, challengeId]
    );
    
    return result.rows[0].id;
  }

  async endSession(sessionId: string, submissionId?: string): Promise<void> {
    await query(
      `UPDATE proctoring_sessions 
       SET end_time = NOW(), 
           status = 'completed',
           submission_id = $2
       WHERE id = $1`,
      [sessionId, submissionId]
    );
  }

  // Basic Violation Logging
  async logViolation(
    sessionId: string, 
    userId: string, 
    violationType: string, 
    description?: string,
    evidence?: any
  ): Promise<ProctoringViolation> {
    const violation = this.violationWeights[violationType] || {
      type: violationType,
      severity: 'medium',
      description: description || `Violation: ${violationType}`,
      penalty: 5
    };

    await query(
      `INSERT INTO proctoring_logs 
       (session_id, user_id, violation_type, severity, description, penalty, timestamp, evidence_data)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [sessionId, userId, violation.type, violation.severity, violation.description, violation.penalty, JSON.stringify(evidence)]
    );

    await query(
      `UPDATE proctoring_sessions 
       SET total_violations = total_violations + 1,
           total_penalty = total_penalty + $2
       WHERE id = $1`,
      [sessionId, violation.penalty]
    );

    return violation;
  }

  // ML Analysis Methods
  async analyzeFaceFrame(
    sessionId: string,
    imageBuffer: Buffer,
    timestamp: string
  ): Promise<{ result: FaceAnalysisResult; violations: ProctoringViolation[] }> {
    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, 'frame.jpg');

      const response = await axios.post(
        `${this.mlServiceUrl}/api/analyze/face`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: {
            session_id: sessionId,
            timestamp: timestamp,
            analysis_type: 'face'
          },
          timeout: 10000
        }
      );

      const mlResult = response.data;
      
      if (mlResult.success) {
        // Log ML analysis results
        await this.logMLAnalysis(sessionId, 'face', timestamp, mlResult.results, mlResult.violations);
        
        // Log violations
        const violations: ProctoringViolation[] = [];
        for (const mlViolation of mlResult.violations || []) {
          const violation = await this.logViolation(
            sessionId,
            '', // User ID will be filled from session
            mlViolation.type,
            mlViolation.description,
            mlResult.results
          );
          violations.push({ ...violation, confidence: mlViolation.confidence });
        }
        
        return {
          result: mlResult.results,
          violations
        };
      }
      
      throw new Error('ML analysis failed');
      
    } catch (error) {
      console.error('Face analysis failed:', error);
      
      // Fallback to basic analysis if ML service is down
      return {
        result: {
          faceCount: 0,
          eyesClosed: false,
          faceCoverage: 0,
          confidence: 0,
          hasFace: false
        },
        violations: []
      };
    }
  }

  async analyzeAudioChunk(
    sessionId: string,
    audioBuffer: Buffer,
    timestamp: string,
    durationMs: number
  ): Promise<{ result: AudioAnalysisResult; violations: ProctoringViolation[] }> {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/webm' });
      formData.append('audio', blob, 'audio.webm');

      const response = await axios.post(
        `${this.mlServiceUrl}/api/analyze/audio`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: {
            session_id: sessionId,
            timestamp: timestamp,
            analysis_type: 'audio',
            duration_ms: durationMs
          },
          timeout: 15000
        }
      );

      const mlResult = response.data;
      
      if (mlResult.success) {
        // Log ML analysis results
        await this.logMLAnalysis(sessionId, 'audio', timestamp, mlResult.results, mlResult.violations);
        
        // Log violations
        const violations: ProctoringViolation[] = [];
        for (const mlViolation of mlResult.violations || []) {
          const violation = await this.logViolation(
            sessionId,
            '', // User ID will be filled from session
            mlViolation.type,
            mlViolation.description,
            mlResult.results
          );
          violations.push({ ...violation, confidence: mlViolation.confidence });
        }
        
        return {
          result: mlResult.results,
          violations
        };
      }
      
      throw new Error('Audio analysis failed');
      
    } catch (error) {
      console.error('Audio analysis failed:', error);
      
      // Fallback result
      return {
        result: {
          hasSpeech: false,
          speechConfidence: 0,
          voiceCount: 0,
          noiseLevel: 0,
          suspiciousKeywords: [],
          transcript: ''
        },
        violations: []
      };
    }
  }

  private async logMLAnalysis(
    sessionId: string,
    analysisType: string,
    timestamp: string,
    results: any,
    violations: any[]
  ): Promise<void> {
    await query(
      `INSERT INTO ml_analysis_results 
       (session_id, analysis_type, timestamp, results, violations_detected, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sessionId, analysisType, new Date(timestamp).toISOString(), JSON.stringify(results), violations.length]
    );
  }

  // Session Data Retrieval
  async getSessionViolations(sessionId: string): Promise<any[]> {
    const result = await query(
      `SELECT id, violation_type, severity, description, penalty, confidence, timestamp, evidence_data
       FROM proctoring_logs
       WHERE session_id = $1
       ORDER BY timestamp`,
      [sessionId]
    );

    return result.rows.map(row => ({
      ...row,
      evidence_data: row.evidence_data ? JSON.parse(row.evidence_data) : null
    }));
  }

  async getMLAnalysisResults(sessionId: string, analysisType?: string): Promise<any[]> {
    let sql = `SELECT * FROM ml_analysis_results WHERE session_id = $1`;
    const params: any[] = [sessionId];
    
    if (analysisType) {
      sql += ` AND analysis_type = $2`;
      params.push(analysisType);
    }
    
    sql += ` ORDER BY timestamp`;
    
    const result = await query(sql, params);
    return result.rows.map(row => ({
      ...row,
      results: row.results ? JSON.parse(row.results) : null
    }));
  }

  // Scoring
  async calculateProctoringScore(sessionId: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(penalty), 0) as total_penalty,
              COUNT(*) as violation_count,
              COUNT(DISTINCT violation_type) as unique_violation_types
       FROM proctoring_logs
       WHERE session_id = $1`,
      [sessionId]
    );

    const { total_penalty, violation_count, unique_violation_types } = result.rows[0];
    
    // Base score: 100 points
    let score = 100;
    
    // Deduct for total penalty points (max 60 points)
    score -= Math.min(parseInt(total_penalty), 60);
    
    // Deduct for number of violations
    score -= Math.min(parseInt(violation_count) * 2, 30);
    
    // Additional deduction for multiple types of violations
    score -= Math.min(parseInt(unique_violation_types) * 3, 15);
    
    // ML violations are more serious
    const mlResult = await query(
      `SELECT SUM(violations_detected) as ml_violations
       FROM ml_analysis_results
       WHERE session_id = $1`,
      [sessionId]
    );
    
    const mlViolations = parseInt(mlResult.rows[0]?.ml_violations || 0);
    score -= mlViolations * 4;
    
    return Math.max(0, Math.floor(score));
  }

  async getSessionDetails(sessionId: string): Promise<any> {
    const sessionResult = await query(
      `SELECT ps.*, 
              u.name as user_name,
              u.email as user_email,
              c.title as challenge_title
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       WHERE ps.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    const violations = await this.getSessionViolations(sessionId);
    const mlAnalyses = await this.getMLAnalysisResults(sessionId);
    const score = await this.calculateProctoringScore(sessionId);

    // Calculate violation statistics
    const violationStats = {
      total: violations.length,
      bySeverity: {
        high: violations.filter((v: any) => v.severity === 'high').length,
        medium: violations.filter((v: any) => v.severity === 'medium').length,
        low: violations.filter((v: any) => v.severity === 'low').length
      },
      byType: violations.reduce((acc: any, violation: any) => {
        acc[violation.violation_type] = (acc[violation.violation_type] || 0) + 1;
        return acc;
      }, {})
    };

    // Calculate ML analysis statistics
    const mlStats = {
      total: mlAnalyses.length,
      byType: mlAnalyses.reduce((acc: any, analysis: any) => {
        acc[analysis.analysis_type] = (acc[analysis.analysis_type] || 0) + 1;
        return acc;
      }, {})
    };

    return {
      session,
      violations,
      mlAnalyses,
      proctoringScore: score,
      stats: {
        violations: violationStats,
        mlAnalyses: mlStats
      },
      duration: session.end_time 
        ? this.calculateDuration(session.start_time, session.end_time)
        : this.calculateDuration(session.start_time, new Date().toISOString())
    };
  }

  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  // Utility Methods
  async getUserSessions(userId: string, limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT ps.*, 
              c.title as challenge_title,
              (SELECT COUNT(*) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as violation_count,
              (SELECT COALESCE(SUM(penalty), 0) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as total_penalty
       FROM proctoring_sessions ps
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       WHERE ps.user_id = $1
       ORDER BY ps.start_time DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  async getRecentSessions(limit: number = 20): Promise<any[]> {
    const result = await query(
      `SELECT ps.*, 
              u.name as user_name,
              u.email as user_email,
              c.title as challenge_title,
              (SELECT COUNT(*) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as violation_count,
              (SELECT COALESCE(SUM(penalty), 0) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as total_penalty
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       ORDER BY ps.start_time DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async getViolationSummary(startDate?: string, endDate?: string): Promise<any> {
    let sql = `
      SELECT violation_type, severity, COUNT(*) as count, SUM(penalty) as total_penalty
      FROM proctoring_logs
    `;
    
    const params: any[] = [];
    
    if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        conditions.push(`timestamp >= $${params.length + 1}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`timestamp <= $${params.length + 1}`);
        params.push(endDate);
      }
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += ` GROUP BY violation_type, severity ORDER BY count DESC`;
    
    const result = await query(sql, params);
    
    const summary = {
      totalViolations: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      totalPenalty: result.rows.reduce((sum, row) => sum + parseInt(row.total_penalty), 0),
      byType: result.rows.reduce((acc: any, row) => {
        if (!acc[row.violation_type]) {
          acc[row.violation_type] = { count: 0, penalty: 0, severity: row.severity };
        }
        acc[row.violation_type].count += parseInt(row.count);
        acc[row.violation_type].penalty += parseInt(row.total_penalty);
        return acc;
      }, {}),
      bySeverity: result.rows.reduce((acc: any, row) => {
        if (!acc[row.severity]) {
          acc[row.severity] = { count: 0, penalty: 0 };
        }
        acc[row.severity].count += parseInt(row.count);
        acc[row.severity].penalty += parseInt(row.total_penalty);
        return acc;
      }, {})
    };
    
    return summary;
  }

  // Health Check
  async healthCheck(): Promise<{ database: boolean; mlService: boolean }> {
    const health = {
      database: false,
      mlService: false
    };

    // Check database
    try {
      await query('SELECT 1');
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check ML service
    try {
      await axios.get(`${this.mlServiceUrl}/health`, { timeout: 5000 });
      health.mlService = true;
    } catch (error) {
      console.error('ML service health check failed:', error);
    }

    return health;
  }
}