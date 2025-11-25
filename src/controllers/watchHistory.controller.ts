import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Video } from '../models/video.model';
import { Subscription } from '../models/subscription.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /api/v1/watch-history/:videoId
 * @description Add a video to the authenticated user's watch history
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Updated watch history entry
 */
export const addToWatchHistory = async (
    req: Request<{ videoId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { videoId } = req.params;

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        // Verify video exists and is published
        const video = await Video.findOne({ _id: videoObjectId, isPublished: true }).lean();
        if (!video) {
            throw new ApiError(404, 'Video not found or not published', []);
        }

        // Check if video is subscribers-only
        if (video.subscribersOnly) {
            const isSubscriber = await Subscription.findOne({
                subscriber: user._id,
                channel: video.owner,
            });
            if (!isSubscriber) {
                throw new ApiError(403, 'You must be a subscriber to view this video', []);
            }
        }

        // Update watch history (remove if exists, add to start)
        await User.findByIdAndUpdate(
            user._id,
            {
                $pull: { watchHistory: videoObjectId }, // Remove if already in history
                $push: {
                    watchHistory: {
                        $each: [videoObjectId],
                        $position: 0, // Add to start
                        $slice: 100, // Limit to last 100 entries
                    },
                },
            },
            { new: true }
        );

        // Fetch updated video for response
        const updatedVideo = await Video.findById(videoObjectId)
            .populate('owner', 'username fullName avatar')
            .lean();

        logger.info(`Added video ${videoId} to watch history for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { video: updatedVideo },
                'Video added to watch history successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in addToWatchHistory: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while adding to watch history',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/watch-history
 * @description Get the authenticated user's watch history
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of watch history entries with pagination
 */
export const getWatchHistory = async (
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

        // Fetch user with watch history
        const userDoc = await User.findById(user._id)
            .select('watchHistory')
            .lean();

        if (!userDoc) {
            throw new ApiError(404, 'User not found', []);
        }

        const videoIds = userDoc.watchHistory || [];

        // Fetch videos with pagination
        const videos = await Video.aggregate([
            {
                $match: {
                    _id: { $in: videoIds },
                    isPublished: true,
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
                },
            },
            { $unwind: '$owner' },
            {
                $project: {
                    title: 1,
                    thumbnail: 1,
                    duration: 1,
                    views: 1,
                    likesCount: 1,
                    createdAt: 1,
                    owner: 1,
                },
            },
            // Preserve original watch history order
            {
                $addFields: {
                    sortOrder: {
                        $indexOfArray: [videoIds, '$_id'],
                    },
                },
            },
            { $sort: { sortOrder: 1 } },
            { $skip: skip },
            { $limit: Number(limit) },
        ]);

        const totalVideos = await Video.countDocuments({
            _id: { $in: videoIds },
            isPublished: true,
        });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / Number(limit)),
            },
        };

        logger.info(`Fetched watch history for user ${user._id} with ${totalVideos} videos`);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'Watch history fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getWatchHistory: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching watch history',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/watch-history
 * @description Clear the authenticated user's watch history
 * @access Private (requires authentication)
 * @returns {ApiResponse} Success message
 */
export const clearWatchHistory = async (
    req: Request,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        await User.findByIdAndUpdate(
            user._id,
            { $set: { watchHistory: [] } },
            { new: true }
        );

        logger.info(`Cleared watch history for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Watch history cleared successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in clearWatchHistory: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while clearing watch history',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/watch-history/:videoId
 * @description Remove a specific video from the authenticated user's watch history
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message
 */
export const removeFromWatchHistory = async (
    req: Request<{ videoId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { videoId } = req.params;

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        // Verify video exists
        const video = await Video.findById(videoObjectId).lean();
        if (!video) {
            throw new ApiError(404, 'Video not found', []);
        }

        // Remove video from watch history
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $pull: { watchHistory: videoObjectId } },
            { new: true }
        );

        if (!updatedUser) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Removed video ${videoId} from watch history for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Video removed from watch history successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in removeFromWatchHistory: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while removing from watch history',
            error.errors || []
        );
    }
};