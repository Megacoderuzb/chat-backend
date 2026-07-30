import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: 'Name of the group room', example: 'Developers Lounge', minLength: 1 })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ description: 'Whether room is private (requires invitation)', default: false })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
