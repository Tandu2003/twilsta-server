# Authentication System Setup Guide

## Overview

This authentication system provides a complete user management solution with JWT-based authentication, email verification, password reset, and rate limiting.

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

### Security Features

- **JWT Authentication**: Access tokens (15min) and refresh tokens (7 days)
- **Cookie-based Storage**: HTTP-only cookies for secure token storage
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Password Hashing**: bcrypt with salt rounds of 12
- **Input Validation**: DTO validation with class-validator
- **Email Verification**: Token-based email verification system
- **Password Reset**: Secure password reset with expiring tokens

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required environment variables:

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# Generate secure random strings for these
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

NODE_ENV=development
```

### 2. Database Setup

Ensure your PostgreSQL database is running and the schema is generated:

```bash
npx prisma generate
npx prisma db push
```

### 3. Start the Application

```bash
npm run start:dev
```

## Usage Examples

### 1. Register a New User

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

### 2. Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "emailOrUsername": "johndoe",
    "password": "password123"
  }'
```

### 3. Get Current User (with cookies)

```bash
curl -X GET http://localhost:4000/api/auth/me \
  -b cookies.txt
```

### 4. Logout

```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -b cookies.txt
```

### 5. Check Username Availability

```bash
curl -X GET "http://localhost:4000/api/auth/check-username?username=johndoe"
```

## Authentication Flow

1. **Registration/Login**: User provides credentials
2. **Token Generation**: Server generates access + refresh tokens
3. **Cookie Storage**: Tokens stored in HTTP-only cookies
4. **Request Authentication**: Access token validated on protected routes
5. **Token Refresh**: Refresh token used to get new access token
6. **Logout**: Cookies cleared on client and server

## Security Considerations

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Passwords are hashed with bcrypt (12 rounds)
- Rate limiting prevents brute force attacks
- Cookies are HTTP-only and secure in production
- Email verification prevents fake accounts
- Password reset tokens expire in 1 hour

## API Documentation

Visit `http://localhost:4000/docs` when the server is running to see the interactive Swagger documentation.

## Error Handling

The API returns structured error responses:

```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials",
  "timestamp": "2023-12-10T10:00:00.000Z",
  "path": "/api/auth/login"
}
```

## Middleware

### Rate Limiter

- **Purpose**: Prevent spam and brute force attacks
- **Limit**: 100 requests per 15 minutes per IP
- **Storage**: Database-based rate limiting

### JWT Auth Guard

- **Purpose**: Protect routes requiring authentication
- **Bypass**: Use `@Public()` decorator for public routes
- **Token Source**: Cookies or Authorization header

## Development Notes

- Email verification and password reset currently log tokens to console
- Implement a proper email service for production
- Consider using Redis for rate limiting in production
- Add refresh token rotation for enhanced security
- Implement blacklist for revoked tokens if needed
