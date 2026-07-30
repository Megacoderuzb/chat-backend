import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Registered username', example: 'muhammad' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ description: 'User password', example: 'password123' })
  @IsString()
  @MinLength(1)
  password: string;
}
