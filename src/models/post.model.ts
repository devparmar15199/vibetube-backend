import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

/**
 * Interface for Post document. (social feed feature)
 * Similar to Video but text-based; uses Like for interactions.
 */
export interface IPost extends Document {
    content: string;
    owner: mongoose.Types.ObjectId;
    likesCount: number;
    commentsCount: number;
    isDeleted: boolean;
    deletedAt?: Date;
}

// Schema definition
const postSchema = new Schema<IPost>({
    content: {
        type: String,
        required: [true, 'Post content is required'],
        maxLength: [1000, 'Post cannot exceed 1000 characters'],
        trim: true,
        index: 'text',  // For search/timeline
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
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: {
        type: Date,
    }
}, { 
    timestamps: true,
    autoIndex: process.env.NODE_ENV === 'development', 
});

// Indexes
postSchema.index({ owner: 1, createdAt: -1 });  // User posts
postSchema.index({ createdAt: -1 });  // Global timeline (descending)
postSchema.index({ isDeleted: 1 });

// Post-save: Could notify followers
postSchema.post('save', function (doc) {
    if (doc.isNew) console.log(`New post by ${doc.owner}`);
});

// Pagination
postSchema.plugin(mongooseAggregatePaginate);

// Soft delete
postSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
postSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Post = mongoose.model<IPost>('Post', postSchema);