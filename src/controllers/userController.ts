import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ResponseHelper } from '../utils/responseHelper';
import { asyncHandler } from '../utils/asyncHandler';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  AuthenticationError,
} from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * User controller based on Prisma User model
 */
export class UserController {
  /**
   * Get all users with pagination and filters
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    logger.info(
      `Getting users - Page: ${page}, Limit: ${limit}, Search: ${search}`,
    );

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
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
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    ResponseHelper.paginated(
      res,
      users,
      page,
      limit,
      total,
      'Users retrieved successfully',
    );
  });

  /**
   * Get user by ID
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info(`Getting user by ID: ${id}`);

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
      throw new NotFoundError('User not found');
    }

    ResponseHelper.success(res, user, 'User retrieved successfully');
  });

  /**
   * Get user by username
   */
  static getByUsername = asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    logger.info(`Getting user by username: ${username}`);

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
      throw new NotFoundError('User not found');
    }

    ResponseHelper.success(res, user, 'User retrieved successfully');
  });

  /**
   * Create new user (register)
   */
  static register = asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, displayName } = req.body;

    logger.info(`Registering new user: ${username}`);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictError('Username already taken');
      }
      if (existingUser.email === email) {
        throw new ConflictError('Email already registered');
      }
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
        verified: true,
        createdAt: true,
      },
    });

    ResponseHelper.created(res, newUser, 'User registered successfully');
  });

  /**
   * Update user profile
   */
  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      displayName,
      bio,
      website,
      location,
      avatar,
      coverImage,
      isPrivate,
    } = req.body;

    logger.info(`Updating user profile: ${id}`);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(website !== undefined && { website }),
        ...(location !== undefined && { location }),
        ...(avatar !== undefined && { avatar }),
        ...(coverImage !== undefined && { coverImage }),
        ...(isPrivate !== undefined && { isPrivate }),
        updatedAt: new Date(),
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
        isPrivate: true,
        updatedAt: true,
      },
    });

    ResponseHelper.updated(res, updatedUser, 'Profile updated successfully');
  });

  /**
   * Change user password
   */
  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { currentPassword, password } = req.body;

    logger.info(`Changing password for user: ${id}`);

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    ResponseHelper.success(res, null, 'Password changed successfully');
  });

  /**
   * Delete user account
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info(`Deleting user: ${id}`);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id },
    });

    ResponseHelper.deleted(res, 'User account deleted successfully');
  });

  /**
   * Get user's followers
   */
  static getFollowers = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    logger.info(`Getting followers for user: ${id}`);

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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.follow.count({ where: { followingId: id } }),
    ]);

    const followersList = followers.map((follow) => follow.follower);

    ResponseHelper.paginated(
      res,
      followersList,
      page,
      limit,
      total,
      'Followers retrieved successfully',
    );
  });

  /**
   * Get user's following
   */
  static getFollowing = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    logger.info(`Getting following for user: ${id}`);

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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.follow.count({ where: { followerId: id } }),
    ]);

    const followingList = following.map((follow) => follow.following);

    ResponseHelper.paginated(
      res,
      followingList,
      page,
      limit,
      total,
      'Following retrieved successfully',
    );
  });
}
