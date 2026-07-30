import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, UseFilters, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SendDmDto } from './dto/send-dm.dto';
import { RoomActionDto } from './dto/room-action.dto';
import { SendRoomMessageDto } from './dto/send-room-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { TypingDto } from './dto/typing.dto';

import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { ArgumentsHost, Catch } from '@nestjs/common';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception instanceof WsException ? exception.getError() : exception.message;
    client.emit('exception', { status: 'error', message: error });
  }
}

function extractId(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') return val.toHexString();
    if (val._id && val._id !== val) {
      if (typeof val._id === 'string') return val._id.trim();
      if (typeof val._id === 'number') return String(val._id);
      if (typeof val._id.toHexString === 'function') return val._id.toHexString();
      if (typeof val._id.toString === 'function') {
        const s = val._id.toString().trim();
        if (s && s !== '[object Object]') return s;
      }
    }
    if (val.id && val.id !== val) {
      if (typeof val.id === 'string') return val.id.trim();
      if (typeof val.id === 'number') return String(val.id);
      if (typeof val.id.toHexString === 'function') return val.id.toHexString();
    }
    if (typeof val.toString === 'function' && !ArrayBuffer.isView(val)) {
      const str = val.toString().trim();
      if (str && str !== '[object Object]') return str;
    }
  }
  return '';
}

