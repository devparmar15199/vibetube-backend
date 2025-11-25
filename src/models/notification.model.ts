import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { NOTIFICATION_TYPES } from '../utils/constants';
import { config } from '../config';

/**
 * Interface for Notification document.
 * Batched for user feeds; supports unread counts.
 */
export interface INotification extends Document {
    user: mongoose.Types.ObjectId;
    type: typeof NOTIFICATION_TYPES[number];
    fromUser: mongoose.Types.ObjectId;
    video?: mongoose.Types.ObjectId;
    post?: mongoose.Types.ObjectId;
    comment?: mongoose.Types.ObjectId;
    message: string;
    isRead: boolean;
}

/**
 * Mongoose schema for Notification model.
 */
const notificationSchema = new Schema<INotification>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: NOTIFICATION_TYPES,
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
        index: true,
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Indexes
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });  // User's notification (unread first)
notificationSchema.index({ user: 1, isRead: 1 });    // Unread count
notificationSchema.index({ fromUser: 1, createdAt: -1 });    // Sender activity

// TTL index (30 days)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days

// Pagination
notificationSchema.plugin(mongooseAggregatePaginate);

// toJSON
notificationSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);