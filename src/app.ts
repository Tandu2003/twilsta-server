import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import apiRoutes from './routes';
import logger from './utils/logger';
import { ResponseHelper } from './utils/responseHelper';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, customRequestLogger } from './middleware/logging';
import {
  securityHeaders,
  generalLimiter,
  requestSizeLimiter,
} from './middleware/security';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Security middleware
app.use(securityHeaders);

// Request logging
app.use(requestLogger);
app.use(customRequestLogger);

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request size limiter
app.use(requestSizeLimiter);

// CORS middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  }),
);

// API Routes
app.use('/api', apiRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  logger.info('Health check requested');
  ResponseHelper.success(
    res,
    {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    },
    'Server is healthy',
  );
});

// 404 handler
app.use('*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

export default app;
