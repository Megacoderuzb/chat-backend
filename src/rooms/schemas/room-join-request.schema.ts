import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomJoinRequestDocument = RoomJoinRequest & Document;

@Schema({
  timestamps: true,
})
export class RoomJoinRequest {
  id?: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'rejected'] })
  status: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RoomJoinRequestSchema = SchemaFactory.createForClass(RoomJoinRequest);
RoomJoinRequestSchema.index({ roomId: 1, userId: 1 }, { unique: true });

RoomJoinRequestSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    if (ret.roomId && typeof ret.roomId === 'object' && ret.roomId._id) {
      ret.room = ret.roomId;
      ret.roomId = ret.roomId._id.toString();
    } else if (ret.roomId) {
      ret.roomId = ret.roomId.toString();
    }

    if (ret.userId && typeof ret.userId === 'object' && ret.userId._id) {
      ret.user = ret.userId;
      ret.userId = ret.userId._id.toString();
    } else if (ret.userId) {
      ret.userId = ret.userId.toString();
    }
    delete ret._id;
  },
});
