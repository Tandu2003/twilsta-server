# Twilsta Server

A modern social media backend with complete user management, file storage, and email notifications.

## 🚀 Features

### Core Features

- **User Management**: Complete CRUD operations with authentication
- **File Storage**: Avatar & cover image upload via Cloudinary
- **Email System**: Welcome emails, notifications, password reset
- **Follow System**: Follow/unfollow with email notifications
- **Security**: JWT authentication, rate limiting, input validation

### Recent Enhancements

- ✅ **User Controller** with Cloudinary integration
- ✅ **File Upload Middleware** with validation and error handling
- ✅ **Email Service** with HTML templates and notifications
- ✅ **Folder Structure** organized for Cloudinary assets
- ✅ **Complete API functionality** with examples

### 🛡️ Security

- **Helmet** - Security headers middleware
- **Rate Limiting** - Configurable rate limiting
- **Request Size Limiting** - Prevent large payload attacks
- **Input Validation** - Express-validator integration
- **CORS Protection** - Configurable cross-origin policies

### 🚨 Error Handling

- **Custom Error Classes** - Structured error hierarchy
- **Global Error Handler** - Centralized error processing
- **Async Error Catching** - Automatic async error handling
- **Validation Error Handling** - User-friendly validation responses

### 📊 Response Management

- **Standardized Responses** - Consistent API response format
- **Response Helpers** - Convenient response methods
- **Pagination Support** - Built-in pagination helpers
- **Status Code Management** - Proper HTTP status codes
- **Error handling** middleware
- **Health check** endpoint
- **Database seeding**
- **Hot reload** với nodemon

## 📋 Yêu cầu

- Node.js >= 16
- PostgreSQL database
- npm hoặc yarn

## 🛠️ Cài đặt

1. **Clone và cài đặt dependencies:**

```bash
cd twilsta-server
npm install
```

2. **Cấu hình database:**

```bash
# Cập nhật DATABASE_URL trong file .env
DATABASE_URL="postgresql://username:password@localhost:5432/twilsta_db?schema=public"
```

3. **Generate Prisma Client:**

```bash
npm run prisma:generate
```

4. **Chạy migration:**

```bash
npm run prisma:migrate
```

5. **Seed database (optional):**

```bash
npm run db:seed
```

## 🏃‍♂️ Chạy ứng dụng

### Development mode:

```bash
npm run dev
```

### Production mode:

```bash
npm run build
npm start
```

## 📚 API Endpoints

### Base URL: `http://localhost:5000`

- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /api` - API information

### Users:

- `GET /api/users` - Lấy tất cả users
- `GET /api/users/:id` - Lấy user theo ID
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user

## API Documentation

### Base URL: `http://localhost:8081/api`

### Health Check

```
GET /health
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "2025-06-20T02:35:34.123Z",
    "uptime": 123.45,
    "environment": "development",
    "version": "1.0.0"
  },
  "message": "Server is healthy"
}
```

### Authentication

#### Register User

```
POST /api/auth/register
```

Request Body:

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "user_id_here",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "verified": false,
    "createdAt": "2025-06-20T02:35:34.123Z"
  }
}
```

Note: Sends welcome email automatically.

### User Management

#### Get All Users

```
GET /api/users?page=1&limit=10&search=john
```

Response:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "user_id",
      "username": "johndoe",
      "displayName": "John Doe",
      "bio": "Software Developer",
      "avatar": "https://res.cloudinary.com/...",
      "verified": true,
      "followersCount": 150,
      "followingCount": 89,
      "postsCount": 42,
      "createdAt": "2025-06-20T02:35:34.123Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Get User by ID

```
GET /api/users/:id
```

#### Get User by Username

```
GET /api/users/username/:username
```

#### Update User Profile

```
PUT /api/users/:id/profile
```

Request Body:

```json
{
  "displayName": "John Doe Updated",
  "bio": "Senior Software Developer at ABC Company",
  "website": "https://johndoe.dev",
  "location": "San Francisco, CA"
}
```

Note: Requires authentication.

### File Upload (Cloudinary Integration)

#### Upload Avatar

```
POST /api/users/:id/avatar
Content-Type: multipart/form-data
```

Form Data:

- `avatar`: Image file (JPG, PNG, GIF, WebP, max 5MB)

Response:

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatar": "https://res.cloudinary.com/twilsta/user/avatar/user_id_timestamp.jpg"
  }
}
```

#### Remove Avatar

```
DELETE /api/users/:id/avatar
```

#### Upload Cover Image

