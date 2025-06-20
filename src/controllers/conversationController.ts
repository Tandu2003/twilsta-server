import { Request, Response } from 'express';
import { PrismaClient, ConversationType, ParticipantRole } from '@prisma/client';
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
 * Conversation Controller with realtime features and Cloudinary integration
 */
export class ConversationController {
  /**
   * Get user's conversations with pagination
   */
  static getConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Get user's conversations with participants and last message
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
        include: {
          participants: {
            where: {
              isActive: true,
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
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
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
          },
          _count: {
            select: {
              messages: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
        skip,
        take: limit,
      });

      // Get unread message counts for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conversation) => {
          const participant = conversation.participants.find((p) => p.userId === userId);

          const unreadCount = await prisma.conversationMessage.count({
            where: {
              conversationId: conversation.id,
              createdAt: {
                gt: participant?.lastReadAt || new Date(0),
              },
              senderId: {
                not: userId, // Don't count own messages
              },
              isDeleted: false,
            },
          });

          return {
            ...conversation,
            unreadCount,
            currentUserRole: participant?.role || 'MEMBER',
          };
        }),
      );

      // Get total count
      const total = await prisma.conversation.count({
        where: {
          participants: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(total / limit);

      success(
        res,
        {
          conversations: conversationsWithUnread,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            limit,
          },
        },
        'Conversations retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting conversations:', error);
      internalError(res, 'Failed to get conversations');
    }
  };

  /**
   * Get a specific conversation details
   */
  static getConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user is participant
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

      // Get conversation details
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            where: {
              isActive: true,
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
          },
        },
      });

      if (!conversation) {
        notFound(res, 'Conversation not found');
        return;
      }

      success(
        res,
        {
          ...conversation,
          currentUserRole: participant.role,
        },
        'Conversation retrieved successfully',
      );
    } catch (error) {
      logger.error('Error getting conversation:', error);
      internalError(res, 'Failed to get conversation');
    }
  };

  /**
   * Create a new conversation (direct or group)
   */
  static createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { participantIds, type = 'DIRECT', name, description } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        badRequest(res, 'Participant IDs are required');
        return;
      }

      // Validate conversation type
      if (type === 'DIRECT' && participantIds.length !== 1) {
        badRequest(res, 'Direct conversations must have exactly one other participant');
        return;
      }

      if (type === 'GROUP' && participantIds.length < 2) {
        badRequest(res, 'Group conversations must have at least 2 other participants');
        return;
      }

      // Check if direct conversation already exists
      if (type === 'DIRECT') {
        const existingConversation = await prisma.conversation.findFirst({
          where: {
            type: 'DIRECT',
            participants: {
              every: {
                userId: {
                  in: [userId, participantIds[0]],
                },
                isActive: true,
              },
            },
          },
          include: {
            participants: {
              where: {
                isActive: true,
              },
            },
          },
        });

        if (existingConversation && existingConversation.participants.length === 2) {
          success(res, existingConversation, 'Direct conversation already exists');
          return;
        }
      }

      // Verify all participants exist
      const participants = await prisma.user.findMany({
        where: {
          id: {
            in: participantIds,
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      });

      if (participants.length !== participantIds.length) {
        badRequest(res, 'Some participants do not exist');
        return;
      }

      // Handle avatar upload for group conversations
      let avatarUrl: string | null = null;
      if (req.file && type === 'GROUP') {
        try {
          const result = await cloudinaryService.uploadFile(
            req.file,
            'conversations/avatars',
            'image',
          );
          avatarUrl = result.secure_url;
        } catch (uploadError) {
          logger.error('Error uploading conversation avatar:', uploadError);
          badRequest(res, 'Failed to upload avatar');
          return;
        }
      }

      // Create conversation
      const newConversation = await prisma.conversation.create({
        data: {
          type: type as ConversationType,
          isGroup: type === 'GROUP',
          name: type === 'GROUP' ? name : null,
          description: type === 'GROUP' ? description : null,
          avatar: avatarUrl,
          participants: {
            create: [
              // Creator as admin for group conversations
              {
                userId,
                role: type === 'GROUP' ? 'ADMIN' : 'MEMBER',
              },
              // Other participants as members
              ...participantIds.map((participantId: string) => ({
                userId: participantId,
                role: 'MEMBER' as ParticipantRole,
              })),
            ],
          },
        },
        include: {
          participants: {
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
          },
        },
      });

      // Broadcast conversation creation to all participants
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastConversationUpdate(newConversation);
      }

      logger.info(`New conversation created: ${newConversation.id} by user: ${userId}`);
      created(res, newConversation, 'Conversation created successfully');
    } catch (error) {
      logger.error('Error creating conversation:', error);
      internalError(res, 'Failed to create conversation');
    }
  };

  /**
   * Update conversation (name, description, avatar for groups)
   */
  static updateConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { name, description } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user is admin of group conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
        include: {
          conversation: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      if (!participant.conversation.isGroup) {
        badRequest(res, 'Cannot update direct conversations');
        return;
      }

      if (participant.role !== 'ADMIN') {
        unauthorized(res, 'Only admins can update group conversations');
        return;
      }

      // Handle avatar update
      let avatarUrl: string | undefined;
      if (req.file) {
        try {
          // Delete old avatar if exists
          if (participant.conversation.avatar) {
            const publicId = cloudinaryService.extractPublicIdFromUrl(
              participant.conversation.avatar,
            );
            await cloudinaryService.deleteFile(publicId);
          }

          // Upload new avatar
          const result = await cloudinaryService.uploadFile(
            req.file,
            'conversations/avatars',
            'image',
          );
          avatarUrl = result.secure_url;
        } catch (uploadError) {
          logger.error('Error uploading conversation avatar:', uploadError);
          badRequest(res, 'Failed to upload avatar');
          return;
        }
      }

      // Update conversation
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          name: name || undefined,
          description: description || undefined,
          avatar: avatarUrl,
          updatedAt: new Date(),
        },
        include: {
          participants: {
            where: {
              isActive: true,
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
          },
        },
      });

      // Broadcast conversation update
      const realtimeService = getRealtimeService();
      if (realtimeService) {
        realtimeService.broadcastConversationUpdate(updatedConversation);
      }

      logger.info(`Conversation updated: ${conversationId} by user: ${userId}`);
      success(res, updatedConversation, 'Conversation updated successfully');
    } catch (error) {
      logger.error('Error updating conversation:', error);
      internalError(res, 'Failed to update conversation');
    }
  };

  /**
   * Add participants to group conversation
   */
  static addParticipants = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { participantIds } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        badRequest(res, 'Participant IDs are required');
        return;
      }

      // Verify user permissions
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
        include: {
          conversation: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      if (!participant.conversation.isGroup) {
        badRequest(res, 'Cannot add participants to direct conversations');
        return;
      }

      // Check permissions (admin or if group allows member add)
      if (participant.role !== 'ADMIN' && !participant.conversation.allowMemberAdd) {
        unauthorized(res, 'You do not have permission to add participants');
        return;
      }

      // Verify new participants exist and are not already in conversation
      const existingParticipants = await prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: {
            in: participantIds,
          },
          isActive: true,
        },
        select: {
          userId: true,
        },
      });

      const existingUserIds = existingParticipants.map((p) => p.userId);
      const newParticipantIds = participantIds.filter(
        (id: string) => !existingUserIds.includes(id),
      );

      if (newParticipantIds.length === 0) {
        badRequest(res, 'All specified users are already participants');
        return;
      }

      // Verify users exist
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: newParticipantIds,
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      });

      if (users.length !== newParticipantIds.length) {
        badRequest(res, 'Some users do not exist');
        return;
      }

      // Add new participants
      await prisma.conversationParticipant.createMany({
        data: newParticipantIds.map((participantId: string) => ({
          conversationId,
          userId: participantId,
          role: 'MEMBER' as ParticipantRole,
        })),
      });

      // Get updated conversation
      const updatedConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            where: {
              isActive: true,
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
          },
        },
      });

      // Broadcast conversation update
      const realtimeService = getRealtimeService();
      if (realtimeService && updatedConversation) {
        realtimeService.broadcastConversationUpdate(updatedConversation);
      }

      logger.info(`Participants added to conversation: ${conversationId} by user: ${userId}`);
      success(res, updatedConversation, 'Participants added successfully');
    } catch (error) {
      logger.error('Error adding participants:', error);
      internalError(res, 'Failed to add participants');
    }
  };

  /**
   * Remove participant from group conversation
   */
  static removeParticipant = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId, participantId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user permissions
      const requestor = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
        include: {
          conversation: true,
        },
      });

      if (!requestor) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      if (!requestor.conversation.isGroup) {
        badRequest(res, 'Cannot remove participants from direct conversations');
        return;
      }

      // Check if removing self or if admin
      const isSelfRemoval = participantId === userId;
      if (!isSelfRemoval && requestor.role !== 'ADMIN') {
        unauthorized(res, 'Only admins can remove other participants');
        return;
      }

      // Find participant to remove
      const targetParticipant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId: participantId,
          isActive: true,
        },
      });

      if (!targetParticipant) {
        notFound(res, 'Participant not found in conversation');
        return;
      }

      // Prevent removing the last admin
      if (targetParticipant.role === 'ADMIN') {
        const adminCount = await prisma.conversationParticipant.count({
          where: {
            conversationId,
            role: 'ADMIN',
            isActive: true,
          },
        });

        if (adminCount === 1) {
          badRequest(res, 'Cannot remove the last admin from group conversation');
          return;
        }
      }

      // Remove participant (soft delete)
      await prisma.conversationParticipant.update({
        where: { id: targetParticipant.id },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });

      // Get updated conversation
      const updatedConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            where: {
              isActive: true,
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
          },
        },
      });

      // Broadcast conversation update
      const realtimeService = getRealtimeService();
      if (realtimeService && updatedConversation) {
        realtimeService.broadcastConversationUpdate(updatedConversation);
      }

      logger.info(`Participant removed from conversation: ${conversationId} by user: ${userId}`);
      success(res, updatedConversation, 'Participant removed successfully');
    } catch (error) {
      logger.error('Error removing participant:', error);
      internalError(res, 'Failed to remove participant');
    }
  };

  /**
   * Leave a conversation
   */
  static leaveConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Use the removeParticipant logic for self-removal
      req.params.participantId = userId;
      await ConversationController.removeParticipant(req, res);
    } catch (error) {
      logger.error('Error leaving conversation:', error);
      internalError(res, 'Failed to leave conversation');
    }
  };

  /**
   * Delete a conversation (admin only for groups, any participant for direct)
   */
  static deleteConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        unauthorized(res, 'Authentication required');
        return;
      }

      // Verify user permissions
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
          isActive: true,
        },
        include: {
          conversation: true,
        },
      });

      if (!participant) {
        unauthorized(res, 'You are not a participant in this conversation');
        return;
      }

      // Check permissions
      if (participant.conversation.isGroup && participant.role !== 'ADMIN') {
        unauthorized(res, 'Only admins can delete group conversations');
        return;
      }

      // Get conversation details for cleanup
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            select: {
              imageUrl: true,
              videoUrl: true,
              audioUrl: true,
              fileUrl: true,
              thumbnailUrl: true,
            },
          },
        },
      });

      if (!conversation) {
        notFound(res, 'Conversation not found');
        return;
      }

      // Collect all media URLs for cleanup
      const mediaUrls: string[] = [];

      // Add conversation avatar
      if (conversation.avatar) {
        mediaUrls.push(conversation.avatar);
      }

      // Add message media
      conversation.messages.forEach((message) => {
        if (message.imageUrl) mediaUrls.push(message.imageUrl);
        if (message.videoUrl) mediaUrls.push(message.videoUrl);
        if (message.audioUrl) mediaUrls.push(message.audioUrl);
        if (message.fileUrl) mediaUrls.push(message.fileUrl);
        if (message.thumbnailUrl) mediaUrls.push(message.thumbnailUrl);
      });

      // Delete conversation (cascades to messages and participants)
      await prisma.conversation.delete({
        where: { id: conversationId },
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
          logger.warn('Failed to cleanup conversation media files:', cleanupError);
          // Don't fail the request if cleanup fails
        }
      }

      logger.info(`Conversation deleted: ${conversationId} by user: ${userId}`);
      success(res, null, 'Conversation deleted successfully');
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      internalError(res, 'Failed to delete conversation');
    }
  };
}

export default ConversationController;
