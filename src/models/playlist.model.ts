import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { config } from '../config';

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

    /**
     * Virtual for video count
     */
    videoCount?: number;
}

/**
 * Mongoose schema for Playlist model.
 */
const playlistSchema = new Schema<IPlaylist>({
    name: {
        type: String,
        required: [true, 'Playlist name is required'],
        maxLength: [100, 'Playlist name cannot exceed 100 characters'],
        trim: true,
        index: 'text',
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
        type: String,
        trim: true, 
    },
    isPublic: { 
        type: Boolean, 
        default: true 
    },
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development', 
});

// Indexes
playlistSchema.index({ owner: 1, isPublic: 1, createdAt: -1 }); // User's playlists
playlistSchema.index({ isPublic: 1, createdAt: -1 }); // Public discovery

// Virtual for video count
playlistSchema.virtual('videoCount').get(function () {
    return this.videos.length;
});

// Pre-save: Auto-set thumbnail
playlistSchema.pre('save', async function (next) {
    if (!this.thumbnail && this.videos.length > 0) {
        const firstVideo = await mongoose.model('Video').findById(this.videos[0]).select('thumbnail');
        if (firstVideo) this.thumbnail = firstVideo.thumbnail;
    }
    next();
});

// Pagination
playlistSchema.plugin(mongooseAggregatePaginate);

// toJSON
playlistSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Playlist = mongoose.model<IPlaylist>('Playlist', playlistSchema);