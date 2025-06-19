import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  success,
  created,
  badRequest,
  unauthorized,
  notFound,
  internalError,
} from '../utils/responseHelper';
import logger from '../utils/logger';
import cloudinaryService from '../services/cloudinaryService';
import emailService from '../services/emailService';

const prisma = new PrismaClient();

/**
 * Comment Controller with Cloudinary integration and email notifications
 */
export class CommentController {
  /**
   * Get all comments for a post with pagination and nested replies
   */
  static getCommentsByPost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { postId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Verify post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        notFound(res, 'Post not found');
        return;
      }

      // Get top-level comments with nested replies
      const [comments, totalComments] = await Promise.all([
        prisma.comment.findMany({
          where: {
            postId,
            parentId: null, // Only root comments
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
            replies: {
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
                _count: {
                  select: {
                    likes: true,
                    replies: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
              take: 3, // Show first 3 replies
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
        prisma.comment.count({
          where: {
            postId,
            parentId: null,
          },
        }),
      ]);

      const totalPages = Math.ceil(totalComments / limit);

      logger.info(`Retrieved ${comments.length} comments for post: ${postId}`);
      success(res, {
        comments,
        pagination: {
          page,
          limit,
          totalComments,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      }, 'Comments retrieved successfully');
    } catch (error) {
      logger.error('Error getting comments:', error);
      internalError(res, 'Failed to retrieve comments');
    }
  };

  /**
   * Get replies for a specific comment
   */
  static getReplies = async (req: Request, res: Response): Promise<void> => {
    try {
      const { commentId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Verify parent comment exists
      const parentComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!parentComment) {
        notFound(res, 'Comment not found');
        return;
      }

      const [replies, totalReplies] = await Promise.all([
        prisma.comment.findMany({
          where: {
            parentId: commentId,
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
            _count: {
              select: {
                likes: true,
                replies: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          skip: offset,
          take: limit,
        }),
        prisma.comment.count({
          where: {
            parentId: commentId,
          },
        }),
      ]);

      const totalPages = Math.ceil(totalReplies / limit);

      success(res, {
        replies,
        pagination: {
          page,
          limit,
          totalReplies,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      }, 'Replies retrieved successfully');
    } catch (error) {
      logger.error('Error getting replies:', error);
      internalError(res, 'Failed to retrieve replies');
    }
  };

  /**
   * Create new comment with media upload and email notifications
   */
  static create = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId; // Assuming user is authenticated
      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      const { content, postId, parentId } = req.body;

      // Validate required fields
      if (!content && (!req.files || !Array.isArray(req.files) || req.files.length === 0)) {
        badRequest(res, 'Content or media files are required');
        return;
      }

      // Verify post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      if (!post) {
        notFound(res, 'Post not found');
        return;
      }

      let parentComment = null;
      let depth = 0;
      let path = '';

      // Verify parent comment if replying
      if (parentId) {
        parentComment = await prisma.comment.findUnique({
          where: { id: parentId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
              },
            },
          },
        });

        if (!parentComment) {
          badRequest(res, 'Parent comment not found');
          return;
        }

        depth = parentComment.depth + 1;
        path = parentComment.path ? `${parentComment.path}/${parentComment.id}` : parentComment.id;
      }

      let images: string[] = [];
      let videos: string[] = [];
      let audioUrl: string | null = null;
      let documents: string[] = [];

      // Upload media files to Cloudinary if present
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        try {
          for (const file of req.files) {
            if (file.mimetype.startsWith('image/')) {
              const result = await cloudinaryService.uploadFile(
                file, 
                `comments/images`, 
                'image'
              );
              images.push(result.secure_url);
            } else if (file.mimetype.startsWith('video/')) {
              const result = await cloudinaryService.uploadFile(
                file, 
                `comments/videos`, 
                'video'
              );
              videos.push(result.secure_url);
            } else if (file.mimetype.startsWith('audio/')) {
              const result = await cloudinaryService.uploadFile(
                file, 
                `comments/audio`, 
                'auto'
              );
              audioUrl = result.secure_url;
              break; // Only one audio file allowed
            } else {
              // Documents (PDF, DOC, etc.)
              const result = await cloudinaryService.uploadFile(
                file, 
                `comments/documents`, 
                'auto'
              );
              documents.push(result.secure_url);
            }
          }
        } catch (uploadError) {
          logger.error('Error uploading comment media:', uploadError);
          badRequest(res, 'Failed to upload media files');
          return;
        }
      }

      // Create comment
      const newComment = await prisma.comment.create({
        data: {
          content: content || '',
          userId,
          postId,
          parentId,
          depth,
          path,
          images,
          videos,
          audioUrl,
          documents,
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
          parent: parentId ? {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          } : false,
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      // Update parent comment's replies count if this is a reply
      if (parentId) {
        await prisma.comment.update({
          where: { id: parentId },
          data: {
            repliesCount: {
              increment: 1,
            },
          },
        });
      }

      // Send email notifications
      try {
        // Notify post author if someone commented on their post
        if (post.author.id !== userId) {
          await emailService.sendCommentNotification(
            post.author.email,            {
              postAuthor: post.author.displayName || post.author.username,
              commenter: newComment.user.displayName || newComment.user.username,
              commentContent: content,
              postContent: post.content || 'No content',
            }
          );
        }

        // Notify parent comment author if this is a reply
        if (parentComment && parentComment.user.id !== userId) {
          await emailService.sendReplyNotification(
            parentComment.user.email,
            {
              originalCommenter: parentComment.user.displayName || parentComment.user.username,
              replier: newComment.user.displayName || newComment.user.username,
              replyContent: content,
              originalComment: parentComment.content,
            }
          );
        }
      } catch (emailError) {
        logger.warn('Failed to send comment notification email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info(`New comment created: ${newComment.id} by user: ${userId}`);
      created(res, newComment, 'Comment created successfully');
    } catch (error) {
      logger.error('Error creating comment:', error);
      internalError(res, 'Failed to create comment');
    }
  };

  /**
   * Update comment
   */
  static update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Find comment and verify ownership
      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        notFound(res, 'Comment not found');
        return;
      }

      if (comment.userId !== userId) {
        unauthorized(res, 'You can only edit your own comments');
        return;
      }

      // Update comment
      const updatedComment = await prisma.comment.update({
        where: { id },
        data: { content },
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
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      logger.info(`Comment updated: ${id} by user: ${userId}`);
      success(res, updatedComment, 'Comment updated successfully');
    } catch (error) {
      logger.error('Error updating comment:', error);
      internalError(res, 'Failed to update comment');
    }
  };

  /**
   * Delete comment and cleanup media files
   */
  static delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Find comment and verify ownership
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: {
          replies: true,
        },
      });

      if (!comment) {
        notFound(res, 'Comment not found');
        return;
      }

      if (comment.userId !== userId) {
        unauthorized(res, 'You can only delete your own comments');
        return;
      }

      // Collect all media URLs for deletion
      const mediaUrls = [
        ...comment.images,
        ...comment.videos,
        ...comment.documents,
      ];
      if (comment.audioUrl) {
        mediaUrls.push(comment.audioUrl);
      }

      // Delete comment (this will cascade delete replies)
      await prisma.comment.delete({
        where: { id },
      });

      // Update parent comment's replies count if this was a reply
      if (comment.parentId) {
        await prisma.comment.update({
          where: { id: comment.parentId },
          data: {
            repliesCount: {
              decrement: 1,
            },
          },
        });
      }

      // Cleanup media files from Cloudinary
      if (mediaUrls.length > 0) {
        try {
          for (const mediaUrl of mediaUrls) {
            const publicId = cloudinaryService.extractPublicIdFromUrl(mediaUrl);
            if (publicId) {
              await cloudinaryService.deleteFile(publicId);
            }
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup comment media files:', cleanupError);
          // Don't fail the request if cleanup fails
        }
      }

      logger.info(`Comment deleted: ${id} by user: ${userId}`);
      success(res, null, 'Comment deleted successfully');
    } catch (error) {
      logger.error('Error deleting comment:', error);
      internalError(res, 'Failed to delete comment');
    }
  };

  /**
   * Toggle like on comment
   */
  static toggleLike = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify comment exists
      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        notFound(res, 'Comment not found');
        return;
      }

      // Check if user already liked this comment
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId: id,
          },
        },
      });

      let isLiked: boolean;

      if (existingLike) {
        // Unlike
        await prisma.commentLike.delete({
          where: { id: existingLike.id },
        });
        
        await prisma.comment.update({
          where: { id },
          data: {
            likesCount: {
              decrement: 1,
            },
          },
        });
        
        isLiked = false;
        logger.info(`Comment unliked: ${id} by user: ${userId}`);
      } else {
        // Like
        await prisma.commentLike.create({
          data: {
            userId,
            commentId: id,
          },
        });
        
        await prisma.comment.update({
          where: { id },
          data: {
            likesCount: {
              increment: 1,
            },
          },
        });
        
        isLiked = true;
        logger.info(`Comment liked: ${id} by user: ${userId}`);
      }

      success(res, { isLiked }, `Comment ${isLiked ? 'liked' : 'unliked'} successfully`);
    } catch (error) {
      logger.error('Error toggling comment like:', error);
      internalError(res, 'Failed to toggle comment like');
    }
  };

  /**
   * Add media to existing comment
   */
  static addMedia = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        badRequest(res, 'No files uploaded');
        return;
      }

      // Find comment and verify ownership
      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        notFound(res, 'Comment not found');
        return;
      }

      if (comment.userId !== userId) {
        unauthorized(res, 'You can only modify your own comments');
        return;
      }

      let newImages: string[] = [];
      let newVideos: string[] = [];
      let newAudioUrl: string | null = null;
      let newDocuments: string[] = [];

      // Upload new media files to Cloudinary
      try {
        for (const file of req.files) {
          if (file.mimetype.startsWith('image/')) {
            const result = await cloudinaryService.uploadFile(
              file, 
              `comments/images`, 
              'image'
            );
            newImages.push(result.secure_url);
          } else if (file.mimetype.startsWith('video/')) {
            const result = await cloudinaryService.uploadFile(
              file, 
              `comments/videos`, 
              'video'
            );
            newVideos.push(result.secure_url);
          } else if (file.mimetype.startsWith('audio/')) {
            if (!comment.audioUrl) { // Only add if no audio exists
              const result = await cloudinaryService.uploadFile(
                file, 
                `comments/audio`, 
                'auto'
              );
              newAudioUrl = result.secure_url;
            }
          } else {
            const result = await cloudinaryService.uploadFile(
              file, 
              `comments/documents`, 
              'auto'
            );
            newDocuments.push(result.secure_url);
          }
        }
      } catch (uploadError) {
        logger.error('Error uploading media to comment:', uploadError);
        badRequest(res, 'Failed to upload media files');
        return;
      }

      // Update comment with new media
      const updatedComment = await prisma.comment.update({
        where: { id },
        data: {
          images: {
            push: newImages,
          },
          videos: {
            push: newVideos,
          },
          audioUrl: newAudioUrl || comment.audioUrl,
          documents: {
            push: newDocuments,
          },
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
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      logger.info(`Media added to comment: ${id} by user: ${userId}`);
      success(res, updatedComment, 'Media added to comment successfully');
    } catch (error) {
      logger.error('Error adding media to comment:', error);
      internalError(res, 'Failed to add media to comment');
    }
  };

  /**
   * Remove media from comment
   */
  static removeMedia = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { mediaUrls, mediaType } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Find comment and verify ownership
      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        notFound(res, 'Comment not found');
        return;
      }

      if (comment.userId !== userId) {
        unauthorized(res, 'You can only modify your own comments');
        return;
      }

      let updateData: any = {};

      // Remove URLs from the appropriate array based on media type
      switch (mediaType) {
        case 'image':
          updateData.images = comment.images.filter(url => !mediaUrls.includes(url));
          break;
        case 'video':
          updateData.videos = comment.videos.filter(url => !mediaUrls.includes(url));
          break;
        case 'audio':
          if (mediaUrls.includes(comment.audioUrl)) {
            updateData.audioUrl = null;
          }
          break;
        case 'document':
          updateData.documents = comment.documents.filter(url => !mediaUrls.includes(url));
          break;
        default:
          badRequest(res, 'Invalid media type');
          return;
      }

      // Update comment
      const updatedComment = await prisma.comment.update({
        where: { id },
        data: updateData,
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
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      // Delete files from Cloudinary
      try {
        for (const mediaUrl of mediaUrls) {
          const publicId = cloudinaryService.extractPublicIdFromUrl(mediaUrl);
          if (publicId) {
            await cloudinaryService.deleteFile(publicId);
          }
        }
      } catch (cleanupError) {
        logger.warn('Failed to cleanup removed media files:', cleanupError);
      }

      logger.info(`Media removed from comment: ${id} by user: ${userId}`);
      success(res, updatedComment, 'Media removed from comment successfully');
    } catch (error) {
      logger.error('Error removing media from comment:', error);
      internalError(res, 'Failed to remove media from comment');
    }
  };
}
