import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({
    description: 'Số lượng item mỗi trang',
    example: 20,
    required: false,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'ID của item cuối cùng',
    required: false,
    example: 'clp123abc',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class FollowParamsDto {
  @ApiProperty({
    description: 'ID của người dùng mục tiêu',
    example: 'clp123abc456def789',
  })
  @IsString()
  targetUserId: string;
}

export class UserParamsDto {
  @ApiProperty({
    description: 'ID của người dùng',
    example: 'clp123abc456def789',
  })
  @IsString()
  userId: string;
}

export class FollowRequestParamsDto {
  @ApiProperty({
    description: 'ID của follow request',
    example: 'clp123abc456def789',
  })
  @IsString()
  followId: string;
}
