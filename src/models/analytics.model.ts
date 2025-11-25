import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config';

/**
 * Interface for Analytics document.
 * Aggregates daily metrics for videos (views, likes, comments) for performance tracking and reports.
 */
export interface IAnalytics extends Document {
    video: mongoose.Types.ObjectId;
    date: Date; // Date of the analytics snapshot
    views: number;
    likes: number;
    comments: number;
}

/**
 * Mongoose schema for Analytics model.
 */
const analyticsSchema = new Schema<IAnalytics>({
    video: { 
        type: Schema.Types.ObjectId, 
        ref: 'Video', 
        required: true,
        index: true, 
    },
    date: { 
        type: Date, 
        required: true,
        index: true, 
    },
    views: { 
        type: Number, 
        default: 0,
        min: 0, 
    },
    likes: { 
        type: Number, 
        default: 0,
        min: 0, 
    },
    comments: { 
        type: Number, 
        default: 0,
        min: 0, 
    },
}, {
    timestamps: true,
    autoIndex: config.nodeEnv === 'development',
});

// Indexes
analyticsSchema.index({ video: 1, date: -1 }); // Video analytics over time
analyticsSchema.index({ video: 1, date: 1 }, { unique: true }); // Unique daily entries per video

// Pre-save: Truncate date to day
analyticsSchema.pre('save', function (next) {
    this.date = new Date(this.date.setHours(0, 0, 0, 0));
    next();
});

// toJSON
analyticsSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Analytics = mongoose.model<IAnalytics>('Analytics', analyticsSchema);