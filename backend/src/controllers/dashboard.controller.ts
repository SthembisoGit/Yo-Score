import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const dashboardService = new DashboardService();

export class DashboardController {
  async getUserDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const dashboardData = await dashboardService.getUserDashboard(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: dashboardData
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get dashboard data';
      
      return res.status(500).json({
        success: false,
        message,
        error: 'DASHBOARD_FETCH_FAILED'
      });
    }
  }
}