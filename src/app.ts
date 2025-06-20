import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes';
import logger from './utils/logger';
import { ResponseHelper } from './utils/responseHelper';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, customRequestLogger } from './middleware/logging';
import { securityHeaders, generalLimiter, requestSizeLimiter } from './middleware/security';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Create Prisma client for health checks
const prisma = new PrismaClient();

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

// Cookie parsing middleware
app.use(cookieParser());

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

// Enhanced health check route
app.get('/health', async (req: Request, res: Response) => {
  try {
    logger.info('Health check requested');

    const healthData: any = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      server: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid,
      },
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthData.database = {
        status: 'connected',
        type: 'PostgreSQL',
      };
    } catch (dbError) {
      logger.warn('Database health check failed:', dbError);
      healthData.database = {
        status: 'disconnected',
        type: 'PostgreSQL',
        error: process.env.NODE_ENV === 'production' ? 'Connection failed' : String(dbError),
      };
      // Server is still healthy even if DB is down
      healthData.status = 'DEGRADED';
    }

    ResponseHelper.success(res, healthData, 'Server health check completed');
  } catch (error) {
    logger.error('Health check error:', error);
    ResponseHelper.error(res, 'Health check failed', 503);
  }
});

// Server status endpoint
app.get('/status', (req: Request, res: Response) => {
  try {
    const status = {
      server: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };

    res.json(status);
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      server: 'error',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'production' ? 'Status check failed' : String(error),
    });
  }
});

// 404 handler
app.use('*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

export default app;
