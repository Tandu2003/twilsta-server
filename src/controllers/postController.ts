import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ResponseHelper } from '../utils/responseHelper';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Post controller based on Prisma Post model
 */
export class PostController {
  /**
   * Get all posts with pagination and filters
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string;
    const authorId = req.query.authorId as string;
    const parentId = req.query.parentId as string;
    const offset = (page - 1) * limit;

    logger.info(
      `Getting posts - Page: ${page}, Limit: ${limit}, Type: ${type}, AuthorId: ${authorId}`,
    );

    const where: any = {
      isPublic: true, // Only show public posts
    };

    if (type) {
      where.type = type;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (parentId) {
      where.parentId = parentId;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              verified: true,
            },
          },
          parent: {
            select: {
              id: true,
              content: true,
              author: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    ResponseHelper.paginated(
      res,
      posts,
      page,
      limit,
      total,
      'Posts retrieved successfully',
    );
  });

  /**
   * Get post by ID
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info(`Getting post by ID: ${id}`);

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            verified: true,
          },
        },
        parent: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
        replies: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                username: true,
                displayName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5, // Show latest 5 replies
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
            replies: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Increment view count
    await prisma.post.update({
      where: { id },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
    });

    ResponseHelper.success(res, post, 'Post retrieved successfully');
  });

  /**
   * Create new post
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const {
      content,
      type = 'TEXT',
      images = [],
      videos = [],
      audioUrl,
      parentId,
      replyToId,
      isPublic = true,
      allowReplies = true,
      authorId, // This should come from JWT token in real implementation
    } = req.body;

    logger.info(`Creating new post for user: ${authorId}`);

    // Validate content exists for text posts or media exists for media posts
    if (
      type === 'TEXT' &&
      !content &&
      images.length === 0 &&
      videos.length === 0 &&
      !audioUrl
    ) {
      throw new ValidationError(
        'Content is required for text posts or media must be provided',
      );
    }

    // If it's a reply, check if parent post exists
    if (parentId) {
      const parentPost = await prisma.post.findUnique({
        where: { id: parentId },
      });

      if (!parentPost) {
        throw new NotFoundError('Parent post not found');
      }
    }

    // If it's a direct reply, check if the post being replied to exists
    if (replyToId) {
      const replyToPost = await prisma.post.findUnique({
        where: { id: replyToId },
      });

      if (!replyToPost) {
        throw new NotFoundError('Post being replied to not found');
      }
    }

    // Create post
    const newPost = await prisma.post.create({
      data: {
        content,
        type,
        images,
        videos,
        audioUrl,
        authorId,
        parentId,
        replyToId,
        isPublic,
        allowReplies,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            verified: true,
          },
        },
      },
    });

    // Update author's post count
    await prisma.user.update({
      where: { id: authorId },
      data: {
        postsCount: {
          increment: 1,
        },
      },
    });

    ResponseHelper.created(res, newPost, 'Post created successfully');
  });

  /**
   * Update post
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content, isPublic, allowReplies } = req.body;

    logger.info(`Updating post: ${id}`);

    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new NotFoundError('Post not found');
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(isPublic !== undefined && { isPublic }),
        ...(allowReplies !== undefined && { allowReplies }),
        updatedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            verified: true,
          },
        },
      },
    });

    ResponseHelper.updated(res, updatedPost, 'Post updated successfully');
  });

  /**
   * Delete post
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info(`Deleting post: ${id}`);

    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!existingPost) {
      throw new NotFoundError('Post not found');
    }

    // Delete post (cascade will handle related records)
    await prisma.post.delete({
      where: { id },
    });

    // Update author's post count
    await prisma.user.update({
      where: { id: existingPost.authorId },
      data: {
        postsCount: {
          decrement: 1,
        },
      },
    });

    ResponseHelper.deleted(res, 'Post deleted successfully');
  });

  /**
   * Like/Unlike post
   */
  static toggleLike = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body; // This should come from JWT token in real implementation

    logger.info(`Toggling like for post: ${id} by user: ${userId}`);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    // Check if user already liked the post
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: id,
        },
      },
    });

    if (existingLike) {
      // Unlike the post
      await prisma.$transaction([
        prisma.like.delete({
          where: {
            userId_postId: {
              userId,
              postId: id,
            },
          },
        }),
        prisma.post.update({
          where: { id },
          data: {
            likesCount: {
              decrement: 1,
            },
          },
        }),
      ]);

      ResponseHelper.success(
        res,
        { liked: false },
        'Post unliked successfully',
      );
    } else {
      // Like the post
      await prisma.$transaction([
        prisma.like.create({
          data: {
            userId,
            postId: id,
          },
        }),
        prisma.post.update({
          where: { id },
          data: {
            likesCount: {
              increment: 1,
            },
          },
        }),
      ]);

      ResponseHelper.success(res, { liked: true }, 'Post liked successfully');
    }
  });

  /**
   * Get post replies
   */
  static getReplies = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    logger.info(`Getting replies for post: ${id}`);

    const [replies, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          parentId: id,
          isPublic: true,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              verified: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.post.count({
        where: {
          parentId: id,
          isPublic: true,
        },
      }),
    ]);

    ResponseHelper.paginated(
      res,
      replies,
      page,
      limit,
      total,
      'Post replies retrieved successfully',
    );
  });
}
