import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
    subscriber: mongoose.Types.ObjectId;
    channel: mongoose.Types.ObjectId;
    isDeleted: boolean;
}

const subscriptionSchema = new Schema<ISubscription>({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

// Soft delete
subscriptionSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);