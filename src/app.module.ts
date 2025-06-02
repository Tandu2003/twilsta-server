import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FollowModule } from './follow/follow.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    FollowModule,
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimiterMiddleware).forRoutes('*'); // Apply to all routes
  }
}
