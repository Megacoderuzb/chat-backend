import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { RoomsService } from '../rooms/rooms.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
    private readonly usersService: UsersService,
  ) {}

  async createRoomMessage(authorId: string, roomId: string, content: string): Promise<MessageDocument> {
    const isMember = await this.roomsService.isMember(roomId, authorId);
    if (!isMember) {
      throw new ForbiddenException('You must be a member of the room to send messages');
    }

    const message = new this.messageModel({
      authorId: new Types.ObjectId(authorId),
      roomId: new Types.ObjectId(roomId),
      content,
    });
    const saved = await message.save();
    return this.findById(saved._id.toString());
  }

  async createDirectMessage(authorId: string, recipientId: string, content: string): Promise<MessageDocument> {
    const recipient = await this.usersService.findById(recipientId);
    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    const message = new this.messageModel({
      authorId: new Types.ObjectId(authorId),
      recipientId: new Types.ObjectId(recipientId),
      content,
    });
    const saved = await message.save();
    return this.findById(saved._id.toString());
  }

  async getRoomHistory(roomId: string, userId: string, limit = 50, beforeCursor?: string): Promise<MessageDocument[]> {
    const isMember = await this.roomsService.isMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You must be a member of the room to view history');
    }

    const query: any = { roomId: new Types.ObjectId(roomId) };
    if (beforeCursor && Types.ObjectId.isValid(beforeCursor)) {
      query._id = { $lt: new Types.ObjectId(beforeCursor) };
    }

    return this.messageModel
      .find(query)
      .populate('authorId', 'username')
      .populate('recipientId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getDirectHistory(userId: string, otherUserId: string, limit = 50, beforeCursor?: string): Promise<MessageDocument[]> {
    const otherUser = await this.usersService.findById(otherUserId);
    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const uId = new Types.ObjectId(userId);
    const oId = new Types.ObjectId(otherUserId);

    const query: any = {
      $or: [
        { authorId: uId, recipientId: oId },
        { authorId: oId, recipientId: uId },
      ],
    };
    if (beforeCursor && Types.ObjectId.isValid(beforeCursor)) {
      query._id = { $lt: new Types.ObjectId(beforeCursor) };
    }

    return this.messageModel
      .find(query)
      .populate('authorId', 'username')
      .populate('recipientId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string): Promise<MessageDocument | null> {
    if (!id || !Types.ObjectId.isValid(id)) return null;
    return this.messageModel
      .findById(id)
      .populate('authorId', 'username')
      .populate('recipientId', 'username')
      .exec();
  }

  async updateMessage(id: string, userId: string, content: string): Promise<MessageDocument> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    const authorObj: any = message.authorId;
    const authorIdStr = authorObj
      ? (typeof authorObj === 'object'
          ? (authorObj._id ? authorObj._id.toString() : authorObj.id ? authorObj.id.toString() : String(authorObj))
          : String(authorObj))
      : '';

    if (authorIdStr !== userId) {
      throw new ForbiddenException('Only the author can edit this message');
    }

    message.content = content;
    await message.save();
    return this.findById(id);
  }

  async deleteMessage(id: string, userId: string): Promise<MessageDocument> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const authorObj: any = message.authorId;
    const authorIdStr = authorObj
      ? (typeof authorObj === 'object'
          ? (authorObj._id ? authorObj._id.toString() : authorObj.id ? authorObj.id.toString() : String(authorObj))
          : String(authorObj))
      : '';

    if (authorIdStr !== userId) {
      throw new ForbiddenException('Only the author can delete this message');
    }

    if (!message.deletedAt) {
      message.deletedAt = new Date();
      message.content = null;
      await message.save();
    }

    return this.findById(id);
  }

  async getRecentDmUsers(userId: string): Promise<Array<{ id: string; username: string; lastMessage?: string; lastMessageAt?: string }>> {
    if (!userId || !Types.ObjectId.isValid(userId)) return [];
    const uId = new Types.ObjectId(userId);

    const messages = await this.messageModel
      .find({
        roomId: null,
        $or: [{ authorId: uId }, { recipientId: uId }],
      } as any)
      .sort({ createdAt: -1 })
      .populate('authorId', 'username')
      .populate('recipientId', 'username')
      .exec();

    const userMap = new Map<string, { id: string; username: string; lastMessage?: string; lastMessageAt?: string }>();

    for (const msg of messages) {
      const author: any = msg.authorId;
      const recipient: any = msg.recipientId;
      const content = msg.deletedAt ? 'This message was deleted' : msg.content;
      const createdAt = msg.createdAt ? (msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt)) : undefined;

      if (author && author._id && author._id.toString() !== userId) {
        const id = author._id.toString();
        if (!userMap.has(id)) {
          userMap.set(id, { id, username: author.username, lastMessage: content, lastMessageAt: createdAt });
        }
      }
      if (recipient && recipient._id && recipient._id.toString() !== userId) {
        const id = recipient._id.toString();
        if (!userMap.has(id)) {
          userMap.set(id, { id, username: recipient.username, lastMessage: content, lastMessageAt: createdAt });
        }
      }
    }

    return Array.from(userMap.values());
  }
}
