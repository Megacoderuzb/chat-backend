import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, password } = registerDto;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await this.usersService.create(username, passwordHash);
    
    const userId = user._id ? user._id.toString() : (user as any).id;
    const payload = { sub: userId, username: user.username };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = user._id ? user._id.toString() : (user as any).id;
    const payload = { sub: userId, username: user.username };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }
}
