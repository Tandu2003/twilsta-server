import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export { PaginationDto } from '../../common/dto/pagination.dto';

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
