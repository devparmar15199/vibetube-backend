import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface INotification extends Document {
    user: mongoose.Types.ObjectId;  // Recipient
    type: 'subscription' | 'like' | 'comment' | 'video_upload' | 'mention';
    fromUser: mongoose.Types.ObjectId;
    video?: mongoose.Types.ObjectId;
    post?: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId;
    message: string;
    isRead: boolean;
    isDeleted: boolean;
}

const notificationSchema = new Schema<INotification>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['subscription', 'like', 'comment', 'video_upload', 'mention'],
        required: true,
    },
    fromUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    video: { type: Schema.Types.ObjectId, ref: 'Video' },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    comment: { type: Schema.Types.ObjectId, ref: 'Comment' },
    message: { 
        type: String, 
        required: true,
        maxlength: [200, 'Notification message too long'] 
    },
    isRead: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Index for user and unread notifications
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });    // User notifications
notificationSchema.index({ user: 1, isRead: 1 });    // Unread count
notificationSchema.index({ fromUser: 1, createdAt: -1 });    // User activity
notificationSchema.index({ isDeleted: 1 });

// Pagination plugin
notificationSchema.plugin(mongooseAggregatePaginate);

// Soft delete
notificationSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);