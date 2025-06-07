import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  UseFilters,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ConversationType } from '@prisma/client'; // keep only what is needed
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { ChatService } from './chat.service';
import { AddMemberDto, CreateConversationDto } from './dto/chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(TransformInterceptor)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Lấy danh sách cuộc trò chuyện' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
  })
  @ApiBearerAuth()
  async getConversations(@Req() req: any, @Query() pagination: PaginationDto) {
    const currentUser = req.user;
    return this.chatService.getConversations(currentUser.id, pagination);
  }

  @Get('conversations/:conversationId')
  @ApiOperation({ summary: 'Lấy thông tin cuộc trò chuyện' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiBearerAuth()
  async getConversation(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    const currentUser = req.user;
    return this.chatService.getConversation(currentUser.id, conversationId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Lấy tin nhắn của cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiBearerAuth()
  async getMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationDto,
  ) {
    const currentUser = req.user;
    return this.chatService.getMessages(
      currentUser.id,
      conversationId,
      pagination,
    );
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Tạo cuộc trò chuyện mới' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  @ApiBearerAuth()
  async createConversation(
    @Req() req: any,
    @Body() data: CreateConversationDto,
  ) {
    const currentUser = req.user;
    return this.chatService.createConversation(currentUser.id, {
      ...data,
      type: data.type as ConversationType,
    });
  }

  @Post('conversations/:conversationId/members')
  @ApiOperation({ summary: 'Thêm thành viên vào cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Member added successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiBearerAuth()
  async addMember(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() data: AddMemberDto,
  ) {
    const currentUser = req.user;
    return this.chatService.addMember(
      currentUser.id,
      conversationId,
      data.userId,
    );
  }

  @Post('conversations/:conversationId/leave')
  @ApiOperation({ summary: 'Rời khỏi cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Left conversation successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiBearerAuth()
  async leaveConversation(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    const currentUser = req.user;
    return this.chatService.leaveConversation(currentUser.id, conversationId);
  }
}
