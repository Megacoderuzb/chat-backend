import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'super-secret-key-12345'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    MessagesModule,
    forwardRef(() => RoomsModule),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
