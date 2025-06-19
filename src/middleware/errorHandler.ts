import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger';
import { ResponseHelper } from '../utils/responseHelper';
import { AppError, ValidationError } from '../utils/errors';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

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
  ResponseHelper.internalError(
    res,
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : error.message,
    process.env.NODE_ENV === 'production' ? undefined : error,
  );
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  ResponseHelper.notFound(res, `Route ${req.originalUrl} not found`);
};

/**
 * Validation middleware using express-validator
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: any) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    ResponseHelper.validationError(res, errorMessages);
    return;
  }

  next();
};
