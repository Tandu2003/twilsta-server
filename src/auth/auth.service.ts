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
import * as bcrypt from 'bcrypt';
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
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

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

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email,
    );

    const userResponse: UserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName || undefined,
      avatar: user.avatar || undefined,
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

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email,
    );

    const userResponse: UserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName || undefined,
      avatar: user.avatar || undefined,
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
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const accessToken = await this.generateAccessToken(
        user.id,
        user.username,
        user.email,
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
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

    // TODO: Send email (implement email service)
    console.log(`Verification token for ${email}: ${token}`);

    return { message: 'Verification email sent successfully' };
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

    // TODO: Send email (implement email service)
    console.log(`Password reset token for ${email}: ${token}`);

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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

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

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

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
      fullName: user.fullName || undefined,
      avatar: user.avatar || undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(
    userId: string,
    username: string,
    email: string,
  ) {
    const payload: JwtPayload = { userId, username, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, username, email),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(
    userId: string,
    username: string,
    email: string,
  ) {
    const payload: JwtPayload = { userId, username, email };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });
  }
}
