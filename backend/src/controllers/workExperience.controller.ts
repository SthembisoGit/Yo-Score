import { Response } from 'express';
import { WorkExperienceService } from '../services/workExperience.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { safeErrorMessage } from '../utils/safeErrorMessage';
import { addWorkExperienceSchema } from '../validation/schemas';
import { z } from 'zod';

const workExperienceService = new WorkExperienceService();
const userIdSchema = z.string().uuid();

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'ADD_EXPERIENCE_FAILED'
  | 'GET_EXPERIENCES_FAILED';

export class WorkExperienceController {
  constructor(private readonly service: Pick<WorkExperienceService, 'addWorkExperience' | 'getUserWorkExperiences'> = workExperienceService) {}

  private getCorrelationId(req: AuthenticatedRequest): string {
    return req.correlationId || 'unknown';
  }

  private sendSuccess(
    req: AuthenticatedRequest,
    res: Response,
    statusCode: number,
    message: string,
    data: unknown,
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: { correlationId: this.getCorrelationId(req) },
    });
  }

  private sendError(
    req: AuthenticatedRequest,
    res: Response,
    statusCode: number,
    code: ErrorCode,
    message: string,
  ) {
    const correlationId = this.getCorrelationId(req);
    return res.status(statusCode).json({
      success: false,
      message,
      error: code,
      meta: { correlationId },
      error_details: {
        code,
        message,
        correlationId,
      },
    });
  }

  private normalizeEvidenceLinks(evidenceLinks: string[] | string | undefined): string[] {
    if (Array.isArray(evidenceLinks)) {
      return evidenceLinks.map((link) => link.trim()).filter((link) => link.length > 0);
    }

    if (typeof evidenceLinks === 'string') {
      return evidenceLinks
        .split(/\r?\n|,/g)
        .map((link) => link.trim())
        .filter((link) => link.length > 0);
    }

    return [];
  }

  async addWorkExperience(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !userIdSchema.safeParse(req.user.id).success) {
        return this.sendError(req, res, 401, 'UNAUTHORIZED', 'User not authenticated');
      }

      const parsed = addWorkExperienceSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || 'Invalid request payload';
        return this.sendError(req, res, 400, 'VALIDATION_FAILED', message);
      }

      const { company_name, role, duration_months, evidence_links } = parsed.data;

      const normalizedEvidenceLinks = this.normalizeEvidenceLinks(evidence_links);

      const experience = await this.service.addWorkExperience(
        req.user.id,
        {
          company_name,
          role,
          duration_months,
          evidence_links: normalizedEvidenceLinks,
        },
      );

      return this.sendSuccess(
        req,
        res,
        201,
        'Work experience added successfully',
        experience,
      );

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to add work experience');
      const statusCode =
        /required|positive number|invalid|validation/i.test(message) ? 400 : 500;
      
      return this.sendError(req, res, statusCode, 'ADD_EXPERIENCE_FAILED', message);
    }
  }

  async getWorkExperiences(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !userIdSchema.safeParse(req.user.id).success) {
        return this.sendError(req, res, 401, 'UNAUTHORIZED', 'User not authenticated');
      }

      const experiencesRaw = await this.service.getUserWorkExperiences(req.user.id);
      const experiences = Array.isArray(experiencesRaw) ? experiencesRaw : [];

      return this.sendSuccess(
        req,
        res,
        200,
        'Work experiences retrieved successfully',
        experiences,
      );

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get work experiences');
      
      return this.sendError(req, res, 500, 'GET_EXPERIENCES_FAILED', message);
    }
  }
}
