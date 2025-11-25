import mongoose, { Schema, Document } from 'mongoose';
import type { IUser } from './user.model';
import { config } from '../config';

/**
 * Interface for Subscription document (many-to-many user-channel relation).
 */
export interface ISubscription extends Document {
    subscriber: mongoose.Types.ObjectId;    // User who subscribes
    channel: mongoose.Types.ObjectId;   // Channel (User) being subscribed to

    /**
     * Virtuals for bidirectional population.
     */
    subscriberDetails?: IUser;
    channelDetails?: IUser;
}

/**
 * Mongoose schema for Subscription model.
 */
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
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development',
});

// Unique compound index to prevent duplicate subscriptions
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

// Additional indexes
subscriptionSchema.index({ channel: 1 }); // Channel's subscriber list
subscriptionSchema.index({ subscriber: 1 }); // User's subscriptions

// Virtuals
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

// Post-save hook: Increment subscribersCount
subscriptionSchema.post('save', async function (doc) {
    await mongoose.model('User').findByIdAndUpdate(doc.channel, {
        $inc: { subscribersCount: 1 },
    });
});

// Pre-deleteOne: Decrement subscribersCount
subscriptionSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        await mongoose.model('User').findByIdAndUpdate(this.channel, { $inc: { subscribersCount: -1 } });
        next();
    } catch (error) {
        next(error as Error);
    }
});

// toJSON
subscriptionSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);