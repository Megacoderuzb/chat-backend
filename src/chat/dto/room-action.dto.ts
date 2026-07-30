import { IsString, MinLength } from 'class-validator';

export class RoomActionDto {
  @IsString()
  @MinLength(1)
  roomId: string;
}
