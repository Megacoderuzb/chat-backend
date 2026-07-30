import { IsString, MinLength } from 'class-validator';

export class DeleteMessageDto {
  @IsString()
  @MinLength(1)
  messageId: string;
}
