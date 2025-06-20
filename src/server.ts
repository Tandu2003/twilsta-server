import app from './app';
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';
import { createServer } from 'http';
import RealtimeService from './services/realtimeService';
import { setRealtimeService } from './services/realtimeInstance';

const PORT = process.env.PORT || 8080;
const prisma = new PrismaClient();

// Create HTTP server and Socket.IO instance
let realtimeService: RealtimeService;
let httpServer: any;

// Database connection retry configuration
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Function to connect to database with retry logic
async function connectToDatabase(attempt = 1): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL database via Prisma');
  } catch (error) {
    logger.error(`❌ Database connection attempt ${attempt} failed:`, error);

    if (attempt < MAX_RETRY_ATTEMPTS) {
      logger.info(`⏳ Retrying database connection in ${RETRY_DELAY / 1000} seconds...`);
      setTimeout(() => {
        connectToDatabase(attempt + 1);
      }, RETRY_DELAY);
    } else {
      logger.error(
        '❌ Max database connection attempts reached. Server will continue without database connection.',
      );
    }
  }
}

// Graceful shutdown function (only for manual shutdown)
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Disconnect realtime service
    if (realtimeService) {
      realtimeService.disconnect();
      logger.info('Socket.IO connections closed');
    }

    // Close HTTP server
    if (httpServer) {
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Disconnect from database
    await prisma.$disconnect();
    logger.info('Database connection closed');

    logger.info('Server shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Function to start the server
async function startServer() {
  try {
    // Try to connect to database
    await connectToDatabase();

    // Create HTTP server
    httpServer = createServer(app);

    // Initialize Socket.IO realtime service
    realtimeService = new RealtimeService(httpServer);
    setRealtimeService(realtimeService);

    // Start the server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔌 Socket.IO realtime enabled`);
    });

    // Handle server errors
    httpServer.on('error', (error: Error) => {
      logger.error('❌ Server error:', error);
      // Server continues running, just logs the error
    });

    // Handle graceful shutdown only for manual signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions - log but don't crash
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception (server continues):', error);
      // Don't call gracefulShutdown, just log the error
    });

    // Handle unhandled promise rejections - log but don't crash
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(
        '❌ Unhandled Rejection (server continues) at:',
        promise?.toString?.() || 'unknown promise',
        'reason:',
        reason,
      );
      // Don't call gracefulShutdown, just log the error
    });

    return httpServer;
  } catch (error) {
    logger.error('❌ Failed to start server (retrying in 5 seconds):', error);

    // Retry starting the server after 5 seconds instead of exiting
    setTimeout(() => {
      logger.info('🔄 Retrying server startup...');
      startServer();
    }, 5000);
  }
}

// Start the server
startServer();

// Keep the process alive
process.on('exit', (code) => {
  logger.info(`Process exiting with code: ${code}`);
});

logger.info('🔄 Server process started - will keep running even on errors');
