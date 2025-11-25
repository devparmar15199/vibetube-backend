import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Subscription } from '../models/subscription.model';
import { Video } from '../models/video.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
// import { addNotificationJob } from '../queue/notificationQueue';
import { NOTIFICATION_TYPES } from '../utils/constants';
import logger from '../utils/logger';

interface SubscribeBody {
    channelId: string;
}

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /api/v1/subscriptions
 * @description Subscribe to a channel
 * @access Private (requires authentication)
 * @param {Object} body - Channel ID to subscribe to
 * @returns {ApiResponse} Subscription details
 */
export const subscribe = async (
    req: Request<{}, {}, SubscribeBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { channelId } = req.body;

        // Validate channel ID
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            throw new ApiError(400, 'Invalid channel ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        // Prevent self-subscription
        if (channelObjectId.equals(user._id)) {
            throw new ApiError(400, 'Cannot subscribe to yourself', []);
        }

        // Check if already subscribed
        const existingSubscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelObjectId,
        });

        if (existingSubscription) {
            throw new ApiError(400, 'Already subscribed to this channel', []);
        }

        // Validate channel exists
        const channel = await User.findById(channelObjectId);
        if (!channel) {
            throw new ApiError(404, 'Channel not found', []);
        }

        // Create subscription and increment subscriber count
        await Promise.all([
            Subscription.create({ subscriber: user._id, channel: channelObjectId }),
            User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: 1 } })
        ]);

        // Queue notification for channel owner
        // const message = `${user.username} subscribed to your channel!`;
        // await addNotificationJob(
        //     channel._id.toString(),
        //     NOTIFICATION_TYPES[0],
        //     user._id.toString(),
        //     message,
        //     undefined,
        //     undefined,
        //     undefined
        // );

        const channelData = await User.findById(channelObjectId).select('username fullName avatar').lean();

        logger.info(`User ${user._id} subscribed to channel ${channelId}`);

        return res.status(201).json(
            ApiResponse.success(
                { channel: channelData },
                `Subscribed to ${channelData?.fullName}!`,
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in subscribe: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while subscribing to channel',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/subscriptions/:channelId
 * @description Unsubscribe from a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID to unsubscribe from
 * @returns {ApiResponse} Success message
 */
export const unsubscribe = async (
    req: Request<{ channelId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { channelId } = req.params;

        // Validate channel ID
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            throw new ApiError(400, 'Invalid channel ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        // Find and delete subscription, decrement subscriber count
        const subscription = await Subscription.findOneAndDelete({
            subscriber: user._id,
            channel: channelObjectId,
        });

        if (!subscription) {
            throw new ApiError(404, 'Subscription not found', []);
        }

        await User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: -1 } });

        logger.info(`User ${user._id} unsubscribed from channel ${channelId}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                `Unsubscribed successfully`,
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in unsubscribe: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while unsubscribing from channel',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/subscriptions/toggle/:channelId
 * @description Toggle subscription status for a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID
 * @returns {ApiResponse} Subscription status
 */
export const toggleSubscription = async (
    req: Request<{ channelId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { channelId } = req.params;

        // Validate channel ID
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            throw new ApiError(400, 'Invalid channel ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        // Prevent self-subscription
        if (channelObjectId.equals(user._id)) {
            throw new ApiError(400, 'Cannot subscribe to yourself', []);
        }

        const existingSubscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelObjectId,
        });

        let isSubscribed: boolean;
        const channel = await User.findById(channelObjectId);

        if (existingSubscription) {
            // Unsubscribe
            await Promise.all([
                Subscription.findByIdAndDelete(existingSubscription._id),
                User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: -1 } }),
            ]);
            isSubscribed = false;
        } else {
            // Subscribe
            if (!channel) {
                throw new ApiError(404, 'Channel not found', []);
            }
            await Promise.all([
                Subscription.create({ subscriber: user._id, channel: channelObjectId }),
                User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: 1 } }),
            ]);

            // Queue notification for channel owner
            // const message = `${user.username} subscribed to your channel!`;
            // await addNotificationJob(
            //     channel._id.toString(),
            //     NOTIFICATION_TYPES[0],
            //     user._id.toString(),
            //     message,
            //     undefined,
            //     undefined,
            //     undefined
            // );
            isSubscribed = true;
        }

        const channelData = await User.findById(channelObjectId).select('username fullName avatar').lean();

        logger.info(`User ${user._id} toggled subscription to channel ${channelId}: ${isSubscribed ? 'subscribed' : 'unsubscribed'}`);

        return res.status(200).json(
            ApiResponse.success(
                { isSubscribed, channel: channelData },
                isSubscribed ? 'Subscribed!' : 'Unsubscribed!',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in toggleSubscription: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while toggling subscription',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/subscriptions
 * @description Get the authenticated user's subscriptions
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of subscribed channels with pagination
 */
export const getMySubscriptions = async (
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

        const match: any = { subscriber: user._id };

        const subscriptions = await Subscription.aggregate([
            { $match: match },
            { 
                $lookup: {
                    from: 'users',
                    localField: 'channel',
                    foreignField: '_id',
                    as: 'channel',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar: 1, subscribersCount: 1 } }
                    ]
                }
            },
            { $unwind: '$channel' },
            { $project: { channel: 1, createdAt: 1 } },
            { $sort: { 'channel.subscribersCount': -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalSubscriptions = await Subscription.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalSubscriptions,
                totalPages: Math.ceil(totalSubscriptions / Number(limit))
            }
        };

        logger.info(`Fetched subscriptions for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { subscriptions, totalSubscriptions },
                `${totalSubscriptions} subscriptions found`,
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getMySubscriptions: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching subscriptions',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/subscriptions/is-subscribed/:channelId
 * @description Check if the authenticated user is subscribed to a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID
 * @returns {ApiResponse} Boolean indicating subscription status
 */
export const isSubscribed = async (
    req: Request<{ channelId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { channelId } = req.params;

        // Validate channel ID
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            throw new ApiError(400, 'Invalid channel ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        const subscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelObjectId,
        });

        logger.info(`Checked subscription status for user ${user._id} to channel ${channelId}`);

        return res.status(200).json(
            ApiResponse.success(
                { isSubscribed: !!subscription },
                'Subscription status checked',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in isSubscribed: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while checking subscription status',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/subscriptions/feed
 * @description Get video feed from subscribed channels
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of videos from subscribed channels with pagination
 */
export const getSubscriptionFeed = async (
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

        const subscriptions = await Subscription.find({ subscriber: user._id })
            .select('channel')
            .limit(50)
            .lean();

        if (subscriptions.length === 0) {
            return res.status(200).json(
                ApiResponse.success(
                    { videos: [], totalVideos: 0 },
                    'No subscriptions found',
                    200
                )
            );
        }

        const channelIds = subscriptions.map(sub => sub.channel);

        const match: any = {
            owner: { $in: channelIds },
            isPublished: true,
        };

        const videos = await Video.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar: 1 } }
                    ]
                }
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
                    owner: '$owner',
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalVideos = await Video.countDocuments(match);
        
        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / Number(limit))
            }
        };

        logger.info(`Fetched subscription feed for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'Subscription feed fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getSubscriptionFeed: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching subscription feed',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/subscriptions/users/:userId/subscribers
 * @description Get subscribers of a channel
 * @access Public
 * @param {string} userId - Channel (user) ID
 * @returns {ApiResponse} List of subscribers with pagination
 */
export const getChannelSubscribers = async (
    req: Request<{ userId: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, 'Invalid user ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(userId);

        const match: any = { channel: channelObjectId };

        const subscribers = await Subscription.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'subscriber',
                    foreignField: '_id',
                    as: 'subscriberData',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar: 1 } }
                    ]
                }
            },
            { $unwind: '$subscriberData' },
            {
                $project: {
                    subscriber: '$subscriberData',
                    subscribedAt: '$createdAt'
                }
            },
            { $sort: { 'subscriber.fullName': 1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalSubscribers = await Subscription.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalSubscribers,
                totalPages: Math.ceil(totalSubscribers / Number(limit))
            }
        };

        logger.info(`Fetched subscribers for channel ${userId}`);

        return res.status(200).json(
            ApiResponse.success(
                { subscribers, totalSubscribers },
                `${totalSubscribers} subscribers found`,
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getChannelSubscribers: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching subscribers',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/subscriptions/users/:userId/subscribers/count
 * @description Get subscriber count for a channel
 * @access Public
 * @param {string} userId - Channel (user) ID
 * @returns {ApiResponse} Subscriber count
 */
export const getSubscriberCount = async (
    req: Request<{ userId: string }>,
    res: Response
) => {
    try {
        const { userId } = req.params;

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, 'Invalid user ID', []);
        }

        const channelObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(channelObjectId).select('subscribersCount').lean();

        if (!user) {
            throw new ApiError(404, 'Channel not found', []);
        }

        logger.info(`Fetched subscriber count for channel ${userId}`);

        return res.status(200).json(
            ApiResponse.success(
                { count: user.subscribersCount || 0 },
                'Subscriber count fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getSubscriberCount: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching subscriber count',
            error.errors || []
        );
    }
};