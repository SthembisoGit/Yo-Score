import { Request, Response, NextFunction } from 'express';
import { AuthService, type UserPayload } from '../services/auth.service';
import { buildStructuredErrorResponse } from '../utils/errorResponse';
import { observeAuthFailure } from '../observability/metrics';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      observeAuthFailure();
      return res
        .status(401)
        .json(buildStructuredErrorResponse(req, 'UNAUTHORIZED', 'No authentication token provided'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    req.user = decoded;
    next();

  } catch (error) {
    observeAuthFailure();
    return res
      .status(401)
      .json(buildStructuredErrorResponse(req, 'INVALID_TOKEN', 'Invalid or expired token'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json(buildStructuredErrorResponse(req, 'UNAUTHORIZED', 'User not authenticated'));
    }

    // Convert both to lowercase for consistent comparison
    const userRole = String(req.user.role).toLowerCase();
    const requiredRoles = roles.map(role => role.toLowerCase());

    if (!requiredRoles.includes(userRole)) {
      return res
        .status(403)
        .json(buildStructuredErrorResponse(req, 'FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
};
