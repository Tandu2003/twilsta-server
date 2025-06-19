import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta?: {
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ResponseHelper {
  /**
   * Success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Success',
    statusCode: number = 200,
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Created response
   */
  static created<T>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully',
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, 201);
  }

  /**
   * Updated response
   */
  static updated<T>(
    res: Response,
    data?: T,
    message: string = 'Resource updated successfully',
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, 200);
  }

  /**
   * Deleted response
   */
  static deleted(
    res: Response,
    message: string = 'Resource deleted successfully',
  ): Response<ApiResponse> {
    return this.success(res, null, message, 200);
  }

  /**
   * Paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data retrieved successfully',
  ): Response<ApiResponse<T[]>> {
    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        page,
        limit,
        total,
        totalPages,
      },
    };

    return res.status(200).json(response);
  }

  /**
   * Error response
   */
  static error(
    res: Response,
    message: string = 'An error occurred',
    statusCode: number = 500,
    error?: any,
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      error: process.env.NODE_ENV === 'production' ? undefined : error,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Bad Request response
   */
  static badRequest(
    res: Response,
    message: string = 'Bad Request',
    error?: any,
  ): Response<ApiResponse> {
    return this.error(res, message, 400, error);
  }

  /**
   * Unauthorized response
   */
  static unauthorized(
    res: Response,
    message: string = 'Unauthorized',
  ): Response<ApiResponse> {
    return this.error(res, message, 401);
  }

  /**
   * Forbidden response
   */
  static forbidden(
    res: Response,
    message: string = 'Forbidden',
  ): Response<ApiResponse> {
    return this.error(res, message, 403);
  }

  /**
   * Not Found response
   */
  static notFound(
    res: Response,
    message: string = 'Resource not found',
  ): Response<ApiResponse> {
    return this.error(res, message, 404);
  }

  /**
   * Validation Error response
   */
  static validationError(
    res: Response,
    errors: any,
    message: string = 'Validation failed',
  ): Response<ApiResponse> {
    return this.error(res, message, 422, errors);
  }

  /**
   * Internal Server Error response
   */
  static internalError(
    res: Response,
    message: string = 'Internal Server Error',
    error?: any,
  ): Response<ApiResponse> {
    return this.error(res, message, 500, error);
  }

  /**
   * Too Many Requests response
   */
  static tooManyRequests(
    res: Response,
    message: string = 'Too many requests, please try again later',
  ): Response<ApiResponse> {
    return this.error(res, message, 429);
  }
}

// Export convenient methods
export const {
  success,
  created,
  updated,
  deleted,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalError,
  tooManyRequests,
} = ResponseHelper;
