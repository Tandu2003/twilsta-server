import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUrl,
  MinLength,
  MaxLength,
  IsPhoneNumber,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Software developer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Website URL',
    example: 'https://example.com',
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+1234567890' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Whether profile is private',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'oldPassword123' })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password', example: 'newPassword123' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UserSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Search keyword (username or name)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description: 'Limit number of results',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Offset for pagination',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsString()
  offset?: string;
}

export class FollowListQueryDto {
  @ApiPropertyOptional({
    description: 'Limit number of results',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class UserIdParamDto {
  @ApiProperty({ description: 'User ID', example: 'cuid123' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class UsernameParamDto {
  @ApiProperty({ description: 'Username', example: 'john_doe' })
  @IsNotEmpty()
  @IsString()
  username: string;
}
