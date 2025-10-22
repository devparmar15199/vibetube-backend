import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Notification, type INotification } from '../models/notification.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { type IUser } from '../models/user.model';

interface PaginationParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

/**
 * @route GET /notifications
 * @desc Get user's notifications
 * @access Private
 */
export const getNotifications = async (
    req: Request<{}, {}, {}, PaginationParams, { user: IUser }>,
    res: Response<ApiResponse<{ notifications: INotification[]; totalNotifications: number; unreadCount: number } | null>>
) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, unreadOnly = false } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {
            user: user?._id,
            isDeleted: { $ne: true }
        };
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
        ]);

        const totalNotifications = await Notification.countDocuments(match);
        const unreadCount = await Notification.countDocuments({
            user: user?._id,
            isRead: false,
            isDeleted: { $ne: true }
        });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalNotifications,
                totalPages: Math.ceil(totalNotifications / Number(limit))
            }
        };

        return res.status(200).json(
            ApiResponse.success(
                { notifications, totalNotifications, unreadCount }, 
                'Notifications fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching notifications',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
export const markAsRead = async (
    req: Request<{ id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ isRead: boolean } | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const notificationId = new mongoose.Types.ObjectId(id);

        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                user: user?._id,
                isDeleted: { $ne: true }
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json(ApiResponse.error(404, null, 'Notification not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                { isRead: true }, 
                'Notification marked as read',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while marking notification as read',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /notifications/all/read
 * @desc Mark all notification as read
 * @access Private
 */
export const markAllAsRead = async (
    req: Request<{}, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ markedCount: number } | null>>
) => {
    try {
        const user = req.user;

        const result = await Notification.updateMany(
            {
                user: user?._id,
                isRead: false,
                isDeleted: { $ne: true }
            },
            { isRead: true }
        );

        return res.status(200).json(
            ApiResponse.success(
                { markedCount: result.modifiedCount }, 
                'All notifications marked as read',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while marking notification all as read',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /notifications/:id
 * @desc Delete a notification
 * @access Private
 */
export const deleteNotification = async (
    req: Request<{ id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const notificationId = new mongoose.Types.ObjectId(id);

        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                user: user?._id,
                isDeleted: { $ne: true }
            },
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json(ApiResponse.error(404, null, 'Notification not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                {}, 
                'Notification deleted successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while deleting notification',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};