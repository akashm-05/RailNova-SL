import { Request, Response, NextFunction } from 'express';
import { AuthService, UserPayload } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required. Please sign in.' }
    });
  }

  const token = authHeader.substring(7);
  try {
    const user = AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: err.message || 'Invalid or expired session token.' }
    });
  }
}

export function requireOrganiser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ORGANISER') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Restricted to Railway Organisers and Administrators.' }
      });
    }
    next();
  });
}
