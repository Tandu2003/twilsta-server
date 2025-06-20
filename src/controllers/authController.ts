import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  success,
  created,
  badRequest,
  unauthorized,
  notFound,
  internalError,
  validationError,
} from '../utils/responseHelper';
import logger from '../utils/logger';
import jwtService from '../services/jwtService';
import emailService from '../services/emailService';

const prisma = new PrismaClient();

/**
 * Helper function to set auth cookies
 */
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Set access token cookie
  res.cookie(process.env.ACCESS_TOKEN_COOKIE_NAME || 'accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  // Set refresh token cookie
  res.cookie(process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/auth',
  });
};

/**
 * Helper function to clear auth cookies
 */
const clearAuthCookies = (res: Response) => {
  res.clearCookie(process.env.ACCESS_TOKEN_COOKIE_NAME || 'accessToken', {
    path: '/',
  });
  res.clearCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken', {
    path: '/auth',
  });
};

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, displayName } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        res.status(409).json({
          success: false,
          message: 'Email already registered',
          error: {
            field: 'email',
            value: email,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
      if (existingUser.username === username) {
        res.status(409).json({
          success: false,
          message: 'Username already taken',
          error: {
            field: 'username',
            value: username,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        verified: true,
        createdAt: true,
      },
    });

    // Create email verification record
    await prisma.emailVerification.create({
      data: {
        email,
        token: verificationToken,
        expiresAt: verificationExpires,
      },
    }); // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken, username);
    logger.info(`User registered: ${user.username} (${user.email})`);
    logger.debug('About to send created response...');

    try {
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email for verification instructions.',
        data: { user },
      });
      logger.debug('Created response sent successfully');
    } catch (responseError) {
      logger.error('Error sending response:', responseError);
      throw responseError;
    }
  } catch (error: any) {
    logger.error('Registration failed:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      res.status(409).json({
        success: false,
        message: `${field === 'email' ? 'Email' : 'Username'} already exists`,
        error: {
          field: field,
          code: 'DUPLICATE_ENTRY',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Handle other database errors
    if (error.code?.startsWith('P')) {
      res.status(500).json({
        success: false,
        message: 'Database error occurred',
        error: {
          code: error.code,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: {
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password } = req.body; // login can be email or username
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
      },
    });

    if (!user) {
      unauthorized(res, 'Invalid credentials');
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      unauthorized(res, 'Invalid credentials');
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = await jwtService.generateTokenPair(
      user,
      userAgent,
      ipAddress,
    );

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    logger.info(`User logged in: ${user.username} (${user.email})`);

    success(
      res,
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          verified: user.verified,
          avatar: user.avatar,
        },
        requiresVerification: !user.verified,
      },
      'Login successful',
    );
  } catch (error) {
    logger.error('Login failed:', error);
    internalError(res, 'Login failed');
  }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies[process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken'];

    if (refreshToken) {
      // Revoke refresh token
      await jwtService.revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    clearAuthCookies(res);

    logger.info(`User logged out`);
    success(res, null, 'Logout successful');
  } catch (error) {
    logger.error('Logout failed:', error);
    // Still clear cookies even if database operation fails
    clearAuthCookies(res);
    success(res, null, 'Logout successful');
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body; // Set by validateRefreshToken middleware

    const result = await jwtService.refreshAccessToken(refreshToken);

    if (!result.success) {
      unauthorized(res, 'Invalid refresh token');
      return;
    }

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(process.env.ACCESS_TOKEN_COOKIE_NAME || 'accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    success(
      res,
      {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          displayName: result.user.displayName,
          verified: result.user.verified,
          avatar: result.user.avatar,
        },
      },
      'Token refreshed successfully',
    );
  } catch (error) {
    logger.error('Token refresh failed:', error);
    internalError(res, 'Token refresh failed');
  }
};

/**
 * Verify email
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    // Find verification record
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      badRequest(res, 'Invalid verification token');
      return;
    }

    if (verification.used) {
      badRequest(res, 'Verification token already used');
      return;
    }

    if (verification.expiresAt < new Date()) {
      badRequest(res, 'Verification token expired');
      return;
    }

    // Update user and mark verification as used
    await prisma.$transaction([
      prisma.user.update({
        where: { email: verification.email },
        data: {
          verified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      }),
      prisma.emailVerification.update({
        where: { token },
        data: { used: true },
      }),
    ]);

    logger.info(`Email verified: ${verification.email}`);
    success(res, null, 'Email verified successfully');
  } catch (error) {
    logger.error('Email verification failed:', error);
    internalError(res, 'Email verification failed');
  }
};

/**
 * Resend verification email
 */
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      notFound(res, 'User not found');
      return;
    }

    if (user.verified) {
      badRequest(res, 'Email already verified');
      return;
    }

    // Generate new verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Create new verification record
    await prisma.emailVerification.create({
      data: {
        email,
        token: verificationToken,
        expiresAt: verificationExpires,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken, user.username);

    logger.info(`Verification email resent to: ${email}`);
    success(res, null, 'Verification email sent');
  } catch (error) {
    logger.error('Resend verification failed:', error);
    internalError(res, 'Failed to send verification email');
  }
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      success(res, null, 'If the email exists, a password reset link has been sent');
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Create password reset record
    await prisma.passwordReset.create({
      data: {
        email,
        token: resetToken,
        expiresAt: resetExpires,
      },
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(email, resetToken, user.username);

    logger.info(`Password reset requested for: ${email}`);
    success(res, null, 'If the email exists, a password reset link has been sent');
  } catch (error) {
    logger.error('Password reset request failed:', error);
    internalError(res, 'Password reset request failed');
  }
};

/**
 * Reset password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find reset record
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      badRequest(res, 'Invalid reset token');
      return;
    }

    if (resetRecord.used) {
      badRequest(res, 'Reset token already used');
      return;
    }

    if (resetRecord.expiresAt < new Date()) {
      badRequest(res, 'Reset token expired');
      return;
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password and mark reset as used
    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetRecord.email },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      }),
      prisma.passwordReset.update({
        where: { token },
        data: { used: true },
      }),
    ]);

    // Revoke all refresh tokens for security
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      select: { id: true },
    });

    if (user) {
      await jwtService.revokeAllRefreshTokens(user.id);
    }

    logger.info(`Password reset completed for: ${resetRecord.email}`);
    success(res, null, 'Password reset successful');
  } catch (error) {
    logger.error('Password reset failed:', error);
    internalError(res, 'Password reset failed');
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res, 'Authentication required');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        bio: true,
        avatar: true,
        coverImage: true,
        website: true,
        location: true,
        verified: true,
        isPrivate: true,
        followersCount: true,
        followingCount: true,
        postsCount: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      notFound(res, 'User not found');
      return;
    }

    success(res, { user }, 'User information retrieved successfully');
  } catch (error) {
    logger.error('Get current user failed:', error);
    internalError(res, 'Failed to retrieve user information');
  }
};

/**
 * Update user last active time
 */
export const updateLastActive = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res, 'Authentication required');
      return;
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { lastActiveAt: new Date() },
    });

    success(res, null, 'Last active time updated');
  } catch (error) {
    logger.error('Update last active failed:', error);
    internalError(res, 'Failed to update last active time');
  }
};
