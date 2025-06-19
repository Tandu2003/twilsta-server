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

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Disconnect realtime service
    if (realtimeService) {
      realtimeService.disconnect();
      logger.info('Socket.IO connections closed');
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
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL database via Prisma');

    // Create HTTP server
    const httpServer = createServer(app); // Initialize Socket.IO realtime service
    realtimeService = new RealtimeService(httpServer);
    setRealtimeService(realtimeService);

    // Start the server
    const server = httpServer.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔌 Socket.IO realtime enabled`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
