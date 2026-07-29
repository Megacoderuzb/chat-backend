import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: any): Promise<UserDocument | null> {
    if (!id || !Types.ObjectId.isValid(id.toString())) return null;
    return this.userModel.findById(id).exec();
  }

  async create(username: string, passwordHash: string): Promise<UserDocument> {
    const existing = await this.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    const user = new this.userModel({ username, passwordHash });
    return user.save();
  }

  async search(query: string, currentUserId: any): Promise<any[]> {
    if (!query || !query.trim()) return [];
    const filter: any = {
      username: { $regex: query.trim(), $options: 'i' },
    };
    if (currentUserId && Types.ObjectId.isValid(currentUserId.toString())) {
      filter._id = { $ne: new Types.ObjectId(currentUserId.toString()) };
    }
    const users = await this.userModel.find(filter).limit(20).exec();
    return users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      createdAt: u.createdAt,
    }));
  }
}
