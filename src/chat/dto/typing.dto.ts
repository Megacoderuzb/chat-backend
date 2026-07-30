import { IsString, IsOptional } from 'class-validator';

export class TypingDto {
  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  recipientId?: string;
}
