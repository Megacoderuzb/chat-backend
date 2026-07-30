import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { RoomMember, RoomMemberDocument } from './schemas/room-member.schema';
import { RoomInvite, RoomInviteDocument } from './schemas/room-invite.schema';
import { RoomJoinRequest, RoomJoinRequestDocument } from './schemas/room-join-request.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(RoomMember.name)
    private readonly roomMemberModel: Model<RoomMemberDocument>,
    @InjectModel(RoomInvite.name)
    private readonly roomInviteModel: Model<RoomInviteDocument>,
    @InjectModel(RoomJoinRequest.name)
    private readonly roomJoinRequestModel: Model<RoomJoinRequestDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async create(name: string, isPrivate: boolean, ownerId: string): Promise<RoomDocument> {
    const room = new this.roomModel({
      name,
      isPrivate: !!isPrivate,
      ownerId: new Types.ObjectId(ownerId),
    });
    const savedRoom = await room.save();
    await this.addMember(savedRoom._id.toString(), ownerId);
    return savedRoom;
  }

  async searchPublic(q: string): Promise<RoomDocument[]> {
    const filter: any = { isPrivate: false };
    if (q && q.trim()) {
      filter.name = { $regex: q.trim(), $options: 'i' };
    }
    return this.roomModel.find(filter).limit(20).exec();
  }

  async findAllJoined(userId: string): Promise<any[]> {
    if (!userId || !Types.ObjectId.isValid(userId)) return [];
    const memberships = await this.roomMemberModel
      .find({ userId: new Types.ObjectId(userId) } as any)
      .populate('roomId')
      .exec();

    const rooms = memberships
      .map((m) => m.roomId as any as RoomDocument)
      .filter(Boolean);

    const result = [];
    for (const room of rooms) {
      const roomObj = room.toJSON ? room.toJSON() : room;
      const lastMsg = await this.messageModel
        .findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .exec();
      if (lastMsg) {
        roomObj.lastMessage = lastMsg.deletedAt ? 'This message was deleted' : lastMsg.content;
        roomObj.lastMessageAt = lastMsg.createdAt ? (lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : String(lastMsg.createdAt)) : undefined;
      }
      result.push(roomObj);
    }

    return result;
  }

  async findById(id: string): Promise<RoomDocument | null> {
    if (!id || !Types.ObjectId.isValid(id)) return null;
    return this.roomModel.findById(id).exec();
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    if (!roomId || !userId || !Types.ObjectId.isValid(roomId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }
    const count = await this.roomMemberModel.countDocuments({
      roomId: new Types.ObjectId(roomId),
      userId: new Types.ObjectId(userId),
    } as any);
    return count > 0;
  }

  async addMember(roomId: string, userId: string): Promise<RoomMemberDocument> {
    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(userId);
    const existing = await this.roomMemberModel.findOne({ roomId: rId, userId: uId } as any).exec();
    if (existing) {
      return existing;
    }
    const member = new this.roomMemberModel({ roomId: rId, userId: uId });
    return member.save();
  }

  async join(roomId: string, userId: string): Promise<void> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.isPrivate && room.ownerId.toString() !== userId) {
      throw new ForbiddenException('Cannot join a private room directly. Request access or accept an invite.');
    }
    await this.addMember(roomId, userId);
  }

  async leave(roomId: string, userId: string): Promise<void> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(userId);
    const member = await this.roomMemberModel.findOne({ roomId: rId, userId: uId } as any).exec();
    if (!member) {
      throw new NotFoundException('You are not a member of this room');
    }
    await member.deleteOne();
  }

  // --- INVITES ---
  async createInvite(roomId: string, inviterId: string, inviteeId: string): Promise<RoomInviteDocument> {
    const isMember = await this.isMember(roomId, inviterId);
    if (!isMember) {
      throw new ForbiddenException('Only members can invite users to this room');
    }

    const rId = new Types.ObjectId(roomId);
    const eId = new Types.ObjectId(inviteeId);
    const iId = new Types.ObjectId(inviterId);

    const alreadyMember = await this.isMember(roomId, inviteeId);
    if (alreadyMember) {
      throw new BadRequestException('User is already a member of this room');
    }

    let invite = await this.roomInviteModel.findOne({ roomId: rId, inviteeId: eId } as any).exec();
    if (invite) {
      invite.status = 'pending';
      invite.inviterId = iId;
    } else {
      invite = new this.roomInviteModel({
        roomId: rId,
        inviterId: iId,
        inviteeId: eId,
        status: 'pending',
      });
    }

    return invite.save();
  }

  async findPendingInvitesForUser(userId: string): Promise<RoomInviteDocument[]> {
    if (!userId || !Types.ObjectId.isValid(userId)) return [];
    return this.roomInviteModel
      .find({ inviteeId: new Types.ObjectId(userId), status: 'pending' } as any)
      .populate('roomId', 'name isPrivate ownerId')
      .populate('inviterId', 'username')
      .exec();
  }

  async acceptInvite(roomId: string, userId: string): Promise<void> {
    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(userId);

    const invite = await this.roomInviteModel.findOne({ roomId: rId, inviteeId: uId } as any).exec();
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Pending invite not found for this room');
    }

    invite.status = 'accepted';
    await invite.save();
    await this.addMember(roomId, userId);
  }

  async rejectInvite(roomId: string, userId: string): Promise<void> {
    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(userId);

    const invite = await this.roomInviteModel.findOne({ roomId: rId, inviteeId: uId } as any).exec();
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Pending invite not found for this room');
    }

    invite.status = 'rejected';
    await invite.save();
  }

  // --- JOIN REQUESTS ---
  async requestJoin(roomId: string, userId: string): Promise<RoomJoinRequestDocument> {
    const room = await this.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const alreadyMember = await this.isMember(roomId, userId);
    if (alreadyMember) {
      throw new BadRequestException('You are already a member of this room');
    }

    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(userId);

    let reqDoc = await this.roomJoinRequestModel.findOne({ roomId: rId, userId: uId } as any).exec();
    if (reqDoc) {
      reqDoc.status = 'pending';
    } else {
      reqDoc = new this.roomJoinRequestModel({
        roomId: rId,
        userId: uId,
        status: 'pending',
      });
    }

    return reqDoc.save();
  }

  async findPendingJoinRequests(roomId: string, callerId: string): Promise<RoomJoinRequestDocument[]> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can view join requests');
    }

    return this.roomJoinRequestModel
      .find({ roomId: new Types.ObjectId(roomId), status: 'pending' } as any)
      .populate('userId', 'username')
      .exec();
  }

  async acceptJoinRequest(roomId: string, targetUserId: string, callerId: string): Promise<void> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can accept join requests');
    }

    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(targetUserId);

    const reqDoc = await this.roomJoinRequestModel.findOne({ roomId: rId, userId: uId } as any).exec();
    if (!reqDoc || reqDoc.status !== 'pending') {
      throw new NotFoundException('Pending join request not found');
    }

    reqDoc.status = 'accepted';
    await reqDoc.save();
    await this.addMember(roomId, targetUserId);
  }

  async rejectJoinRequest(roomId: string, targetUserId: string, callerId: string): Promise<void> {
    const isMember = await this.isMember(roomId, callerId);
    if (!isMember) {
      throw new ForbiddenException('Only room members can reject join requests');
    }

    const rId = new Types.ObjectId(roomId);
    const uId = new Types.ObjectId(targetUserId);

    const reqDoc = await this.roomJoinRequestModel.findOne({ roomId: rId, userId: uId } as any).exec();
    if (!reqDoc || reqDoc.status !== 'pending') {
      throw new NotFoundException('Pending join request not found');
    }

    reqDoc.status = 'rejected';
    await reqDoc.save();
  }
}
