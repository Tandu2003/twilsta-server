import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelper';
import { AppError, ValidationError } from '../utils/errors';

/**
 * Global error handling middleware
 * This should only handle errors that are NOT already handled by other middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check if response has already been sent
    if (res.headersSent) {
      logger.warn('Headers already sent, cannot send error response');
      return;
    }

    let error = { ...err };
    error.message = err.message || 'Unknown error';

    // Log error with additional request information
    logger.error('🔥 Unhandled error occurred:', {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new AppError(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((val: any) => val.message);
      error = new ValidationError('Validation Error', message);
    }

    // Prisma errors
    if (err.code === 'P2002') {
      const message = 'Duplicate field value entered';
      error = new AppError(message, 400);
    }

    if (err.code === 'P2025') {
      const message = 'Record not found';
      error = new AppError(message, 404);
    }

    // Prisma connection errors
    if (err.code === 'P1001') {
      const message = 'Database connection error';
      error = new AppError(message, 503);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      const message = 'Invalid token';
      error = new AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
      const message = 'Token expired';
      error = new AppError(message, 401);
    }

    // Handle validation errors specifically
    if (error instanceof ValidationError) {
      ResponseHelper.validationError(res, error.errors, error.message);
      return;
    }

    // Handle operational errors
    if (error instanceof AppError) {
      ResponseHelper.error(res, error.message, error.statusCode);
      return;
    }

    // Default to 500 server error
    if (!res.headersSent) {
      error(
        res,
        process.env.NODE_ENV === 'production' ? 'Something went wrong!' : error.message,
        error.statusCode || 500,
        process.env.NODE_ENV === 'development'
          ? {
              name: error.name,
              code: error.code,
              stack: error.stack,
            }
          : undefined,
      );
    }
  } catch (handlerError) {
    // If error handler itself fails, log it and send a basic response
    logger.error('❌ Critical error in error handler:', handlerError);

    // Try to send a basic error response if possible
    try {
      if (!res.headersSent) {
        ResponseHelper.internalError(res, 'Critical server error');
      }
    } catch (responseError) {
      logger.error('❌ Failed to send error response:', responseError);
      // At this point, we can't do anything more
    }
  }
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    logger.info(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!res.headersSent) {
      ResponseHelper.notFound(res, `Route ${req.originalUrl} not found`);
    }
  } catch (error) {
    logger.error('Error in 404 handler:', error);
    try {
      if (!res.headersSent) {
        ResponseHelper.notFound(res, 'Not found');
      }
    } catch (responseError) {
      logger.error('Failed to send 404 response:', responseError);
    }
  }
};

/**
 * Validation middleware using express-validator
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error: any) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
      }));

      logger.info('Validation errors:', { errors: errorMessages, url: req.url });

      if (!res.headersSent) {
        ResponseHelper.validationError(res, errorMessages);
      }
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in validation handler:', error);
    try {
      if (!res.headersSent) {
        ResponseHelper.badRequest(res, 'Validation error');
      }
    } catch (responseError) {
      logger.error('Failed to send validation error response:', responseError);
    }
  }
};
