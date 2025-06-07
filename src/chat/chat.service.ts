import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUtil } from '../common/utils/jwt.util';
import { LoggerUtil } from '../common/utils/logger.util';
import { CreateConversationDto } from './dto/chat.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ConversationType, MessageType, ReactionType } from '@prisma/client';

@Injectable()
export class ChatService {
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private userSockets: Map<string, Socket> = new Map(); // socketId -> Socket
  private conversationRooms: Map<string, Set<string>> = new Map(); // conversationId -> Set<socketId>

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtUtil: JwtUtil,
  ) {}

  async validateSocketConnection(client: Socket): Promise<string | null> {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = await this.jwtUtil.verifyAccessToken(token);
      if (!payload) {
        throw new UnauthorizedException('Invalid token');
      }

      return payload.userId;
    } catch (error) {
      LoggerUtil.error(
        'Socket validation error:',
        error.message,
        'ChatService',
      );
      return null;
    }
  }

  async userConnected(userId: string, client: Socket) {
    this.connectedUsers.set(userId, client.id);
    this.userSockets.set(client.id, client);
  }

  async userDisconnected(userId: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.connectedUsers.delete(userId);
      this.userSockets.delete(socketId);
      // purge from all rooms
      for (const [, members] of this.conversationRooms) {
        members.delete(socketId);
      }
    }
  }

  async getConversations(userId: string, paginationDto: PaginationDto) {
    const { limit = 20, cursor } = paginationDto;

    const conversations = await this.prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        lastMessage: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit + 1,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1,
      }),
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, -1) : conversations;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        lastMessage: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getMessages(
    userId: string,
    conversationId: string,
    paginationDto: PaginationDto,
  ) {
    const { limit = 20, cursor } = paginationDto;

    // Verify user is a member
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('Not a member of this conversation');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(cursor && {
        cursor: {
          id: cursor,
        },
        skip: 1,
      }),
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async createConversation(userId: string, data: CreateConversationDto) {
    const { userIds, type, name } = data;

    // Validate user IDs
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (users.length !== userIds.length) {
      throw new NotFoundException('One or more users not found');
    }

    // Create conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        name: type === ConversationType.GROUP ? name : undefined,
        members: {
          create: userIds.map((id) => ({
            user: {
              connect: {
                id,
              },
            },
            role: id === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  async addMember(userId: string, conversationId: string, newUserId: string) {
    // Verify conversation exists and user is admin
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId,
            role: 'ADMIN',
            leftAt: null,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or user is not admin',
      );
    }

    // Verify new user exists
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
    });

    if (!newUser) {
      throw new NotFoundException('User not found');
    }

    // Add member
    await this.prisma.conversationMember.create({
      data: {
        conversationId,
        userId: newUserId,
        role: 'MEMBER',
      },
    });

    return { message: 'Member added successfully' };
  }

  async joinConversation(
    userId: string,
    conversationId: string,
    client: Socket,
  ) {
    // Verify user is a member of the conversation
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('Not a member of this conversation');
    }

    // Join socket room
    client.join(conversationId);

    // Track room membership
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set());
    }
    this.conversationRooms.get(conversationId)?.add(client.id);

    // Get unread messages
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        createdAt: {
          gt: member.lastReadAt || new Date(0),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return unreadMessages;
  }

  async leaveConversation(
    userId: string,
    conversationId: string,
    client?: Socket,
  ) {
    // Verify conversation exists and user is a member
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or user is not a member',
      );
    }

    // Remove user from conversation
    await this.prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    // If this is a WebSocket request, handle socket room
    if (client) {
      const room = this.conversationRooms.get(conversationId);
      if (room) {
        room.delete(client.id);
        if (room.size === 0) {
          this.conversationRooms.delete(conversationId);
        }
      }
      client.leave(conversationId);
    }

    // Notify other members
    const room = this.conversationRooms.get(conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit('memberLeft', {
            conversationId,
            userId,
          });
        }
      }
    }

    return { success: true };
  }

  async sendMessage(
    userId: string,
    data: { conversationId: string; content: string; type: MessageType },
  ) {
    const { conversationId, content, type } = data;

    // Verify user is a member
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('Not a member of this conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        messageType: type,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Update conversation last message
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
        lastMessageText: message.content,
      },
    });

    // Emit to all members in the conversation
    const room = this.conversationRooms.get(conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit('newMessage', message);
        }
      }
    }

    return message;
  }

  async handleTyping(
    userId: string,
    conversationId: string,
    isTyping: boolean,
  ) {
    const room = this.conversationRooms.get(conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket && socket.id !== this.connectedUsers.get(userId)) {
          socket.emit('userTyping', { userId, isTyping });
        }
      }
    }
  }

  async markMessagesAsRead(
    userId: string,
    conversationId: string,
    messageIds: string[],
  ) {
    // Update last read message
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
        lastReadMessageId: messageIds[messageIds.length - 1],
      },
    });

    // Notify other members
    const room = this.conversationRooms.get(conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket && socket.id !== this.connectedUsers.get(userId)) {
          socket.emit('messagesRead', { userId, messageIds });
        }
      }
    }
  }

  async editMessage(userId: string, messageId: string, content: string) {
    // Verify message exists and user is the sender
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
      },
    });

    if (!message) {
      throw new NotFoundException(
        'Message not found or you are not the sender',
      );
    }

    // Update message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Emit to all members in the conversation
    const room = this.conversationRooms.get(message.conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit('messageEdited', updatedMessage);
        }
      }
    }

    return updatedMessage;
  }

  async deleteMessage(userId: string, messageId: string) {
    // Verify message exists and user is the sender
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
      },
    });

    if (!message) {
      throw new NotFoundException(
        'Message not found or you are not the sender',
      );
    }

    // Soft delete message
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: 'This message was deleted',
      },
    });

    // Emit to all members in the conversation
    const room = this.conversationRooms.get(message.conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit('messageDeleted', { messageId });
        }
      }
    }
  }

  async addReaction(userId: string, messageId: string, type: string) {
    // Verify message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Create or update reaction
    const reaction = await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      update: {
        type,
      },
      create: {
        messageId,
        userId,
        type,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Emit to all members in the conversation
    const room = this.conversationRooms.get(message.conversationId);
    if (room) {
      for (const socketId of room) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit('reactionAdded', { messageId, reaction });
        }
      }
    }

    return reaction;
  }

  async removeReaction(userId: string, messageId: string, reactionId: string) {
    // Verify reaction exists and belongs to user
    const reaction = await this.prisma.messageReaction.findFirst({
      where: {
        id: reactionId,
        userId,
        messageId,
      },
    });

    if (!reaction) {
      throw new NotFoundException(
        'Reaction not found or you are not the owner',
      );
    }

    // Delete reaction
    await this.prisma.messageReaction.delete({
      where: { id: reactionId },
    });

    // Emit to all members in the conversation
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (message) {
      const room = this.conversationRooms.get(message.conversationId);
      if (room) {
        for (const socketId of room) {
          const socket = this.userSockets.get(socketId);
          if (socket) {
            socket.emit('reactionRemoved', { messageId, reactionId });
          }
        }
      }
    }
  }
}
