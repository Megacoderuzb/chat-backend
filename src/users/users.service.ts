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

  async findById(id: string): Promise<UserDocument | null> {
    if (!id || !Types.ObjectId.isValid(id)) return null;
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

  async search(query: string, currentUserId: string): Promise<any[]> {
    const filter: any = {};
    if (query && query.trim()) {
      filter.username = { $regex: query.trim(), $options: 'i' };
    }
    if (currentUserId && Types.ObjectId.isValid(currentUserId)) {
      filter._id = { $ne: new Types.ObjectId(currentUserId) };
    }
    const users = await this.userModel.find(filter).limit(20).exec();
    return users.map((u) => (u.toJSON ? u.toJSON() : { id: u._id.toString(), username: u.username, createdAt: u.createdAt }));
  }
}
