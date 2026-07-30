import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({
  timestamps: true,
})
export class Message {
  id?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room', required: false, default: null })
  roomId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  recipientId?: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;

    if (ret.authorId) {
      if (typeof ret.authorId === 'object') {
        const authorObj = ret.authorId;
        const authorIdStr = authorObj._id
          ? authorObj._id.toString()
          : (typeof authorObj.toString === 'function' ? authorObj.toString() : String(authorObj));
        ret.author = {
          id: authorIdStr,
          username: authorObj.username || '',
        };
        ret.authorId = authorIdStr;
      } else {
        ret.authorId = ret.authorId.toString();
        if (!ret.author) {
          ret.author = { id: ret.authorId, username: '' };
        }
      }
    }

    if (ret.recipientId) {
      if (typeof ret.recipientId === 'object') {
        const recipientObj = ret.recipientId;
        const recipientIdStr = recipientObj._id
          ? recipientObj._id.toString()
          : (typeof recipientObj.toString === 'function' ? recipientObj.toString() : String(recipientObj));
        ret.recipient = {
          id: recipientIdStr,
          username: recipientObj.username || '',
        };
        ret.recipientId = recipientIdStr;
      } else {
        ret.recipientId = ret.recipientId.toString();
      }
    }

    if (ret.roomId) {
      if (typeof ret.roomId === 'object') {
        const roomObj = ret.roomId;
        ret.roomId = roomObj._id
          ? roomObj._id.toString()
          : (typeof roomObj.toString === 'function' ? roomObj.toString() : String(roomObj));
      } else {
        ret.roomId = ret.roomId.toString();
      }
    }

    if (ret.deletedAt) {
      ret.content = null;
    }

    delete ret._id;
  },
});
