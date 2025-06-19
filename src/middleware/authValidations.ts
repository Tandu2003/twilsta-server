import { body, param } from 'express-validator';

/**
 * Validation for user registration
 */
export const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),

  body('displayName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be between 1 and 50 characters'),
];

/**
 * Validation for user login
 */
export const loginValidation = [
  body('login').notEmpty().withMessage('Email or username is required'),

  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Validation for email verification token
 */
export const verifyEmailValidation = [
  param('token').isUUID().withMessage('Invalid verification token format'),
];

/**
 * Validation for resend verification email
 */
export const resendVerificationValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/**
 * Validation for password reset request
 */
export const requestPasswordResetValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/**
 * Validation for password reset
 */
export const resetPasswordValidation = [
  param('token').isUUID().withMessage('Invalid reset token format'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),
];

/**
 * Validation for change password (when authenticated)
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),

  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  }),
];

/**
 * Validation for update profile
 */
export const updateProfileValidation = [
  body('displayName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be between 1 and 50 characters'),

  body('bio')
    .optional()
    .isLength({ max: 160 })
    .withMessage('Bio must be no more than 160 characters'),

  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),

  body('location')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Location must be no more than 30 characters'),

  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean value'),
];
