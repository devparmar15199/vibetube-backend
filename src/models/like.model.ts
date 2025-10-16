import mongoose, { Schema, Document } from 'mongoose';

export interface ILike extends Document {
    type: 'Comment' | 'Video' | 'Post';
    comment?: mongoose.Types.ObjectId;
    video?: mongoose.Types.ObjectId;
    post?: mongoose.Types.ObjectId;
    likedBy: mongoose.Types.ObjectId;
    isDeleted: boolean;
}

const likeSchema = new Schema<ILike>({
    type: {
        type: String,
        enum: ['Comment', 'Video', 'Post'],
        required: true,
    },
    comment: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
    },
    post: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
    },
    likedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Unique indexes to prevent duplicate likes (per entity type)
likeSchema.index({ likedBy: 1, comment: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, video: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, post: 1 }, { unique: true, sparse: true });

// Performance Indexes
likeSchema.index({ type: 1, video: 1 });    // Video likes count
likeSchema.index({ type: 1, post: 1 });    // Post likes count
likeSchema.index({ type: 1, comment: 1 });    // Comment likes count
likeSchema.index({ isDeleted: 1 });

// Soft delete
likeSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Like = mongoose.model<ILike>('Like', likeSchema);