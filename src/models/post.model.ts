import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IPost extends Document {
    content: string;
    owner: mongoose.Types.ObjectId;
    likesCount: number;
    commentsCount: number;
    isDeleted: boolean;
}

const postSchema = new Schema<IPost>({
    content: {
        type: String,
        required: [true, 'Post content is required'],
        maxLength: [1000, 'Post cannot exceed 1000 characters'],
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Index for owner and timeline queries
postSchema.index({ owner: 1, createdAt: -1 });  // User posts
postSchema.index({ createdAt: -1 });  // Timeline feed
postSchema.index({ isDeleted: 1 });

// Pagination plugin
postSchema.plugin(mongooseAggregatePaginate);

// Soft delete
postSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Post = mongoose.model<IPost>('Post', postSchema);