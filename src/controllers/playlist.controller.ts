import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Playlist } from '../models/playlist.model';
import { Video } from '../models/video.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { uploadToCloudinary } from '../utils/cloudinarySetup';
// import { addNotificationJob } from '../queue/notificationQueue';
import { NOTIFICATION_TYPES } from '../utils/constants';
import logger from '../utils/logger';

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
 * @route POST /api/v1/playlists
 * @description Create a new playlist
 * @access Private (requires authentication)
 * @param {Object} body - Playlist data (name, description, isPublic)
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Created playlist
 */
export const createPlaylist = async (
    req: Request<{}, {}, CreatePlaylistBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { name, description, isPublic = true } = req.body;

        // Validation is handled by middleware, but double-check name
        if (!name?.trim()) {
            throw new ApiError(400, 'Playlist name is required', []);
        }

        // Upload thumbnail to Cloudinary if provided
        const file = req.file;
        let thumbnailUrl: string | undefined;
        if (file) {
            const thumbnailResult = await uploadToCloudinary(file.path, 'image', {
                folder: 'playlists',
                transformation: [{ width: 400, height: 225, crop: 'fill' }],
            });
            if (!thumbnailResult?.secure_url) {
                throw new ApiError(500, 'Failed to upload thumbnail', []);
            }
            thumbnailUrl = thumbnailResult.secure_url;
        }

        const playlist = await Playlist.create({
            name: name.trim(),
            description: description?.trim(),
            owner: user._id,
            thumbnail: thumbnailUrl,
            isPublic,
            videos: [],
        });

        logger.info(`Playlist ${playlist._id} created by user ${user._id}`);

        return res.status(201).json(
            ApiResponse.success(
                { playlist },
                'Playlist created successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in createPlaylist: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while creating playlist',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/playlists/user
 * @description Get playlists owned by the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of user's playlists with pagination
 */
export const getUserPlaylists = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = { owner: user._id };

        const playlists = await Playlist.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'videos',
                    localField: 'videos',
                    foreignField: '_id',
                    as: 'videos',
                    pipeline: [
                        { $match: { isPublished: true } },
                        { $project: { title: 1, thumbnail: 1 } },
                    ],
                },
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    thumbnail: 1,
                    isPublic: 1,
                    videoCount: { $size: '$videos' },
                    videos: 1,
                    createdAt: 1
                },
            },
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
        
        logger.info(`Fetched playlists for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { playlists, totalPlaylists },
                'User playlists fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getUserPlaylists: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user playlists',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/playlists/:id
 * @description Get a specific playlist by ID
 * @access Public
 * @param {string} id - Playlist ID
 * @returns {ApiResponse} Playlist details
 */
export const getPlaylistById = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        // Validate playlist ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid playlist ID', []);
        }

        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findById(playlistId)
            .populate({
                path: 'videos',
                match: { isPublished: true },
                select: '_id title description duration views likesCount createdAt',
                options: { sort: { createdAt: -1 } }
            });
        
        if (!playlist) {
            throw new ApiError(404, 'Playlist not found', []);
        }
        
        // Access control: Public or owner
        if (!playlist.isPublic && (!userId || !playlist.owner.equals(userId))) {
            throw new ApiError(403, 'Access denied to private playlist', []);
        }

        logger.info(`Fetched playlist ${id} for user ${userId || 'anonymous'}`);

        return res.status(200).json(
            ApiResponse.success(
                { playlist },
                'Playlist fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getPlaylistById: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching playlist',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/playlists/:id
 * @description Update a playlist's details
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {Object} body - Updated playlist data (name, description, isPublic)
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Updated playlist
 */
export const updatePlaylist = async (
    req: Request<{ id: string }, {}, UpdatePlaylistBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;
        const { name, description, isPublic } = req.body;

        // Validate playlist ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid playlist ID', []);
        }

        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user._id
        });

        if (!playlist) {
            throw new ApiError(404, 'Playlist not found or you do not own it', []);
        }

        // Upload new thumbnail if provided
        let thumbnailUrl: string | undefined = playlist.thumbnail;
        const file = req.file;
        if (file) {
            const thumbnailResult = await uploadToCloudinary(file.path, 'image', {
                folder: 'playlists',
                transformation: [{ width: 400, height: 225, crop: 'fill' }],
            });
            if (!thumbnailResult?.secure_url) {
                throw new ApiError(500, 'Failed to upload thumbnail', []);
            }
            thumbnailUrl = thumbnailResult.secure_url;
        }
        
        const updateData: any = {
            name: name?.trim() || playlist.name,
            description: description?.trim() !== undefined ? description.trim() : playlist.description,
            isPublic: isPublic !== undefined ? isPublic : playlist.isPublic,
            thumbnail: thumbnailUrl,
        };

        const updatedPlaylist = await Playlist.findByIdAndUpdate(
            playlistId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        logger.info(`Playlist ${id} updated by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { playlist: updatedPlaylist },
                'Playlist updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updatePlaylist: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating playlist',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/playlists/:id
 * @description Delete a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @returns {ApiResponse} Success message
 */
export const deletePlaylist = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;

        // Validate playlist ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid playlist ID', []);
        }

        const playlistId = new mongoose.Types.ObjectId(id);

        const playlist = await Playlist.findOneAndDelete({
            _id: playlistId,
            owner: user._id
        });

        if (!playlist) {
            throw new ApiError(404, 'Playlist not found or you do not own it', []);
        }

        logger.info(`Playlist ${id} deleted by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Playlist deleted successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in deletePlaylist: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting playlist',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/playlists
 * @description Get all public playlists
 * @access Public
 * @returns {ApiResponse} List of public playlists with pagination
 */
export const getPublicPlaylists = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = { isPublic: true };
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
                $lookup: {
                    from: 'videos',
                    localField: 'videos',
                    foreignField: '_id',
                    as: 'videos',
                    pipeline: [
                        { $match: { isPublished: true } },
                        { $project: { title: 1, thumbnail: 1 } }
                    ],
                },
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    thumbnail: 1,
                    isPublic: 1,
                    videoCount: { $size: '$videos' },
                    videos: 1,
                    owner: '$ownerDetails',
                    createdAt: 1,
                },
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
        
        logger.info(`Fetched public playlists with search: ${search}`);

        return res.status(200).json(
            ApiResponse.success(
                { playlists, totalPlaylists },
                'Public playlists fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getPublicPlaylists: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching public playlists',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/playlists/:id/videos/:videoId
 * @description Add a video to a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {string} videoId - Video ID to add
 * @returns {ApiResponse} Updated playlist video count
 */
export const addVideoToPlaylist = async (
    req: Request<{ id: string; videoId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id, videoId } = req.params;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid playlist or video ID', []);
        }

        const playlistId = new mongoose.Types.ObjectId(id);
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user._id,
        });

        if (!playlist) {
            throw new ApiError(404, 'Playlist not found or you do not own it', []);
        }

        // Check if video exists and is published
        const video = await Video.findOne({ _id: videoObjectId, isPublished: true });
        if (!video) {
            throw new ApiError(404, 'Video not found or not published', []);
        }

        // Add if not already in playlist
        if (playlist.videos.includes(videoObjectId)) {
            throw new ApiError(400, 'Video already in playlist', []);
        }

        await Playlist.findByIdAndUpdate(
            playlistId,
            { $push: { videos: videoObjectId } },
            { new: true }
        );

        // Queue notification for video owner (if not the playlist owner)
        // if (video.owner.toString() !== user._id.toString()) {
        //     const message = `${user.username} added your video "${video.title}" to their playlist "${playlist.name}"`;
        //     await addNotificationJob(
        //         video.owner.toString(),
        //         NOTIFICATION_TYPES[5],
        //         user._id.toString(),
        //         message,
        //         (String(video._id)),
        //         undefined,
        //         undefined
        //     );
        // }

        logger.info(`Video ${videoId} added to playlist ${id} by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { videoCount: playlist.videos.length + 1 },
                'Video added to playlist successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in addVideoToPlaylist: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while adding video to playlist',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/playlists/:id/videos/:videoId
 * @description Remove a video from a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {string} videoId - Video ID to remove
 * @returns {ApiResponse} Updated playlist video count
 */
export const removeVideoFromPlaylist = async (
    req: Request<{ id: string; videoId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id, videoId } = req.params;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid playlist or video ID', []);
        }

        const playlistId = new mongoose.Types.ObjectId(id);
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const playlist = await Playlist.findOne({
            _id: playlistId,
            owner: user._id,
        });

        if (!playlist) {
            throw new ApiError(404, 'Playlist not found or you do not own it', []);
        }

        // Check if video is in playlist
        if (!playlist.videos.includes(videoObjectId)) {
            throw new ApiError(400, 'Video not in playlist', []);
        }

        await Playlist.findByIdAndUpdate(
            playlistId,
            { $pull: { videos: videoObjectId } },
            { new: true }
        );

        logger.info(`Video ${videoId} removed from playlist ${id} by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { videoCount: playlist.videos.length - 1 },
                'Video removed from playlist successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in removeVideoFromPlaylist: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while removing video from playlist',
            error.errors || []
        );
    }
};