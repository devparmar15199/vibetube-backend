import type { Request, Response } from 'express';
import { User } from '../models/user.model.ts';
import { Subscription, ISubscription } from '../models/subscription.model.ts';
import { IVideo, Video } from '../models/video.model.ts';
import { ApiResponse } from '../utils/apiResponse.ts';
import mongoose from 'mongoose';

interface SubscribeBody {
    channelId: string;
}

/**
 * @route POST subcriptions/
 * @desc Subscribe to a channel
 * @access Private
 */
export const subscribe = async (
    req: Request<{}, {}, SubscribeBody>,
    res: Response<ApiResponse<{ channel: any } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.body;

        // Check if already subscribed
        const existingSubscription = await Subscription.findOne({ 
            subscriber: user._id, 
            channel: channelId 
        });
        if (existingSubscription) {
            return res.status(400).json(ApiResponse.error(400, null, 'Already subscribed to this channel'));
        }

        // Validate channel exists
        const channel = await User.findById(channelId);
        if (!channel) {
            return res.status(404).json(ApiResponse.error(404, null, 'Channel not found'));
        }

        // Create subscription + increment subscriber count
        await Promise.all([
            Subscription.create({ subscriber: user._id, channel: channelId }),
            User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: 1 } })
        ]);

        const channelData = await User.findById(channelId).select('username fullName avatar');

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
 * @route DELETE subcriptions/:channelId
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

        // Find and delete subscription + decrement count
        const subscription = await Subscription.findOneAndDelete({ 
            subscriber: user._id, 
            channel: channelId 
        });
        if (subscription) {
            await User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: -1 } });
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
 * @route GET subcriptions/
 * @desc Get user's subscriptions
 * @access Private
 */
export const getMySubscriptions = async (
    req: Request,
    res: Response<ApiResponse<{ subscriptions: ISubscription[]; totalSubscriptions: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const subscriptions = await Subscription.aggregate([
            { $match: { subscriber: user._id } },
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
            { $project: { channel: 1 } },
            { $sort: { 'channel.subscribersCount': -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalSubscriptions = await Subscription.countDocuments({ subscriber: user._id });

        return res.status(200).json(
            ApiResponse.success(
                { subscriptions, totalSubscriptions },
                `${totalSubscriptions} subscriptions found`,
                200
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
 * @route GET subcriptions/users/:userId/subscribers
 * @desc Get channel's subscribers
 * @access Private
 */
export const getChannelSubscribers = async (
    req: Request<{ userId: string }>,
    res: Response<ApiResponse<{ subscribers: ISubscription[]; totalSubscribers: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const subscribers = await Subscription.aggregate([
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(userId)
                }
            },
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

        const totalSubscribers = await Subscription.countDocuments({ 
            channel: userId,
            isDeleted: { $ne: true } 
        });

        return res.status(200).json(
            ApiResponse.success(
                { subscribers, totalSubscribers },
                `${totalSubscribers} subscribers found`,
                200
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
 * @route POST subcriptions/toggle/:channelId
 * @desc Toggle subscription to a channel
 * @access Private
 */
export const toggleSubscription = async (
    req: Request<{ channelId: string }>,
    res: Response<ApiResponse<{ isSubscribed: boolean; channel: any } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { channelId } = req.params;

        const existingSubscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelId
        });

        let isSubscribed: boolean;
        const channel = await User.findById(channelId);

        if (existingSubscription) {
            // Unsubscribe
            await Promise.all([
                Subscription.findByIdAndDelete(existingSubscription._id),
                User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: -1 } })
            ]);
            isSubscribed = false;
        } else {
            // Subscribe
            if (!channel) {
                return res.status(404).json(ApiResponse.error(404, null, 'Channel not found'));
            }
            await Promise.all([
                Subscription.create({ subscriber: user._id, channel: channelId }),
                User.findByIdAndUpdate(channelId, { $inc: { subscribersCount: 1 } })
            ]);
            isSubscribed = true;
        }

        const channelData = await User.findById(channelId).select('username fullName avatar');

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
 * @route GET subcriptions/users/:userId/subscribers/count
 * @desc Get subscription count for a channel
 * @access Public
 */
export const getSubscriberCount = async (
    req: Request<{ userId: string }>,
    res: Response<ApiResponse<{ count: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('subscribersCount');
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
 * @route GET subscriptions/is-subscribed/:channelId
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

        const subscription = await Subscription.findOne({
            subscriber: user._id,
            channel: channelId
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
 * @route GET subscriptions/feed
 * @desc Get videos from subscribed channels
 * @access Private
 */
export const getSubscriptionFeed = async (
    req: Request,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const videos = await Video.aggregate([
            // Get user's subscribed channels
            {
                $lookup: {
                    from: 'subscriptions',
                    let: { userId: user._id },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$subscriber', '$$userId'] } } },
                        { $project: { channel: 1 } }
                    ],
                    as: 'subscriptions'
                }
            },
            { $unwind: '$subscriptions' },
            // Match videos from subscribed channels
            { 
                $match: {
                    owner: '$subscriptions.channel',
                    isPublished: true
                }
            },
            // Get channel info
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }]
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

        const totalVideos = await Video.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    let: { userId: user._id },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$subscriber', '$$userId'] } } },
                        { $project: { channel: 1 } }
                    ],
                    as: 'subscriptions'
                }
            },
            { $unwind: '$subscriptions' },
            {
                $match: {
                    owner: '$subscriptions.channel',
                    isPublished: true
                }
            },
            { $count: 'total' }
        ]);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos: totalVideos[0]?.totalVideos || 0 },
                'Subscription feed fetched successfully',
                200
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