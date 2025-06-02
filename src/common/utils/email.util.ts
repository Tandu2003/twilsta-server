import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { LoggerUtil } from './logger.util';

export class EmailUtil {
  private static transporter: nodemailer.Transporter;

  static async initialize(configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASS'),
      },
    });

    // Verify connection
    try {
      await this.transporter.verify();
      LoggerUtil.log('Email service initialized successfully');
    } catch (error) {
      LoggerUtil.error('Email service initialization failed', error);
    }
  }

  static async sendVerificationEmail(
    to: string,
    username: string,
    token: string,
    frontendUrl?: string,
  ): Promise<boolean> {
    try {
      const verificationUrl = `${frontendUrl || 'http://localhost:3000'}/verify-email?token=${token}`;
      const smtpUser = process.env.SMTP_USER || '';

      const mailOptions = {
        from: `"Twilsta" <${smtpUser}>`,
        to,
        subject: 'Xác thực email của bạn - Twilsta',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Chào mừng đến với Twilsta!</h1>
            </div>

            <div style="padding: 40px 20px; background-color: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Xin chào ${username}!</h2>

              <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
                Cảm ơn bạn đã đăng ký tài khoản Twilsta. Để hoàn tất quá trình đăng ký và bắt đầu sử dụng dịch vụ của chúng tôi,
                vui lòng xác thực địa chỉ email của bạn bằng cách nhấp vào nút bên dưới:
              </p>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${verificationUrl}"
                   style="display: inline-block; padding: 15px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Xác thực Email
                </a>
              </div>

              <p style="color: #777; font-size: 14px; line-height: 1.5;">
                Nếu nút không hoạt động, bạn có thể copy và paste đường link sau vào trình duyệt:<br>
                <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
              </p>

              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Link này sẽ hết hạn sau 24 giờ. Nếu bạn không yêu cầu xác thực này, vui lòng bỏ qua email này.
              </p>
            </div>

            <div style="background-color: #333; padding: 20px; text-align: center;">
              <p style="color: #999; margin: 0; font-size: 12px;">
                © 2024 Twilsta. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      LoggerUtil.logAuthEvent('Verification email sent', undefined, {
        to,
        username,
      });
      return true;
    } catch (error) {
      LoggerUtil.error('Failed to send verification email', error);
      return false;
    }
  }

  static async sendPasswordResetEmail(
    to: string,
    username: string,
    token: string,
    frontendUrl?: string,
  ): Promise<boolean> {
    try {
      const resetUrl = `${frontendUrl || 'http://localhost:3000'}/reset-password?token=${token}`;
      const smtpUser = process.env.SMTP_USER || '';

      const mailOptions = {
        from: `"Twilsta" <${smtpUser}>`,
        to,
        subject: 'Đặt lại mật khẩu - Twilsta',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Đặt lại mật khẩu</h1>
            </div>

            <div style="padding: 40px 20px; background-color: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Xin chào ${username}!</h2>

              <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Twilsta của bạn.
                Nếu bạn đã yêu cầu điều này, vui lòng nhấp vào nút bên dưới để đặt lại mật khẩu:
              </p>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}"
                   style="display: inline-block; padding: 15px 30px; background-color: #f5576c; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Đặt lại mật khẩu
                </a>
              </div>

              <p style="color: #777; font-size: 14px; line-height: 1.5;">
                Nếu nút không hoạt động, bạn có thể copy và paste đường link sau vào trình duyệt:<br>
                <a href="${resetUrl}" style="color: #f5576c; word-break: break-all;">${resetUrl}</a>
              </p>

              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>⚠️ Lưu ý bảo mật:</strong><br>
                  - Link này sẽ hết hạn sau 1 giờ<br>
                  - Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này<br>
                  - Không chia sẻ link này với bất kỳ ai
                </p>
              </div>
            </div>

            <div style="background-color: #333; padding: 20px; text-align: center;">
              <p style="color: #999; margin: 0; font-size: 12px;">
                © 2024 Twilsta. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      LoggerUtil.logAuthEvent('Password reset email sent', undefined, {
        to,
        username,
      });
      return true;
    } catch (error) {
      LoggerUtil.error('Failed to send password reset email', error);
      return false;
    }
  }

  static async sendWelcomeEmail(
    to: string,
    username: string,
    frontendUrl?: string,
  ): Promise<boolean> {
    try {
      const loginUrl = `${frontendUrl || 'http://localhost:3000'}/login`;
      const smtpUser = process.env.SMTP_USER || '';

      const mailOptions = {
        from: `"Twilsta" <${smtpUser}>`,
        to,
        subject: 'Chào mừng bạn đến với Twilsta! 🎉',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Chào mừng đến với Twilsta!</h1>
            </div>

            <div style="padding: 40px 20px; background-color: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Xin chào ${username}!</h2>

              <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
                Cảm ơn bạn đã xác thực email và trở thành thành viên của cộng đồng Twilsta!
                Bây giờ bạn có thể khám phá tất cả các tính năng tuyệt vời mà chúng tôi cung cấp.
              </p>

              <div style="background-color: white; border-radius: 8px; padding: 30px; margin: 30px 0; border-left: 4px solid #667eea;">
                <h3 style="color: #333; margin-top: 0;">Những gì bạn có thể làm:</h3>
                <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
                  <li>Chia sẻ những khoảnh khắc đáng nhớ</li>
                  <li>Kết nối với bạn bè và người thân</li>
                  <li>Khám phá nội dung thú vị từ cộng đồng</li>
                  <li>Tùy chỉnh hồ sơ cá nhân của bạn</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${loginUrl}"
                   style="display: inline-block; padding: 15px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Bắt đầu khám phá
                </a>
              </div>

              <p style="color: #777; font-size: 14px; text-align: center;">
                Cần hỗ trợ? Liên hệ với chúng tôi tại
                <a href="mailto:support@twilsta.com" style="color: #667eea;">support@twilsta.com</a>
              </p>
            </div>

            <div style="background-color: #333; padding: 20px; text-align: center;">
              <p style="color: #999; margin: 0; font-size: 12px;">
                © 2024 Twilsta. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      LoggerUtil.logAuthEvent('Welcome email sent', undefined, {
        to,
        username,
      });
      return true;
    } catch (error) {
      LoggerUtil.error('Failed to send welcome email', error);
      return false;
    }
  }
}
