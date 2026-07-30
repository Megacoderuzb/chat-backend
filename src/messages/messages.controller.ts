import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, Request, Inject, forwardRef, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { UpdateMessageDto } from '../chat/dto/update-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatGateway } from '../chat/chat.gateway';

function extractReqUserId(req: any): string {
  const u = req?.user;
  if (!u) return '';
  if (typeof u === 'string') return u.trim();
  if (u._id) return u._id.toString().trim();
  if (u.id) return String(u.id).trim();
  if (u.sub) return String(u.sub).trim();
  return '';
}

function extractId(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val._id && val._id !== val) {
      if (typeof val._id === 'string') return val._id.trim();
      if (typeof val._id.toString === 'function') return val._id.toString().trim();
    }
    if (val.id && val.id !== val) return String(val.id).trim();
    if (typeof val.toString === 'function') return val.toString().trim();
  }
  return '';
}

@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Get room message history' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to retrieve (default 50)' })
  @ApiQuery({ name: 'before', required: false, description: 'Message ID cursor (returns messages before this ID)' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden from viewing this room history' })
  async getRoomHistory(
    @Param('id') roomId: string,
    @Query('limit') limit: string,
    @Query('before') before: string,
    @Request() req,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const beforeCursor = before || undefined;
    const userId = extractReqUserId(req);
    return this.messagesService.getRoomHistory(roomId, userId, parsedLimit, beforeCursor);
  }

  @Get('messages/direct/conversations')
  @ApiOperation({ summary: 'Get list of active direct message conversations' })
  @ApiResponse({ status: 200, description: 'List of users with active DM channels' })
  async getRecentConversations(@Request() req) {
    const userId = extractReqUserId(req);
    return this.messagesService.getRecentDmUsers(userId);
  }

  @Get('messages/direct/:userId')
  @ApiOperation({ summary: 'Get direct message history with another user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to retrieve (default 50)' })
  @ApiQuery({ name: 'before', required: false, description: 'Message ID cursor (returns messages before this ID)' })
  @ApiResponse({ status: 200, description: 'List of direct messages' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDirectHistory(
    @Param('userId') otherUserId: string,
    @Query('limit') limit: string,
    @Query('before') before: string,
    @Request() req,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const beforeCursor = before || undefined;
    const userId = extractReqUserId(req);
    return this.messagesService.getDirectHistory(userId, otherUserId, parsedLimit, beforeCursor);
  }

  @Patch('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a message by ID via REST API' })
  @ApiResponse({ status: 200, description: 'Message edited successfully' })
  @ApiResponse({ status: 403, description: 'Only author can edit message' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateMessage(
    @Param('id') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req,
  ) {
    const userId = extractReqUserId(req);
    const updated: any = await this.messagesService.updateMessage(messageId, userId, updateMessageDto.content);

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
      this.chatGateway.server.to(`room:${roomId}`).emit('message:updated', eventPayload);
    } else {
      if (authorId) this.chatGateway.server.to(`user:${authorId}`).emit('message:updated', eventPayload);
      if (recipientId) this.chatGateway.server.to(`user:${recipientId}`).emit('message:updated', eventPayload);
    }

    return { message: 'Message updated successfully', messageData: formattedMessage };
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message by ID via REST API' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only author can delete message' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async deleteMessage(@Param('id') messageId: string, @Request() req) {
    const userId = extractReqUserId(req);
    const deleted: any = await this.messagesService.deleteMessage(messageId, userId);

    const formattedMessage = deleted.toJSON ? deleted.toJSON() : deleted;
    const msgId = extractId(formattedMessage.id || formattedMessage._id);
    const authorId = extractId(formattedMessage.authorId);
    const recipientId = extractId(formattedMessage.recipientId);
    const roomId = extractId(formattedMessage.roomId);

    const eventPayload = {
      messageId: msgId,
    };

    if (roomId) {
      this.chatGateway.server.to(`room:${roomId}`).emit('message:deleted', eventPayload);
    } else {
      if (authorId) this.chatGateway.server.to(`user:${authorId}`).emit('message:deleted', eventPayload);
      if (recipientId) this.chatGateway.server.to(`user:${recipientId}`).emit('message:deleted', eventPayload);
    }

    return { message: 'Message deleted successfully' };
  }
}
