import mongoose, { Schema, Document } from 'mongoose';

export interface IView extends Document {
    video: mongoose.Types.ObjectId;
    viewer: mongoose.Types.ObjectId;    // User or IP for anonymous
    ipAddress?: string; // For unique views
    isDeleted: boolean;
}

const viewSchema = new Schema<IView>({
    video: {
        type: Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
    },
    viewer: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    ipAddress: { 
        type: String,
        maxLength: [45, 'IP address too long'] 
    },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Unique index for unique views per video/user or IP
viewSchema.index({ video: 1, viewer: 1 }, { unique: true, sparse: true });
viewSchema.index({ video: 1, ipAddress: 1 }, { unique: true, sparse: true });

// Performance indexes
viewSchema.index({ video: 1, createdAt: -1 });  // Video views timeline
viewSchema.index({ viewer: 1, createdAt: -1 }); // User watch history
viewSchema.index({ isDeleted: 1 });

// Soft delete
viewSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const View = mongoose.model<IView>('View', viewSchema);