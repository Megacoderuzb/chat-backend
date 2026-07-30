import { IsString, MinLength } from 'class-validator';

export class SendDmDto {
  @IsString()
  @MinLength(1)
  recipientId: string;

  @IsString()
  @MinLength(1)
  content: string;
}
