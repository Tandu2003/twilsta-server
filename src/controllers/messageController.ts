import { Request, Response } from 'express';
import { PrismaClient, MessageType } from '@prisma/client';
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
import { getRealtimeService } from '../services/realtimeInstance';

const prisma = new PrismaClient();

/**
 * Message Controller with Cloudinary integration and realtime features
 */
export class MessageController {
  /**
   * Get conversation messages with pagination
   */
  static getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      // Get messages with pagination
      const messages = await prisma.conversationMessage.findMany({
        where: {
          conversationId,
          isDeleted: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              verified: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      // Get total count
      const total = await prisma.conversationMessage.count({
        where: {
          conversationId,
          isDeleted: false,
        },
      });

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      success(
        res,
        {
          messages: messages.reverse(), // Reverse to show oldest first
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            hasNextPage,
            hasPrevPage,
            limit,
          },
        },
        'Messages retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting messages:', error);
      internalError(res, 'Failed to get messages');
    }
  };

  /**
   * Send a new message
   */
  static sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { content, type = 'TEXT', replyToId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      // Get conversation details for permission checks
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        notFound(res, 'Conversation not found');
        return;
      }

      // Check if only admins can message in group
      if (
        conversation.isGroup &&
        conversation.onlyAdminsCanMessage &&
        participant.role === 'MEMBER'
      ) {
        unauthorized(res, 'Only admins can send messages in this group');
        return;
      }

      // Validate reply message if replyToId is provided
      let replyToMessage = null;
      if (replyToId) {
        replyToMessage = await prisma.conversationMessage.findFirst({
          where: {
            id: replyToId,
            conversationId,
            isDeleted: false,
          },
        });

        if (!replyToMessage) {
          badRequest(res, 'Reply message not found or deleted');
          return;
        }
      }

      // Determine message type and handle media upload
      let messageType: MessageType = type;
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileMimeType: string | null = null;
      let mediaDuration: number | null = null;
      let thumbnailUrl: string | null = null;

      // Handle file upload if present
      if (req.file) {
        try {
          const file = req.file;
          fileName = file.originalname;
          fileSize = file.size;
          fileMimeType = file.mimetype;

          if (file.mimetype.startsWith('image/')) {
            messageType = 'IMAGE';
            const result = await cloudinaryService.uploadFile(
              file,
              `messages/${conversationId}/images`,
              'image',
            );
            imageUrl = result.secure_url;
          } else if (file.mimetype.startsWith('video/')) {
            messageType = 'VIDEO';
            const result = await cloudinaryService.uploadFile(
              file,
              `messages/${conversationId}/videos`,
              'video',
            );
            videoUrl = result.secure_url;
            if (result.duration) {
              mediaDuration = Math.round(result.duration);
            }
            // Generate thumbnail for video
            if (result.public_id) {
              thumbnailUrl = cloudinaryService.generateVideoThumbnail(
                result.public_id,
              );
            }
          } else if (file.mimetype.startsWith('audio/')) {
            messageType = 'AUDIO';
            const result = await cloudinaryService.uploadFile(
              file,
              `messages/${conversationId}/audio`,
              'video', // Use video for audio to get duration
            );
            audioUrl = result.secure_url;
            if (result.duration) {
              mediaDuration = Math.round(result.duration);
            }
          } else {
            messageType = 'FILE';
            const result = await cloudinaryService.uploadFile(
              file,
              `messages/${conversationId}/files`,
              'raw',
            );
            fileUrl = result.secure_url;
          }
        } catch (uploadError) {
          logger.error('Error uploading message file:', uploadError);
          badRequest(res, 'Failed to upload file');
          return;
        }
      }

      // Validate content or media
      if (!content && !imageUrl && !videoUrl && !audioUrl && !fileUrl) {
        badRequest(res, 'Message must have content or media attachment');
        return;
      }

      // Create message
      const newMessage = await prisma.conversationMessage.create({
        data: {
          conversationId,
          senderId: userId,
          content: content || null,
          type: messageType,
          imageUrl,
          videoUrl,
          audioUrl,
          fileUrl,
          fileName,
          fileSize,
          fileMimeType,
          mediaDuration,
          thumbnailUrl,
          replyToId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              verified: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      // Update conversation's last message info
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: newMessage.id,
          lastMessageContent: content || `[${messageType}]`,
          lastMessageAt: newMessage.createdAt,
          lastMessageSender: userId,
          updatedAt: new Date(),
        },
      });

      // Update participant's last read timestamp
      await prisma.conversationParticipant.update({
        where: {
          id: participant.id,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      // Broadcast new message via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastNewMessage(conversationId, newMessage);
      }

      logger.info(`New message sent: ${newMessage.id} by user: ${userId}`);
      created(res, newMessage, 'Message sent successfully');
    } catch (error) {
      logger.error('Error sending message:', error);
      internalError(res, 'Failed to send message');
    }
  };

  /**
   * Edit a message
   */
  static editMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      if (!content || content.trim().length === 0) {
        badRequest(res, 'Content is required for editing message');
        return;
      }

