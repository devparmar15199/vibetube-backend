import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

/**
 * Interface for Comment document.
 * Supports threading via parentComment.
 * likesCount denormalized; use Like model for details.
 */
export interface IComment extends Document {
    content: string;
    video: mongoose.Types.ObjectId;
    owner: mongoose.Types.ObjectId;
    likesCount: number;
    parentComment?: mongoose.Types.ObjectId; // For replies
    isDeleted: boolean;
    deletedAt?: Date;

    /**
     * Virtual for replies count.
     */
    repliesCount?: number;
}

// Schema definition
const commentSchema = new Schema<IComment>({
    content: {
        type: String,
        required: [true, 'Comment content is required'],
        maxLength: [500, 'Comment content cannot exceed 500 characters'],
        trim: true,
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
        index: true,    // For video comments
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,    // For user comments
    },
    likesCount: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
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
commentSchema.index({ video: 1, createdAt: -1 });   // Video's comments (sorted)
commentSchema.index({ parentComment: 1, createdAt: -1 }); // Threaded replies
commentSchema.index({ owner: 1, createdAt: -1 }); // User's comments
commentSchema.index({ isDeleted: 1 });

// Virtual for replies (sub-comments)
commentSchema.virtual('repliesCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentComment',
    count: true,
})

// Post-save: Increment video's commentsCount
commentSchema.post('save', async function (doc) {
    if (doc.isNew && !doc.isDeleted) {
        await mongoose.model('Video').findByIdAndUpdate(doc.video, {
            $inc: { commentsCount: 1 },
        });
    }
});

// Pagination for comment threads
commentSchema.plugin(mongooseAggregatePaginate);

// Soft delete
commentSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
commentSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Comment = mongoose.model<IComment>('Comment', commentSchema);