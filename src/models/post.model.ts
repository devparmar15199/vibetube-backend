import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { config } from '../config';

/**
 * Interface for Post document. (social feed feature)
 * Similar to Video but text-based; uses Like for interactions.
 */
export interface IPost extends Document {
    content: string;
    owner: mongoose.Types.ObjectId;
    likesCount: number;
    commentsCount: number;
}

/**
 * Mongoose schema for Post model.
 */
const postSchema = new Schema<IPost>({
    content: {
        type: String,
        required: [true, 'Post content is required'],
        maxLength: [1000, 'Post cannot exceed 1000 characters'],
        trim: true,
        index: 'text',
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
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
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Indexes
postSchema.index({ owner: 1, createdAt: -1 });  // User posts
postSchema.index({ createdAt: -1 });  // Global timeline (descending)

// Pre-deleteOne: Clean up related data
postSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        await mongoose.model('Like').deleteMany({ post: this._id });
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Pagination
postSchema.plugin(mongooseAggregatePaginate);

// toJSON
postSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Post = mongoose.model<IPost>('Post', postSchema);