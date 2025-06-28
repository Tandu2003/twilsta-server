import { Request, Response } from 'express';
import { PrismaClient, PostType } from '@prisma/client';
import { ResponseHelper } from '../utils/responseHelper';
import logger from '../utils/logger';
import cloudinaryService from '../services/cloudinaryService';
import { getRealtimeService } from '../services/realtimeInstance';

const prisma = new PrismaClient();

/**
 * Post Controller with Cloudinary integration
 */
export class PostController {
  /**
   * Get all posts with pagination and filters
   */
  static getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const type = req.query.type as string;
      const authorId = req.query.authorId as string;
      const parentId = req.query.parentId as string;
      const search = req.query.search as string;
      const offset = (page - 1) * limit;

      logger.info(
        `Getting posts - Page: ${page}, Limit: ${limit}, Type: ${type}, AuthorId: ${authorId}`,
      );

      const where: any = {
        isPublic: true,
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

      if (search) {
        where.OR = [{ content: { contains: search, mode: 'insensitive' } }];
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
                type: true,
                images: true,
                videos: true,
                audioUrl: true,
                author: {
                  select: {
                    username: true,
                    displayName: true,
                    avatar: true,
                  },
                },
              },
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
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.post.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      ResponseHelper.success(
        res,
        {
          posts,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
        'Posts retrieved successfully',
      );
    } catch (error) {
      logger.error('Error retrieving posts:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve posts');
    }
  };

  /**
   * Get post by ID
   */
  static getById = async (req: Request, res: Response): Promise<void> => {
    try {
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
              followersCount: true,
            },
          },
          parent: {
            select: {
              id: true,
              content: true,
              type: true,
              images: true,
              videos: true,
              audioUrl: true,
              createdAt: true,
              author: {
                select: {
                  username: true,
                  displayName: true,
                  avatar: true,
                },
              },
            },
          },
          replies: {
            select: {
              id: true,
              content: true,
              type: true,
              images: true,
              videos: true,
              audioUrl: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                  replies: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
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
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      logger.info(`Post retrieved: ${id}`);
      ResponseHelper.success(res, post, 'Post retrieved successfully');
    } catch (error) {
      logger.error('Error retrieving post:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve post');
    }
  };

  /**
   * Create new post with media upload
   */
  static create = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId; // Assuming user is authenticated
      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const { content, type = 'TEXT', parentId, isPublic = true } = req.body;

      // Validate required fields
      if (!content && (!req.files || !Array.isArray(req.files) || req.files.length === 0)) {
        ResponseHelper.badRequest(res, 'Content or media files are required');
        return;
      }

      let images: string[] = [];
      let videos: string[] = [];
      let audioUrl: string | null = null;

