import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import type { IUser } from './user.model';

/**
 * Interface for Video document.
 */
export interface IVideo extends Document {
    videoFile: string;  // Cloudinary secure URL
    thumbnail: string;  // Cloudinary URL
    owner: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    duration: number;   // In seconds
    views: number;  // Denormalized count (increment via View model)
    likesCount: number; // Denormalized; update atmoically from Like model
    commentsCount: number;  // Denormalized; update from Comment model
    category: 'Music' | 'Education' | 'Comedy' | 'Sports' | 'Gaming' | 'News' | 'Entertainment' | 'Lifestyle' | 'Other';
    isPublished: boolean;
    subscribersOnly: boolean;   // Restrict to channel subscribers
    publishedAt: Date;
    isDeleted: boolean;
    deletedAt?: Date;

    /**
     * Virtual for owner population.
     */
    ownerDetails?: IUser;
}

// Schema with validations
const videoSchema = new Schema<IVideo>({
    videoFile: {
        type: String,   // Cloudinary secure URL
        required: [true, 'Video file is required'],
        trim: true,
    },
    thumbnail: {
        type: String,
        required: [true, 'Thumbnail is required'],
        trim: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,    // For owner queries
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxLength: [100, 'Title cannot exceed 100 characters'],
        trim: true,
        index: 'text',  // For search
    },
    description: {
        type: String,
        maxLength: [500, 'Description cannot exceed 500 characters'],
        trim: true,
        index: 'text',  // For search
    },
    duration: {
        type: Number,
        required: [true, 'Duration is required'],
        min: [1, 'Duration must be at least 1 second'],
    },
    views: {
        type: Number, 
        default: 0, 
        min: 0 
    },
    likesCount: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    commentsCount: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    category: { 
        type: String,
        enum: ['Music', 'Education', 'Comedy', 'Sports', 'Gaming', 'News', 'Entertainment', 'Lifestyle', 'Other'],
        default: 'Other',
        required: true,
        index: true,    // For category feeds
    },
    isPublished: { 
        type: Boolean, 
        default: true 
    },
    subscribersOnly: { 
        type: Boolean, 
        default: false 
    },
    publishedAt: { 
        type: Date, 
        default: Date.now   // Set on publish 
    },
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: {
        type: Date,
    }
}, { 
    timestamps: true,
    autoIndex: process.env.NODE_ENV === 'development' 
});

// Compound indexes for feeds and searches
videoSchema.index({ owner: 1, createdAt: -1 }); // User's video list
videoSchema.index({ category: 1, createdAt: -1 }); // Category-based feeds
videoSchema.index({ isPublished: 1, publishedAt: -1 }); // Published/recent videos
videoSchema.index({ subscribersOnly: 1, owner: 1 });  // Premium content per channel
videoSchema.index({ isDeleted: 1 });
videoSchema.index({ title: 'text', description: 'text' });  // Full-text search

// Virtual for owner
videoSchema.virtual('ownerDetails', {
    ref: 'User',
    localField: 'owner',
    foreignField: '_id',
    justOne: true,
});

// Pre-save: Set publishedAt only if publishing
videoSchema.pre('save', function (next) {
    if (this.isModified('isPublished') && this.isPublished) {
        this.publishedAt = new Date();
    }
    next();
});

// Pagination plugin for aggregate queries
videoSchema.plugin(mongooseAggregatePaginate);

// Soft delete filter
videoSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON transform
videoSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Video = mongoose.model<IVideo>('Video', videoSchema);