import mongoose, { Schema, Document } from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

export interface IPlaylist extends Document {
    name: string;
    description?: string;
    videos: mongoose.Types.ObjectId[];
    owner: mongoose.Types.ObjectId;
    thumbnail?: string;
    isPublic: boolean;
    isDeleted: boolean;
}

const playlistSchema = new Schema<IPlaylist>({
    name: {
        type: String,
        required: [true, 'Playlist name is required'],
        maxLength: [100, 'Playlist name cannot exceed 100 characters'],
    },
    description: { 
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters'] 
    },
    videos: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Video',
        }
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    thumbnail: { type: String },
    isPublic: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Index for owner queries
playlistSchema.index({ owner: 1, isPublic: 1, createdAt: -1 }); // User playlists
playlistSchema.index({ isPublic: 1, createdAt: -1 }); // Public playlists
playlistSchema.index({ isDeleted: 1 });

// Pagination plugin
playlistSchema.plugin(mongooseAggregatePaginate);

// Soft delete
playlistSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const Playlist = mongoose.model<IPlaylist>('Playlist', playlistSchema);