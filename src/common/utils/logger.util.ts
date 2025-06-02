import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerUtil {
  private static readonly logger = new Logger('Application');

  static log(message: string, context?: string): void {
    this.logger.log(message, context);
  }

  static error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, trace, context);
  }

  static warn(message: string, context?: string): void {
    this.logger.warn(message, context);
  }

  static debug(message: string, context?: string): void {
    this.logger.debug(message, context);
  }

  static verbose(message: string, context?: string): void {
    this.logger.verbose(message, context);
  }

  // Specific methods for common use cases
  static logAuthEvent(event: string, userId?: string, details?: any): void {
    const message = `Auth Event: ${event}${userId ? ` for user ${userId}` : ''}`;
    this.log(message, 'AuthService');
    if (details) {
      this.debug(`Details: ${JSON.stringify(details)}`, 'AuthService');
    }
  }

  static logFollowEvent(
    event: string,
    userId?: string,
    targetUserId?: string,
  ): void {
    const message = `Follow Event: ${event}${userId ? ` by user ${userId}` : ''}${targetUserId ? ` for user ${targetUserId}` : ''}`;
    this.log(message, 'FollowService');
  }

  static logSecurityEvent(event: string, ip?: string, details?: any): void {
    const message = `Security Event: ${event}${ip ? ` from IP ${ip}` : ''}`;
    this.warn(message, 'Security');
    if (details) {
      this.debug(`Details: ${JSON.stringify(details)}`, 'Security');
    }
  }
}
