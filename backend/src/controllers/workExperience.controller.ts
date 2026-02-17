import { Request, Response } from 'express';
import { WorkExperienceService } from '../services/workExperience.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const workExperienceService = new WorkExperienceService();

export class WorkExperienceController {
  async addWorkExperience(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { company_name, role, duration_months, evidence_links } = req.body;

      if (!company_name || !role || !duration_months) {
        return res.status(400).json({
          success: false,
          message: 'Company name, role, and duration are required'
        });
      }

      const months = Number(duration_months);
      if (!Number.isFinite(months) || months <= 0) {
        return res.status(400).json({
          success: false,
          message: 'duration_months must be a positive number',
        });
      }

      const experience = await workExperienceService.addWorkExperience(
        req.user.id,
        {
          company_name: String(company_name).trim(),
          role: String(role).trim(),
          duration_months: months,
          evidence_links: Array.isArray(evidence_links) ? evidence_links : [],
        },
      );

      return res.status(201).json({
        success: true,
        message: 'Work experience added successfully',
        data: experience
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add work experience';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'ADD_EXPERIENCE_FAILED'
      });
    }
  }

  async getWorkExperiences(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const experiences = await workExperienceService.getUserWorkExperiences(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Work experiences retrieved successfully',
        data: experiences
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get work experiences';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'GET_EXPERIENCES_FAILED'
      });
    }
  }
}
