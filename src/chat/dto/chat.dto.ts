import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationType, MessageType } from '@prisma/client';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Danh sách ID người dùng tham gia cuộc trò chuyện',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Loại cuộc trò chuyện (DIRECT hoặc GROUP)',
    enum: ConversationType,
  })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiProperty({
    description: 'Tên cuộc trò chuyện (chỉ dùng cho GROUP)',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class AddMemberDto {
  @ApiProperty({
    description: 'ID người dùng cần thêm vào cuộc trò chuyện',
  })
  @IsString()
  userId: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Loại tin nhắn',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType = MessageType.TEXT;

  @ApiProperty({
    description: 'URL media (nếu có)',
    required: false,
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
