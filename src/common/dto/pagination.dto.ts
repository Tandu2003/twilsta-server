import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
} from 'class-validator';

export class PaginationDto {
  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Cursor for pagination',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
