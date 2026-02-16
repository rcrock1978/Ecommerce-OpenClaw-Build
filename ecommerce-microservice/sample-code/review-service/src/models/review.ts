import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
  verified: boolean;
  moderated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  productId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  orderId: { type: String, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: true },
  comment: { type: String, required: true },
  images: [{ type: String }],
  verified: { type: Boolean, default: false },
  moderated: { type: Boolean, default: false },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  moderationNotes: { type: String },
  helpful: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ verified: 1 });
ReviewSchema.index({ moderated: 1 });

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);