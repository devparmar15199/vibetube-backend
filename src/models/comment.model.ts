import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { config } from '../config';

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

    /**
     * Virtual for replies count.
     */
    repliesCount?: number;
}

/**
 * Mongoose schema for Comment model.
 */
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
        index: true,
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
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Indexes
commentSchema.index({ video: 1, createdAt: -1 });   // Video's comments (sorted)
commentSchema.index({ parentComment: 1, createdAt: -1 }); // Threaded replies
commentSchema.index({ owner: 1, createdAt: -1 }); // User's comments

// Virtual for replies count
commentSchema.virtual('repliesCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentComment',
    count: true,
})

// Post-save: Increment commentsCount
commentSchema.post('save', async function (doc) {
    if (doc.isNew) {
        await mongoose.model('Video').findByIdAndUpdate(doc.video, {
            $inc: { commentsCount: 1 },
        });
    }
});

// Pre-deleteOne: Decrement commentsCount and delete replies
commentSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        await mongoose.model('Video').findByIdAndUpdate(this.video, { $inc: { commentsCount: -1 } });
        await mongoose.model('Comment').deleteMany({ parentComment: this._id });
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Pagination
commentSchema.plugin(mongooseAggregatePaginate);

// toJSON
commentSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Comment = mongoose.model<IComment>('Comment', commentSchema);