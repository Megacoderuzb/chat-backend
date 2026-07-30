import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Unique username for user registration', example: 'muhammad', minLength: 3 })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: 'User password (at least 6 characters)', example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
