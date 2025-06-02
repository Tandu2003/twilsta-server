import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FollowResponse,
  FollowStatusResponse,
  FollowListResponse,
  UserWithFollowInfo,
  FollowRequestResponse,
  FollowStatus,
  PaginationQuery,
} from './interfaces/follow.interface';

@Injectable()
export class FollowService {
  constructor(private prisma: PrismaService) {}

  async followUser(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ message: string; status: FollowStatus }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Check if target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isPrivate: true, username: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already following or has pending request
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      if (existingFollow.status === 'ACCEPTED') {
        throw new BadRequestException('Already following this user');
      } else {
        throw new BadRequestException('Follow request already sent');
      }
    }

    // Determine the status based on target user's privacy
    const status = targetUser.isPrivate
      ? FollowStatus.PENDING
      : FollowStatus.ACCEPTED;

    // Create follow record
    await this.prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: targetUserId,
        status,
      },
    });

    // Update user stats if accepted
    if (status === FollowStatus.ACCEPTED) {
      await this.updateUserStats(currentUserId, targetUserId, 'increment');
    }

    return {
      message: targetUser.isPrivate
        ? 'Follow request sent'
        : 'Successfully followed user',
      status,
    };
  }

  async unfollowUser(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot unfollow yourself');
    }

    const followRecord = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (!followRecord) {
      throw new NotFoundException('Not following this user');
    }

    // Delete follow record
    await this.prisma.follow.delete({
      where: { id: followRecord.id },
    });

    // Update user stats if was accepted
    if (followRecord.status === 'ACCEPTED') {
      await this.updateUserStats(currentUserId, targetUserId, 'decrement');
    }

    return {
      message:
        followRecord.status === 'PENDING'
          ? 'Follow request cancelled'
          : 'Successfully unfollowed user',
    };
  }

  async getFollowStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<FollowStatusResponse> {
    if (currentUserId === targetUserId) {
      return {
        isFollowing: false,
        isPending: false,
        canFollow: false,
      };
    }

    const followRecord = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    const isFollowing = followRecord?.status === 'ACCEPTED';
    const isPending = followRecord?.status === 'PENDING';

    return {
      isFollowing,
      isPending,
      canFollow: !followRecord,
    };
  }

  async getFollowers(
    userId: string,
    currentUserId: string,
    pagination: PaginationQuery,
  ): Promise<FollowListResponse> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if current user can view followers
    const canView = await this.canViewUserContent(
      currentUserId,
      userId,
      user.isPrivate,
    );
    if (!canView) {
      throw new ForbiddenException(
        'Cannot view followers of this private account',
      );
    }

    const limit = Math.min(pagination.limit || 20, 50);
    const whereClause: any = {
      followingId: userId,
      status: 'ACCEPTED',
    };

    if (pagination.cursor) {
      whereClause.id = { lt: pagination.cursor };
    }

    const followers = await this.prisma.follow.findMany({
      where: whereClause,
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            isVerified: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    const hasNext = followers.length > limit;
    const items = hasNext ? followers.slice(0, limit) : followers;

    const users: UserWithFollowInfo[] = await Promise.all(
      items.map(async (follow) => {
        const followStatus = await this.getFollowStatus(
          currentUserId,
          follow.follower.id,
        );
        return {
          id: follow.follower.id,
          username: follow.follower.username,
          fullName: follow.follower.fullName || undefined,
          avatar: follow.follower.avatar || undefined,
          isVerified: follow.follower.isVerified,
          isPrivate: follow.follower.isPrivate,
          followStatus: followStatus.isFollowing
            ? FollowStatus.ACCEPTED
            : followStatus.isPending
              ? FollowStatus.PENDING
              : undefined,
          createdAt: follow.follower.createdAt,
        };
      }),
    );

    return {
      users,
      pagination: {
        hasNext,
        cursor: hasNext ? items[items.length - 1].id : undefined,
      },
    };
  }

  async getFollowing(
    userId: string,
    currentUserId: string,
    pagination: PaginationQuery,
  ): Promise<FollowListResponse> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if current user can view following
    const canView = await this.canViewUserContent(
      currentUserId,
      userId,
      user.isPrivate,
    );
    if (!canView) {
      throw new ForbiddenException(
        'Cannot view following of this private account',
      );
    }

    const limit = Math.min(pagination.limit || 20, 50);
    const whereClause: any = {
      followerId: userId,
      status: 'ACCEPTED',
    };

    if (pagination.cursor) {
      whereClause.id = { lt: pagination.cursor };
    }

    const following = await this.prisma.follow.findMany({
      where: whereClause,
      include: {
        following: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            isVerified: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    const hasNext = following.length > limit;
    const items = hasNext ? following.slice(0, limit) : following;

    const users: UserWithFollowInfo[] = await Promise.all(
      items.map(async (follow) => {
        const followStatus = await this.getFollowStatus(
          currentUserId,
          follow.following.id,
        );
        return {
          id: follow.following.id,
          username: follow.following.username,
          fullName: follow.following.fullName || undefined,
          avatar: follow.following.avatar || undefined,
          isVerified: follow.following.isVerified,
          isPrivate: follow.following.isPrivate,
          followStatus: followStatus.isFollowing
            ? FollowStatus.ACCEPTED
            : followStatus.isPending
              ? FollowStatus.PENDING
              : undefined,
          createdAt: follow.following.createdAt,
        };
      }),
    );

    return {
      users,
      pagination: {
        hasNext,
        cursor: hasNext ? items[items.length - 1].id : undefined,
      },
    };
  }

  async getFollowRequests(
    currentUserId: string,
  ): Promise<FollowRequestResponse[]> {
    const requests = await this.prisma.follow.findMany({
      where: {
        followingId: currentUserId,
        status: 'PENDING',
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            avatar: true,
            isVerified: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      id: request.id,
      user: {
        id: request.follower.id,
        username: request.follower.username,
        email: request.follower.email,
        fullName: request.follower.fullName || undefined,
        avatar: request.follower.avatar || undefined,
        isVerified: request.follower.isVerified,
        isPrivate: request.follower.isPrivate,
        createdAt: request.follower.createdAt,
      },
      createdAt: request.createdAt,
    }));
  }

  async acceptFollowRequest(
    currentUserId: string,
    followId: string,
  ): Promise<{ message: string }> {
    const followRequest = await this.prisma.follow.findFirst({
      where: {
        id: followId,
        followingId: currentUserId,
        status: 'PENDING',
      },
    });

    if (!followRequest) {
      throw new NotFoundException('Follow request not found');
    }

    // Update status to accepted
    await this.prisma.follow.update({
      where: { id: followId },
      data: { status: 'ACCEPTED' },
    });

    // Update user stats
    await this.updateUserStats(
      followRequest.followerId,
      currentUserId,
      'increment',
    );

    return { message: 'Follow request accepted' };
  }

  async rejectFollowRequest(
    currentUserId: string,
    followId: string,
  ): Promise<{ message: string }> {
    const followRequest = await this.prisma.follow.findFirst({
      where: {
        id: followId,
        followingId: currentUserId,
        status: 'PENDING',
      },
    });

    if (!followRequest) {
      throw new NotFoundException('Follow request not found');
    }

    // Delete the follow request
    await this.prisma.follow.delete({
      where: { id: followId },
    });

    return { message: 'Follow request rejected' };
  }

  private async canViewUserContent(
    currentUserId: string,
    targetUserId: string,
    isTargetPrivate: boolean,
  ): Promise<boolean> {
    // Own profile
    if (currentUserId === targetUserId) {
      return true;
    }

    // Public profile
    if (!isTargetPrivate) {
      return true;
    }

    // Private profile - check if following
    const followRecord = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    return followRecord?.status === 'ACCEPTED';
  }

  private async updateUserStats(
    followerId: string,
    followingId: string,
    operation: 'increment' | 'decrement',
  ): Promise<void> {
    const increment = operation === 'increment' ? 1 : -1;

    await this.prisma.$transaction([
      // Update follower's following count
      this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment } },
      }),
      // Update following's followers count
      this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { increment } },
      }),
    ]);
  }
}
