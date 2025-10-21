import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

/**
 * Interface for Playlist document.
 */
export interface IPlaylist extends Document {
    name: string;
    description?: string;
    videos: mongoose.Types.ObjectId[];  // Ref to Videos
    owner: mongoose.Types.ObjectId;
    thumbnail?: string;     // Optional; can auto-generate from first video
    isPublic: boolean;
    isDeleted: boolean;
    deletedAt?: Date;

    /**
     * Virtual for video count
     */
    videoCount?: number;
}

// Schema definition
const playlistSchema = new Schema<IPlaylist>({
    name: {
        type: String,
        required: [true, 'Playlist name is required'],
        maxLength: [100, 'Playlist name cannot exceed 100 characters'],
        trim: true,
        index: 'text',  // For search
    },
    description: { 
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        trim: true,
    },
    videos: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Video',
            // Limit for scalability
            validate: {
                validator: function (v: mongoose.Types.ObjectId[]) {
                    return v.length <= 500;
                },
                message: 'Playlist cannot exceed 500 videos',
            },
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    thumbnail: { 
        type: String,   // Cloudinary URL
        trim: true, 
    },
    isPublic: { 
        type: Boolean, 
        default: true 
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

// Indexes
playlistSchema.index({ owner: 1, isPublic: 1, createdAt: -1 }); // User's playlists
playlistSchema.index({ isPublic: 1, createdAt: -1 }); // Public discovery
playlistSchema.index({ name: 'text' }); // Search
playlistSchema.index({ isDeleted: 1 });

// Virtual for video count (efficient without population)
playlistSchema.virtual('videoCount').get(function () {
    return this.videos.length;
});

// Pagination for listing playlists
playlistSchema.plugin(mongooseAggregatePaginate);

// Soft delete
playlistSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// toJSON
playlistSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

export const Playlist = mongoose.model<IPlaylist>('Playlist', playlistSchema);