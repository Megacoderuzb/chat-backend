import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomMemberDocument = RoomMember & Document;

@Schema({
  timestamps: { createdAt: 'joinedAt', updatedAt: false },
})
export class RoomMember {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  joinedAt: Date;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });

RoomMemberSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret: any) => {
    if (ret.roomId) ret.roomId = ret.roomId.toString();
    if (ret.userId) ret.userId = ret.userId.toString();
    delete ret._id;
  },
});
