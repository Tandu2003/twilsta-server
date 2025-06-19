import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { badRequest } from '../utils/responseHelper';
import logger from '../utils/logger';

// File type validation
const allowedImageTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];
const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
const allowedDocumentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Configure multer to store files in memory
const storage = multer.memoryStorage();

/**
 * File filter for different types
 */
const createFileFilter = (allowedTypes: string[], maxSize: number) => {
  return (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn(`Invalid file type uploaded: ${file.mimetype}`);
      return cb(
        new Error(
          `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        ),
      );
    }

    // Check file size (this is also handled by multer limits, but good to double-check)
    if (file.size && file.size > maxSize) {
      logger.warn(`File too large: ${file.size} bytes`);
      return cb(
        new Error(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`),
      );
    }

    cb(null, true);
  };
};

/**
 * Avatar upload middleware
 */
export const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(allowedImageTypes, MAX_IMAGE_SIZE),
}).single('avatar');

/**
 * Cover image upload middleware
 */
export const uploadCoverImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(allowedImageTypes, MAX_IMAGE_SIZE),
}).single('coverImage');

/**
 * Upload middleware for post media (images, videos, audio)
 */
export const uploadPostMedia = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use largest limit for mixed media
    files: 10, // Allow up to 10 files per post
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...allowedImageTypes,
      ...allowedVideoTypes,
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn(`Invalid media file type uploaded: ${file.mimetype}`);
      return cb(
        new Error(
          `Invalid file type. Allowed types: images, videos, audio files`,
        ),
      );
    }

    // Check specific size limits based on file type
    let maxSize = MAX_IMAGE_SIZE;
    if (file.mimetype.startsWith('video/')) {
      maxSize = MAX_VIDEO_SIZE;
    } else if (file.mimetype.startsWith('audio/')) {
      maxSize = MAX_DOCUMENT_SIZE; // 10MB for audio
    }

    cb(null, true);
  },
}).array('media', 10); // Accept up to 10 files with field name 'media'

/**
 * Upload middleware for single post media
 */
export const uploadSinglePostMedia = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...allowedImageTypes,
      ...allowedVideoTypes,
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn(`Invalid media file type uploaded: ${file.mimetype}`);
      return cb(
        new Error(
          `Invalid file type. Allowed types: images, videos, audio files`,
        ),
      );
    }

    cb(null, true);
  },
}).single('media');

/**
 * Message attachment upload middleware
 */
export const uploadMessageAttachment = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
    files: 5, // Max 5 attachments per message
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const allAllowedTypes = [
      ...allowedImageTypes,
      ...allowedVideoTypes,
      ...allowedDocumentTypes,
    ];

    if (!allAllowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          `Invalid file type. Allowed types: images, videos, and documents`,
        ),
      );
    }

    cb(null, true);  },
}).array('attachments', 5);

/**
 * Comment media upload middleware (supports images, videos, audio, documents)
 */
export const uploadCommentMedia = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use largest limit for mixed media
    files: 5, // Max 5 files per comment
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...allowedImageTypes,
      ...allowedVideoTypes,
      ...allowedDocumentTypes,
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/m4a',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn(`Invalid comment media file type uploaded: ${file.mimetype}`);
      return cb(
        new Error(
          `Invalid file type. Allowed types: images, videos, audio files, and documents`,
        ),
      );
    }

    // Check specific size limits based on file type
    let maxSize = MAX_IMAGE_SIZE;
    if (file.mimetype.startsWith('video/')) {
      maxSize = MAX_VIDEO_SIZE;
    } else if (file.mimetype.startsWith('audio/')) {
      maxSize = MAX_DOCUMENT_SIZE; // 10MB for audio
    } else if (allowedDocumentTypes.includes(file.mimetype)) {
      maxSize = MAX_DOCUMENT_SIZE; // 10MB for documents
    }

    cb(null, true);
  },
}).array('media', 5); // Accept up to 5 files with field name 'media'

/**
 * Generic file upload error handler
 */
export const handleUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer upload error:', error);

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        badRequest(res, 'File too large');
        return;
      case 'LIMIT_FILE_COUNT':
        badRequest(res, 'Too many files uploaded');
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        badRequest(res, 'Unexpected file field');
        return;
      default:
        badRequest(res, 'File upload error');
        return;
    }
  }

  if (error.message) {
    logger.error('File validation error:', error.message);
    badRequest(res, error.message);
    return;
  }

  next(error);
};

/**
 * Validate uploaded files middleware
 */
export const validateUploadedFiles = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Check if files were uploaded when expected
  const file = req.file;
  const files = req.files as Express.Multer.File[];
  if (!file && !files?.length) {
    badRequest(res, 'No files uploaded');
    return;
  }

  // Log upload info
  if (file) {
    logger.info(`File uploaded: ${file.originalname}, size: ${file.size}`);
  }
  if (files?.length) {
    logger.info(`Files uploaded: ${files.length} files`);
  }

  next();
};
