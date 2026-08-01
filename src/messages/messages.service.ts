import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Message } from './entities/message.entity';
import { RoomsService } from '../rooms/rooms.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
    private readonly usersService: UsersService,
  ) {}

  async createRoomMessage(authorId: string, roomId: string, content: string): Promise<Message> {
    const isMember = await this.roomsService.isMember(roomId, authorId);
    if (!isMember) {
      throw new ForbiddenException('You must be a member of the room to send messages');
    }

    const message = this.messageRepository.create({
      authorId,
      roomId,
      content,
    });
    const saved = await this.messageRepository.save(message);
    return this.findById(saved.id);
  }

  async createDirectMessage(authorId: string, recipientId: string, content: string): Promise<Message> {
    const recipient = await this.usersService.findById(recipientId);
    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    const message = this.messageRepository.create({
      authorId,
      recipientId,
      content,
    });
    const saved = await this.messageRepository.save(message);
    return this.findById(saved.id);
  }

  async getRoomHistory(roomId: string, userId: string, limit = 50, beforeCursor?: string): Promise<Message[]> {
    const isMember = await this.roomsService.isMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('You must be a member of the room to view history');
    }

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.author', 'author')
      .leftJoinAndSelect('message.recipient', 'recipient')
      .where('message.roomId = :roomId', { roomId });

    if (beforeCursor) {
      const cursorMsg = await this.messageRepository.findOne({ where: { id: beforeCursor } });
      if (cursorMsg) {
        qb.andWhere('message.createdAt < :createdAt', { createdAt: cursorMsg.createdAt });
      }
    }

    return qb.orderBy('message.createdAt', 'DESC').limit(limit).getMany();
  }

  async getDirectHistory(userId: string, otherUserId: string, limit = 50, beforeCursor?: string): Promise<Message[]> {
    const otherUser = await this.usersService.findById(otherUserId);
    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.author', 'author')
      .leftJoinAndSelect('message.recipient', 'recipient')
      .where(
        '((message.authorId = :userId AND message.recipientId = :otherUserId) OR (message.authorId = :otherUserId AND message.recipientId = :userId))',
        { userId, otherUserId },
      );

    if (beforeCursor) {
      const cursorMsg = await this.messageRepository.findOne({ where: { id: beforeCursor } });
      if (cursorMsg) {
        qb.andWhere('message.createdAt < :createdAt', { createdAt: cursorMsg.createdAt });
      }
    }

    return qb.orderBy('message.createdAt', 'DESC').limit(limit).getMany();
  }

  async findById(id: string): Promise<Message | null> {
    if (!id) return null;
    return this.messageRepository.findOne({
      where: { id },
      relations: { author: true, recipient: true },
    });
  }

  async updateMessage(id: string, userId: string, content: string): Promise<Message> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit this message');
    }

    message.content = content;
    await this.messageRepository.save(message);
    return this.findById(id);
  }

  async deleteMessage(id: string, userId: string): Promise<Message> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete this message');
    }

    if (!message.deletedAt) {
      message.deletedAt = new Date();
      message.content = null;
      await this.messageRepository.save(message);
    }

    return this.findById(id);
  }

  async getRecentDmUsers(userId: string): Promise<Array<{ id: string; username: string; lastMessage?: string; lastMessageAt?: string }>> {
    if (!userId) return [];

    const messages = await this.messageRepository.find({
      where: [
        { roomId: IsNull(), authorId: userId },
        { roomId: IsNull(), recipientId: userId },
      ],
      order: { createdAt: 'DESC' },
      relations: { author: true, recipient: true },
    });

    const userMap = new Map<string, { id: string; username: string; lastMessage?: string; lastMessageAt?: string }>();

    for (const msg of messages) {
      const author = msg.author;
      const recipient = msg.recipient;
      const content = msg.deletedAt ? 'This message was deleted' : msg.content;
      const createdAt = msg.createdAt ? msg.createdAt.toISOString() : undefined;

      if (author && author.id !== userId) {
        if (!userMap.has(author.id)) {
          userMap.set(author.id, { id: author.id, username: author.username, lastMessage: content, lastMessageAt: createdAt });
        }
      }
      if (recipient && recipient.id !== userId) {
        if (!userMap.has(recipient.id)) {
          userMap.set(recipient.id, { id: recipient.id, username: recipient.username, lastMessage: content, lastMessageAt: createdAt });
        }
      }
    }

    return Array.from(userMap.values());
  }
}
