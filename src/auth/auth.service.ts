import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BcryptUtil } from '../common/utils/bcrypt.util';
import { JwtUtil } from '../common/utils/jwt.util';
import { LoggerUtil } from '../common/utils/logger.util';
import { EmailUtil } from '../common/utils/email.util';
import { randomBytes } from 'crypto';
import {
  RegisterDto,
  LoginDto,
  SendVerificationEmailDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  AuthResponse,
  JwtPayload,
  UserResponse,
} from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  private jwtUtil: JwtUtil;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtUtil = new JwtUtil(this.jwtService);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { username, email, password, fullName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already exists');
      }
    }

    // Hash password using BcryptUtil
    const hashedPassword = await BcryptUtil.hash(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullName,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatar: true,
        isVerified: true,
        isPrivate: true,
        createdAt: true,
      },
    });

    // Send verification email automatically after registration
    try {
      const token = randomBytes(32).toString('hex');
      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          token,
          type: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      const frontendUrl = this.configService.get<string>('CORS_ORIGIN');
      await EmailUtil.sendVerificationEmail(
        user.email,
        user.username,
        token,
        frontendUrl,
      );
    } catch (error) {
      LoggerUtil.error(
        'Failed to send verification email after registration',
        error,
      );
      // Don't fail registration if email fails
    }

    // Generate tokens using JwtUtil
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };
    const tokens = await this.jwtUtil.generateTokens(payload);

    const userResponse: UserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName ?? undefined,
      avatar: user.avatar ?? undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };

    return {
      ...tokens,
      user: userResponse,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { emailOrUsername, password } = loginDto;

    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });

    if (!user || !(await BcryptUtil.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens using JwtUtil
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };
    const tokens = await this.jwtUtil.generateTokens(payload);

    const userResponse: UserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName ?? undefined,
      avatar: user.avatar ?? undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };

    return {
      ...tokens,
      user: userResponse,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtUtil.refreshAccessToken(refreshToken);

    if (!accessToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { accessToken };
  }

  async sendVerificationEmail(
    dto: SendVerificationEmailDto,
  ): Promise<{ message: string }> {
    const { email } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate verification token
    const token = randomBytes(32).toString('hex');

    // Save token to database
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    try {
      const frontendUrl = this.configService.get<string>('CORS_ORIGIN');
      const emailSent = await EmailUtil.sendVerificationEmail(
        user.email,
        user.username,
        token,
        frontendUrl,
      );

      if (!emailSent) {
        throw new Error('Email service failed');
      }

      LoggerUtil.logAuthEvent('Verification email requested', user.id, {
        email,
      });
      return { message: 'Verification email sent successfully' };
    } catch (error) {
      LoggerUtil.error('Failed to send verification email', error);
      throw new BadRequestException(
        'Failed to send verification email. Please try again later.',
      );
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const { token } = dto;

    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION',
        isUsed: false,
        expiresAt: {
          gte: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { isVerified: true },
    });

    // Mark token as used
    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { isUsed: true },
    });

    // Send welcome email
    try {
      const frontendUrl = this.configService.get<string>('CORS_ORIGIN');
      await EmailUtil.sendWelcomeEmail(
        verificationToken.user.email,
        verificationToken.user.username,
        frontendUrl,
      );
    } catch (error) {
      LoggerUtil.error('Failed to send welcome email', error);
      // Don't fail verification if welcome email fails
    }

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists or not
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');

    // Save token to database
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send password reset email
    try {
      const frontendUrl = this.configService.get<string>('CORS_ORIGIN');
      const emailSent = await EmailUtil.sendPasswordResetEmail(
        user.email,
        user.username,
        token,
        frontendUrl,
      );

      if (!emailSent) {
        throw new Error('Email service failed');
      }

      LoggerUtil.logAuthEvent('Password reset requested', user.id, { email });
    } catch (error) {
      LoggerUtil.error('Failed to send password reset email', error);
      // Don't reveal if email exists or not, even if email fails
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = dto;

    const resetToken = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'PASSWORD_RESET',
        isUsed: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password using BcryptUtil
    const hashedPassword = await BcryptUtil.hash(newPassword);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await this.prisma.verificationToken.update({
      where: { id: resetToken.id },
      data: { isUsed: true },
    });

    return { message: 'Password reset successfully' };
  }

  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(await BcryptUtil.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password using BcryptUtil
    const hashedPassword = await BcryptUtil.hash(newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async checkUsername(username: string): Promise<{ exists: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    return { exists: !!user };
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatar: true,
        isVerified: true,
        isPrivate: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName ?? undefined,
      avatar: user.avatar ?? undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };
  }
}
