import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, type IUser } from '../models/user.model';
import { Subscription, type ISubscription } from '../models/subscription.model';
import { Video, type IVideo } from '../models/video.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';

interface SubscribeBody {
    channelId: string;
}

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /subscriptions
 * @desc Subscribe to a channel
 * @access Private
 */
export const subscribe = async (
    req: Request<{}, {}, SubscribeBody>,
    res: Response<ApiResponse<{ channel: IUser | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.body;

        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        // Check if already subscribed
        const existingSubscription = await Subscription.findOne({ 
            subscriber: user._id, 
            channel: channelObjectId,
            isDeleted: { $ne: true }
        });
        if (existingSubscription) {
            return res.status(400).json(ApiResponse.error(400, null, 'Already subscribed to this channel'));
        }

        // Validate channel exists
        const channel = await User.findById(channelObjectId);
        if (!channel) {
            return res.status(404).json(ApiResponse.error(404, null, 'Channel not found'));
        }

        // Create subscription + increment subscriber count
        await Promise.all([
            Subscription.create({ subscriber: user._id, channel: channelObjectId }),
            User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: 1 } })
        ]);

        const channelData = await User.findById(channelObjectId).select('username fullName avatar');

        return res.status(201).json(
            ApiResponse.success(
                { channel: channelData },
                `Subscribed to ${channelData?.fullName}!`,
                201
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while subscribing to channel',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /subscriptions/:channelId
 * @desc Unsubscribe from a channel
 * @access Private
 */
export const unsubscribe = async (
    req: Request<{ channelId: string }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.params;
        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        // Find and soft-delete subscription + decrement count
        const subscription = await Subscription.findOneAndUpdate(
            { 
                subscriber: user._id, 
                channel: channelObjectId,
                isDeleted: { $ne: true }
            },
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );
        if (subscription) {
            await User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: -1 } });
        } else {
            return res.status(404).json(ApiResponse.error(404, null, 'Subscription not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                {},
                `Unsubscribed successfully`,
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while unsubscribing from channel',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /subscriptions
 * @desc Get user's subscriptions
 * @access Private
 */
export const getMySubscriptions = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ subscriptions: ISubscription[]; totalSubscriptions: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {
            subscriber: user._id,
            isDeleted: { $ne: true }
        };

        const subscriptions = await Subscription.aggregate([
            { $match: match },
            { 
                $lookup: {
                    from: 'users',
                    localField: 'channel',
                    foreignField: '_id',
                    as: 'channel',
                    pipeline: [
                        { $match: { isDeleted: { $ne: true } } },
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

        return res.status(200).json(
            ApiResponse.success(
                { subscriptions, totalSubscriptions },
                `${totalSubscriptions} subscriptions found`,
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching subscriptions',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /subscriptions/users/:userId/subscribers
 * @desc Get channel's subscribers
 * @access Private
 */
export const getChannelSubscribers = async (
    req: Request<{ userId: string }, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ subscribers: ISubscription[]; totalSubscribers: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const channelObjectId = new mongoose.Types.ObjectId(userId);

        const match: any = {
            channel: channelObjectId,
            isDeleted: { $ne: true }
        };

        const subscribers = await Subscription.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'subscriber',
                    foreignField: '_id',
                    as: 'subscriberData',
                    pipeline: [
                        { $match: { isDeleted: { $ne: true } } },
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

        return res.status(200).json(
            ApiResponse.success(
                { subscribers, totalSubscribers },
                `${totalSubscribers} subscribers found`,
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching subscribers',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /subscriptions/toggle/:channelId
 * @desc Toggle subscription to a channel
 * @access Private
 */
export const toggleSubscription = async (
    req: Request<{ channelId: string }>,
    res: Response<ApiResponse<{ isSubscribed: boolean; channel: IUser | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.params;
        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        const existingSubscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelObjectId,
            isDeleted: { $ne: true }
        });

        let isSubscribed: boolean;
        const channel = await User.findById(channelObjectId);

        if (existingSubscription) {
            // Unsubscribe (soft delete)
            await Promise.all([
                Subscription.findByIdAndUpdate(existingSubscription._id, {
                    isDeleted: true,
                    deletedAt: new Date()
                }),
                User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: -1 } })
            ]);
            isSubscribed = false;
        } else {
            // Subscribe
            if (!channel) {
                return res.status(404).json(ApiResponse.error(404, null, 'Channel not found'));
            }
            await Promise.all([
                Subscription.create({ subscriber: user._id, channel: channelObjectId }),
                User.findByIdAndUpdate(channelObjectId, { $inc: { subscribersCount: 1 } })
            ]);
            isSubscribed = true;
        }

        const channelData = await User.findById(channelObjectId).select('username fullName avatar');

        return res.status(200).json(
            ApiResponse.success(
                { isSubscribed, channel: channelData },
                isSubscribed ? 'Subscribed!' : 'Unsubscribed!',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while toggling subscription',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /subscriptions/users/:userId/subscribers/count
 * @desc Get subscription count for a channel
 * @access Public
 */
export const getSubscriberCount = async (
    req: Request<{ userId: string }>,
    res: Response<ApiResponse<{ count: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const channelObjectId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(channelObjectId).select('subscribersCount');
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Channel not found'));

        return res.status(200).json(
            ApiResponse.success(
                { count: user.subscribersCount },
                'Subscriber count fetched successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching subscriber count',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /subscriptions/is-subscribed/:channelId
 * @desc Check if user is subscribed to a channel
 * @access Private
 */
export const isSubscribed = async (
    req: Request<{ channelId: string }>,
    res: Response<ApiResponse<{ isSubscribed: boolean } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.params;
        const channelObjectId = new mongoose.Types.ObjectId(channelId);

        const subscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelObjectId,
            isDeleted: { $ne: true }
        });

        return res.status(200).json(
            ApiResponse.success(
                { isSubscribed: !!subscription },
                'Subscription status checked',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while checking subscription status',
                error instanceof Error ? [error.message] : []
            )
        );   
    }
};

/**
 * @route GET /subscriptions/feed
 * @desc Get videos from subscribed channels
 * @access Private
 */
export const getSubscriptionFeed = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const subscriptions = await Subscription.aggregate([
            { $match: {
                subscriber: user._id,
                isDeleted: { $ne: true }
            } },
            { $project: { channel: 1 } },
            { $limit: 50 }
        ]);

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
            isDeleted: { $ne: true }
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
                        { $match: { isDeleted: { $ne: true } } },
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
                    owner: '$owner'
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

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'Subscription feed fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching subscription feed',
                error instanceof Error ? [error.message] : []
            )
        );   
    }
};