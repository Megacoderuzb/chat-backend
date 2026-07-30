import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomInviteDocument = RoomInvite & Document;

@Schema({
  timestamps: true,
})
export class RoomInvite {
  id?: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  inviterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  inviteeId: Types.ObjectId;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'rejected'] })
  status: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RoomInviteSchema = SchemaFactory.createForClass(RoomInvite);
RoomInviteSchema.index({ roomId: 1, inviteeId: 1 }, { unique: true });

RoomInviteSchema.set('toJSON', {
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

    if (ret.inviterId && typeof ret.inviterId === 'object' && ret.inviterId._id) {
      ret.inviter = ret.inviterId;
      ret.inviterId = ret.inviterId._id.toString();
    } else if (ret.inviterId) {
      ret.inviterId = ret.inviterId.toString();
    }

    if (ret.inviteeId && typeof ret.inviteeId === 'object' && ret.inviteeId._id) {
      ret.invitee = ret.inviteeId;
      ret.inviteeId = ret.inviteeId._id.toString();
    } else if (ret.inviteeId) {
      ret.inviteeId = ret.inviteeId.toString();
    }
    delete ret._id;
  },
});