function getUserId(user: any): string {
  return extractId(user);
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
  },
})
@UseFilters(new WsExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly roomsService: RoomsService,
  ) {}

  async onUserJoinedRoom(userId: string, roomId: string, roomData?: any) {
    try {
      const uId = extractId(userId);
      const rId = extractId(roomId);
      if (!uId || !rId) return;

      const userRoom = `user:${uId}`;
      const roomChannel = `room:${rId}`;

      if (this.server) {
        this.server.in(userRoom).socketsJoin(roomChannel);

        const room = roomData || (await this.roomsService.findById(rId));
        const formattedRoom = room ? (room.toJSON ? room.toJSON() : room) : { id: rId };

        this.server.to(userRoom).emit('room:joined', { room: formattedRoom });
      }
    } catch (e) {
      this.logger.error(`Error in onUserJoinedRoom: ${e.message}`);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        this.logger.log(`Connection rejected: no auth token. client id: ${client.id}`);
        client.disconnect();
        return;
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;
      const user = await this.usersService.findById(userId);

      if (!user) {
        this.logger.log(`Connection rejected: user not found. client id: ${client.id}`);
        client.disconnect();
        return;
      }

      client['user'] = user;
      if (!client.data) client.data = {};
      client.data.user = user;

      const uId = getUserId(user);
      const userRoom = `user:${uId}`;
      await client.join(userRoom);
      this.logger.log(`Client ${client.id} authenticated as User ${uId} and joined room ${userRoom}`);

      try {
        const joinedRooms = await this.roomsService.findAllJoined(uId);
        for (const room of joinedRooms) {
          const rId = extractId(room.id || (room as any)._id);
          if (rId) {
            await client.join(`room:${rId}`);
            this.logger.log(`Client ${client.id} auto-joined group room:${rId}`);
          }
        }
      } catch (e) {
        this.logger.error(`Error auto-joining user rooms: ${e.message}`);
      }
    } catch (err) {
      this.logger.log(`Connection rejected: auth error. client id: ${client.id}. Details: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private getUserFromSocket(client: Socket): any {
    return client['user'] || client.data?.user;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('dm:send')
  async handleSendDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendDmDto,
  ) {
    const author = this.getUserFromSocket(client);
    const authorId = getUserId(author);
    const recipientId = (payload.recipientId || '').trim();

    const message: any = await this.messagesService.createDirectMessage(
      authorId,
      recipientId,
      payload.content,
    );

    const formattedMessage = message.toJSON ? message.toJSON() : message;
    const msgId = extractId(formattedMessage.id || formattedMessage._id);

    this.server.to(`user:${recipientId}`).to(`user:${authorId}`).emit('message:new', { message: formattedMessage });
    return { status: 'ok', messageId: msgId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomActionDto,
  ) {
    const user = this.getUserFromSocket(client);
    const userId = getUserId(user);
    const roomId = (payload.roomId || '').trim();
    const isMember = await this.roomsService.isMember(roomId, userId);
    if (!isMember) {
      throw new WsException('Forbidden: You are not a member of this room');
    }

    const roomName = `room:${roomId}`;
    await client.join(roomName);
    this.logger.log(`User ${userId} joined WebSocket room ${roomName}`);
    return { status: 'ok', roomJoined: roomName };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomActionDto,
  ) {
    const user = this.getUserFromSocket(client);
    const userId = getUserId(user);
    const roomId = (payload.roomId || '').trim();
    const roomName = `room:${roomId}`;
    await client.leave(roomName);
    this.logger.log(`User ${userId} left WebSocket room ${roomName}`);
    return { status: 'ok', roomLeft: roomName };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:send')
  async handleSendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendRoomMessageDto,
  ) {
    const author = this.getUserFromSocket(client);
    const authorId = getUserId(author);
    const roomId = (payload.roomId || '').trim();

    const message: any = await this.messagesService.createRoomMessage(
      authorId,
      roomId,
      payload.content,
    );

    const formattedMessage = message.toJSON ? message.toJSON() : message;
    const msgId = extractId(formattedMessage.id || formattedMessage._id);

    this.server.to(`room:${roomId}`).emit('message:new', { message: formattedMessage });
    return { status: 'ok', messageId: msgId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:update')
  async handleUpdateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateMessageDto,
  ) {
    const user = this.getUserFromSocket(client);
    const userId = getUserId(user);
    const updated: any = await this.messagesService.updateMessage(
      payload.messageId,
      userId,
      payload.content,
    );

    const formattedMessage = updated.toJSON ? updated.toJSON() : updated;
    const msgId = extractId(formattedMessage.id || formattedMessage._id);
    const authorId = extractId(formattedMessage.authorId);
    const recipientId = extractId(formattedMessage.recipientId);
    const roomId = extractId(formattedMessage.roomId);

    const eventPayload = {
      messageId: msgId,
      content: formattedMessage.content,
      updatedAt: formattedMessage.updatedAt,
    };

    if (roomId) {
      this.server.to(`room:${roomId}`).emit('message:updated', eventPayload);
    } else {
      if (authorId) this.server.to(`user:${authorId}`).emit('message:updated', eventPayload);
      if (recipientId) this.server.to(`user:${recipientId}`).emit('message:updated', eventPayload);
    }

    return { status: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeleteMessageDto,
  ) {
    const user = this.getUserFromSocket(client);
    const userId = getUserId(user);
    const deleted: any = await this.messagesService.deleteMessage(payload.messageId, userId);

    const formattedMessage = deleted.toJSON ? deleted.toJSON() : deleted;
    const msgId = extractId(formattedMessage.id || formattedMessage._id);
    const authorId = extractId(formattedMessage.authorId);
    const recipientId = extractId(formattedMessage.recipientId);
    const roomId = extractId(formattedMessage.roomId);

    const eventPayload = {
      messageId: msgId,
    };

    if (roomId) {
      this.server.to(`room:${roomId}`).emit('message:deleted', eventPayload);
    } else {
      if (authorId) this.server.to(`user:${authorId}`).emit('message:deleted', eventPayload);
      if (recipientId) this.server.to(`user:${recipientId}`).emit('message:deleted', eventPayload);
    }

    return { status: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingDto,
  ) {
    const user = this.getUserFromSocket(client);
    const userId = getUserId(user);
    const eventPayload = {
      userId,
      roomId: payload.roomId,
    };

    if (payload.roomId) {
      client.to(`room:${payload.roomId}`).emit('user:typing', eventPayload);
    } else if (payload.recipientId) {
      this.server.to(`user:${payload.recipientId}`).emit('user:typing', eventPayload);
    }

    return { status: 'ok' };
  }
}