      // Find message and verify ownership
      const message = await prisma.conversationMessage.findUnique({
        where: { id: messageId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      });

      if (!message) {
        notFound(res, 'Message not found');
        return;
      }

      if (message.senderId !== userId) {
        unauthorized(res, 'You can only edit your own messages');
        return;
      }

      if (message.isDeleted) {
        badRequest(res, 'Cannot edit deleted message');
        return;
      }

      // Only allow editing text messages
      if (message.type !== 'TEXT') {
        badRequest(res, 'Only text messages can be edited');
        return;
      }

      // Update message
      const updatedMessage = await prisma.conversationMessage.update({
        where: { id: messageId },
        data: {
          content,
          isEdited: true,
          editedAt: new Date(),
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              verified: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      // Broadcast message update via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastMessageUpdate(
          message.conversationId,
          updatedMessage,
        );
      }

      logger.info(`Message edited: ${messageId} by user: ${userId}`);
      success(res, updatedMessage, 'Message updated successfully');
    } catch (error) {
      logger.error('Error editing message:', error);
      internalError(res, 'Failed to edit message');
    }
  };

  /**
   * Delete a message
   */
  static deleteMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { messageId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Find message and verify ownership
      const message = await prisma.conversationMessage.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        notFound(res, 'Message not found');
        return;
      }

      if (message.senderId !== userId) {
        unauthorized(res, 'You can only delete your own messages');
        return;
      }

      // Collect media URLs for cleanup
      const mediaUrls: string[] = [];
      if (message.imageUrl) mediaUrls.push(message.imageUrl);
      if (message.videoUrl) mediaUrls.push(message.videoUrl);
      if (message.audioUrl) mediaUrls.push(message.audioUrl);
      if (message.fileUrl) mediaUrls.push(message.fileUrl);
      if (message.thumbnailUrl) mediaUrls.push(message.thumbnailUrl);

      // Soft delete message
      await prisma.conversationMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: null, // Clear content for privacy
        },
      });

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
          logger.warn('Failed to cleanup message media files:', cleanupError);
          // Don't fail the request if cleanup fails
        }
      }

      // Broadcast message deletion via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastMessageDelete(
          message.conversationId,
          messageId,
          userId,
        );
      }

      logger.info(`Message deleted: ${messageId} by user: ${userId}`);
      success(res, null, 'Message deleted successfully');
    } catch (error) {
      logger.error('Error deleting message:', error);
      internalError(res, 'Failed to delete message');
    }
  };

  /**
   * React to a message (emoji reactions)
   */
  static reactToMessage = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      if (!emoji || emoji.trim().length === 0) {
        badRequest(res, 'Emoji is required');
        return;
      }

      // Verify message exists and user has access
      const message = await prisma.conversationMessage.findFirst({
        where: {
          id: messageId,
          isDeleted: false,
          conversation: {
            participants: {
              some: {
                userId,
                isActive: true,
              },
            },
          },
        },
      });

      if (!message) {
        notFound(res, 'Message not found or you do not have access');
        return;
      }

      // Check if user already reacted with this emoji
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji: emoji.trim(),
          },
        },
      });

      let reactionData;
      let action: 'added' | 'removed';

      if (existingReaction) {
        // Remove reaction
        await prisma.messageReaction.delete({
          where: { id: existingReaction.id },
        });
        action = 'removed';
        reactionData = { emoji, action };
      } else {
        // Add reaction
        const newReaction = await prisma.messageReaction.create({
          data: {
            messageId,
            userId,
            emoji: emoji.trim(),
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        });
        action = 'added';
        reactionData = { ...newReaction, action };
      }

      // Broadcast reaction via Socket.IO
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastMessageReaction(
          message.conversationId,
          messageId,
          reactionData,
        );
      }

      logger.info(
        `Message reaction ${action}: ${messageId} by user: ${userId} with emoji: ${emoji}`,
      );
      success(res, reactionData, `Reaction ${action} successfully`);
    } catch (error) {
      logger.error('Error reacting to message:', error);
      internalError(res, 'Failed to react to message');
    }
  };

  /**
   * Mark messages as read
   */
  static markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { messageId } = req.body; // Optional: mark up to specific message
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user is participant in conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      let targetMessage;
      if (messageId) {
        // Mark up to specific message
        targetMessage = await prisma.conversationMessage.findFirst({
          where: {
            id: messageId,
            conversationId,
            isDeleted: false,
          },
        });

        if (!targetMessage) {
          badRequest(res, 'Target message not found');
          return;
        }
      } else {
        // Mark all messages as read (get latest message)
        targetMessage = await prisma.conversationMessage.findFirst({
          where: {
            conversationId,
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }

      if (targetMessage) {
        // Create read receipts for messages up to target message
        const messagesToMarkRead = await prisma.conversationMessage.findMany({
          where: {
            conversationId,
            createdAt: {
              lte: targetMessage.createdAt,
            },
            senderId: {
              not: userId, // Don't mark own messages
            },
            isDeleted: false,
            readReceipts: {
              none: {
                userId,
              },
            },
          },
          select: {
            id: true,
          },
        });

        // Batch create read receipts
        if (messagesToMarkRead.length > 0) {
          await prisma.messageReadReceipt.createMany({
            data: messagesToMarkRead.map((msg) => ({
              messageId: msg.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        // Update participant's last read timestamp
        await prisma.conversationParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            lastReadAt: new Date(),
          },
        });

        // Broadcast read receipt via Socket.IO
        const realtimeService = getRealtimeService();
        if (realtimeService) {
          realtimeService.broadcastMessageRead(
            conversationId,
            userId,
            targetMessage.id,
          );
        }
      }

      logger.info(
        `Messages marked as read in conversation: ${conversationId} by user: ${userId}`,
      );
      success(res, null, 'Messages marked as read');
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      internalError(res, 'Failed to mark messages as read');
    }
  };
}

export default MessageController;
