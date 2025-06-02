# Follow System Documentation

## Overview

The follow system allows users to follow each other, with support for private accounts that require follow request approval. The system handles both direct follows (for public accounts) and pending follow requests (for private accounts).

## Features Implemented

### Follow System Endpoints

| #   | Method | Endpoint                                | Description                            | Body/Query                              | Auth Required |
| --- | ------ | --------------------------------------- | -------------------------------------- | --------------------------------------- | ------------- |
| 1   | POST   | `/api/follow/:targetUserId`             | Send follow request or follow directly | —                                       | ✅            |
| 2   | DELETE | `/api/follow/:targetUserId`             | Unfollow user                          | —                                       | ✅            |
| 3   | GET    | `/api/follow/status/:userId`            | Check follow status with another user  | —                                       | ✅            |
| 4   | GET    | `/api/follow/followers/:userId`         | Get user's followers list              | `?limit=&cursor=` (optional pagination) | ✅            |
| 5   | GET    | `/api/follow/following/:userId`         | Get user's following list              | `?limit=&cursor=`                       | ✅            |
| 6   | GET    | `/api/follow/requests`                  | (Private acc) Get follow requests      | —                                       | ✅            |
| 7   | POST   | `/api/follow/requests/:followId/accept` | Accept follow request                  | —                                       | ✅            |
| 8   | POST   | `/api/follow/requests/:followId/reject` | Reject follow request                  | —                                       | ✅            |

### Database Schema Changes

The `Follow` model has been enhanced with a `status` field:

```prisma
model Follow {
  id          String      @id @default(cuid())
  followerId  String
  followingId String
  status      FollowStatus @default(ACCEPTED)
  createdAt   DateTime    @default(now())

  follower  User @relation("UserFollowing", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("UserFollowers", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followerId, status])
  @@index([followingId, status])
  @@map("follows")
}

enum FollowStatus {
  PENDING
  ACCEPTED
}
```

## Functionality Details

### 1. Follow User (POST `/api/follow/:targetUserId`)

**Behavior:**

- If target user is **public**: Creates `Follow` record with `status: ACCEPTED`
- If target user is **private**: Creates `Follow` record with `status: PENDING`
- Updates user statistics (followers/following count) only when status is `ACCEPTED`

**Response:**

```json
{
  "message": "Successfully followed user", // or "Follow request sent"
  "status": "ACCEPTED" // or "PENDING"
}
```

### 2. Unfollow User (DELETE `/api/follow/:targetUserId`)

**Behavior:**

- Deletes the `Follow` record regardless of status
- Updates user statistics if the follow was `ACCEPTED`

**Response:**

```json
{
  "message": "Successfully unfollowed user" // or "Follow request cancelled"
}
```

### 3. Get Follow Status (GET `/api/follow/status/:userId`)

**Response:**

```json
{
  "isFollowing": true, // User is following (status: ACCEPTED)
  "isPending": false, // Request is pending (status: PENDING)
  "canFollow": false // No relationship exists
}
```

### 4. Get Followers (GET `/api/follow/followers/:userId`)

**Privacy Rules:**

- **Public accounts**: Anyone can view followers
- **Private accounts**: Only followers can view the followers list
- **Own account**: Always accessible

**Response:**

```json
{
  "users": [
    {
      "id": "user123",
      "username": "johndoe",
      "fullName": "John Doe",
      "avatar": "https://...",
      "isVerified": true,
      "isPrivate": false,
      "followStatus": "ACCEPTED", // Current user's relationship with this user
      "createdAt": "2023-12-10T10:00:00.000Z"
    }
  ],
  "pagination": {
    "hasNext": true,
    "cursor": "clp123abc456"
  }
}
```

### 5. Get Following (GET `/api/follow/following/:userId`)

Same structure and privacy rules as followers list.

### 6. Get Follow Requests (GET `/api/follow/requests`)

Returns pending follow requests for the current user's private account.

**Response:**

```json
[
  {
    "id": "follow123",
    "user": {
      "id": "user456",
      "username": "janedoe",
      "email": "jane@example.com",
      "fullName": "Jane Doe",
      "avatar": "https://...",
      "isVerified": false,
      "isPrivate": true,
      "createdAt": "2023-12-10T09:00:00.000Z"
    },
    "createdAt": "2023-12-10T10:30:00.000Z"
  }
]
```

### 7. Accept Follow Request (POST `/api/follow/requests/:followId/accept`)

**Behavior:**

- Changes status from `PENDING` to `ACCEPTED`
- Updates both users' statistics (followers/following count)

### 8. Reject Follow Request (POST `/api/follow/requests/:followId/reject`)

**Behavior:**

- Deletes the follow request record completely

## Usage Examples

### 1. Follow a User

```bash
curl -X POST http://localhost:4000/api/follow/user123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Check Follow Status

```bash
curl -X GET http://localhost:4000/api/follow/status/user123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Get Followers with Pagination

```bash
curl -X GET "http://localhost:4000/api/follow/followers/user123?limit=20&cursor=clp123abc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Get Follow Requests

```bash
curl -X GET http://localhost:4000/api/follow/requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Accept Follow Request

```bash
curl -X POST http://localhost:4000/api/follow/requests/follow123/accept \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Privacy and Security Features

### Privacy Rules

- **Private accounts**: Follow requests require approval
- **Public accounts**: Immediate following without approval
- **Visibility**: Private account followers/following lists are only visible to followers

### Security Features

- **Self-follow prevention**: Users cannot follow themselves
- **Duplicate prevention**: Cannot send multiple follow requests
- **Permission checks**: Follow requests can only be managed by the target user
- **Statistics consistency**: Follower/following counts are automatically maintained

### Rate Limiting

All endpoints are protected by the global rate limiter (100 requests per 15 minutes per IP).

## Database Migration

After updating the schema, run:

```bash
npx prisma generate
npx prisma db push
```

**Note**: Existing follow records will default to `status: ACCEPTED` for backward compatibility.

## API Documentation

Visit `http://localhost:4000/docs` when the server is running to see the interactive Swagger documentation for all follow endpoints.

## Error Handling

Common error responses:

```json
// User not found
{
  "statusCode": 404,
  "message": "User not found"
}

// Cannot follow yourself
{
  "statusCode": 400,
  "message": "Cannot follow yourself"
}

// Already following
{
  "statusCode": 400,
  "message": "Already following this user"
}

// Private account access denied
{
  "statusCode": 403,
  "message": "Cannot view followers of this private account"
}
```

## Integration with Other Features

The follow system integrates with:

- **User profiles**: Public/private account settings
- **Statistics**: Automatic follower/following count updates
- **Notifications**: Can be extended to send follow notifications
- **Content visibility**: Can be used to filter content based on follow relationships
