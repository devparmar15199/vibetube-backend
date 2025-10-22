import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Playlist, type IPlaylist } from '../models/playlist.model';
import { Video } from '../models/video.model';
import { type IUser } from '../models/user.model';
import { uploadToCloudinary } from '../utils/cloudinarySetup';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';

interface CreatePlaylistBody {
    name: string;
    description?: string;
    isPublic?: boolean;
}

interface UpdatePlaylistBody {
    name?: string;
    description?: string;
    isPublic?: boolean;
}

interface PaginationParams {
    page?: string;
    limit?: string;
    search?: string;
}

/**
 * @route POST /playlists
 * @desc Create a new playlist
 * @access Private
 */
export const createPlaylist = async (
    req: Request<{}, {}, CreatePlaylistBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ playlist: IPlaylist | null } | null>>
) => {
    try {
        const user = req.user;
        const { name, description, isPublic = true } = req.body;

        if (!name?.trim()) {
            return res.status(400).json(ApiResponse.error(400, null, 'Playlist name is required'));
        }

        // Optional thumbnail upload
        const file = req.file;
        let thumbnailUrl: string | undefined;
        if (file) {
            const thumbnailResult = await uploadToCloudinary(file.path, 'image');
            thumbnailUrl = thumbnailResult?.secure_url;
        }
        
        const playlist = await Playlist.create({
            name: name?.trim(),
            description: description?.trim(),
            owner: user?._id,
            thumbnail: thumbnailUrl,
            isPublic,
            videos: [],
            isDeleted: false
        });

        return res.status(200).json(
            ApiResponse.success(
                { playlist },
                'Playlist created successfully',
                200
            )
        );
        
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while creating playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /playlists/user
 * @desc Get authenticated user's playlists
 * @access Private
 */
export const getUserPlaylists = async (
    req: Request<{}, {}, {}, PaginationParams, { user: IUser }>,
    res: Response<ApiResponse<{ playlists: IPlaylist[]; totalPlaylists: number } | null>>
) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {
            owner: user?._id,
            isDeleted: { $ne: true }
        };

        const playlists = await Playlist.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $project: {
                    name: 1,
                    description: 1,
                    thumbnail: 1,
                    isPublic: 1,
                    videoCount: { $size: '$videos' },
                    createdAt: 1
                }
            }
        ]);

        const totalPlaylists = await Playlist.countDocuments(match);
        
        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalPlaylists,
                totalPages: Math.ceil(totalPlaylists / Number(limit))
            }
        };
        
        return res.status(200).json(
            ApiResponse.success(
                { playlists, totalPlaylists }, 
                'User Playlists fetched successfully', 
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching user playlists',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /playlists/:id
 * @desc Get playlist by ID
 * @access Public
 */
export const getPlaylistById = async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<{ playlist: IPlaylist | null } | null>>
) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findById(playlistId)
            .populate({
                path: 'videos',
                match: { isPublished: true, isDeleted: { $ne: true } },
                select: '_id title description duration views likesCount createdAt',
                options: { sort: { createdAt: -1 } }
            });
        
        if (!playlist) {
            return res.status(404).json(ApiResponse.error(404, null, 'Playlist not found'));
        }
        
        // Access control: Public or owner
        if (!playlist.isPublic && (!userId || !playlist.owner.equals(userId))) {
            return res.status(403).json(ApiResponse.error(403, null, 'Access denied to private playlist'));
        }

        return res.status(200).json(
            ApiResponse.success(
                { playlist }, 
                'Playlist fetched successfully', 
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /playlists/:id
 * @desc Update playlist details
 * @access Private
 */
export const updatePlaylist = async (
    req: Request<{ id: string }, {}, UpdatePlaylistBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ playlist: IPlaylist | null } | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { name, description, isPublic } = req.body;

        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user?._id,
            isDeleted: { $ne: true }
        });

        if (!playlist) {
            return res.status(404).json(ApiResponse.error(404, null, 'Playlist not found or access denied'));
        }

        // Optional thumbnail update
        const file = req.file;
        let thumbnailUrl: string | undefined = playlist.thumbnail;
        if (file) {
            const thumbnailResult = await uploadToCloudinary(file.path, 'image');
            thumbnailUrl = thumbnailResult?.secure_url;
        }
        
        const updateData: any = {
            name: name?.trim() || playlist.name,
            description: description?.trim() || playlist.description,
            isPublic: isPublic !== undefined ? isPublic : playlist.isPublic,
            thumbnail: thumbnailUrl
        };

        const updatedPlaylist = await Playlist.findByIdAndUpdate(
            playlistId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        return res.status(200).json(
            ApiResponse.success(
                { playlist: updatedPlaylist },
                'Playlist updated successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while updating playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /playlists/:id
 * @desc Soft delete a playlist
 * @access Private
 */
export const deletePlaylist = async (
    req: Request<{ id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findOneAndUpdate(
            {
                _id: playlistId,
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!playlist) {
            return res.status(404).json(ApiResponse.error(404, null, 'Playlist not found or access denied'));
        }

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Playlist deleted successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while deleting playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /playlists
 * @desc Get all public playlists
 * @access Public
 */
export const getPublicPlaylists = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ playlists: IPlaylist[]; totalPlaylists: number } | null>>
) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {
            isPublic: true,
            isDeleted: { $ne: true }
        };
        if (search) {
            match.name = { $regex: search, $options: 'i' };
        }

        const playlists = await Playlist.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'ownerDetails',
                    pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }]
                }
            },
            { $unwind: '$ownerDetails' },
            {
                $project: {
                    name: 1,
                    description: 1,
                    thumbnail: 1,
                    videoCount: { $size: '$videos' },
                    createdAt: 1,
                    owner: '$ownerDetails'
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalPlaylists = await Playlist.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalPlaylists,
                totalPages: Math.ceil(totalPlaylists / Number(limit))
            }
        };
        
        return res.status(200).json(
            ApiResponse.success(
                { playlists, totalPlaylists },
                'Public playlists fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching public playlists',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /playlists/:id/videos/:videoId
 * @desc Add a video to a playlist
 * @access Private
 */
export const addVideoToPlaylist = async (
    req: Request<{ id: string; videoId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ videoCount: number } | null>>
) => {
    try {
        const user = req.user;
        const { id, videoId } = req.params;
        const playlistId = new mongoose.Types.ObjectId(id);
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user?._id,
            isDeleted: { $ne: true }
        });

        if (!playlist) {
            return res.status(404).json(ApiResponse.error(404, null, 'Playlist not found or access denied'));
        }

        // Check if video exists
        const video = await Video.findById(videoObjectId);
        if (!video) {
            return res.status(404).json(ApiResponse.error(404, null, 'Video not found'));
        }

        // Add if not already in playlist
        if (playlist.videos.includes(videoObjectId)) {
            return res.status(400).json(ApiResponse.error(400, null, 'Video already in playlist'));
        }

        await Playlist.findByIdAndUpdate(
            playlistId,
            { $push: { videos: videoObjectId } }
        );

        return res.status(200).json(
            ApiResponse.success(
                { videoCount: playlist.videos.length + 1 },
                'Video added to playlist successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while adding video to playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /playlists/:id/videos/:videoId
 * @desc Remove a video from a playlist
 * @access Private
 */
export const removeVideoFromPlaylist = async (
    req: Request<{ id: string; videoId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ videoCount: number } | null>>
) => {
    try {
        const user = req.user;
        const { id, videoId } = req.params;
        const playlistId = new mongoose.Types.ObjectId(id);
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user?._id,
            isDeleted: { $ne: true }
        });

        if (!playlist) {
            return res.status(404).json(ApiResponse.error(404, null, 'Playlist not found or access denied'));
        }

        // Remove if exists
        if (!playlist.videos.includes(videoObjectId)) {
            return res.status(400).json(ApiResponse.error(400, null, 'Video not in playlist'));
        }

        await Playlist.findByIdAndUpdate(
            playlistId,
            { $pull: { videos: videoObjectId } }
        );

        return res.status(200).json(
            ApiResponse.success(
                { videoCount: playlist.videos.length - 1 },
                'Video removed to playlist successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while removing video from playlist',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

