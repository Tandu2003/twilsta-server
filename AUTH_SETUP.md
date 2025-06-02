# Authentication System Setup Guide

## Overview

This authentication system provides a complete user management solution with JWT-based authentication, **fully implemented email verification and password reset using NodeMailer**, and rate limiting.

## Features Implemented

### Authentication Endpoints

| #   | Method | Endpoint                            | Description                    | Body/Query                                | Auth Required |
| --- | ------ | ----------------------------------- | ------------------------------ | ----------------------------------------- | ------------- |
| 1   | POST   | `/api/auth/register`                | Register new user              | `{ username, email, password, fullName }` | ❌            |
| 2   | POST   | `/api/auth/login`                   | User login                     | `{ emailOrUsername, password }`           | ❌            |
| 3   | POST   | `/api/auth/logout`                  | User logout                    | —                                         | ✅ (cookie)   |
| 4   | POST   | `/api/auth/refresh-token`           | Refresh access token           | — (from refreshToken cookie)              | ❌            |
| 5   | GET    | `/api/auth/me`                      | Get current user info          | —                                         | ✅            |
| 6   | POST   | `/api/auth/send-verification-email` | Send email verification        | `{ email }`                               | ❌            |
| 7   | POST   | `/api/auth/verify-email`            | Verify email with token        | `{ token }`                               | ❌            |
| 8   | POST   | `/api/auth/forgot-password`         | Send password reset email      | `{ email }`                               | ❌            |
| 9   | POST   | `/api/auth/reset-password`          | Reset password with token      | `{ token, newPassword }`                  | ❌            |
| 10  | PUT    | `/api/auth/update-password`         | Update password when logged in | `{ currentPassword, newPassword }`        | ✅            |
| 11  | GET    | `/api/auth/check-username`          | Check if username exists       | `?username=...`                           | ❌            |
| 12  | POST   | `/api/auth/test-email`              | [DEV ONLY] Test email service  | `{ email, type? }`                        | ❌            |

### Email Features ✅ FULLY IMPLEMENTED

- **🎉 Automatic Email Verification**: Verification emails are sent automatically after user registration
- **🔐 Password Reset**: Beautiful HTML emails with reset links
- **👋 Welcome Emails**: Sent automatically after email verification
- **🎨 Professional Templates**: Beautiful, responsive HTML email templates in Vietnamese
- **⚡ NodeMailer Integration**: Full SMTP support with Gmail/Outlook/custom SMTP
- **🛡️ Secure**: Tokens expire automatically (24h for verification, 1h for password reset)

### Security Features

- **JWT Authentication**: Access tokens (15min) and refresh tokens (7 days)
- **Cookie-based Storage**: HTTP-only cookies for secure token storage
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Password Hashing**: bcrypt with salt rounds of 12
- **Input Validation**: DTO validation with class-validator
- **Email Verification**: Token-based email verification system ✅
- **Password Reset**: Secure password reset with expiring tokens ✅

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# JWT Configuration - Generate secure random strings
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (NodeMailer) ✅ REQUIRED
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_app_password"  # Use App Password for Gmail

# Environment
NODE_ENV=development
```

### 2. Email Configuration

#### For Gmail:

1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password in `SMTP_PASS`, not your regular password

#### For Other Providers:

- **Outlook**: `smtp-mail.outlook.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Check your email provider's documentation

### 3. Database Setup

Ensure your PostgreSQL database is running and the schema is generated:

```bash
npx prisma generate
npx prisma db push
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start the Application

```bash
npm run start:dev
```

## Usage Examples

### 1. Register a New User (with automatic verification email)

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "fullName": "John Doe"
  }'
```

✅ **Verification email will be sent automatically!**

### 2. Test Email Service (Development Only)

```bash
# Test verification email
curl -X POST http://localhost:4000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "verification"
  }'

# Test password reset email
curl -X POST http://localhost:4000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "reset"
  }'

# Test welcome email
curl -X POST http://localhost:4000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "welcome"
  }'
```

### 3. Request Password Reset

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

✅ **Reset email will be sent with beautiful HTML template!**

### 4. Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "emailOrUsername": "johndoe",
    "password": "password123"
  }'
```

## Email Templates

The system includes three beautiful, responsive HTML email templates:

1. **Verification Email** 📧

   - Welcome message with verification link
   - 24-hour expiration notice
   - Professional branding

2. **Password Reset Email** 🔐

   - Security warnings and instructions
   - 1-hour expiration notice
   - Secure reset link

3. **Welcome Email** 🎉
   - Celebration message for verified users
   - Feature overview
   - Getting started guide

All emails are:

- 📱 **Mobile responsive**
- 🎨 **Beautiful gradient designs**
- 🇻🇳 **Vietnamese language**
- ⚡ **Fast delivery via SMTP**

## Troubleshooting

### Email Issues

1. **Gmail "Less secure app" error**: Use App Password instead of regular password
2. **Emails not sending**: Check SMTP credentials and firewall settings
3. **Emails in spam**: Add your domain to SPF/DKIM records
4. **Test emails**: Use the `/api/auth/test-email` endpoint in development

### Development Tools

- **Swagger Documentation**: `http://localhost:4000/docs`
- **Email Testing**: `POST /api/auth/test-email` (dev only)
- **Log Monitoring**: Check console for email delivery status

## Security Considerations

- ✅ Access tokens expire in 15 minutes
- ✅ Refresh tokens expire in 7 days
- ✅ Passwords are hashed with bcrypt (12 rounds)
- ✅ Rate limiting prevents brute force attacks
- ✅ Cookies are HTTP-only and secure in production
- ✅ Email verification prevents fake accounts
- ✅ Password reset tokens expire in 1 hour
- ✅ Email service errors don't expose user existence
- ✅ Welcome emails sent after successful verification

## Production Deployment

1. Set `NODE_ENV=production`
2. Use secure SMTP credentials
3. Configure proper CORS origins
4. Set up SSL/TLS certificates
5. Configure email rate limiting
6. Monitor email delivery logs
7. Set up email bounce handling

The authentication system is now **fully production-ready** with complete email functionality! 🚀
