import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/notification.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface PaginationParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

/**
 * @route GET /api/v1/notifications
 * @description Get notifications for the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of notifications with pagination
 */
export const getNotifications = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { page = 1, limit = 10, unreadOnly = false } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = { user: user._id };
        if (unreadOnly) match.isRead = false;
        
        const notifications = await Notification.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'fromUser',
                    foreignField: '_id',
                    as: 'fromUser',
                    pipeline: [{ $project: { username: 1, avatar: 1 } }]
                }
            },
            { $unwind: '$fromUser' },
            {
                $lookup: {
                    from: 'videos',
                    localField: 'video',
                    foreignField: '_id',
                    as: 'video',
                    pipeline: [{ $project: { title: 1, thumbnail: 1 } }]
                }
            },
            { $unwind: { path: '$video', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'post',
                    foreignField: '_id',
                    as: 'post',
                    pipeline: [{ $project: { title: 1, thumbnail: 1 } }]
                }
            },
            { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'comments',
                    localField: 'comment',
                    foreignField: '_id',
                    as: 'comment',
                    pipeline: [{ $project: { content: 1 } }]
                }
            },
            { $unwind: { path: '$comment', preserveNullAndEmptyArrays: true } },
        ]);

        const totalNotifications = await Notification.countDocuments(match);
        const unreadCount = await Notification.countDocuments({
            user: user._id,
            isRead: false,
        });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalNotifications,
                totalPages: Math.ceil(totalNotifications / Number(limit))
            }
        };

        logger.info(`Fetched notifications for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { notifications, totalNotifications, unreadCount },
                'Notifications fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getNotifications: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching notifications',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/notifications/:id/read
 * @description Mark a specific notification as read
 * @access Private (requires authentication)
 * @param {string} id - Notification ID
 * @returns {ApiResponse} Updated notification status
 */
export const markAsRead = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;

        // Validate notification ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid notification ID', []);
        }

        const notificationId = new mongoose.Types.ObjectId(id);

        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                user: user._id,
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            throw new ApiError(404, 'Notification not found or you do not own it', []);
        }

        logger.info(`Notification ${id} marked as read by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { isRead: true },
                'Notification marked as read',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in markAsRead: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while marking notification as read',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/notifications/all/read
 * @description Mark all notifications as read for the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} Number of notifications marked as read
 */
export const markAllAsRead = async (
    req: Request,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const result = await Notification.updateMany(
            {
                user: user._id,
                isRead: false,
            },
            { isRead: true }
        );

        logger.info(`Marked ${result.modifiedCount} notifications as read for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { markedCount: result.modifiedCount },
                'All notifications marked as read',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in markAllAsRead: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while marking all notifications as read',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/notifications/:id
 * @description Delete a specific notification
 * @access Private (requires authentication)
 * @param {string} id - Notification ID
 * @returns {ApiResponse} Success message
 */
export const deleteNotification = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;

        // Validate notification ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid notification ID', []);
        }

        const notificationId = new mongoose.Types.ObjectId(id);

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            user: user._id,
        });

        if (!notification) {
            throw new ApiError(404, 'Notification not found or you do not own it', []);
        }

        logger.info(`Notification ${id} deleted by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Notification deleted successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in deleteNotification: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting notification',
            error.errors || []
        );
    }
};