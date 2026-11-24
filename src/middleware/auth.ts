import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/auth-crypto.ts';
import { getUserByUid, type SafeUser } from '../db/repository.ts';

export interface AuthRequest extends Request {
  user?: SafeUser;
  firebaseClaims?: {
    uid: string;
    email: string;
    name?: string;
  };
}

async function resolveAuthFromHeader(req: AuthRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return;
  }

  const sessionPayload = verifySessionToken(token);
  if (sessionPayload) {
    const user = await getUserByUid(sessionPayload.uid);
    if (user) {
      req.user = user;
    }
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseClaims = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
    const user = await getUserByUid(decoded.uid);
    if (user) {
      req.user = user;
    }
  } catch {
    // Invalid token ignored here; requireAuth will return 401
  }
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    await resolveAuthFromHeader(req);
  } catch (error) {
    console.error('Optional auth error:', error);
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await resolveAuthFromHeader(req);
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    if (req.user.status !== 'active') {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact the administrator.',
      });
    }
    next();
  } catch (error) {
    console.error('Authentication check failed:', error);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};

export const requireFirebaseToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Google authentication token.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Google account must provide an email address.' });
    }
    req.firebaseClaims = {
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired Google sign-in token.' });
  }
};

export const requireRole = (...roles: Array<'donor' | 'ngo' | 'admin'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role as 'donor' | 'ngo' | 'admin')) {
      return res.status(403).json({
        error: `Access denied. This action requires ${roles.join(' or ')} privileges.`,
      });
    }
    next();
  };
};
