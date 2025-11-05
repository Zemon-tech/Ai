import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, createdAt: -1 });

export type ConversationDocument = InferSchemaType<typeof ConversationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ConversationModel = mongoose.model('Conversation', ConversationSchema);


