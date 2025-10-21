import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import type { IUser } from './user.model';

/**
 * Interface for Subscription document (many-to-many user-channel relation).
 * Supports soft delete for unsubscribe without data loss.
 */
export interface ISubscription extends Document {
    subscriber: mongoose.Types.ObjectId;    // User who subscribes
    channel: mongoose.Types.ObjectId;   // Channel (User) being subscribed to
    isDeleted: boolean;
    deletedAt?: Date;

    /**
     * Virtuals for bidirectional population.
     */
    subscriberDetails?: IUser;
    channelDetails?: IUser;
}

// Schema definition
const subscriptionSchema = new Schema<ISubscription>({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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

// Unique compound index to prevent duplicate subscriptions
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

// Additional indexes for queries
subscriptionSchema.index({ channel: 1 }); // Channel's subscriber list
subscriptionSchema.index({ subscriber: 1 }); // User's subscriptions
subscriptionSchema.index({ isDeleted: 1 });

// Virtuals for population
subscriptionSchema.virtual('subscriberDetails', {
    ref: 'User',
    localField: 'subscriber',
    foreignField: '_id',
    justOne: true,
});
subscriptionSchema.virtual('channelDetails', {
    ref: 'User',
    localField: 'channel',
    foreignField: '_id',
    justOne: true,
});

// Post-save hook: Update channel's subscribersCount atomically
subscriptionSchema.post('save', async function (doc) {
    if (doc.isDeleted) return; // No update on delete
    await mongoose.model('User').findByIdAndUpdate(doc.channel, {
        $inc: { subscribersCount: 1 },
    });
});

// Soft delete filter
subscriptionSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
subscriptionSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);