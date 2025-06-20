import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { ResponseHelper } from '../utils/responseHelper';
import logger from '../utils/logger';
import jwtService from '../services/jwtService';
import emailService from '../services/emailService';

const prisma = new PrismaClient();

/**
 * Helper function to set auth cookies
 */
const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Only set refresh token in httpOnly cookie (access token will be returned in response)
  res.cookie(process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

/**
 * Helper function to clear refresh token cookie
 */
const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken', {
    path: '/',
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
        ResponseHelper.conflict(res, 'Email already registered', {
          field: 'email',
          value: email,
        });
        return;
      }
      if (existingUser.username === username) {
        ResponseHelper.conflict(res, 'Username already taken', {
          field: 'username',
          value: username,
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
      ResponseHelper.created(
        res,
        { user },
        'Registration successful. Please check your email for verification instructions.',
      );
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
      ResponseHelper.conflict(res, `${field === 'email' ? 'Email' : 'Username'} already exists`, {
        field: field,
        code: 'DUPLICATE_ENTRY',
      });
      return;
    }

    // Handle other database errors
    if (error.code?.startsWith('P')) {
      ResponseHelper.internalError(res, 'Database error occurred', {
        code: error.code,
      });
      return;
    }

    // Generic error
    ResponseHelper.internalError(res, 'Registration failed', {
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
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
      ResponseHelper.unauthorized(res, 'Invalid credentials');
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      ResponseHelper.unauthorized(res, 'Invalid credentials');
      return;
    }

    // Check if email is verified - REQUIRED for login
    if (!user.verified) {
      ResponseHelper.forbidden(
        res,
        'Email verification required. Please verify your email before logging in.',
      );
      return;
    }

    // Generate tokens (jwtService automatically stores refresh token in database)
    const { accessToken, refreshToken } = await jwtService.generateTokenPair(
      user,
      userAgent,
      ipAddress,
    );

    // Set refresh token in httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`User logged in: ${user.username} (${user.email})`);

    ResponseHelper.success(
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
        accessToken, // Return access token in response body
      },
      'Login successful',
    );
  } catch (error) {
    logger.error('Login failed:', error);
    ResponseHelper.internalError(res, 'Login failed');
  }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies[process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken'];

    if (refreshToken) {
      // Revoke refresh token (jwtService.revokeRefreshToken already deletes from database)
      await jwtService.revokeRefreshToken(refreshToken);
    }

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    logger.info(`User logged out`);
    ResponseHelper.success(res, null, 'Logout successful');
  } catch (error) {
    logger.error('Logout failed:', error);
    // Still clear cookies even if database operation fails
    clearRefreshTokenCookie(res);
    ResponseHelper.success(res, null, 'Logout successful');
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
      ResponseHelper.unauthorized(res, 'Invalid refresh token');
      return;
    }

    // Return new access token in response (not cookie)
    ResponseHelper.success(
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
        accessToken: result.accessToken, // Return access token in response body
      },
      'Token refreshed successfully',
    );
  } catch (error) {
    logger.error('Token refresh failed:', error);
    ResponseHelper.internalError(res, 'Token refresh failed');
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
      ResponseHelper.badRequest(res, 'Invalid verification token');
      return;
    }

    if (verification.used) {
      ResponseHelper.badRequest(res, 'Verification token already used');
      return;
    }

    if (verification.expiresAt < new Date()) {
      ResponseHelper.badRequest(res, 'Verification token expired');
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
    ResponseHelper.success(res, null, 'Email verified successfully');
  } catch (error) {
    logger.error('Email verification failed:', error);
    ResponseHelper.internalError(res, 'Email verification failed');
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
      ResponseHelper.notFound(res, 'User not found');
      return;
    }

    if (user.verified) {
      ResponseHelper.badRequest(res, 'Email already verified');
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
    ResponseHelper.success(res, null, 'Verification email sent');
  } catch (error) {
    logger.error('Resend verification failed:', error);
    ResponseHelper.internalError(res, 'Failed to send verification email');
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
      ResponseHelper.success(res, null, 'If the email exists, a password reset link has been sent');
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
    ResponseHelper.success(res, null, 'If the email exists, a password reset link has been sent');
  } catch (error) {
    logger.error('Password reset request failed:', error);
    ResponseHelper.internalError(res, 'Password reset request failed');
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
      ResponseHelper.badRequest(res, 'Invalid reset token');
      return;
    }

    if (resetRecord.used) {
      ResponseHelper.badRequest(res, 'Reset token already used');
      return;
    }

    if (resetRecord.expiresAt < new Date()) {
      ResponseHelper.badRequest(res, 'Reset token expired');
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
    ResponseHelper.success(res, null, 'Password reset successful');
  } catch (error) {
    logger.error('Password reset failed:', error);
    ResponseHelper.internalError(res, 'Password reset failed');
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ResponseHelper.unauthorized(res, 'Authentication required');
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
      ResponseHelper.notFound(res, 'User not found');
      return;
    }

    ResponseHelper.success(res, { user }, 'User information retrieved successfully');
  } catch (error) {
    logger.error('Get current user failed:', error);
    ResponseHelper.internalError(res, 'Failed to retrieve user information');
  }
};

/**
 * Update user last active time
 */
export const updateLastActive = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ResponseHelper.unauthorized(res, 'Authentication required');
      return;
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { lastActiveAt: new Date() },
    });

    ResponseHelper.success(res, null, 'Last active time updated');
  } catch (error) {
    logger.error('Update last active failed:', error);
    ResponseHelper.internalError(res, 'Failed to update last active time');
  }
};

/**
 * Get user's active refresh tokens (for security monitoring)
 */
export const getActiveTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ResponseHelper.unauthorized(res, 'Authentication required');
      return;
    }

    const activeTokens = await jwtService.getUserRefreshTokens(req.user.userId);

    ResponseHelper.success(res, { activeTokens }, 'Active tokens retrieved');
  } catch (error) {
    logger.error('Get active tokens failed:', error);
    ResponseHelper.internalError(res, 'Failed to get active tokens');
  }
};

/**
 * Revoke all refresh tokens (logout from all devices)
 */
export const logoutAllDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ResponseHelper.unauthorized(res, 'Authentication required');
      return;
    }

    await jwtService.revokeAllRefreshTokens(req.user.userId);

    // Clear current refresh token cookie
    clearRefreshTokenCookie(res);

    logger.info(`User logged out from all devices: ${req.user.userId}`);
    ResponseHelper.success(res, null, 'Logged out from all devices');
  } catch (error) {
    logger.error('Logout all devices failed:', error);
    ResponseHelper.internalError(res, 'Failed to logout from all devices');
  }
};
