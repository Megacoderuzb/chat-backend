import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req) {
    const user = req.user;
    return {
      id: user._id ? user._id.toString() : user.id,
      username: user.username,
      createdAt: user.createdAt,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query for username' })
  @ApiResponse({ status: 200, description: 'List of matching users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(@Query('q') q: string, @Request() req) {
    const userId = req.user?._id ? req.user._id.toString() : (req.user?.id ? req.user.id.toString() : '');
    return this.usersService.search(q || '', userId);
  }
}
