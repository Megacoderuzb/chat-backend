import { Controller, Get, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req) {
    const userId = req.user?.id || req.user?.sub || '';
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    const userObj = { ...user };
    delete (userObj as any).passwordHash;
    return userObj;
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query for username' })
  @ApiQuery({ name: 'username', required: false, description: 'Search query for username (alias)' })
  @ApiResponse({ status: 200, description: 'List of matching users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(@Query('q') q: string, @Query('username') username: string, @Request() req) {
    const searchString = q || username || '';
    const userId = req.user?.id || req.user?.sub || '';
    return this.usersService.search(searchString, userId);
  }
}
