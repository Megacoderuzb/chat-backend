import { IsString, MinLength } from 'class-validator';

export class SendRoomMessageDto {
  @IsString()
  @MinLength(1)
  roomId: string;

  @IsString()
  @MinLength(1)
  content: string;
}
