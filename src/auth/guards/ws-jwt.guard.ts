import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UsersService } from '../../users/users.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();

      if (client['user'] || client.data?.user) {
        return true;
      }

      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        throw new WsException('Unauthorized');
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;
      const user = await this.usersService.findById(userId);

      if (!user) {
        throw new WsException('Unauthorized');
      }

      client['user'] = user;
      if (!client.data) client.data = {};
      client.data.user = user;
      return true;
    } catch (err) {
      this.logger.error(`WS Authentication failed: ${err.message}`);
      throw new WsException('Unauthorized');
    }
  }
}
