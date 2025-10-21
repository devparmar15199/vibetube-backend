import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';

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
    isDeleted: boolean;
    deletedAt?: Date;
}

// Schema definition
const likeSchema = new Schema<ILike>({
    type: {
        type: String,
        enum: ['Comment', 'Video', 'Post'],
        required: true,
        index: true,    // For type-based queries
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

// Unique sparse indexes (ignore nulls for optional fields)
likeSchema.index({ likedBy: 1, comment: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, video: 1 }, { unique: true, sparse: true });
likeSchema.index({ likedBy: 1, post: 1 }, { unique: true, sparse: true });

// Performance indexes for counts
likeSchema.index({ type: 1, video: 1 });    // Video likes
likeSchema.index({ type: 1, post: 1 });    // Post likes
likeSchema.index({ type: 1, comment: 1 });    // Comment likes
likeSchema.index({ isDeleted: 1 });

// Post-save: Update entity's likesCount
likeSchema.post('save', async function (doc) {
    if (doc.isNew && !doc.isDeleted) {
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
        // Map field to ID
        const targetId = doc.video || doc.post || doc.comment;
        await mongoose.model(updateTarget).findByIdAndUpdate(targetId, {
            $inc: { likesCount: incValue },
        });
    }
});

// Soft delete
likeSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
likeSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Like = mongoose.model<ILike>('Like', likeSchema);