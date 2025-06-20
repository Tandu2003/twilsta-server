import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

class RealtimeService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('🔌 Socket.IO realtime service initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          logger.warn('Socket connection attempted without token');
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

        // Get user info from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            verified: true,
          },
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.username = user.username;

        logger.info(`User authenticated via socket: ${user.username} (${user.id})`);
        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
      this.handleDisconnection(socket);
      this.handlePostEvents(socket);
      this.handleCommentEvents(socket);
      this.handleMessageEvents(socket);
      this.handleConversationEvents(socket);
      this.handleUserEvents(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    // Track connected user
    if (!this.connectedUsers.has(socket.userId)) {
      this.connectedUsers.set(socket.userId, new Set());
    }
    this.connectedUsers.get(socket.userId)!.add(socket.id);
    this.socketToUser.set(socket.id, socket.userId);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join global activity room
    socket.join('global:activity');

    logger.info(`User connected: ${socket.username} (${socket.userId}) - Socket: ${socket.id}`);

    // Notify about online status
    this.broadcastUserStatus(socket.userId, 'online');

    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date(),
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    socket.on('disconnect', () => {
      if (!socket.userId) return;

      // Remove from tracking
      const userSockets = this.connectedUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(socket.userId);
          // User is completely offline
          this.broadcastUserStatus(socket.userId, 'offline');
        }
      }
      this.socketToUser.delete(socket.id);

      logger.info(
        `User disconnected: ${socket.username} (${socket.userId}) - Socket: ${socket.id}`,
      );
    });
  }

  private handlePostEvents(socket: AuthenticatedSocket): void {
    // Join/leave post rooms for real-time updates
    socket.on('join:post', (postId: string) => {
      socket.join(`post:${postId}`);
      logger.debug(`User ${socket.username} joined post room: ${postId}`);
    });

    socket.on('leave:post', (postId: string) => {
      socket.leave(`post:${postId}`);
      logger.debug(`User ${socket.username} left post room: ${postId}`);
    });

    // Handle typing indicators for post comments
    socket.on('post:typing', ({ postId, isTyping }: { postId: string; isTyping: boolean }) => {
      socket.broadcast.to(`post:${postId}`).emit('user:typing', {
        userId: socket.userId,
        username: socket.username,
        postId,
        isTyping,
        timestamp: new Date(),
      });
    });
  }

  private handleCommentEvents(socket: AuthenticatedSocket): void {
    // Join/leave comment rooms for replies
    socket.on('join:comment', (commentId: string) => {
      socket.join(`comment:${commentId}`);
      logger.debug(`User ${socket.username} joined comment room: ${commentId}`);
    });

    socket.on('leave:comment', (commentId: string) => {
      socket.leave(`comment:${commentId}`);
      logger.debug(`User ${socket.username} left comment room: ${commentId}`);
    });

    // Handle typing indicators for comment replies
    socket.on(
      'comment:typing',
      ({ commentId, isTyping }: { commentId: string; isTyping: boolean }) => {
        socket.broadcast.to(`comment:${commentId}`).emit('user:typing', {
          userId: socket.userId,
          username: socket.username,
          commentId,
          isTyping,
          timestamp: new Date(),
        });
      },
    );
  }

  private handleMessageEvents(socket: AuthenticatedSocket): void {
    // Join conversation room
    socket.on('join:conversation', (data: { conversationId: string }) => {
      socket.join(`conversation:${data.conversationId}`);
      logger.info(`User ${socket.username} joined conversation: ${data.conversationId}`);
    });

    // Leave conversation room
    socket.on('leave:conversation', (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`);
      logger.info(`User ${socket.username} left conversation: ${data.conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.broadcast.to(`conversation:${data.conversationId}`).emit('user:typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId,
        isTyping: true,
        timestamp: new Date(),
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.broadcast.to(`conversation:${data.conversationId}`).emit('user:typing', {
        userId: socket.userId,
        username: socket.username,
        conversationId: data.conversationId,
        isTyping: false,
        timestamp: new Date(),
      });
    });
  }

  private handleConversationEvents(socket: AuthenticatedSocket): void {
    // Join user's conversations on connect
    socket.on('join:conversations', async () => {
      try {
        // Get user's active conversations
        const conversations = await prisma.conversationParticipant.findMany({
          where: {
            userId: socket.userId,
            isActive: true,
          },
          select: {
            conversationId: true,
          },
        });

        // Join all conversation rooms
        conversations.forEach((conv) => {
          socket.join(`conversation:${conv.conversationId}`);
        });

        logger.info(`User ${socket.username} joined ${conversations.length} conversation rooms`);
      } catch (error) {
        logger.error('Error joining conversations:', error);
      }
    });

    // Handle conversation creation notification
    socket.on('conversation:created', (data: { conversation: any }) => {
      // Notify all participants
      data.conversation.participants?.forEach((participant: any) => {
        this.io.to(`user:${participant.userId}`).emit('conversation:created', {
          conversation: data.conversation,
          timestamp: new Date(),
        });
      });
    });
  }

  private handleUserEvents(socket: AuthenticatedSocket): void {
    // Handle user status updates
    socket.on('user:status', (status: 'online' | 'away' | 'busy') => {
      this.broadcastUserStatus(socket.userId!, status);
    });

    // Handle user activity updates
    socket.on('user:activity', (activity: any) => {
      socket.broadcast.to('global:activity').emit('user:activity', {
        userId: socket.userId,
        username: socket.username,
        activity,
        timestamp: new Date(),
      });
    });
  }

  private broadcastUserStatus(
    userId: string,
    status: 'online' | 'offline' | 'away' | 'busy',
  ): void {
    this.io.emit('user:status', {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  // Public methods for controllers to emit events

  /**
   * Broadcast new post to all connected users
   */
  public broadcastNewPost(post: any): void {
    this.io.to('global:activity').emit('post:created', {
      post,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted new post: ${post.id} by ${post.author.username}`);
  }

  /**
   * Broadcast post update to users in post room
   */
  public broadcastPostUpdate(postId: string, post: any): void {
    this.io.to(`post:${postId}`).emit('post:updated', {
      post,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted post update: ${postId}`);
  }

  /**
   * Broadcast post deletion to users in post room
   */
  public broadcastPostDelete(postId: string, authorId: string): void {
    this.io.to(`post:${postId}`).emit('post:deleted', {
      postId,
      authorId,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted post deletion: ${postId}`);
  }

  /**
   * Broadcast new like to post room and post author
   */
  public broadcastPostLike(postId: string, like: any): void {
    // Notify users in post room
    this.io.to(`post:${postId}`).emit('post:liked', {
      postId,
      like,
      timestamp: new Date(),
    });

    // Notify post author specifically
    this.io.to(`user:${like.post.authorId}`).emit('notification:like', {
      type: 'post_like',
      postId,
      user: like.user,
      timestamp: new Date(),
    });

    logger.info(`Broadcasted post like: ${postId} by ${like.user.username}`);
  }

  /**
   * Broadcast like removal
   */
  public broadcastPostUnlike(postId: string, userId: string, authorId: string): void {
    this.io.to(`post:${postId}`).emit('post:unliked', {
      postId,
      userId,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted post unlike: ${postId} by ${userId}`);
  }

  /**
   * Broadcast new comment to post room and post author
   */
  public broadcastNewComment(comment: any): void {
    // Notify users in post room
    this.io.to(`post:${comment.postId}`).emit('comment:created', {
      comment,
      timestamp: new Date(),
    });

    // If it's a reply, notify parent comment room
    if (comment.parentId) {
      this.io.to(`comment:${comment.parentId}`).emit('comment:reply', {
        comment,
        timestamp: new Date(),
      });

      // Notify parent comment author
      if (comment.parent?.user?.id && comment.parent.user.id !== comment.user.id) {
        this.io.to(`user:${comment.parent.user.id}`).emit('notification:reply', {
          type: 'comment_reply',
          comment,
          timestamp: new Date(),
        });
      }
    }

    // Notify post author about new comment
    if (comment.post?.authorId && comment.post.authorId !== comment.user.id) {
      this.io.to(`user:${comment.post.authorId}`).emit('notification:comment', {
        type: 'post_comment',
        comment,
        timestamp: new Date(),
      });
    }

    logger.info(`Broadcasted new comment: ${comment.id} on post ${comment.postId}`);
  }

  /**
   * Broadcast comment update
   */
  public broadcastCommentUpdate(comment: any): void {
    this.io.to(`post:${comment.postId}`).emit('comment:updated', {
      comment,
      timestamp: new Date(),
    });

    if (comment.parentId) {
      this.io.to(`comment:${comment.parentId}`).emit('comment:updated', {
        comment,
        timestamp: new Date(),
      });
    }

    logger.info(`Broadcasted comment update: ${comment.id}`);
  }

  /**
   * Broadcast comment deletion
   */
  public broadcastCommentDelete(commentId: string, postId: string, parentId?: string): void {
    this.io.to(`post:${postId}`).emit('comment:deleted', {
      commentId,
      postId,
      parentId,
      timestamp: new Date(),
    });

    if (parentId) {
      this.io.to(`comment:${parentId}`).emit('comment:deleted', {
        commentId,
        postId,
        parentId,
        timestamp: new Date(),
      });
    }

    logger.info(`Broadcasted comment deletion: ${commentId}`);
  }

  /**
   * Broadcast comment like
   */
  public broadcastCommentLike(commentId: string, like: any): void {
    this.io.to(`post:${like.comment.postId}`).emit('comment:liked', {
      commentId,
      like,
      timestamp: new Date(),
    });

    // Notify comment author
    if (like.comment.userId !== like.userId) {
      this.io.to(`user:${like.comment.userId}`).emit('notification:like', {
        type: 'comment_like',
        commentId,
        user: like.user,
        timestamp: new Date(),
      });
    }

    logger.info(`Broadcasted comment like: ${commentId} by ${like.user.username}`);
  }

  /**
   * Broadcast comment unlike
   */
  public broadcastCommentUnlike(commentId: string, userId: string, postId: string): void {
    this.io.to(`post:${postId}`).emit('comment:unliked', {
      commentId,
      userId,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted comment unlike: ${commentId} by ${userId}`);
  }

  /**
   * Broadcast user follow event
   */
  public broadcastUserFollow(followerId: string, followingId: string, follower: any): void {
    this.io.to(`user:${followingId}`).emit('notification:follow', {
      type: 'user_follow',
      follower,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted follow: ${follower.username} followed user ${followingId}`);
  }

  /**
   * Broadcast new message in conversation
   */
  public broadcastNewMessage(conversationId: string, message: any): void {
    this.io.to(`conversation:${conversationId}`).emit('message:created', {
      message,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted new message: ${message.id} in conversation: ${conversationId}`);
  }

  /**
   * Broadcast message update
   */
  public broadcastMessageUpdate(conversationId: string, message: any): void {
    this.io.to(`conversation:${conversationId}`).emit('message:updated', {
      message,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted message update: ${message.id} in conversation: ${conversationId}`);
  }

  /**
   * Broadcast message deletion
   */
  public broadcastMessageDelete(conversationId: string, messageId: string, userId: string): void {
    this.io.to(`conversation:${conversationId}`).emit('message:deleted', {
      messageId,
      userId,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted message deletion: ${messageId} in conversation: ${conversationId}`);
  }

  /**
   * Broadcast message reaction
   */
  public broadcastMessageReaction(conversationId: string, messageId: string, reaction: any): void {
    this.io.to(`conversation:${conversationId}`).emit('message:reaction', {
      messageId,
      reaction,
      timestamp: new Date(),
    });
    logger.info(`Broadcasted message reaction: ${messageId} in conversation: ${conversationId}`);
  }

  /**
   * Broadcast message read receipt
   */
  public broadcastMessageRead(conversationId: string, userId: string, messageId: string): void {
    this.io.to(`conversation:${conversationId}`).emit('message:read', {
      userId,
      messageId,
      timestamp: new Date(),
    });
    logger.info(
      `Broadcasted message read: ${messageId} by user: ${userId} in conversation: ${conversationId}`,
    );
  }

  /**
   * Broadcast typing indicator
   */
  public broadcastTyping(conversationId: string, userId: string, isTyping: boolean): void {
    this.io.to(`conversation:${conversationId}`).emit('user:typing', {
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast conversation update
   */
  public broadcastConversationUpdate(conversation: any): void {
    // Broadcast to all participants
    if (conversation.participants) {
      conversation.participants.forEach((participant: any) => {
        this.io.to(`user:${participant.userId}`).emit('conversation:updated', {
          conversation,
          timestamp: new Date(),
        });
      });
    }
    logger.info(`Broadcasted conversation update: ${conversation.id}`);
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get users connected to a specific room
   */
  public getUsersInRoom(room: string): number {
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }
  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get Socket.IO instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Disconnect all sockets and close server
   */
  public disconnect(): void {
    this.io.close();
    this.connectedUsers.clear();
    this.socketToUser.clear();
    logger.info('Socket.IO server disconnected');
  }
}

export default RealtimeService;
