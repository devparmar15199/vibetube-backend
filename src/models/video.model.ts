import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import type { IUser } from './user.model';
import { VIDEO_CATEGORIES } from '../utils/constants';
import { config } from '../config';

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
    category: typeof VIDEO_CATEGORIES[number];
    tags: mongoose.Types.ObjectId[]; // References to Tag model for categorization and search
    isPublished: boolean;
    subscribersOnly: boolean;   // Restrict to channel subscribers
    publishedAt: Date;

    /**
     * Virtual for owner population.
     */
    ownerDetails?: IUser;
}

/**
 * Mongoose schema for Video model.
 * Defines structure, validations, indexes, and hooks.
 */
const videoSchema = new Schema<IVideo>({
    videoFile: {
        type: String,
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
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxLength: [100, 'Title cannot exceed 100 characters'],
        trim: true,
        index: 'text',
    },
    description: {
        type: String,
        maxLength: [500, 'Description cannot exceed 500 characters'],
        trim: true,
        index: 'text',
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
        enum: VIDEO_CATEGORIES,
        default: 'Other',
        required: true,
        index: true,
    },
    tags: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Tag',
        }
    ],
    isPublished: { 
        type: Boolean, 
        default: true 
    },
    subscribersOnly: { 
        type: Boolean, 
        default: false,
    },
    publishedAt: { 
        type: Date, 
        default: Date.now, 
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development' 
});

// Compound indexes
videoSchema.index({ owner: 1, createdAt: -1 }); // User's video list
videoSchema.index({ category: 1, createdAt: -1 }); // Category-based feeds
videoSchema.index({ isPublished: 1, publishedAt: -1 }); // Published/recent videos
videoSchema.index({ subscribersOnly: 1, owner: 1 });  // Premium content per channel
videoSchema.index({ tags: 1, createdAt: -1 });  // Tag-based searches
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

// Pre-deleteOne: Clean up related data
videoSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        await mongoose.model('Analytics').deleteMany({ video: this._id });
        await mongoose.model('View').deleteMany({ video: this._id });
        await mongoose.model('Comment').deleteMany({ video: this._id });
        await mongoose.model('Like').deleteMany({ video: this._id });
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Pagination plugin
videoSchema.plugin(mongooseAggregatePaginate);

// toJSON: Add id and exclude __v
videoSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Video = mongoose.model<IVideo>('Video', videoSchema);