import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomInvite } from './entities/room-invite.entity';
import { RoomJoinRequest } from './entities/room-join-request.entity';
import { Message } from '../messages/entities/message.entity';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomMember, RoomInvite, RoomJoinRequest, Message]),
    forwardRef(() => MessagesModule),
    forwardRef(() => ChatModule),
    UsersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
