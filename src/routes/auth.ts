import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  getCurrentUser,
  updateLastActive,
} from '../controllers/authController';
import {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
} from '../middleware/authValidations';
import { authenticateToken, validateRefreshToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validations';

const router = Router();

// Public routes
router.post('/register', registerValidation, validateRequest, register);
router.post('/login', loginValidation, validateRequest, login);
router.post('/logout', logout);

// Email verification
router.get(
  '/verify/:token',
  verifyEmailValidation,
  validateRequest,
  verifyEmail,
);
router.post(
  '/resend-verification',
  resendVerificationValidation,
  validateRequest,
  resendVerification,
);

// Password reset
router.post(
  '/reset-password-request',
  requestPasswordResetValidation,
  validateRequest,
  requestPasswordReset,
);
router.post(
  '/reset-password/:token',
  resetPasswordValidation,
  validateRequest,
  resetPassword,
);

// Token refresh
router.post('/refresh', validateRefreshToken, refreshToken);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);
router.post('/update-activity', authenticateToken, updateLastActive);

export default router;
