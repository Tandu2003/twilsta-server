import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  UserProfile,
  UserWithStats,
  UserStats,
  UserSearchResponse,
  FollowListResponse,
  UpdateProfileResult,
} from './interfaces/user.interface';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UserSearchQueryDto,
  FollowListQueryDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper method to check if user can access profile
  private canAccessProfile(
    targetUser: any,
    currentUserId?: string,
    isFollowing?: boolean,
  ): boolean {
    // Public profile - always accessible
    if (!targetUser.isPrivate) return true;

    // Owner can always access their own profile
    if (currentUserId && targetUser.id === currentUserId) return true;

    // Private profile - only accessible if following
    if (targetUser.isPrivate && currentUserId && isFollowing) return true;

    return false;
  }

  // Helper method to format user profile for response
  private formatUserProfile(
    user: any,
    currentUserId?: string,
    includeEmail: boolean = false,
  ): UserProfile {
    return {
      id: user.id,
      username: user.username,
      email: includeEmail && currentUserId === user.id ? user.email : undefined,
      fullName: user.fullName || undefined,
      bio: user.bio || undefined,
      avatar: user.avatar || undefined,
      website: user.website || undefined,
      phone: currentUserId === user.id ? user.phone || undefined : undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // Helper method to check if user is following another user
  private async checkIfFollowing(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
        status: 'ACCEPTED',
      },
    });
    return !!follow;
  }

  // 1. GET /api/users/:userId - Get user by ID
  async getUserById(
    userId: string,
    currentUserId?: string,
  ): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = currentUserId
      ? await this.checkIfFollowing(currentUserId, userId)
      : false;

    if (!this.canAccessProfile(user, currentUserId, isFollowing)) {
      throw new ForbiddenException('This profile is private');
    }

    return this.formatUserProfile(user, currentUserId);
  }

  // 2. GET /api/users/username/:username - Get user by username
  async getUserByUsername(
    username: string,
    currentUserId?: string,
  ): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = currentUserId
      ? await this.checkIfFollowing(currentUserId, user.id)
      : false;

    if (!this.canAccessProfile(user, currentUserId, isFollowing)) {
      throw new ForbiddenException('This profile is private');
    }

    return this.formatUserProfile(user, currentUserId);
  }

  // 3. GET /api/users/me - Get current user profile
  async getCurrentUser(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.formatUserProfile(user, userId, true);
  }

  // 4. PUT /api/users/me - Update profile
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UpdateProfileResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateProfileDto,
        updatedAt: new Date(),
      },
    });

    return {
      user: this.formatUserProfile(updatedUser, userId, true),
      message: 'Profile updated successfully',
    };
  }

  // 5. POST /api/users/me/change-password - Change password
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    return { message: 'Password changed successfully' };
  }

  // 6. POST /api/users/me/avatar - Upload avatar (placeholder for multipart)
  async updateAvatar(
    userId: string,
    avatarUrl: string,
  ): Promise<UpdateProfileResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: avatarUrl,
        updatedAt: new Date(),
      },
    });

    return {
      user: this.formatUserProfile(updatedUser, userId, true),
      message: 'Avatar updated successfully',
    };
  }

  // 7. DELETE /api/users/me - Delete account
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user (cascade will handle related data)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account deleted successfully' };
  }

  // 8. GET /api/users - Search users
  async searchUsers(query: UserSearchQueryDto): Promise<UserSearchResponse> {
    const limit = parseInt(query.limit || '20');
    const offset = parseInt(query.offset || '0');
    const searchTerm = query.q?.trim();

    const whereClause = searchTerm
      ? {
          OR: [
            {
              username: { contains: searchTerm, mode: 'insensitive' as const },
            },
            {
              fullName: { contains: searchTerm, mode: 'insensitive' as const },
            },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          username: true,
          fullName: true,
          avatar: true,
          isVerified: true,
          isPrivate: true,
        },
        take: limit,
        skip: offset,
        orderBy: [{ isVerified: 'desc' }, { username: 'asc' }],
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    const formattedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName || undefined,
      avatar: user.avatar || undefined,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
    }));

    return {
      users: formattedUsers,
      hasMore: offset + limit < total,
      total,
    };
  }

  // 9. GET /api/users/:userId/stats - Get user stats
  async getUserStats(
    userId: string,
    currentUserId?: string,
  ): Promise<UserStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isPrivate: true,
        postsCount: true,
        followersCount: true,
        followingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = currentUserId
      ? await this.checkIfFollowing(currentUserId, userId)
      : false;

    if (!this.canAccessProfile(user, currentUserId, isFollowing)) {
      throw new ForbiddenException('This profile is private');
    }

    return {
      postsCount: user.postsCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
    };
  }

  // 10. GET /api/users/:userId/followers - Get followers list
  async getFollowers(
    userId: string,
    query: FollowListQueryDto,
    currentUserId?: string,
  ): Promise<FollowListResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPrivate: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = currentUserId
      ? await this.checkIfFollowing(currentUserId, userId)
      : false;

    if (!this.canAccessProfile(user, currentUserId, isFollowing)) {
      throw new ForbiddenException('This profile is private');
    }

    const limit = parseInt(query.limit || '20');
    const cursor = query.cursor;

    const followers = await this.prisma.follow.findMany({
      where: {
        followingId: userId,
        status: 'ACCEPTED',
        ...(cursor && { id: { lt: cursor } }),
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            isVerified: true,
            isPrivate: true,
          },
        },
      },
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = followers.length > limit;
    if (hasMore) followers.pop();

    const nextCursor = hasMore
      ? followers[followers.length - 1]?.id
      : undefined;

    const users = followers.map((follow) => ({
      id: follow.follower.id,
      username: follow.follower.username,
      fullName: follow.follower.fullName || undefined,
      avatar: follow.follower.avatar || undefined,
      isVerified: follow.follower.isVerified,
      isPrivate: follow.follower.isPrivate,
      isFollowing: undefined, // TODO: Check if current user follows these users
      isFollowedBy: true, // They follow the target user
    }));

    const total = await this.prisma.follow.count({
      where: { followingId: userId, status: 'ACCEPTED' },
    });

    return { users, hasMore, nextCursor, total };
  }

  // 11. GET /api/users/:userId/following - Get following list
  async getFollowing(
    userId: string,
    query: FollowListQueryDto,
    currentUserId?: string,
  ): Promise<FollowListResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPrivate: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = currentUserId
      ? await this.checkIfFollowing(currentUserId, userId)
      : false;

    if (!this.canAccessProfile(user, currentUserId, isFollowing)) {
      throw new ForbiddenException('This profile is private');
    }

    const limit = parseInt(query.limit || '20');
    const cursor = query.cursor;

    const following = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: 'ACCEPTED',
        ...(cursor && { id: { lt: cursor } }),
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            isVerified: true,
            isPrivate: true,
          },
        },
      },
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = following.length > limit;
    if (hasMore) following.pop();

    const nextCursor = hasMore
      ? following[following.length - 1]?.id
      : undefined;

    const users = following.map((follow) => ({
      id: follow.following.id,
      username: follow.following.username,
      fullName: follow.following.fullName || undefined,
      avatar: follow.following.avatar || undefined,
      isVerified: follow.following.isVerified,
      isPrivate: follow.following.isPrivate,
      isFollowing: true, // Current user (or target user) follows these users
      isFollowedBy: undefined, // TODO: Check if these users follow back
    }));

    const total = await this.prisma.follow.count({
      where: { followerId: userId, status: 'ACCEPTED' },
    });

    return { users, hasMore, nextCursor, total };
  }
}
