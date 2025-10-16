import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IVideo extends Document {
    videoFile: string;
    thumbnail: string;
    owner: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    duration: number;
    views: number;
    likesCount: number;
    commentsCount: number;
    category: 'Music' | 'Education' | 'Comedy' | 'Sports' | 'Gaming' | 'News' | 'Entertainment' | 'Lifestyle' | 'Other';
    isPublished: boolean;
    subscribersOnly: boolean;
    publishedAt: Date;
    isDeleted: boolean;
}

const videoSchema = new Schema<IVideo>({
    videoFile: {
        type: String,
        required: [true, 'Video file is required'],
    },
    thumbnail: {
        type: String,
        required: [true, 'Thumbnail is required'],
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxLength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
        type: String,
        maxLength: [500, 'Description cannot exceed 500 characters'],
    },
    duration: {
        type: Number,
        required: [true, 'Duration is required'],
        min: [1, 'Duration must be at least 1 second'],
    },
    views: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    category: { 
        type: String,
        enum: ['Music', 'Education', 'Comedy', 'Sports', 'Gaming', 'News', 'Entertainment', 'Lifestyle', 'Other'],
        default: 'Other',
        required: true,
        index: true,
    },
    isPublished: { type: Boolean, default: true },
    subscribersOnly: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Indexes
videoSchema.index({ owner: 1, createdAt: -1 }); // User videos
videoSchema.index({ category: 1, createdAt: -1 }); // Category feed
videoSchema.index({ isPublished: 1, publishedAt: -1 }); // Published videos
videoSchema.index({ subscribersOnly: 1 });  // Premium content
videoSchema.index({ isDeleted: 1 });

// Pagination plugin
videoSchema.plugin(mongooseAggregatePaginate);

// Soft delete middleware
videoSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Video = mongoose.model<IVideo>('Video', videoSchema);