import { Response } from 'express';
import { WorkExperienceService } from '../services/workExperience.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { safeErrorMessage } from '../utils/safeErrorMessage';
import { addWorkExperienceSchema } from '../validation/schemas';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DomainError, isDomainError } from '../errors/domainError';
import { buildStructuredErrorResponse, getCorrelationId } from '../utils/errorResponse';

const workExperienceService = new WorkExperienceService();
const userIdSchema = z.string().uuid();

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'ADD_EXPERIENCE_FAILED'
  | 'GET_EXPERIENCES_FAILED'
  | 'WORK_EXPERIENCE_CONFLICT';

export class WorkExperienceController {
  constructor(private readonly service: Pick<WorkExperienceService, 'addWorkExperience' | 'getUserWorkExperiences'> = workExperienceService) {}

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
      meta: { correlationId: getCorrelationId(req) },
    });
  }

  private sendError(
    req: AuthenticatedRequest,
    res: Response,
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: { retryAfterSeconds?: number },
  ) {
    return res
      .status(statusCode)
      .json(buildStructuredErrorResponse(req, code, message, options));
  }

  private mapDomainError(error: DomainError): { statusCode: number; code: ErrorCode; message: string } {
    if (error.code === 'VALIDATION_FAILED') {
      return { statusCode: 400, code: 'VALIDATION_FAILED', message: error.message };
    }
    if (error.code === 'WORK_EXPERIENCE_CONFLICT') {
      return { statusCode: 409, code: 'WORK_EXPERIENCE_CONFLICT', message: error.message };
    }
    if (error.code === 'WORK_EXPERIENCE_CREATE_FAILED') {
      return { statusCode: 500, code: 'ADD_EXPERIENCE_FAILED', message: 'Failed to add work experience' };
    }
    if (error.code === 'WORK_EXPERIENCE_LIST_FAILED') {
      return { statusCode: 500, code: 'GET_EXPERIENCES_FAILED', message: 'Failed to get work experiences' };
    }
    return {
      statusCode: Math.max(400, Math.min(599, error.httpStatus || 500)),
      code: 'ADD_EXPERIENCE_FAILED',
      message: 'Failed to process work experience',
    };
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
      if (isDomainError(error)) {
        const mapped = this.mapDomainError(error);
        logger.warn('Work experience domain error', {
          correlationId: getCorrelationId(req),
          userId: req.user?.id || 'anonymous',
          code: error.code,
          internalMessage: error.internalMessage,
        });
        return this.sendError(req, res, mapped.statusCode, mapped.code, mapped.message);
      }

      const message = safeErrorMessage(error, 'Failed to add work experience');
      const statusCode = /required|positive number|invalid|validation/i.test(message) ? 400 : 500;
      logger.error('Unexpected add work experience error', {
        correlationId: getCorrelationId(req),
        userId: req.user?.id || 'anonymous',
        error,
      });
      
      if (statusCode === 400) {
        return this.sendError(req, res, 400, 'VALIDATION_FAILED', message);
      }
      return this.sendError(req, res, 500, 'ADD_EXPERIENCE_FAILED', message);
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
      if (isDomainError(error)) {
        const mapped = this.mapDomainError(error);
        logger.warn('Work experience domain error', {
          correlationId: getCorrelationId(req),
          userId: req.user?.id || 'anonymous',
          code: error.code,
          internalMessage: error.internalMessage,
        });
        return this.sendError(req, res, mapped.statusCode, mapped.code, mapped.message);
      }

      const message = safeErrorMessage(error, 'Failed to get work experiences');
      logger.error('Unexpected get work experiences error', {
        correlationId: getCorrelationId(req),
        userId: req.user?.id || 'anonymous',
        error,
      });
      
      return this.sendError(req, res, 500, 'GET_EXPERIENCES_FAILED', message);
    }
  }
}
