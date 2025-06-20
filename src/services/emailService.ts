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
      logger.info(`📧 Email sent successfully to ${options.to}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Twilsta!</h1>
            <p>Your social media journey starts here</p>
          </div>
          <div class="content">
            <h2>Hello ${username}! 👋</h2>
            <p>We're thrilled to have you join the Twilsta community! Your account has been successfully created and you're ready to start connecting with friends and sharing your thoughts.</p>

            <h3>What you can do now:</h3>
            <ul>
              <li>✨ Complete your profile with a bio and profile picture</li>
              <li>🔍 Discover and follow interesting people</li>
              <li>📝 Share your first post with the community</li>
              <li>💬 Engage with posts through likes and comments</li>
            </ul>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}" class="btn">Start Exploring</a>
            </div>

            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>

            <p>Happy posting! 🚀</p>
            <p><strong>The Twilsta Team</strong></p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}. If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const options: EmailOptions = {
      to: email,
      subject: '🎉 Welcome to Twilsta - Your account is ready!',
      html,
    };

    return this.sendEmail(options);
  }

  async sendVerificationEmail(email: string, token: string, username: string): Promise<boolean> {
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

  async sendPasswordResetEmail(email: string, token: string, username: string): Promise<boolean> {
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

  async sendPasswordChangedNotification(email: string, username: string): Promise<boolean> {
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

  /**
   * Send follow notification email
   */
  async sendFollowNotification(
    email: string,
    username: string,
    followerUsername: string,
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Follower - Twilsta</title>
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
            <h1>👥 New Follower!</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p><strong>@${followerUsername}</strong> started following you on Twilsta!</p>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/profile/${followerUsername}" class="button">View Profile</a>
            </div>

            <p>Connect with your new follower and grow your community!</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Follower - Twilsta

      Hi ${username}!

      @${followerUsername} started following you on Twilsta!

      Visit their profile: ${process.env.FRONTEND_URL}/profile/${followerUsername}

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: `${followerUsername} started following you on Twilsta`,
      html,
      text,
    });
  }

  /**
   * Send password change notification email
   */
  async sendPasswordChangeNotification(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Changed - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Changed</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p>Your password has been successfully changed for your Twilsta account.</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't make this change, please contact our support team immediately.
            </div>

            <p><strong>Change Details:</strong></p>
            <ul>
              <li>Date: ${new Date().toLocaleString()}</li>
              <li>Account: ${email}</li>
            </ul>

            <p>For your security, you may be logged out of all devices and will need to log in again.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Changed - Twilsta

      Hi ${username}!

      Your password has been successfully changed for your Twilsta account.

      Change Details:
      - Date: ${new Date().toLocaleString()}
      - Account: ${email}

      If you didn't make this change, please contact our support team immediately.

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully - Twilsta',
      html,
      text,
    });
  }

  /**
   * Send account deactivation notification email
   */
  async sendAccountDeactivationNotification(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Deactivated - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Account Deactivated</h1>
          </div>
          <div class="content">
            <h2>Hi ${username}!</h2>
            <p>Your Twilsta account has been successfully deactivated as requested.</p>

            <p><strong>What happens now?</strong></p>
            <ul>
              <li>Your profile is no longer visible to other users</li>
              <li>Your posts and content remain but are private</li>
              <li>You can reactivate your account anytime by logging in</li>
            </ul>

            <p>We're sad to see you go! If you change your mind, you can always come back.</p>

            <p><strong>Deactivation Details:</strong></p>
            <ul>
              <li>Date: ${new Date().toLocaleString()}</li>
              <li>Account: ${email}</li>
            </ul>
          </div>
          <div class="footer">
            <p>&copy; 2025 Twilsta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Account Deactivated - Twilsta

      Hi ${username}!

      Your Twilsta account has been successfully deactivated as requested.

      What happens now?
      - Your profile is no longer visible to other users
      - Your posts and content remain but are private
      - You can reactivate your account anytime by logging in

      Deactivation Details:
      - Date: ${new Date().toLocaleString()}
      - Account: ${email}

      We're sad to see you go! If you change your mind, you can always come back.

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Account Deactivated - Twilsta',
      html,
      text,
    });
  }

  /**
   * Send comment notification to post author
   */
  async sendCommentNotification(
    email: string,
    data: {
      postAuthor: string;
      commenter: string;
      commentContent: string;
      postContent: string;
    },
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Comment on Your Post - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .comment-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px; }
          .post-box { background: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .username { font-weight: bold; color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Comment!</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.postAuthor}!</h2>
            <p><span class="username">${data.commenter}</span> commented on your post:</p>

            <div class="post-box">
              <strong>Your Post:</strong><br>
              "${
                data.postContent.length > 100
                  ? data.postContent.substring(0, 100) + '...'
                  : data.postContent
              }"
            </div>

            <div class="comment-box">
              <strong>Comment from ${data.commenter}:</strong><br>
              "${data.commentContent}"
            </div>

            <p>Check it out on Twilsta to reply and engage with your community!</p>
          </div>
          <div class="footer">
            <p>© 2025 Twilsta. All rights reserved.</p>
            <p>You received this email because someone commented on your post.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Comment on Your Post - Twilsta

      Hi ${data.postAuthor}!

      ${data.commenter} commented on your post:

      Your Post: "${
        data.postContent.length > 100
          ? data.postContent.substring(0, 100) + '...'
          : data.postContent
      }"

      Comment: "${data.commentContent}"

      Check it out on Twilsta to reply and engage with your community!

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: `New comment from ${data.commenter} - Twilsta`,
      html,
      text,
    });
  }

  /**
   * Send reply notification to comment author
   */
  async sendReplyNotification(
    email: string,
    data: {
      originalCommenter: string;
      replier: string;
      replyContent: string;
      originalComment: string;
    },
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Reply to Your Comment - Twilsta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .reply-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4facfe; border-radius: 5px; }
          .comment-box { background: #e9ecef; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .username { font-weight: bold; color: #4facfe; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>↩️ New Reply!</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.originalCommenter}!</h2>
            <p><span class="username">${data.replier}</span> replied to your comment:</p>

            <div class="comment-box">
              <strong>Your Comment:</strong><br>
              "${
                data.originalComment.length > 100
                  ? data.originalComment.substring(0, 100) + '...'
                  : data.originalComment
              }"
            </div>

            <div class="reply-box">
              <strong>Reply from ${data.replier}:</strong><br>
              "${data.replyContent}"
            </div>

            <p>Join the conversation on Twilsta and continue the discussion!</p>
          </div>
          <div class="footer">
            <p>© 2025 Twilsta. All rights reserved.</p>
            <p>You received this email because someone replied to your comment.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Reply to Your Comment - Twilsta

      Hi ${data.originalCommenter}!

      ${data.replier} replied to your comment:

      Your Comment: "${
        data.originalComment.length > 100
          ? data.originalComment.substring(0, 100) + '...'
          : data.originalComment
      }"

      Reply: "${data.replyContent}"

      Join the conversation on Twilsta and continue the discussion!

      © 2025 Twilsta. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: `${data.replier} replied to your comment - Twilsta`,
      html,
      text,
    });
  }
}

export default new EmailService();
