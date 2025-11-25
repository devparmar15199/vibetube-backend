import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { View } from '../models/view.model';
import { Video } from '../models/video.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /api/v1/views/:videoId
 * @description Log a view for a video (user or IP-based)
 * @access Public
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message indicating if view was logged
 */
export const logView = async (
    req: Request<{ videoId: string }>,
    res: Response
) => {
    try {
        const { videoId } = req.params;
        const user = req.user;
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || null;

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        // Verify video exists and is published
        const video = await Video.findOne({ _id: videoObjectId, isPublished: true });
        if (!video) {
            throw new ApiError(404, 'Video not found or not published', []);
        }

        // Create unique view key (user or IP)
        const viewerId = user?._id || null;
        const viewKey = viewerId 
            ? { video: videoObjectId, viewer: viewerId }
            : { video: videoObjectId, ipAddress };

        // Check for existing view (within reasonable timeframe)
        const existingView = await View.findOne(viewKey);
        if (existingView) {
            logger.info(`View already exists for ${viewerId ? 'user' : 'IP'} ${viewerId || ipAddress} on video ${videoId}`);
            return res.status(200).json(
                ApiResponse.success(
                    { viewed: true },
                    'View already logged recently',
                    200
                )
            );
        }

        // Create new view and increment video views count
        await Promise.all([
            View.create({
                video: videoObjectId,
                ...(viewerId && { viewer: viewerId }),
                ...(ipAddress && { ipAddress }),
            }),
            Video.findByIdAndUpdate(videoObjectId, { $inc: { views: 1 } }),
        ]);

        logger.info(`View logged for ${viewerId ? 'user' : 'IP'} ${viewerId || ipAddress} on video ${videoId}`);

        return res.status(201).json(
            ApiResponse.success(
                { viewed: true },
                'View logged successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in logView: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while logging view',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/views/:videoId
 * @description Get view details for a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} List of views with pagination
 */
export const getVideoViews = async (
    req: Request<{ videoId: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { videoId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        // Verify video exists and user is the owner
        const video = await Video.findOne({ _id: videoObjectId, owner: user._id });
        if (!video) {
            throw new ApiError(404, 'Video not found or access denied', []);
        }

        const match: any = { video: videoObjectId };

        const views = await View.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'viewer',
                    foreignField: '_id',
                    as: 'viewerDetails',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar: 1 } },
                    ],
                },
            },
            {
                $addFields: {
                    viewer: {
                        $cond: {
                            if: { $gt: [{ $size: '$viewerDetails' }, 0] },
                            then: { $arrayElemAt: ['$viewerDetails', 0] },
                            else: null,
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    createdAt: 1,
                    viewer: 1,
                    ipAddress: {
                        $cond: {
                            if: { $eq: [null, '$viewer'] },
                            then: '$ipAddress',
                            else: '***',
                        },
                    },
                },
            },
        ]);

        const totalViews = await View.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalViews,
                totalPages: Math.ceil(totalViews / Number(limit))
            }
        };

        logger.info(`Fetched ${totalViews} views for video ${videoId} by owner ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { views, totalViews },
                'Views fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getVideoViews: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching views',
            error.errors || []
        );
    }
};