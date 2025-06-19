import nodemailer from 'nodemailer';
import logger from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(
        `📧 Email sent successfully to ${options.to}:`,
        info.messageId,
      );
      return true;
    } catch (error) {
      logger.error(`❌ Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    username: string,
  ): Promise<boolean> {
    const verificationUrl = `${process.env.VERIFY_EMAIL_URL}?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Twilsta!</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p>Thank you for signing up for Twilsta. To complete your registration, please verify your email address by clicking the button below:</p>

            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${verificationUrl}</p>

            <p><strong>This verification link will expire in 24 hours.</strong></p>

            <p>If you didn't create an account with Twilsta, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Twilsta!

      Hi ${username}!

      Thank you for signing up for Twilsta. To complete your registration, please verify your email address by visiting:

      ${verificationUrl}

      This verification link will expire in 24 hours.

      If you didn't create an account with Twilsta, please ignore this email.

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address - Twilsta',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    username: string,
  ): Promise<boolean> {
    const resetUrl = `${process.env.RESET_PASSWORD_URL}?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p>We received a request to reset your password for your Twilsta account.</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account is still secure.
            </div>

            <p>To reset your password, click the button below:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${resetUrl}</p>

            <p><strong>This reset link will expire in 1 hour for security reasons.</strong></p>

            <p>If you're having trouble, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request - Twilsta

      Hi ${username}!

      We received a request to reset your password for your Twilsta account.

      To reset your password, visit:
      ${resetUrl}

      This reset link will expire in 1 hour for security reasons.

      If you didn't request this password reset, please ignore this email. Your account is still secure.

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Twilsta',
      html,
      text,
    });
  }

  async sendPasswordChangedNotification(
    email: string,
    username: string,
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Changed - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .alert { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p>Your password has been successfully changed for your Twilsta account.</p>

            <div class="alert">
              <strong>🔒 Security Info:</strong> This change was made on ${new Date().toLocaleString()}.
            </div>

            <p>If you did not make this change, please contact our support team immediately.</p>

            <p>For your security, you have been logged out of all devices and will need to log in again with your new password.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Changed Successfully - Twilsta

      Hi ${username}!

      Your password has been successfully changed for your Twilsta account.

      This change was made on ${new Date().toLocaleString()}.

      If you did not make this change, please contact our support team immediately.

      For your security, you have been logged out of all devices and will need to log in again with your new password.

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully - Twilsta',
      html,
      text,
    });
  }
}

export default new EmailService();
