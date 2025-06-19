# Twilsta Server

Express.js server với TypeScript và Prisma PostgreSQL cho ứng dụng Twilsta.

## 🚀 Tính năng

- **Express.js** với TypeScript
- **Prisma** ORM với PostgreSQL
- **CORS** enabled
- **Environment variables** management
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
```

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
