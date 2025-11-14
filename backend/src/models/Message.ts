import mongoose, { Schema, InferSchemaType } from 'mongoose';

const MessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    attachments: [
      new Schema(
        {
          url: { type: String },
          mediaType: { type: String },
          filename: { type: String },
        },
        { _id: false }
      ),
    ],
    // Optional: persisted web research artifacts attached to assistant messages
    sources: [
      new Schema(
        {
          id: { type: Number },
          title: { type: String },
          link: { type: String },
          source: { type: String },
          favicon: { type: String },
          date: { type: String },
          snippet: { type: String },
        },
        { _id: false }
      ),
    ],
    webSummary: { type: String },
    researchBrief: { type: String },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export type MessageDocument = InferSchemaType<typeof MessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MessageModel = mongoose.model('Message', MessageSchema);


