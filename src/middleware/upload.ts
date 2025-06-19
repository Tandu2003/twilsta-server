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
 * Post media upload middleware (supports multiple files)
 */
export const uploadPostMedia = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max video size for all media
    files: 4, // Max 4 files per post
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const isImage = allowedImageTypes.includes(file.mimetype);
    const isVideo = allowedVideoTypes.includes(file.mimetype);

    if (!isImage && !isVideo) {
      return cb(
        new Error(`Invalid file type. Allowed types: images and videos`),
      );
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size && file.size > maxSize) {
      return cb(
        new Error(
          `File too large. Maximum size for ${isImage ? 'images' : 'videos'}: ${
            maxSize / (1024 * 1024)
          }MB`,
        ),
      );
    }

    cb(null, true);
  },
}).array('media', 4);

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

    cb(null, true);
  },
}).array('attachments', 5);

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
    logger.info(
      `File uploaded: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );
  }

  if (files?.length) {
    logger.info(
      `${files.length} files uploaded:`,
      files.map((f) => ({
        name: f.originalname,
        type: f.mimetype,
        size: f.size,
      })),
    );
  }

  next();
};

/**
 * Clean filename for safe storage
 */
export const cleanFileName = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .toLowerCase();
};
