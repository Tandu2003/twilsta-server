import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtUtil } from '../common/utils/jwt.util';
import { LoggerUtil } from '../common/utils/logger.util';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    {
      provide: JwtUtil,
      useFactory: (jwtService: JwtService) => new JwtUtil(jwtService),
      inject: [JwtService],
    },
    LoggerUtil,
  ],
  exports: [ChatService],
})
export class ChatModule {}