      // Upload media files to Cloudinary if present
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        try {
          for (const file of req.files) {
            if (file.mimetype.startsWith('image/')) {
              const result = await cloudinaryService.uploadFile(file, 'post/media', 'image');
              images.push(result.secure_url);
            } else if (file.mimetype.startsWith('video/')) {
              const result = await cloudinaryService.uploadFile(file, 'post/media', 'video');
              videos.push(result.secure_url);
            } else if (file.mimetype.startsWith('audio/')) {
              const result = await cloudinaryService.uploadFile(file, 'post/media', 'auto');
              audioUrl = result.secure_url;
              break; // Only one audio file allowed
            }
          }
        } catch (uploadError) {
          logger.error('Error uploading media files:', uploadError);
          ResponseHelper.badRequest(res, 'Failed to upload media files');
          return;
        }
      }

      // Determine post type based on media
      let postType: PostType = type as PostType;
      if (images.length > 0 && videos.length > 0) {
        postType = PostType.MIXED;
      } else if (videos.length > 0) {
        postType = PostType.VIDEO;
      } else if (audioUrl) {
        postType = PostType.AUDIO;
      } else if (images.length > 0) {
        postType = PostType.IMAGE;
      } else {
        postType = PostType.TEXT;
      }

      // Validate parent post if replying
      if (parentId) {
        const parentPost = await prisma.post.findUnique({
          where: { id: parentId },
        });
        if (!parentPost) {
          ResponseHelper.badRequest(res, 'Parent post not found');
          return;
        }
      }

      // Create post
      const newPost = await prisma.post.create({
        data: {
          content: content || '',
          type: postType,
          images,
          videos,
          audioUrl,
          authorId: userId,
          parentId,
          isPublic,
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
          parent: parentId
            ? {
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
              }
            : false,
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
              replies: true,
            },
          },
        },
      }); // Update user's posts count
      await prisma.user.update({
        where: { id: userId },
        data: {
          postsCount: {
            increment: 1,
          },
        },
      }); // Broadcast new post creation via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        try {
          realtimeService.broadcastNewPost(newPost);
        } catch (broadcastError) {
          logger.warn('Failed to broadcast new post event:', broadcastError);
        }
      }

      logger.info(`New post created: ${newPost.id} by user: ${userId}`);
      ResponseHelper.created(res, newPost, 'Post created successfully');
    } catch (error) {
      logger.error('Error creating post:', error);
      ResponseHelper.internalError(res, 'Failed to create post');
    }
  };

  /**
   * Update post
   */
  static update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      const { content, isPublic } = req.body;

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
        where: { id },
        select: { id: true, authorId: true },
      });

      if (!existingPost) {
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      if (existingPost.authorId !== userId) {
        ResponseHelper.unauthorized(res, 'You can only edit your own posts');
        return;
      }

      // Update post
      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          content,
          isPublic,
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

      // Broadcast post update via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        try {
          realtimeService.broadcastPostUpdate(id, updatedPost);
        } catch (broadcastError) {
          logger.warn('Failed to broadcast post update event:', broadcastError);
        }
      }

      logger.info(`Post updated: ${id} by user: ${userId}`);
      ResponseHelper.success(res, updatedPost, 'Post updated successfully');
    } catch (error) {
      logger.error('Error updating post:', error);
      ResponseHelper.internalError(res, 'Failed to update post');
    }
  };

  /**
   * Delete post
   */
  static delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          images: true,
          videos: true,
          audioUrl: true,
          _count: {
            select: {
              replies: true,
            },
          },
        },
      });

      if (!existingPost) {
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      if (existingPost.authorId !== userId) {
        ResponseHelper.unauthorized(res, 'You can only delete your own posts');
        return;
      }

      // Delete media files from Cloudinary
      try {
        const deletePromises: Promise<boolean>[] = [];

        // Delete images
        existingPost.images.forEach((url) => {
          const publicId = cloudinaryService.extractPublicIdFromUrl(url);
          deletePromises.push(cloudinaryService.deleteFile(publicId, 'image'));
        });

        // Delete videos
        existingPost.videos.forEach((url) => {
          const publicId = cloudinaryService.extractPublicIdFromUrl(url);
          deletePromises.push(cloudinaryService.deleteFile(publicId, 'video'));
        });

        // Delete audio
        if (existingPost.audioUrl) {
          const publicId = cloudinaryService.extractPublicIdFromUrl(existingPost.audioUrl);
          deletePromises.push(cloudinaryService.deleteFile(publicId, 'video'));
        }

        await Promise.all(deletePromises);
      } catch (cloudinaryError) {
        logger.error('Error deleting media from Cloudinary:', cloudinaryError);
        // Continue with post deletion even if Cloudinary cleanup fails
      }

      // Delete post (this will cascade delete likes, comments, etc.)
      await prisma.post.delete({
        where: { id },
      }); // Update user's posts count
      await prisma.user.update({
        where: { id: userId },
        data: {
          postsCount: {
            decrement: 1,
          },
        },
      });

      // Broadcast post deletion via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        try {
          realtimeService.broadcastPostDelete(id, userId);
        } catch (broadcastError) {
          logger.warn('Failed to broadcast post delete event:', broadcastError);
        }
      }

      logger.info(`Post deleted: ${id} by user: ${userId}`);
      ResponseHelper.success(res, null, 'Post deleted successfully');
    } catch (error) {
      logger.error('Error deleting post:', error);
      ResponseHelper.internalError(res, 'Failed to delete post');
    }
  };

  /**
   * Toggle like on post
   */
  static toggleLike = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      logger.info(`Toggle like request - Post ID: ${id}, User ID: ${userId}`);

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true, authorId: true },
      });

      logger.info(`Post lookup result:`, { post, postId: id });

      if (!post) {
        logger.warn(`Post not found: ${id}`);
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      if (!post.authorId) {
        logger.error(`Post found but authorId is null: ${id}`);
        ResponseHelper.badRequest(res, 'Invalid post data');
        return;
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

      logger.info(`Existing like check:`, { existingLike, userId, postId: id });

      let liked = false;
      let message = '';
      let likeData = null;

      if (existingLike) {
        // Unlike the post
        await prisma.like.delete({
          where: {
            userId_postId: {
              userId,
              postId: id,
            },
          },
        });
        message = 'Post unliked successfully';
        liked = false;

        // Update post likes count
        await prisma.post.update({
          where: { id },
          data: {
            likesCount: {
              decrement: 1,
            },
          },
        });

        // Broadcast unlike event
        const realtimeService = getRealtimeService();
        if (realtimeService && post.authorId) {
          try {
            realtimeService.broadcastPostUnlike(id, userId, post.authorId);
          } catch (broadcastError) {
            logger.warn('Failed to broadcast unlike event:', broadcastError);
          }
        }
      } else {
        // Like the post
        const newLike = await prisma.like.create({
          data: {
            userId,
            postId: id,
          },
          include: {
            user: {
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
        message = 'Post liked successfully';
        liked = true;
        likeData = newLike;

        // Update post likes count
        await prisma.post.update({
          where: { id },
          data: {
            likesCount: {
              increment: 1,
            },
          },
        });

        // Broadcast like event
        const realtimeService = getRealtimeService();
        if (realtimeService) {
          try {
            realtimeService.broadcastPostLike(id, newLike);
          } catch (broadcastError) {
            logger.warn('Failed to broadcast like event:', broadcastError);
          }
        }
      }

      // Get updated like count from post
      const updatedPost = await prisma.post.findUnique({
        where: { id },
        select: { likesCount: true },
      });

      const likeCount = updatedPost?.likesCount || 0;

      logger.info(
        `Post ${liked ? 'liked' : 'unliked'}: ${id} by user: ${userId}, new count: ${likeCount}`,
      );
      ResponseHelper.success(
        res,
        {
          postId: id,
          liked,
          likeCount,
        },
        message,
      );
    } catch (error) {
      logger.error('Error toggling like:', error);
      ResponseHelper.internalError(res, 'Failed to toggle like');
    }
  };

  /**
   * Get post replies
   */
  static getReplies = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      logger.info(`Getting replies for post: ${id} - Page: ${page}, Limit: ${limit}`);

      // Check if parent post exists
      const parentPost = await prisma.post.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!parentPost) {
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      const [replies, total] = await Promise.all([
        prisma.post.findMany({
          where: { parentId: id },
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
                replies: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.post.count({ where: { parentId: id } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      ResponseHelper.success(
        res,
        {
          replies,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
        'Replies retrieved successfully',
      );
    } catch (error) {
      logger.error('Error retrieving replies:', error);
      ResponseHelper.internalError(res, 'Failed to retrieve replies');
    }
  };

  /**
   * Add media to existing post
   */
  static addMedia = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        ResponseHelper.badRequest(res, 'No media files provided');
        return;
      }

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          images: true,
          videos: true,
          audioUrl: true,
          type: true,
        },
      });

      if (!existingPost) {
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      if (existingPost.authorId !== userId) {
        ResponseHelper.unauthorized(res, 'You can only modify your own posts');
        return;
      }

      let newImages: string[] = [...existingPost.images];
      let newVideos: string[] = [...existingPost.videos];
      let newAudioUrl: string | null = existingPost.audioUrl;

      // Upload new media files
      try {
        for (const file of req.files) {
          if (file.mimetype.startsWith('image/')) {
            const result = await cloudinaryService.uploadFile(file, 'post/media', 'image');
            newImages.push(result.secure_url);
          } else if (file.mimetype.startsWith('video/')) {
            const result = await cloudinaryService.uploadFile(file, 'post/media', 'video');
            newVideos.push(result.secure_url);
          } else if (file.mimetype.startsWith('audio/') && !newAudioUrl) {
            const result = await cloudinaryService.uploadFile(file, 'post/media', 'auto');
            newAudioUrl = result.secure_url;
          }
        }

        // Update post type based on media
        let postType: PostType = PostType.TEXT;
        if (newImages.length > 0 && newVideos.length > 0) {
          postType = PostType.MIXED;
        } else if (newVideos.length > 0) {
          postType = PostType.VIDEO;
        } else if (newAudioUrl) {
          postType = PostType.AUDIO;
        } else if (newImages.length > 0) {
          postType = PostType.IMAGE;
        }

        // Update post
        const updatedPost = await prisma.post.update({
          where: { id },
          data: {
            images: newImages,
            videos: newVideos,
            audioUrl: newAudioUrl,
            type: postType,
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

        logger.info(`Media added to post: ${id} by user: ${userId}`);
        ResponseHelper.success(res, updatedPost, 'Media added to post successfully');
      } catch (uploadError) {
        logger.error('Error uploading media files:', uploadError);
        ResponseHelper.badRequest(res, 'Failed to upload media files');
      }
    } catch (error) {
      logger.error('Error adding media to post:', error);
      ResponseHelper.internalError(res, 'Failed to add media to post');
    }
  };

  /**
   * Remove specific media from post
   */
  static removeMedia = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { mediaUrl, mediaType } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      if (!mediaUrl || !mediaType) {
        ResponseHelper.badRequest(res, 'Media URL and type are required');
        return;
      }

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          images: true,
          videos: true,
          audioUrl: true,
        },
      });

      if (!existingPost) {
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      if (existingPost.authorId !== userId) {
        ResponseHelper.unauthorized(res, 'You can only modify your own posts');
        return;
      }

      // Check if media exists in post
      let mediaFound = false;
      let updatedImages = existingPost.images;
      let updatedVideos = existingPost.videos;
      let updatedAudioUrl = existingPost.audioUrl;

      if (mediaType === 'image' && existingPost.images.includes(mediaUrl)) {
        updatedImages = existingPost.images.filter((url) => url !== mediaUrl);
        mediaFound = true;
      } else if (mediaType === 'video' && existingPost.videos.includes(mediaUrl)) {
        updatedVideos = existingPost.videos.filter((url) => url !== mediaUrl);
        mediaFound = true;
      } else if (mediaType === 'audio' && existingPost.audioUrl === mediaUrl) {
        updatedAudioUrl = null;
        mediaFound = true;
      }

      if (!mediaFound) {
        ResponseHelper.badRequest(res, 'Media URL not found in post');
        return;
      }

      // Remove media from Cloudinary
      try {
        const publicId = cloudinaryService.extractPublicIdFromUrl(mediaUrl);
        const resourceType = mediaType === 'image' ? 'image' : 'video';
        await cloudinaryService.deleteFile(publicId, resourceType);
      } catch (cloudinaryError) {
        logger.error('Error deleting media from Cloudinary:', cloudinaryError);
        // Continue with database update even if Cloudinary deletion fails
      }

      // Update post type based on remaining media
      let postType: PostType = PostType.TEXT;
      if (updatedImages.length > 0 && updatedVideos.length > 0) {
        postType = PostType.MIXED;
      } else if (updatedVideos.length > 0) {
        postType = PostType.VIDEO;
      } else if (updatedAudioUrl) {
        postType = PostType.AUDIO;
      } else if (updatedImages.length > 0) {
        postType = PostType.IMAGE;
      }

      // Update post
      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          images: updatedImages,
          videos: updatedVideos,
          audioUrl: updatedAudioUrl,
          type: postType,
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

      logger.info(`Media removed from post: ${id} by user: ${userId}`);
      ResponseHelper.success(res, updatedPost, 'Media removed from post successfully');
    } catch (error) {
      logger.error('Error removing media from post:', error);
      ResponseHelper.internalError(res, 'Failed to remove media from post');
    }
  };

  /**
   * Get like status for a post
   */
  static getLikeStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      logger.info(`Get like status request - Post ID: ${id}, User ID: ${userId}`);

      if (!userId) {
        ResponseHelper.unauthorized(res, 'Authentication required');
        return;
      }

      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true },
      });

      logger.info(`Post lookup for like status:`, { post, postId: id });

      if (!post) {
        logger.warn(`Post not found for like status: ${id}`);
        ResponseHelper.notFound(res, 'Post not found');
        return;
      }

      // Check if user liked the post
      const existingLike = await prisma.like.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: id,
          },
        },
      });

      const liked = !!existingLike;

      logger.info(`Like status result:`, { postId: id, userId, liked });
      ResponseHelper.success(res, { liked }, 'Like status retrieved successfully');
    } catch (error) {
      logger.error('Error getting like status:', error);
      ResponseHelper.internalError(res, 'Failed to get like status');
    }
  };
}
