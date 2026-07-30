import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room, RoomSchema } from './schemas/room.schema';
import { RoomMember, RoomMemberSchema } from './schemas/room-member.schema';
import { RoomInvite, RoomInviteSchema } from './schemas/room-invite.schema';
import { RoomJoinRequest, RoomJoinRequestSchema } from './schemas/room-join-request.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { RoomMembershipGuard } from './guards/room-membership.guard';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: RoomMember.name, schema: RoomMemberSchema },
      { name: RoomInvite.name, schema: RoomInviteSchema },
      { name: RoomJoinRequest.name, schema: RoomJoinRequestSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    forwardRef(() => ChatModule),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomMembershipGuard],
  exports: [RoomsService, RoomMembershipGuard],
})
export class RoomsModule {}
