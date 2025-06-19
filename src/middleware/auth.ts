import { Request, Response, NextFunction } from 'express';
import jwtService, { JWTPayload } from '../services/jwtService';
import {
  unauthorized,
  forbidden,
  internalError,
} from '../utils/responseHelper';
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
 * Middleware to authenticate JWT tokens from httpOnly cookies
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const accessToken =
      req.cookies[process.env.ACCESS_TOKEN_COOKIE_NAME || 'accessToken'];

    if (!accessToken) {
      unauthorized(
        res,
        'Access token not found. Please log in to access this resource',
      );
      return;
    }

    const payload = jwtService.verifyAccessToken(accessToken);

    if (!payload) {
      unauthorized(
        res,
        'Invalid or expired access token. Please refresh your session.',
      );
      return;
    }

    // Attach user info to request
    req.user = payload;

    logger.debug(`Authenticated user: ${payload.userId}`);
    next();
  } catch (error) {
    logger.error('Token authentication failed:', error);
    internalError(res, 'Authentication failed');
  }
};

/**
 * Middleware to check if user is verified
 */
export const requireVerification = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    unauthorized(res, 'Authentication required');
    return;
  }

  if (!req.user.verified) {
    forbidden(
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
    const accessToken =
      req.cookies[process.env.ACCESS_TOKEN_COOKIE_NAME || 'accessToken'];

    if (accessToken) {
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
    const refreshToken =
      req.cookies[process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken'];

    if (!refreshToken) {
      unauthorized(res, 'Refresh token not found. Please log in again');
      return;
    }

    const verification = await jwtService.verifyRefreshToken(refreshToken);

    if (!verification.valid) {
      unauthorized(
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
    internalError(res, 'Token validation failed');
  }
};
