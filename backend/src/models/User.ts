import mongoose, { Schema, InferSchemaType } from 'mongoose';

const RefreshTokenSchema = new Schema(
  {
    tokenId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserModel = mongoose.model('User', UserSchema);


