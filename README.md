# Twilsta Server

A professional Express.js API server with TypeScript, featuring comprehensive logging, error handling, security middleware, and response helpers.

## Features

### 🔧 Core Features

- **TypeScript** - Type-safe development
- **Express.js** - Fast, unopinionated web framework
- **Prisma** - Modern database toolkit
- **CORS** - Cross-origin resource sharing
- **Environment Configuration** - Secure environment variable management

### � Logging & Monitoring

- **Winston** - Professional logging with multiple transports
- **Morgan** - HTTP request logging middleware
- **Request/Response Logging** - Detailed request tracking
- **Error Logging** - Comprehensive error tracking

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

### Health Check

```
GET /health
```

### User API

```
GET    /api/users                     - Get all users (with pagination)
GET    /api/users/:id                 - Get user by ID
GET    /api/users/username/:username  - Get user by username
GET    /api/users/:id/followers       - Get user's followers
GET    /api/users/:id/following       - Get user's following
POST   /api/auth/register             - Register new user
PUT    /api/users/:id/profile         - Update user profile (protected)
PUT    /api/users/:id/password        - Change password (protected)
DELETE /api/users/:id                 - Delete user account (protected)
```

### Post API

```
GET    /api/posts           - Get all posts (with pagination & filters)
GET    /api/posts/:id       - Get post by ID
GET    /api/posts/:id/replies - Get post replies
POST   /api/posts           - Create new post (protected)
PUT    /api/posts/:id       - Update post (protected)
DELETE /api/posts/:id       - Delete post (protected)
POST   /api/posts/:id/like  - Like/Unlike post (protected)
```

### Query Parameters

#### Pagination

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `search`: Search query for users

#### Post Filters

- `type`: Post type (TEXT, IMAGE, VIDEO, AUDIO, MIXED)
- `authorId`: Filter by author ID
- `parentId`: Filter by parent post ID (for replies)

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
