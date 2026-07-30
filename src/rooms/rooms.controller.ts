import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatGateway } from '../chat/chat.gateway';

@ApiTags('Rooms')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new chat room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createRoomDto: CreateRoomDto, @Request() req) {
    const isPrivate = createRoomDto.isPrivate ?? false;
    const userId = req.user?.id || req.user?.sub;
    const room = await this.roomsService.create(createRoomDto.name, isPrivate, userId);
    const roomId = room.id || (room as any)._id?.toString();
    await this.chatGateway.onUserJoinedRoom(userId, roomId, room);
    return room;
  }

  @Get()
  @ApiOperation({ summary: 'List rooms the current user is a member of' })
  @ApiResponse({ status: 200, description: 'List of joined rooms' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getJoined(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.roomsService.findAllJoined(userId);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a room' })
  @ApiResponse({ status: 200, description: 'Successfully joined room' })
  @ApiResponse({ status: 403, description: 'Forbidden from joining private room directly' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async join(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    await this.roomsService.join(id, userId);
    await this.chatGateway.onUserJoinedRoom(userId, id);
    return { message: 'Successfully joined the room' };
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a room' })
  @ApiResponse({ status: 200, description: 'Successfully left room' })
  @ApiResponse({ status: 404, description: 'Room not found / not a member' })
  async leave(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    await this.roomsService.leave(id, userId);
    return { message: 'Successfully left the room' };
  }

  @Get('invites/pending')
  @ApiOperation({ summary: 'Get list of pending room invites for the current user' })
  @ApiResponse({ status: 200, description: 'List of pending room invitations' })
  async getPendingInvites(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.roomsService.findPendingInvitesForUser(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search public rooms' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query for room name' })
  @ApiResponse({ status: 200, description: 'List of matching public rooms' })
  async search(@Query('q') q: string) {
    return this.roomsService.searchPublic(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific room by ID' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getById(@Param('id') id: string) {
    const room = await this.roomsService.findById(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  @Post(':id/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invite a user to a room' })
  @ApiResponse({ status: 200, description: 'Invitation created successfully' })
  @ApiResponse({ status: 403, description: 'Only members can invite users' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async invite(@Param('id') roomId: string, @Body() inviteUserDto: InviteUserDto, @Request() req) {
    const targetUserId = inviteUserDto.userId;
    const callerId = req.user?.id || req.user?.sub;
    const invite = await this.roomsService.createInvite(roomId, callerId, targetUserId);
    return { message: 'Successfully sent room invitation', invite };
  }

  @Post(':id/invites/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending room invitation' })
  @ApiResponse({ status: 200, description: 'Successfully accepted invitation and joined room' })
  @ApiResponse({ status: 404, description: 'Pending invite not found' })
  async acceptInvite(@Param('id') roomId: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    await this.roomsService.acceptInvite(roomId, userId);
    await this.chatGateway.onUserJoinedRoom(userId, roomId);
    return { message: 'Successfully accepted invitation and joined room' };
  }

  @Post(':id/invites/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending room invitation' })
  @ApiResponse({ status: 200, description: 'Successfully rejected invitation' })
  @ApiResponse({ status: 404, description: 'Pending invite not found' })
  async rejectInvite(@Param('id') roomId: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    await this.roomsService.rejectInvite(roomId, userId);
    return { message: 'Successfully rejected invitation' };
  }

  @Post(':id/request-join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a join request for a room' })
  @ApiResponse({ status: 200, description: 'Join request submitted' })
  @ApiResponse({ status: 400, description: 'Already a member' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async requestJoin(@Param('id') roomId: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const request = await this.roomsService.requestJoin(roomId, userId);
    return { message: 'Join request submitted successfully', request };
  }

  @Get(':id/join-requests')
  @ApiOperation({ summary: 'Get list of pending join requests for a room (room members/owner only)' })
  @ApiResponse({ status: 200, description: 'List of pending join requests' })
  @ApiResponse({ status: 403, description: 'Only room members can view join requests' })
  async getJoinRequests(@Param('id') roomId: string, @Request() req) {
    const callerId = req.user?.id || req.user?.sub;
    return this.roomsService.findPendingJoinRequests(roomId, callerId);
  }

  @Post(':id/join-requests/:userId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a user join request for a room (room members/owner only)' })
  @ApiResponse({ status: 200, description: 'Join request accepted' })
  @ApiResponse({ status: 403, description: 'Only room members can accept join requests' })
  @ApiResponse({ status: 404, description: 'Join request not found' })
  async acceptJoinRequest(@Param('id') roomId: string, @Param('userId') targetUserId: string, @Request() req) {
    const callerId = req.user?.id || req.user?.sub;
    await this.roomsService.acceptJoinRequest(roomId, targetUserId, callerId);
    await this.chatGateway.onUserJoinedRoom(targetUserId, roomId);
    return { message: 'Successfully accepted join request' };
  }

  @Post(':id/join-requests/:userId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a user join request for a room (room members/owner only)' })
  @ApiResponse({ status: 200, description: 'Join request rejected' })
  @ApiResponse({ status: 403, description: 'Only room members can reject join requests' })
  @ApiResponse({ status: 404, description: 'Join request not found' })
  async rejectJoinRequest(@Param('id') roomId: string, @Param('userId') targetUserId: string, @Request() req) {
    const callerId = req.user?.id || req.user?.sub;
    await this.roomsService.rejectJoinRequest(roomId, targetUserId, callerId);
    return { message: 'Successfully rejected join request' };
  }
}
