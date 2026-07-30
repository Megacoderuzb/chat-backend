import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { RoomsService } from '../rooms.service';

@Injectable()
export class RoomMembershipGuard implements CanActivate {
  constructor(private readonly roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roomId = request.params?.id || request.params?.roomId || request.body?.roomId;

    if (!user || !user.id || !roomId) {
      throw new ForbiddenException('Room ID and authenticated user are required');
    }

    const isMember = await this.roomsService.isMember(roomId, user.id);
    if (!isMember) {
      throw new ForbiddenException('Forbidden: You are not a member of this room');
    }

    return true;
  }
}
