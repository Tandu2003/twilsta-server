import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { LoggerUtil } from '../common/utils/logger.util';
import { MessageType } from '@prisma/client';
import { SendMessageDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    try {
      const userId = await this.chatService.validateSocketConnection(client);
      if (userId) {
        client.data.userId = userId;
        await this.chatService.userConnected(userId, client);
        // Broadcast user online status
        this.server.emit('userStatus', { userId, status: 'online' });
        LoggerUtil.log(`User ${userId} connected to chat`, 'ChatGateway');
      } else {
        client.disconnect();
      }
    } catch (error) {
      LoggerUtil.error(
        'Socket connection error:',
        error.message,
        'ChatGateway',
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      await this.chatService.userDisconnected(client.data.userId);
      // Broadcast user offline status
      this.server.emit('userStatus', {
        userId: client.data.userId,
        status: 'offline',
      });
      LoggerUtil.log(
        `User ${client.data.userId} disconnected from chat`,
        'ChatGateway',
      );
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.joinConversation(userId, conversationId, client);
      return { success: true };
    } catch (error) {
      LoggerUtil.error(
        'Join conversation error:',
        error.message,
        'ChatGateway',
      );
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.leaveConversation(userId, conversationId, client);
      return { success: true };
    } catch (error) {
      LoggerUtil.error(
        'Leave conversation error:',
        error.message,
        'ChatGateway',
      );
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ transform: true }))
    data: SendMessageDto & { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;
      const message = await this.chatService.sendMessage(userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type as MessageType,
      });
      return { success: true, message };
    } catch (error) {
      LoggerUtil.error('Send message error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    try {
      const userId = client.data.userId;
      const message = await this.chatService.editMessage(
        userId,
        data.messageId,
        data.content,
      );
      return { success: true, message };
    } catch (error) {
      LoggerUtil.error('Edit message error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.deleteMessage(userId, data.messageId);
      return { success: true };
    } catch (error) {
      LoggerUtil.error('Delete message error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('addReaction')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; type: string },
  ) {
    try {
      const userId = client.data.userId;
      const reaction = await this.chatService.addReaction(
        userId,
        data.messageId,
        data.type,
      );
      return { success: true, reaction };
    } catch (error) {
      LoggerUtil.error('Add reaction error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('removeReaction')
  async handleRemoveReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; reactionId: string },
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.removeReaction(
        userId,
        data.messageId,
        data.reactionId,
      );
      return { success: true };
    } catch (error) {
      LoggerUtil.error('Remove reaction error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.handleTyping(
        userId,
        data.conversationId,
        data.isTyping,
      );
      return { success: true };
    } catch (error) {
      LoggerUtil.error('Typing event error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('readMessages')
  async handleReadMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageIds: string[] },
  ) {
    try {
      const userId = client.data.userId;
      await this.chatService.markMessagesAsRead(
        userId,
        data.conversationId,
        data.messageIds,
      );
      return { success: true };
    } catch (error) {
      LoggerUtil.error('Read messages error:', error.message, 'ChatGateway');
      return { success: false, error: error.message };
    }
  }
}
