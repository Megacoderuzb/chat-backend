import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ description: 'ID of the user to invite into the room', example: '66a111111111111111111111' })
  @IsString()
  @MinLength(1)
  userId: string;
}
