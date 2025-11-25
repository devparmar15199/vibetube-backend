import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config';

/**
 * Interface for Like document (polymorphic for Video/Post/Comment).
 * Ensures unique likes per user-entity to prevent duplicates.
 */
export interface ILike extends Document {
    type: 'Comment' | 'Video' | 'Post';
    comment?: mongoose.Types.ObjectId;
    video?: mongoose.Types.ObjectId;
    post?: mongoose.Types.ObjectId;
    likedBy: mongoose.Types.ObjectId;
}

/**
 * Mongoose Schema for Like model.
 */
const likeSchema = new Schema<ILike>({
    type: {
        type: String,
        enum: ['Comment', 'Video', 'Post'],
        required: true,
        index: true,
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
        index: true,
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Unique sparse indexes
likeSchema.index({ likedBy: 1, comment: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, video: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, post: 1 }, { unique: true, sparse: true });

// Performance indexes
likeSchema.index({ type: 1, video: 1 });    // Video likes
likeSchema.index({ type: 1, post: 1 });    // Post likes
likeSchema.index({ type: 1, comment: 1 });    // Comment likes

// Post-save: Increment likesCount
likeSchema.post('save', async function (doc) {
    if (doc.isNew) {
        let updateTarget: string;
        let incValue = 1;
        switch (doc.type) {
            case 'Video':
                updateTarget = 'Video';
                break;
            case 'Post':
                updateTarget = 'Post';
                break;
            case 'Comment':
                updateTarget = 'Comment';
                break;
            default:
                return;
        }
        const targetId = doc.video || doc.post || doc.comment;
        await mongoose.model(updateTarget).findByIdAndUpdate(targetId, {
            $inc: { likesCount: incValue },
        });
    }
});

// Pre-deleteOne: Decrement likesCount
likeSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        let updateTarget: string;
        let targetId: mongoose.Types.ObjectId | undefined;
        switch (this.type) {
            case 'Video':
                updateTarget = 'Video';
                targetId = this.video;
                break;
            case 'Post':
                updateTarget = 'Post';
                targetId = this.post;
                break;
            case 'Comment':
                updateTarget = 'Comment';
                targetId = this.comment;
                break;
            default:
                return next();
        }
        if (targetId) {
            await mongoose.model(updateTarget).findByIdAndUpdate(targetId, { $inc: { likesCount: -1 } });
        }
        next();
    } catch (error) {
        next(error as Error);
    }
});

// toJSON
likeSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Like = mongoose.model<ILike>('Like', likeSchema);