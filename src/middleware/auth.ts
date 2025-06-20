import { Request, Response, NextFunction } from 'express';
import jwtService, { JWTPayload } from '../services/jwtService';
import { ResponseHelper } from '../utils/responseHelper';
import logger from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens from Authorization header or cookies
 * Supports both Bearer token format and cookie-based authentication
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ResponseHelper.unauthorized(
        res,
        'Access token required. Please provide a valid Bearer token in Authorization header.',
      );
      return;
    }

    const accessToken = authHeader.substring(7);
    const payload = jwtService.verifyAccessToken(accessToken);

    if (!payload) {
      ResponseHelper.unauthorized(
        res,
        'Invalid or expired access token. Please refresh your session.',
      );
      return;
    }

    req.user = payload;
    logger.debug(`Authenticated user: ${payload.userId}`);
    next();
  } catch (error) {
    logger.error('Token authentication failed:', error);
    if (!res.headersSent) {
      ResponseHelper.internalError(res, 'Authentication failed');
    }
    return;
  }
};

/**
 * Middleware to check if user is verified
 */
export const requireVerification = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    ResponseHelper.unauthorized(res, 'Authentication required');
    return;
  }

  if (!req.user.verified) {
    ResponseHelper.forbidden(
      res,
      'Email verification required. Please verify your email address to access this resource',
    );
    return;
  }

  next();
};

/**
 * Optional authentication - adds user to request if token exists
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Get token from Authorization header only
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      const payload = jwtService.verifyAccessToken(accessToken);
      if (payload) {
        req.user = payload;
        logger.debug(`Optional auth - authenticated user: ${payload.userId}`);
      }
    }

    next();
  } catch (error) {
    logger.debug('Optional auth failed, continuing without user:', error);
    next();
  }
};

/**
 * Middleware to validate refresh token from cookies
 */
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshToken = req.cookies[process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken'];

    if (!refreshToken) {
      ResponseHelper.unauthorized(res, 'Refresh token not found. Please log in again');
      return;
    }

    const verification = await jwtService.verifyRefreshToken(refreshToken);

    if (!verification.valid) {
      ResponseHelper.unauthorized(
        res,
        'Invalid or expired refresh token. Session expired. Please log in again.',
      );
      return;
    }

    // Attach refresh token to request for use in controller
    req.body.refreshToken = refreshToken;
    next();
  } catch (error) {
    logger.error('Refresh token validation failed:', error);
    ResponseHelper.internalError(res, 'Token validation failed');
    return; // Important: return here to stop execution
  }
};
