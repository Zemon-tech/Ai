import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const cookieToken = (req as any).cookies?.access_token as string | undefined;
    const jwtToken = token || cookieToken;
    if (!jwtToken) throw createError(401, 'Unauthorized');
    const payload = verifyAccessToken(jwtToken);
    req.user = { userId: payload.userId };
    next();
  } catch {
    next(createError(401, 'Unauthorized'));
  }
}


