import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ResponseHelper } from '../utils/responseHelper';
import logger from '../utils/logger';
import cloudinaryService from '../services/cloudinaryService';
import emailService from '../services/emailService';

const prisma = new PrismaClient();

/**
 * User Controller with Cloudinary integration
 */
export class UserController {
  /**
   * Get all users with pagination and filters
   */
  static getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const verified = req.query.verified === 'true';
      const offset = (page - 1) * limit;

      logger.info(`Getting users - Page: ${page}, Limit: ${limit}, Search: ${search}`);

      const where: any = {};

      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (verified !== undefined) {
        where.verified = verified;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatar: true,
            verified: true,
            followersCount: true,
            followingCount: true,
            postsCount: true,
            createdAt: true,
            lastActiveAt: true,
          },
          orderBy: { lastActiveAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.user.count({ where }),
      ]);
      ResponseHelper.paginated(res, users, page, limit, total, 'Users retrieved successfully');
    } catch (error) {
      logger.error('Error getting users:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve users');
    }
  };

  /**
   * Get user by ID
   */
  static getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.userId;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatar: true,
          coverImage: true,
          website: true,
          location: true,
          verified: true,
          isPrivate: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          lastActiveAt: true,
        },
      });

      if (!user) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Check if current user follows this user
      let isFollowing = false;
      if (currentUserId && currentUserId !== id) {
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: id,
            },
          },
        });
        isFollowing = !!follow;
      }

      ResponseHelper.success(
        res,
        {
          ...user,
          isFollowing,
          isOwnProfile: currentUserId === id,
        },
        'User retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user');
    }
  };

  /**
   * Get user by username
   */
  static getByUsername = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username } = req.params;
      const currentUserId = req.user?.userId;

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatar: true,
          coverImage: true,
          website: true,
          location: true,
          verified: true,
          isPrivate: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          lastActiveAt: true,
        },
      });

      if (!user) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Check if current user follows this user
      let isFollowing = false;
      if (currentUserId && currentUserId !== user.id) {
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: user.id,
            },
          },
        });
        isFollowing = !!follow;
      }

      ResponseHelper.success(
        res,
        {
          ...user,
          isFollowing,
          isOwnProfile: currentUserId === user.id,
        },
        'User retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting user by username:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve user');
    }
  };

  /**
   * Update user profile
   */
  static updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const { displayName, bio, website, location, isPrivate } = req.body;

      // Validate input
      if (displayName && (displayName.length < 1 || displayName.length > 50)) {
        ResponseHelper.badRequest(res, 'Display name must be between 1 and 50 characters');
        return;
      }

      if (bio && bio.length > 160) {
        ResponseHelper.badRequest(res, 'Bio must be no more than 160 characters');
        return;
      }

      if (website && !/^https?:\/\/.+/.test(website)) {
        ResponseHelper.badRequest(res, 'Website must be a valid URL');
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          displayName,
          bio,
          website,
          location,
          isPrivate: isPrivate !== undefined ? Boolean(isPrivate) : undefined,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatar: true,
          coverImage: true,
          website: true,
          location: true,
          verified: true,
          isPrivate: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
        },
      });

      logger.info(`User profile updated: ${userId}`);
      ResponseHelper.success(res, { user: updatedUser }, 'Profile updated successfully');
    } catch (error) {
      logger.error('Error updating profile:', error);
      ResponseHelper.internalError(res, 'Failed to update profile');
    }
  };

  /**
   * Upload user avatar
   */
  static uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      if (!req.file) {
        ResponseHelper.badRequest(res, 'No avatar file provided');
        return;
      }

      // Get current user to check for existing avatar
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });

      // Upload new avatar to Cloudinary
      const uploadResult = await cloudinaryService.uploadAvatar(req.file.buffer, userId);

      // Update user avatar in database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { avatar: uploadResult.secure_url },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      });

      // Delete old avatar if exists
      if (currentUser?.avatar) {
        const oldPublicId = `twilsta/users/avatars/avatar_${userId}`;
        await cloudinaryService.deleteFile(oldPublicId);
      }

      logger.info(`Avatar uploaded for user: ${userId}`);
      ResponseHelper.success(
        res,
        {
          user: updatedUser,
          avatar: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
          },
        },
        'Avatar uploaded successfully',
      );
    } catch (error) {
      logger.error('Error uploading avatar:', error);
      ResponseHelper.internalError(res, 'Failed to upload avatar');
    }
  };

  /**
   * Upload user cover image
   */
  static uploadCoverImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      if (!req.file) {
        ResponseHelper.badRequest(res, 'No cover image file provided');
        return;
      }

      // Get current user to check for existing cover
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { coverImage: true },
      });

      // Upload new cover image to Cloudinary
      const uploadResult = await cloudinaryService.uploadCoverImage(req.file.buffer, userId);

      // Update user cover image in database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { coverImage: uploadResult.secure_url },
        select: {
          id: true,
          username: true,
          displayName: true,
          coverImage: true,
        },
      });

      // Delete old cover image if exists
      if (currentUser?.coverImage) {
        const oldPublicId = `twilsta/users/covers/cover_${userId}`;
        await cloudinaryService.deleteFile(oldPublicId);
      }

      logger.info(`Cover image uploaded for user: ${userId}`);
      ResponseHelper.success(
        res,
        {
          user: updatedUser,
          coverImage: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
          },
        },
        'Cover image uploaded successfully',
      );
    } catch (error) {
      logger.error('Error uploading cover image:', error);
      ResponseHelper.internalError(res, 'Failed to upload cover image');
    }
  };

  /**
   * Remove user avatar
   */
  static removeAvatar = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Get current avatar
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });

      if (!currentUser?.avatar) {
        ResponseHelper.badRequest(res, 'No avatar to remove');
        return;
      }

      // Remove avatar from database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { avatar: null },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      });

      // Delete from Cloudinary
      const publicId = `twilsta/users/avatars/avatar_${userId}`;
      await cloudinaryService.deleteFile(publicId);

      logger.info(`Avatar removed for user: ${userId}`);
      ResponseHelper.success(res, { user: updatedUser }, 'Avatar removed successfully');
    } catch (error) {
      logger.error('Error removing avatar:', error);
      ResponseHelper.internalError(res, 'Failed to remove avatar');
    }
  };

  /**
   * Remove user cover image
   */
  static removeCoverImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Get current cover image
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { coverImage: true },
      });

      if (!currentUser?.coverImage) {
        ResponseHelper.badRequest(res, 'No cover image to remove');
        return;
      }

      // Remove cover image from database
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { coverImage: null },
        select: {
          id: true,
          username: true,
          displayName: true,
          coverImage: true,
        },
      });

      // Delete from Cloudinary
      const publicId = `twilsta/users/covers/cover_${userId}`;
      await cloudinaryService.deleteFile(publicId);

      logger.info(`Cover image removed for user: ${userId}`);
      ResponseHelper.success(res, { user: updatedUser }, 'Cover image removed successfully');
    } catch (error) {
      logger.error('Error removing cover image:', error);
      ResponseHelper.internalError(res, 'Failed to remove cover image');
    }
  };

  /**
   * Get user followers
   */
  static getFollowers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const [followers, total] = await Promise.all([
        prisma.follow.findMany({
          where: { followingId: id },
          include: {
            follower: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                verified: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.follow.count({ where: { followingId: id } }),
      ]);

      const followersList = followers.map((f) => f.follower);
      ResponseHelper.paginated(
        res,
        followersList,
        page,
        limit,
        total,
        'Followers retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting followers:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve followers');
    }
  };

  /**
   * Get user following
   */
  static getFollowing = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const [following, total] = await Promise.all([
        prisma.follow.findMany({
          where: { followerId: id },
          include: {
            following: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                verified: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.follow.count({ where: { followerId: id } }),
      ]);

      const followingList = following.map((f) => f.following);
      ResponseHelper.paginated(
        res,
        followingList,
        page,
        limit,
        total,
        'Following retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting following:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve following');
    }
  };

  /**
   * Follow user
   */
  static followUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const followerId = req.user?.userId;
      const { id: followingId } = req.params;

      if (!followerId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      if (followerId === followingId) {
        ResponseHelper.badRequest(res, 'Cannot follow yourself');
        return;
      }

      // Check if user exists
      const userToFollow = await prisma.user.findUnique({
        where: { id: followingId },
        select: { id: true, username: true, email: true },
      });

      if (!userToFollow) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Check if already following
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        ResponseHelper.badRequest(res, 'Already following this user');
        return;
      }

      // Create follow relationship and update counts
      await prisma.$transaction(async (tx) => {
        await tx.follow.create({
          data: {
            followerId,
            followingId,
          },
        });

        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        });

        await tx.user.update({
          where: { id: followingId },
          data: { followersCount: { increment: 1 } },
        });
      });

      // Send notification email
      try {
        const follower = await prisma.user.findUnique({
          where: { id: followerId },
          select: { username: true },
        });

        if (follower) {
          await emailService.sendFollowNotification(
            userToFollow.email,
            userToFollow.username,
            follower.username,
          );
        }
      } catch (emailError) {
        logger.error('Failed to send follow notification email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info(`User ${followerId} followed ${followingId}`);
      ResponseHelper.success(res, { following: true }, 'User followed successfully');
    } catch (error) {
      logger.error('Error following user:', error);
      ResponseHelper.internalError(res, 'Failed to follow user');
    }
  };

  /**
   * Unfollow user
   */
  static unfollowUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const followerId = req.user?.userId;
      const { id: followingId } = req.params;

      if (!followerId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Check if currently following
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!existingFollow) {
        ResponseHelper.badRequest(res, 'Not following this user');
        return;
      }

      // Remove follow relationship and update counts
      await prisma.$transaction(async (tx) => {
        await tx.follow.delete({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
        });

        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { decrement: 1 } },
        });

        await tx.user.update({
          where: { id: followingId },
          data: { followersCount: { decrement: 1 } },
        });
      });

      logger.info(`User ${followerId} unfollowed ${followingId}`);
      ResponseHelper.success(res, { following: false }, 'User unfollowed successfully');
    } catch (error) {
      logger.error('Error unfollowing user:', error);
      ResponseHelper.internalError(res, 'Failed to unfollow user');
    }
  };

  /**
   * Change password
   */
  static changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true, email: true, username: true },
      });

      if (!user) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        ResponseHelper.badRequest(res, 'Current password is incorrect');
        return;
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      // Send notification email
      try {
        await emailService.sendPasswordChangeNotification(user.email, user.username);
      } catch (emailError) {
        logger.error('Failed to send password change notification:', emailError);
      }

      logger.info(`Password changed for user: ${userId}`);
      ResponseHelper.success(res, null, 'Password changed successfully');
    } catch (error) {
      logger.error('Error changing password:', error);
      ResponseHelper.internalError(res, 'Failed to change password');
    }
  };

  /**
   * Deactivate account
   */
  static deactivateAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const { password } = req.body;

      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true, email: true, username: true },
      });

      if (!user) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        ResponseHelper.badRequest(res, 'Password is incorrect');
        return;
      }

      // TODO: Implement soft delete or deactivation logic
      // For now, we'll just mark as private and clear sensitive data
      await prisma.user.update({
        where: { id: userId },
        data: {
          isPrivate: true,
          bio: 'Account deactivated',
          website: null,
          location: null,
        },
      });

      // Send confirmation email
      try {
        await emailService.sendAccountDeactivationNotification(user.email, user.username);
      } catch (emailError) {
        logger.error('Failed to send deactivation notification:', emailError);
      }

      logger.info(`Account deactivated for user: ${userId}`);
      ResponseHelper.success(res, null, 'Account deactivated successfully');
    } catch (error) {
      logger.error('Error deactivating account:', error);
      ResponseHelper.internalError(res, 'Failed to deactivate account');
    }
  };

  /**
   * Register a new user
   */
  static register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password, displayName } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existingUser) {
        ResponseHelper.badRequest(res, 'User with this email or username already exists');
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          displayName: displayName || username,
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          bio: true,
          avatar: true,
          coverImage: true,
          verified: true,
          isPrivate: true,
          website: true,
          location: true,
          createdAt: true,
        },
      });

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(email, displayName || username);
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
      }

      logger.info(`New user registered: ${newUser.id} - ${username}`);
      ResponseHelper.created(res, newUser, 'User registered successfully');
    } catch (error) {
      logger.error('Error registering user:', error);
      ResponseHelper.internalError(res, 'Failed to register user');
    }
  };

  /**
   * Delete user (soft delete)
   */
  static delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          coverImage: true,
        },
      });

      if (!user) {
        ResponseHelper.notFound(res, 'User not found');
        return;
      }

      // Check authorization (user can only delete their own account)
      if (userId !== id) {
        ResponseHelper.unauthorized(res, 'You can only delete your own account');
        return;
      } // Clean up Cloudinary assets
      try {
        if (user.avatar) {
          await cloudinaryService.deleteFile(user.avatar);
        }
        if (user.coverImage) {
          await cloudinaryService.deleteFile(user.coverImage);
        }
      } catch (cloudinaryError) {
        logger.error('Error cleaning up Cloudinary assets:', cloudinaryError);
      }

      // TODO: Implement soft delete instead of hard delete
      // For now, we'll anonymize the user data
      await prisma.user.update({
        where: { id },
        data: {
          username: `deleted_user_${id}`,
          email: `deleted_${Date.now()}@deleted.com`,
          displayName: 'Deleted User',
          bio: null,
          avatar: null,
          coverImage: null,
          website: null,
          location: null,
          isPrivate: true,
        },
      });

      logger.info(`User deleted: ${id} - ${user.username}`);
      ResponseHelper.success(res, null, 'User deleted successfully');
    } catch (error) {
      logger.error('Error deleting user:', error);
      ResponseHelper.internalError(res, 'Failed to delete user');
    }
  };
}
