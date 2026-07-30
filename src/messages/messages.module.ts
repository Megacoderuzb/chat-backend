import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message, MessageSchema } from './schemas/message.schema';
import { RoomsModule } from '../rooms/rooms.module';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    forwardRef(() => RoomsModule),
    forwardRef(() => ChatModule),
    UsersModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
