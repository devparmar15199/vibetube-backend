import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { config } from '../config';

/**
 * Interface for WatchHistory document.
 * Tracks full watch history for users, allowing for unlimited entries with pagination.
 */
export interface IWatchHistory extends Document {
    user: mongoose.Types.ObjectId;
    video: mongoose.Types.ObjectId;
    watchedAt: Date;
    lastPosition?: number;  // Last watched position in seconds (for resume playback)
}

/**
 * Mongoose schema for WatchHistory model.
 */
const watchHistorySchema = new Schema<IWatchHistory>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
        index: true,
    },
    watchedAt: {
        type: Date,
        default: Date.now,
    },
    lastPosition: {
        type: Number,
        min: 0,
    },
}, {
    timestamps: true,
    autoIndex: config.nodeEnv === 'development',
});

// Indexes (allow multiple per user-video)
watchHistorySchema.index({ user: 1, watchedAt: -1 }); // User's history sorted by recency
watchHistorySchema.index({ video: 1, watchedAt: -1 }); // Video's watch history sorted by recency

// Pagination
watchHistorySchema.plugin(mongooseAggregatePaginate);

// toJSON
watchHistorySchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const WatchHistory = mongoose.model<IWatchHistory>('WatchHistory', watchHistorySchema);