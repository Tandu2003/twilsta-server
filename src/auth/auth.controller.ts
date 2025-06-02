import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  UseFilters,
  UseInterceptors,
  ValidationPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CookieUtil } from '../common/utils/cookie.util';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import {
  RegisterDto,
  LoginDto,
  SendVerificationEmailDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  TestEmailDto,
} from './dto/auth.dto';
import { UserResponse } from './interfaces/auth.interface';
import { ConfigService } from '@nestjs/config';
import { EmailUtil } from '../common/utils/email.util';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(TransformInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký người dùng mới' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(registerDto);

    // Set cookies using CookieUtil
    CookieUtil.set(response, 'accessToken', result.accessToken, {
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    CookieUtil.set(response, 'refreshToken', result.refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      message: 'User registered successfully',
      user: result.user,
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập người dùng' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set cookies using CookieUtil
    CookieUtil.set(response, 'accessToken', result.accessToken, {
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    CookieUtil.set(response, 'refreshToken', result.refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất người dùng' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiBearerAuth()
  async logout(@Res({ passthrough: true }) response: Response) {
    // Clear cookies using CookieUtil
    CookieUtil.clear(response, 'accessToken');
    CookieUtil.clear(response, 'refreshToken');

    return { message: 'Logout successful' };
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Làm mới accessToken' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = CookieUtil.get(request, 'refreshToken');

    if (!refreshToken) {
      response.status(HttpStatus.UNAUTHORIZED);
      return { message: 'Refresh token not found' };
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new access token cookie using CookieUtil
    CookieUtil.set(response, 'accessToken', result.accessToken, {
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return { message: 'Token refreshed successfully' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'User information retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  async getCurrentUser(
    @CurrentUser() user: UserResponse,
  ): Promise<UserResponse> {
    return this.authService.getCurrentUser(user.id);
  }

  @Public()
  @Post('send-verification-email')
  @ApiOperation({ summary: 'Gửi email xác thực tài khoản' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendVerificationEmail(
    @Body(ValidationPipe) dto: SendVerificationEmailDto,
  ) {
    return this.authService.sendVerificationEmail(dto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Xác minh tài khoản qua token email' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body(ValidationPipe) dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Gửi mail đặt lại mật khẩu' })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
  async forgotPassword(@Body(ValidationPipe) dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới từ token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body(ValidationPipe) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Put('update-password')
  @ApiOperation({ summary: 'Đổi mật khẩu khi đã đăng nhập' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiBearerAuth()
  async updatePassword(
    @CurrentUser() user: UserResponse,
    @Body(ValidationPipe) dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user.id, dto);
  }

  @Public()
  @Get('check-username')
  @ApiOperation({ summary: 'Kiểm tra username đã tồn tại' })
  @ApiResponse({ status: 200, description: 'Username availability checked' })
  async checkUsername(@Query('username') username: string) {
    if (!username) {
      return { exists: false, message: 'Username parameter is required' };
    }
    return this.authService.checkUsername(username);
  }

  @Public()
  @Post('test-email')
  @ApiOperation({
    summary: '[DEV ONLY] Test email service',
    description:
      'Send test emails for development and testing purposes. Only available in development mode.',
  })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Test verification email sent successfully',
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Only available in development or validation error',
  })
  async testEmail(@Body(ValidationPipe) dto: TestEmailDto) {
    // Only allow in development
    if (this.configService.get('NODE_ENV') !== 'development') {
      return {
        message: 'This endpoint is only available in development mode',
        success: false,
      };
    }

    const { email, type = 'verification' } = dto;
    const testToken = 'test-token-123';
    const testUsername = 'testuser';
    const frontendUrl = this.configService.get<string>('CORS_ORIGIN');

    try {
      let result = false;
      switch (type) {
        case 'verification':
          result = await EmailUtil.sendVerificationEmail(
            email,
            testUsername,
            testToken,
            frontendUrl,
          );
          break;
        case 'reset':
          result = await EmailUtil.sendPasswordResetEmail(
            email,
            testUsername,
            testToken,
            frontendUrl,
          );
          break;
        case 'welcome':
          result = await EmailUtil.sendWelcomeEmail(
            email,
            testUsername,
            frontendUrl,
          );
          break;
      }

      return {
        message: `Test ${type} email ${result ? 'sent successfully' : 'failed to send'}`,
        success: result,
      };
    } catch (error) {
      return {
        message: 'Failed to send test email',
        error: error.message,
        success: false,
      };
    }
  }
}
