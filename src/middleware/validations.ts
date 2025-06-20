import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationError } from '../utils/responseHelper';

/**
 * Middleware to handle validation errors
 * This middleware should be used after express-validator validation rules
 * It will return validation errors immediately and not proceed to controller
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Format errors for better readability
      const formattedErrors = errors.array().map((error: any) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
        location: error.location,
      }));

      // Create meaningful error message from first error or general message
      const firstError = formattedErrors[0];
      const errorMessage = firstError ? firstError.message : 'Invalid input data';

      // Log validation errors for debugging
      console.log('🔍 Validation errors:', formattedErrors);

      // Return validation error response immediately - DO NOT call next()
      res.status(422).json({
        success: false,
        message: errorMessage,
        errors: formattedErrors,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return; // Important: return here to stop execution
    }

    // Only call next() if validation passes
    next();
  } catch (error) {
    // If validation middleware itself fails, return 500
    console.error('❌ Error in validation middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal validation error',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
};

/**
 * Common validation rules based on Prisma schema
 */
export const commonValidations = {
  // ID validation (using CUID from schema)
  id: param('id')
    .isLength({ min: 25, max: 25 })
    .matches(/^c[a-z0-9]{24}$/)
    .withMessage('ID must be a valid CUID'),

  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  // Strong password validation
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
    ),

  // Username validation (unique in schema)
  username: body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      'Username must be 3-30 characters long and contain only letters, numbers, and underscores',
    ),

  // Display name validation
  displayName: body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be between 1 and 100 characters'),

  // Bio validation
  bio: body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),

  // Website URL validation
  website: body('website').optional().isURL().withMessage('Please provide a valid website URL'),

  // Location validation
  location: body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must not exceed 100 characters'),

  // Image URL validation (for avatar, coverImage, etc.)
  avatarUrl: body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),

  coverImageUrl: body('coverImage')
    .optional()
    .isURL()
    .withMessage('Cover image must be a valid URL'),

  // Pagination
  page: query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  // Search
  search: query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
};

/**
 * User validation schemas based on Prisma User model
 */
export const userValidations = {
  // Register new user
  register: [
    commonValidations.username,
    commonValidations.email,
    commonValidations.password,
    commonValidations.displayName,
  ],

  // Login user
  login: [
    body('usernameOrEmail')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  // Update user profile
  updateProfile: [
    commonValidations.displayName,
    commonValidations.bio,
    commonValidations.website,
    commonValidations.location,
    commonValidations.avatarUrl,
    commonValidations.coverImageUrl,
    body('isPrivate').optional().isBoolean().withMessage('isPrivate must be a boolean'),
  ],

  // Change password
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password,
  ],

  // Get user by username
  getByUsername: [
    param('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        'Username must be 3-30 characters long and contain only letters, numbers, and underscores',
      ),
  ],
};

/**
 * Post validation schemas based on Prisma Post model
 */
