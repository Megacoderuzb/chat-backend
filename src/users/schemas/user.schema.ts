import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class User {
  id?: string;

  @Prop({ unique: true, required: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret._id;
    delete ret.passwordHash;
  },
});
