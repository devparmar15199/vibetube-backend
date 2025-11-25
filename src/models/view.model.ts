import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config';

/**
 * Interface for View document.
 * Tracks unique views (user or IP-based) for analytics.
 */
export interface IView extends Document {
    video: mongoose.Types.ObjectId;
    viewer?: mongoose.Types.ObjectId;    // Logged-in user (optional)
    ipAddress?: string; // Anonymous unique view (optional)
}

/**
 * Mongoose schema for View model.
 */
const viewSchema = new Schema<IView>({
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
        index: true,
    },
    viewer: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    ipAddress: { 
        type: String,
        maxLength: [45, 'IP address too long'],
        index: true,
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Unique sparse indexes
viewSchema.index({ video: 1, viewer: 1 }, { unique: true, sparse: true });
viewSchema.index({ video: 1, ipAddress: 1 }, { unique: true, sparse: true });

// Performance indexes
viewSchema.index({ video: 1, createdAt: -1 });  // Video history/timeline
viewSchema.index({ viewer: 1, createdAt: -1 }); // User watch history

// TTL index (90 days)
viewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

// Post-save: Increment views
viewSchema.post('save', async function (doc) {
    if (doc.isNew) {
        await mongoose.model('Video').findByIdAndUpdate(doc.video, {
            $inc: { views: 1 },
        });
    }
});

// toJSON
viewSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const View = mongoose.model<IView>('View', viewSchema);