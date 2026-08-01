import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomInvite } from './entities/room-invite.entity';
import { RoomJoinRequest } from './entities/room-join-request.entity';
import { Message } from '../messages/entities/message.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: Repository<RoomMember>,
    @InjectRepository(RoomInvite)
    private readonly roomInviteRepository: Repository<RoomInvite>,
    @InjectRepository(RoomJoinRequest)
    private readonly roomJoinRequestRepository: Repository<RoomJoinRequest>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async create(name: string, isPrivate: boolean, ownerId: string): Promise<Room> {
    const room = this.roomRepository.create({
      name,
      isPrivate: !!isPrivate,
      ownerId,
    });
    const savedRoom = await this.roomRepository.save(room);
    await this.addMember(savedRoom.id, ownerId);
    return savedRoom;
  }

  async searchPublic(q: string): Promise<Room[]> {
    const qb = this.roomRepository
      .createQueryBuilder('room')
      .where('room.isPrivate = :isPrivate', { isPrivate: false });
    if (q && q.trim()) {
      qb.andWhere('room.name ILIKE :q', { q: `%${q.trim()}%` });
    }
    return qb.limit(20).getMany();
  }

  async findAllJoined(userId: string): Promise<any[]> {
    if (!userId) return [];
    const memberships = await this.roomMemberRepository.find({
      where: { userId },
      relations: { room: true },
    });

    const rooms = memberships.map((m) => m.room).filter(Boolean);

    const result = [];
    for (const room of rooms) {
      const roomObj: any = { ...room };
      const lastMsg = await this.messageRepository.findOne({
        where: { roomId: room.id },
        order: { createdAt: 'DESC' },
      });
      if (lastMsg) {
        roomObj.lastMessage = lastMsg.deletedAt ? 'This message was deleted' : lastMsg.content;
        roomObj.lastMessageAt = lastMsg.createdAt ? lastMsg.createdAt.toISOString() : undefined;
      }
      result.push(roomObj);
    }

    return result;
  }

  async findById(id: string): Promise<Room | null> {
    if (!id) return null;
    return this.roomRepository.findOne({ where: { id } });
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    if (!roomId || !userId) {
      return false;
    }
    const count = await this.roomMemberRepository.count({
      where: { roomId, userId },
    });
    return count > 0;
  }

  async addMember(roomId: string, userId: string): Promise<RoomMember> {
    const existing = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (existing) {
      return existing;
    }
    const member = this.roomMemberRepository.create({ roomId, userId });
    return this.roomMemberRepository.save(member);
  }

  async join(roomId: string, userId: string): Promise<void> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.isPrivate && room.ownerId !== userId) {
      throw new ForbiddenException('Cannot join a private room directly. Request access or accept an invite.');
    }
    await this.addMember(roomId, userId);
  }

  async leave(roomId: string, userId: string): Promise<void> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const member = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (!member) {
      throw new NotFoundException('You are not a member of this room');
    }
    await this.roomMemberRepository.remove(member);
  }

  async getMembers(roomId: string): Promise<any[]> {
    if (!roomId) return [];
    const members = await this.roomMemberRepository.find({
      where: { roomId },
      relations: { user: true },
    });

    return members.map((m) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.user ? { id: m.user.id, username: m.user.username } : m.userId,
      joinedAt: m.joinedAt,
    }));
  }

  // --- INVITES ---
  async createInvite(roomId: string, inviterId: string, inviteeId: string): Promise<RoomInvite> {
    const isMember = await this.isMember(roomId, inviterId);
    if (!isMember) {
      throw new ForbiddenException('Only members can invite users to this room');
    }

    const alreadyMember = await this.isMember(roomId, inviteeId);
    if (alreadyMember) {
      throw new BadRequestException('User is already a member of this room');
    }

    let invite = await this.roomInviteRepository.findOne({
      where: { roomId, inviteeId },
    });
    if (invite) {
      invite.status = 'pending';
      invite.inviterId = inviterId;
    } else {
      invite = this.roomInviteRepository.create({
        roomId,
        inviterId,
        inviteeId,
        status: 'pending',
      });
    }

    return this.roomInviteRepository.save(invite);
  }

  async findPendingInvitesForUser(userId: string): Promise<any[]> {
    if (!userId) return [];
    const invites = await this.roomInviteRepository.find({
      where: { inviteeId: userId, status: 'pending' },
      relations: { room: true, inviter: true },
    });

    return invites.map((inv) => ({
      id: inv.id,
      roomId: inv.room ? { id: inv.room.id, name: inv.room.name, isPrivate: inv.room.isPrivate, ownerId: inv.room.ownerId } : inv.roomId,
      inviterId: inv.inviter ? { id: inv.inviter.id, username: inv.inviter.username } : inv.inviterId,
      inviteeId: inv.inviteeId,
      status: inv.status,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }));
  }

  async acceptInvite(roomId: string, userId: string): Promise<void> {
    const invite = await this.roomInviteRepository.findOne({
      where: { roomId, inviteeId: userId },
    });
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Pending invite not found for this room');
    }

    invite.status = 'accepted';
    await this.roomInviteRepository.save(invite);
    await this.addMember(roomId, userId);
  }

  async rejectInvite(roomId: string, userId: string): Promise<void> {
    const invite = await this.roomInviteRepository.findOne({
      where: { roomId, inviteeId: userId },
    });
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Pending invite not found for this room');
    }

    invite.status = 'rejected';
    await this.roomInviteRepository.save(invite);
  }

  // --- JOIN REQUESTS ---
  async requestJoin(roomId: string, userId: string): Promise<RoomJoinRequest> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const alreadyMember = await this.isMember(roomId, userId);
    if (alreadyMember) {
      throw new BadRequestException('You are already a member of this room');
    }

    let reqDoc = await this.roomJoinRequestRepository.findOne({
      where: { roomId, userId },
    });
    if (reqDoc) {
      reqDoc.status = 'pending';
    } else {
      reqDoc = this.roomJoinRequestRepository.create({
        roomId,
        userId,
        status: 'pending',
      });
    }

    return this.roomJoinRequestRepository.save(reqDoc);
  }

  async findPendingJoinRequests(roomId: string, callerId: string): Promise<any[]> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can view join requests');
    }

    const requests = await this.roomJoinRequestRepository.find({
      where: { roomId, status: 'pending' },
      relations: { user: true },
    });

    return requests.map((req) => ({
      id: req.id,
      roomId: req.roomId,
      userId: req.user ? { id: req.user.id, username: req.user.username } : req.userId,
      status: req.status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));
  }

  async acceptJoinRequest(roomId: string, targetUserId: string, callerId: string): Promise<void> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can accept join requests');
    }

    const reqDoc = await this.roomJoinRequestRepository.findOne({
      where: { roomId, userId: targetUserId },
    });
    if (!reqDoc || reqDoc.status !== 'pending') {
      throw new NotFoundException('Pending join request not found');
    }

    reqDoc.status = 'accepted';
    await this.roomJoinRequestRepository.save(reqDoc);
    await this.addMember(roomId, targetUserId);
  }

  async rejectJoinRequest(roomId: string, targetUserId: string, callerId: string): Promise<void> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can reject join requests');
    }

    const reqDoc = await this.roomJoinRequestRepository.findOne({
      where: { roomId, userId: targetUserId },
    });
    if (!reqDoc || reqDoc.status !== 'pending') {
      throw new NotFoundException('Pending join request not found');
    }

    reqDoc.status = 'rejected';
    await this.roomJoinRequestRepository.save(reqDoc);
  }
}
