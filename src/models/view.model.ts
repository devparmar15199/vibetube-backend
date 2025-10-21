import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';

/**
 * Interface for View document.
 * Tracks unique views (user or IP-based) for analytics.
 */
export interface IView extends Document {
    video: mongoose.Types.ObjectId;
    viewer: mongoose.Types.ObjectId;    // Logged-in user
    ipAddress?: string; // Anonymous unique view
    isDeleted: boolean;
    deletedAt?: Date;
}

// Schema definition
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
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: {
        type: Date,
    },
}, { 
    timestamps: true,
    autoIndex: process.env.NODE_ENV === 'development', 
});

// Unique indexes for uniqueness (sparse for optional viewer/ip)
viewSchema.index({ video: 1, viewer: 1 }, { unique: true, sparse: true });
viewSchema.index({ video: 1, ipAddress: 1 }, { unique: true, sparse: true });

// Performance
viewSchema.index({ video: 1, createdAt: -1 });  // Video history/timeline
viewSchema.index({ viewer: 1, createdAt: -1 }); // User watch history
viewSchema.index({ isDeleted: 1 });

// Post-save: Increment video views
viewSchema.post('save', async function (doc) {
    if (doc.isNew && !doc.isDeleted) {
        await mongoose.model('Video').findByIdAndUpdate(doc.video, {
            $inc: { views: 1 },
        });
    }
});

// Soft delete
viewSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
viewSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const View = mongoose.model<IView>('View', viewSchema);