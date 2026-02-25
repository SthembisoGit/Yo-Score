import { Request, Response, NextFunction } from 'express';
import { AuthService, type UserPayload } from '../services/auth.service';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

const getCorrelationMeta = (req: Request) => ({
  correlationId: req.correlationId || 'unknown',
});

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
        error: 'UNAUTHORIZED',
        meta: getCorrelationMeta(req),
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    req.user = decoded;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN',
      meta: getCorrelationMeta(req),
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
        meta: getCorrelationMeta(req),
      });
    }

    // Convert both to lowercase for consistent comparison
    const userRole = String(req.user.role).toLowerCase();
    const requiredRoles = roles.map(role => role.toLowerCase());

    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'FORBIDDEN',
        meta: getCorrelationMeta(req),
      });
    }

    next();
  };
};