export const postValidations = {
  // Create new post
  create: [
    body('content')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Post content must not exceed 2000 characters'),
    body('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'MIXED'])
      .withMessage('Post type must be one of: TEXT, IMAGE, VIDEO, AUDIO, MIXED'),
    body('images').optional().isArray({ max: 10 }).withMessage('Maximum 10 images allowed'),
    body('images.*').optional().isURL().withMessage('Each image must be a valid URL'),
    body('videos').optional().isArray({ max: 5 }).withMessage('Maximum 5 videos allowed'),
    body('videos.*').optional().isURL().withMessage('Each video must be a valid URL'),
    body('audioUrl').optional().isURL().withMessage('Audio URL must be valid'),
    body('parentId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Parent ID must be a valid CUID'),
    body('replyToId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Reply to ID must be a valid CUID'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('allowReplies').optional().isBoolean().withMessage('allowReplies must be a boolean'),
  ],

  // Update post
  update: [
    commonValidations.id,
    body('content')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Post content must not exceed 2000 characters'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('allowReplies').optional().isBoolean().withMessage('allowReplies must be a boolean'),
  ],

  // Get posts with filters
  getAll: [
    commonValidations.page,
    commonValidations.limit,
    query('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'MIXED'])
      .withMessage('Post type must be one of: TEXT, IMAGE, VIDEO, AUDIO, MIXED'),
    query('authorId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Author ID must be a valid CUID'),
    query('parentId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Parent ID must be a valid CUID'),
  ],

  // Remove media from post
  removeMedia: [
    body('mediaUrls').isArray({ min: 1 }).withMessage('At least one media URL must be provided'),
    body('mediaUrls.*').isURL().withMessage('Each media URL must be valid'),
    body('mediaType')
      .isIn(['image', 'video', 'audio'])
      .withMessage('Media type must be one of: image, video, audio'),
  ],
};

/**
 * Comment validation schemas based on Prisma Comment model
 */
export const commentValidations = {
  create: [
    body('content')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Comment content must not exceed 1000 characters'),
    body('postId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Post ID must be a valid CUID'),
    body('parentId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Parent ID must be a valid CUID'),
  ],

  update: [
    commonValidations.id,
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment content must be between 1 and 1000 characters'),
  ],

  // Get comments with pagination
  getByPost: [
    param('postId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Post ID must be a valid CUID'),
    commonValidations.page,
    commonValidations.limit,
  ],

  // Get replies for a comment
  getReplies: [
    param('commentId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Comment ID must be a valid CUID'),
    commonValidations.page,
    commonValidations.limit,
  ],

  // Remove media from comment
  removeMedia: [
    commonValidations.id,
    body('mediaUrls').isArray({ min: 1 }).withMessage('At least one media URL must be provided'),
    body('mediaUrls.*').isURL().withMessage('Each media URL must be valid'),
    body('mediaType')
      .isIn(['image', 'video', 'audio', 'document'])
      .withMessage('Media type must be one of: image, video, audio, document'),
  ],
};

/**
 * Message validation schemas based on Prisma Message model
 */
export const messageValidations = {
  sendMessage: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    body('content')
      .optional()
      .trim()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Message content must be between 1 and 10000 characters'),
    body('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE'])
      .withMessage('Invalid message type'),
    body('replyToId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Reply message ID must be a valid CUID'),
  ],
  editMessage: [
    param('messageId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Message ID must be a valid CUID'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Message content must be between 1 and 10000 characters'),
  ],
  deleteMessage: [
    param('messageId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Message ID must be a valid CUID'),
  ],
  reactToMessage: [
    param('messageId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Message ID must be a valid CUID'),
    body('emoji')
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage('Emoji must be between 1 and 10 characters'),
  ],
  markAsRead: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    body('messageId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Message ID must be a valid CUID'),
  ],
  getMessages: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    commonValidations.page,
    commonValidations.limit,
  ],
};

/**
 * Follow validation schemas
 */
export const followValidations = {
  follow: [
    param('userId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('User ID must be a valid CUID'),
  ],

  unfollow: [
    param('userId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('User ID must be a valid CUID'),
  ],
};

/**
 * Report validation schemas
 */
export const reportValidations = {
  create: [
    body('postId')
      .optional()
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Post ID must be a valid CUID'),
    body('reason')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Reason must be between 1 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
  ],
};

/**
 * Conversation Validations
 */
export const conversationValidations = {
  createConversation: [
    body('participantIds')
      .isArray({ min: 1 })
      .withMessage('Participant IDs must be an array with at least one ID'),
    body('participantIds.*')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Each participant ID must be a valid CUID'),
    body('type')
      .optional()
      .isIn(['DIRECT', 'GROUP'])
      .withMessage('Conversation type must be DIRECT or GROUP'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
  ],
  updateConversation: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
  ],
  getConversation: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
  ],
  addParticipants: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    body('participantIds')
      .isArray({ min: 1 })
      .withMessage('Participant IDs must be an array with at least one ID'),
    body('participantIds.*')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Each participant ID must be a valid CUID'),
  ],
  removeParticipant: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    param('participantId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Participant ID must be a valid CUID'),
  ],
  updateParticipantRole: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
    param('userId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('User ID must be a valid CUID'),
    body('role').isIn(['MEMBER', 'ADMIN']).withMessage('Role must be MEMBER or ADMIN'),
  ],
  leaveConversation: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
  ],
  deleteConversation: [
    param('conversationId')
      .isLength({ min: 25, max: 25 })
      .matches(/^c[a-z0-9]{24}$/)
      .withMessage('Conversation ID must be a valid CUID'),
  ],
  getConversations: [commonValidations.page, commonValidations.limit],
};

/**
 * Generic CRUD validations
 */
export const crudValidations = {
  getById: [commonValidations.id],
  pagination: [commonValidations.page, commonValidations.limit, commonValidations.search],
  deleteById: [commonValidations.id],
};
