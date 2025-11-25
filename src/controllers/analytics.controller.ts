import type { Request, Response } from 'express';
import { Analytics } from '../models/analytics.model';
import { Video } from '../models/video.model';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import logger from '../utils/logger';
import { Types } from 'mongoose';

interface AnalyticsQuery {
    page?: string;
    pageSize?: string;
    startDate?: string;
    endDate?: string;
}

/**
 * @route GET /api/v1/analytics/video/:videoId
 * @description Get analytics data for a specific video (views, likes, comments)
 * @access Private (requires authentication)
 * @param {string} videoId - The ID of the video to fetch analytics for
 * @returns {ApiResponse} Analytics data with daily breakdowns
 */
export const getVideoAnalytics = async (
    req: Request<{ videoId: string }, {}, {}, AnalyticsQuery>,
    res: Response
) => {
    try {
        const { videoId } = req.params;
        const { page = '1', pageSize = '10', startDate, endDate } = req.query;
        const user = req.user;

        if (!user) {
            throw new ApiError(401, 'Unauthorized: No user found', []);
        }

        // Validate videoId
        if (!Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        // Check if video exists and user is the owner
        const video = await Video.findById(videoId);
        if (!video) {
            throw new ApiError(404, 'Video not found', []);
        }
        if (video.owner.toString() !== user._id.toString()) {
            throw new ApiError(403, 'Forbidden: You do not own this video', []);
        }

        // Parse pagination parameters
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        if (isNaN(pageNum) || pageNum < 1 || isNaN(pageSizeNum) || pageSizeNum < 1) {
            throw new ApiError(400, 'Invalid pagination parameters', []);
        }

        // Build query
        const query: any = { video: videoId };
        if (startDate) {
            const start = new Date(startDate);
            if (isNaN(start.getTime())) {
                throw new ApiError(400, 'Invalid start date', []);
            }
            query.date = { $gte: start };
        }
        if (endDate) {
            const end = new Date(endDate);
            if (isNaN(end.getTime())) {
                throw new ApiError(400, 'Invalid end date', []);
            }
            query.date = query.date || {};
            query.date.$lte = end;
        }

        // Fetch analytics with pagination
        const total = await Analytics.countDocuments(query);
        const analytics = await Analytics.find(query)
            .sort({ date: -1 })
            .skip((pageNum - 1) * pageSizeNum)
            .limit(pageSizeNum);

        logger.info(`Fetched analytics for video ${videoId} for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { analytics },
                'Video analytics fetched successfully',
                200,
                {
                    pagination: {
                        current: pageNum,
                        pageSize: pageSizeNum,
                        total,
                        totalPages: Math.ceil(total / pageSizeNum),
                    },
                }
            )
        );
    } catch (error: any) {
        logger.error(`Error in getVideoAnalytics: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching video analytics',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/analytics/user
 * @description Get aggregated analytics for all videos owned by the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} Aggregated analytics data for user's videos
 */
export const getUserAnalytics = async (
    req: Request<{}, {}, {}, AnalyticsQuery>,
    res: Response
) => {
    try {
        const { page = '1', pageSize = '10', startDate, endDate } = req.query;
        const user = req.user;

        if (!user) {
            throw new ApiError(401, 'Unauthorized: No user found', []);
        }

        // Parse pagination parameters
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        if (isNaN(pageNum) || pageNum < 1 || isNaN(pageSizeNum) || pageSizeNum < 1) {
            throw new ApiError(400, 'Invalid pagination parameters', []);
        }

        // Find all videos owned by the user
        const videos = await Video.find({ owner: user._id }).select('_id');
        if (!videos.length) {
            return res.status(200).json(
                ApiResponse.success(
                    { analytics: [], totals: { views: 0, likes: 0, comments: 0 } },
                    'No videos found for user',
                    200,
                    { pagination: { current: pageNum, pageSize: pageSizeNum, total: 0, totalPages: 0 } }
                )
            );
        }

        // Build analytics query
        const query: any = { video: { $in: videos.map(v => v._id) } };
        if (startDate) {
            const start = new Date(startDate);
            if (isNaN(start.getTime())) {
                throw new ApiError(400, 'Invalid start date', []);
            }
            query.date = { $gte: start };
        }
        if (endDate) {
            const end = new Date(endDate);
            if (isNaN(end.getTime())) {
                throw new ApiError(400, 'Invalid end date', []);
            }
            query.date = query.date || {};
            query.date.$lte = end;
        }

        // Aggregate analytics
        const total = await Analytics.countDocuments(query);
        const analytics = await Analytics.find(query)
            .sort({ date: -1 })
            .skip((pageNum - 1) * pageSizeNum)
            .limit(pageSizeNum)
            .populate('video', 'title thumbnail');

        // Calculate totals
        const totals = await Analytics.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    views: { $sum: '$views' },
                    likes: { $sum: '$likes' },
                    comments: { $sum: '$comments' },
                },
            },
        ]);

        logger.info(`Fetched user analytics for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {
                    analytics,
                    totals: totals[0] || { views: 0, likes: 0, comments: 0 },
                },
                'User analytics fetched successfully',
                200,
                {
                    pagination: {
                        current: pageNum,
                        pageSize: pageSizeNum,
                        total,
                        totalPages: Math.ceil(total / pageSizeNum),
                    },
                }
            )
        );
    } catch (error: any) {
        logger.error(`Error in getUserAnalytics: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user analytics',
            error.errors || []
        );
    }
};