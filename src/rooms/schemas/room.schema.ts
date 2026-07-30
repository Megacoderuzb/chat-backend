import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class Room {
  id?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ default: false })
  isPrivate: boolean;

  createdAt: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    if (ret.ownerId) ret.ownerId = ret.ownerId.toString();
    delete ret._id;
  },
});