```
POST /api/users/:id/cover
Content-Type: multipart/form-data
```

Form Data:

- `coverImage`: Image file (JPG, PNG, GIF, WebP, max 10MB)

#### Remove Cover Image

```
DELETE /api/users/:id/cover
```

### Follow System

#### Follow User

```
POST /api/users/:id/follow
```

Note: Sends email notification to followed user.

#### Unfollow User

```
DELETE /api/users/:id/follow
```

#### Get User Followers

```
GET /api/users/:id/followers?page=1&limit=10
```

#### Get User Following

```
GET /api/users/:id/following?page=1&limit=10
```

### Account Management

#### Change Password

```
PUT /api/users/:id/password
```

Request Body:

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

Note: Sends confirmation email.

#### Deactivate Account

```
POST /api/users/:id/deactivate
```

Request Body:

```json
{
  "password": "UserPassword123!"
}
```

Note: Sends deactivation notification email.

#### Delete Account

```
DELETE /api/users/:id
```

Note: Soft delete with Cloudinary asset cleanup.

### Post Management

#### Get All Posts

```
GET /api/posts?page=1&limit=10&type=TEXT&authorId=user_id
```

#### Get Post by ID

```
GET /api/posts/:id
```

#### Get Post Replies

```
GET /api/posts/:id/replies?page=1&limit=10
```

#### Create Post

```
POST /api/posts
```

Request Body:

```json
{
  "content": "This is my new post!",
  "type": "TEXT"
}
```

Note: Requires authentication.

#### Update Post

```
PUT /api/posts/:id
```

#### Delete Post

```
DELETE /api/posts/:id
```

#### Like/Unlike Post

```
POST /api/posts/:id/like
```

### Query Parameters

#### Pagination

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

#### User Search

- `search`: Search in username, displayName (case-insensitive)
- `verified`: Filter by verification status (true/false)

#### Post Filters

- `type`: Post type (TEXT, IMAGE, VIDEO, AUDIO, MIXED)
- `authorId`: Filter by author ID
- `parentId`: Filter by parent post ID (for replies)

### Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "meta": {
    "timestamp": "2025-06-20T02:35:34.123Z"
  }
}
```

Common HTTP Status Codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `422`: Validation Error
- `429`: Too Many Requests
- `500`: Internal Server Error

### File Upload Specifications

#### Supported File Types

- Images: JPG, JPEG, PNG, GIF, WebP

#### Size Limits

- Avatar: Maximum 5MB
- Cover Image: Maximum 10MB

#### Cloudinary Folder Structure

```
/twilsta/
├── user/avatar/{userId}_{timestamp}
├── user/cover/{userId}_{timestamp}
├── post/media/{postId}_{timestamp}
└── message/attachments/{messageId}_{timestamp}
```

### Email Notifications

Automatic email notifications are sent for:

- ✅ **Welcome Email**: User registration
- ✅ **Follow Notification**: When someone follows you
- ✅ **Password Change**: Password update confirmation
- ✅ **Account Deactivation**: Account deactivation notice

### Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **File Upload**: Special handling with size validation

````

## 🗄️ Database Models

### User

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  name      String?
  avatar    String?
  bio       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
````

### Post

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🔧 Scripts

- `npm run dev` - Chạy development server với hot reload
- `npm run build` - Build TypeScript sang JavaScript
- `npm start` - Chạy production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Chạy database migrations
- `npm run prisma:studio` - Mở Prisma Studio
- `npm run prisma:reset` - Reset database
- `npm run db:seed` - Seed database với dữ liệu mẫu

## 📁 Cấu trúc thư mục

```
src/
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic services
├── app.ts          # Express app setup
└── server.ts       # Server entry point

prisma/
├── schema.prisma   # Database schema
└── seed.ts         # Database seeding
```

## 🌍 Environment Variables

```env
DATABASE_URL="postgresql://username:password@localhost:5432/twilsta_db?schema=public"
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
```

## 📝 Development Notes

- Server chạy trên port 5000 (có thể thay đổi qua PORT env)
- Database connection được test khi server khởi động
- Graceful shutdown được handle cho SIGINT và SIGTERM
- Error logging và handling được implement
- CORS enabled cho tất cả origins (development)

## 🔮 Kế hoạch tương lai

- [ ] Authentication & Authorization (JWT)
- [ ] Input validation middleware
- [ ] Rate limiting
- [ ] API documentation (Swagger)
- [ ] Unit & Integration tests
- [ ] Docker containerization
- [ ] CI/CD pipeline
