import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | null> {
    if (!id) return null;
    return this.userRepository.findOne({ where: { id } });
  }

  async create(username: string, passwordHash: string): Promise<User> {
    const existing = await this.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    const user = this.userRepository.create({ username, passwordHash });
    return this.userRepository.save(user);
  }

  async search(query: string, currentUserId: string): Promise<any[]> {
    const qb = this.userRepository.createQueryBuilder('user');
    if (query && query.trim()) {
      qb.andWhere('user.username ILIKE :query', { query: `%${query.trim()}%` });
    }
    if (currentUserId) {
      qb.andWhere('user.id != :currentUserId', { currentUserId });
    }
    const users = await qb.limit(20).getMany();
    return users.map((u) => ({ id: u.id, username: u.username, createdAt: u.createdAt }));
  }
}
