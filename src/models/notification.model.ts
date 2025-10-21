import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

/**
 * Interface for Notification document.
 * Batched for user feeds; supports unread counts.
 */
export interface INotification extends Document {
    user: mongoose.Types.ObjectId;
    type: 'subscription' | 'like' | 'comment' | 'video_upload' | 'mention';
    fromUser: mongoose.Types.ObjectId;
    video?: mongoose.Types.ObjectId;
    post?: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId;
    message: string;
    isRead: boolean;
    isDeleted: boolean;
    deletedAt?: Date;
}

// Schema definition
const notificationSchema = new Schema<INotification>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true, // Core query field
    },
    type: {
        type: String,
        enum: ['subscription', 'like', 'comment', 'video_upload', 'mention'],
        required: true,
        index: true,
    },
    fromUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    video: { 
        type: Schema.Types.ObjectId, 
        ref: 'Video' 
    },
    post: { 
        type: Schema.Types.ObjectId, 
        ref: 'Post' 
    },
    comment: { 
        type: Schema.Types.ObjectId, 
        ref: 'Comment' 
    },
    message: { 
        type: String, 
        required: true,
        maxlength: [200, 'Notification message too long'],
        trim: true,
    },
    isRead: { 
        type: Boolean, 
        default: false,
        index: true,    // For unread queries 
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
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });  // User's notification (unread first)
notificationSchema.index({ user: 1, isRead: 1 });    // Unread count
notificationSchema.index({ fromUser: 1, createdAt: -1 });    // Sender activity
notificationSchema.index({ isDeleted: 1 });

// Pagination
notificationSchema.plugin(mongooseAggregatePaginate);

// Soft delete
notificationSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
notificationSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);