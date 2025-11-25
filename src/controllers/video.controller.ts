import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Video } from '../models/video.model';
import { type IUser } from '../models/user.model';
import { Like } from '../models/like.model';
import { View } from '../models/view.model';
import { Subscription } from '../models/subscription.model';
import { uploadToCloudinary } from '../utils/cloudinarySetup';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
// import { addNotificationJob } from '../queue/notificationQueue';
import { NOTIFICATION_TYPES } from '../utils/constants';
import logger from '../utils/logger';

interface UploadVideoBody {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    isPublished?: boolean;
    subscribersOnly?: boolean;
}

interface UpdateVideoBody {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    isPublished?: boolean;
    subscribersOnly?: boolean;
}

interface MulterFiles {
    videoFile?: Express.Multer.File[];
    thumbnail?: Express.Multer.File[];
}

interface PaginationParams {
    page?: string;
    limit?: string;
    search?: string;
    category?: string;
    sortBy?: string;
}

/**
 * @route POST /api/v1/videos
 * @description Upload a new video with thumbnail
 * @access Private (requires authentication)
 * @param {Object} body - Video data (title, description, category, tags, isPublished, subscribersOnly)
 * @param {File} videoFile - Video file
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Created video
 */
export const uploadVideo = async (
    req: Request<{}, {}, UploadVideoBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { title, description, category, tags, isPublished = false, subscribersOnly = false } = req.body;

        if (!title?.trim()) {
            throw new ApiError(400, 'Title is required', []);
        }

        const files = req.files as MulterFiles;
        const videoFilePath = files?.videoFile?.[0]?.path;
        const thumbnailPath = files?.thumbnail?.[0]?.path;

        if (!videoFilePath) {
            throw new ApiError(400, 'Video file is required', []);
        }

        // Upload video to Cloudinary
        const videoResult = await uploadToCloudinary(videoFilePath, 'video');
        if (!videoResult?.secure_url) {
            throw new ApiError(500, 'Failed to upload video', []);
        }

        // Upload or generate thumbnail
        let thumbnailResult;
        if (thumbnailPath) {
            thumbnailResult = await uploadToCloudinary(thumbnailPath, 'image');
        } else {
            thumbnailResult = await uploadToCloudinary(videoFilePath, 'image', {
                resource_type: 'video',
                transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
            });
        }

        if (!thumbnailResult?.secure_url) {
            throw new ApiError(500, 'Failed to upload thumbnail', []);
        }

        // Assume duration is provided by Cloudinary (in seconds)
        const duration = videoResult?.duration || 100;

        // Convert tag IDs to ObjectId
        let tagIds: mongoose.Types.ObjectId[] = [];
        if (tags && tags.length > 0) {
            tagIds = tags
                .filter((tagId) => mongoose.Types.ObjectId.isValid(tagId))
                .map((tagId) => new mongoose.Types.ObjectId(tagId));
        }

        const video = await Video.create({
            videoFile: videoResult.secure_url,
            thumbnail: thumbnailResult.secure_url,
            owner: user._id,
            title: title.trim(),
            description: description?.trim() || '',
            duration,
            category: category || 'Other',
            tags: tagIds,
            subscribersOnly,
            isPublished,
            views: 0,
            likesCount: 0,
            commentsCount: 0,
        });

        // Notify subscribers if published
        if (isPublished) {
            const subscribers = await Subscription.find({ channel: user._id })
                .select('subscriber')
                .lean();
            // const subscriberIds = subscribers.map((sub) => sub.subscriber.toString());
            // const message = `${user.username} uploaded a new video: ${title}!`;
            // for (const subscriberId of subscriberIds) {
            //     await addNotificationJob(
            //         subscriberId,
            //         NOTIFICATION_TYPES[3],
            //         user._id.toString(),
            //         message,
            //         (String(video._id)),
            //         undefined,
            //         undefined
            //     );
            // }
        }

        // Fetch video with owner details
        const uploadedVideo = await Video.findById(video._id)
            .populate('owner', 'username fullName avatar subscribersCount')
            .lean();

        logger.info(`Video ${video._id} uploaded by user ${user._id}`);

        return res.status(201).json(
            ApiResponse.success(
                { video: uploadedVideo },
                'Video uploaded successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in uploadVideo: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while uploading video',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/videos/:videoId
 * @description Get a specific video by ID
 * @access Public
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Video details
 */
export const getVideoById = async (
    req: Request<{ videoId: string }, {}, {}, {}, { user?: IUser }>,
    res: Response
) => {
    try {
        const { videoId } = req.params;
        const user = req.user;

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findById(videoObjectId)
            .populate('owner', 'username fullName avatar subscribersCount')
            .lean();

        if (!video) {
            throw new ApiError(404, 'Video not found', []);
        }

        // Check access for subscribers-only videos
        if (video.subscribersOnly && !user) {
            throw new ApiError(401, 'Authentication required to view this video', []);
        }
        if (video.subscribersOnly && user) {
            const isSubscriber = await Subscription.findOne({
                subscriber: user._id,
                channel: video.owner,
            });
            if (!isSubscriber) {
                throw new ApiError(403, 'You must be a subscriber to view this video', []);
            }
        }

        // Increment view if not viewed recently
        const viewerId = user?._id || null;
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || null;
        const viewKey = viewerId ? { video: videoObjectId, viewer: viewerId } : { video: videoObjectId, ipAddress };

        const existingView = await View.findOne(viewKey);
        if (!existingView) {
            await Promise.all([
                View.create({
                    video: videoObjectId,
                    ...(viewerId && { viewer: viewerId }),
                    ...(ipAddress && { ipAddress }),
                }),
                Video.findByIdAndUpdate(videoObjectId, { $inc: { views: 1 } }),
            ]);
        }

        logger.info(`Fetched video ${videoId} for viewer ${viewerId || ipAddress}`);

        return res.status(200).json(
            ApiResponse.success(
                { video, owner: video.owner },
                'Video fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getVideoById: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching video',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/videos
 * @description Get all published videos
 * @access Public
 * @returns {ApiResponse} List of videos with pagination
 */
export const getAllVideos = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { page = 1, limit = 10, search = '', category, sortBy = 'publishedAt' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filter: any = { isPublished: true };
        if (search) filter.title = { $regex: search.trim(), $options: 'i' };
        if (category) filter.category = category;

        const videos = await Video.aggregate([
            { $match: filter },
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
                    publishedAt: 1,
                    owner: '$owner',
                },
            },
            { $sort: { [sortBy]: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalVideos = await Video.countDocuments(filter);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / Number(limit))
            }
        };
        
        logger.info(`Fetched ${totalVideos} videos with page ${Number(page)} and limit ${Number(limit)}`);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                `${totalVideos} videos found`,
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getAllVideos: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching videos',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/videos/:videoId
 * @description Update a video's details
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @param {Object} body - Updated video data
 * @returns {ApiResponse} Updated video
 */
export const updateVideo = async (
    req: Request<{ videoId: string }, {}, UpdateVideoBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { videoId } = req.params;
        const { title, description, category, tags, subscribersOnly } = req.body;

        // Validate video ID
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, 'Invalid video ID', []);
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findOne({ _id: videoObjectId, owner: user._id });
        if (!video) {
            throw new ApiError(404, 'Video not found or access denied', []);
        }

        // Convert tag IDs to ObjectId
        let tagIds: mongoose.Types.ObjectId[] = video.tags;
        if (tags) {
            tagIds = tags
                .filter((tagId) => mongoose.Types.ObjectId.isValid(tagId))
                .map((tagId) => new mongoose.Types.ObjectId(tagId));
        }

        const updatedData: any = {
            title: title?.trim() || video.title,
            description: description?.trim() || video.description,
            category: category || video.category,
            tags: tagIds,
            subscribersOnly: subscribersOnly !== undefined ? subscribersOnly : video.subscribersOnly,
        };

        const updatedVideo = await Video.findByIdAndUpdate(
            videoObjectId,
            { $set: updatedData },
            { new: true, runValidators: true }
        )
        .populate('owner', 'username fullName avatar')
        .lean();

        if (!updatedVideo) {
            throw new ApiError(404, 'Video not found', []);
        }

        logger.info(`Video ${videoId} updated by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { video: updatedVideo },
                'Video updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateVideo: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating video',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/videos/:videoId
 * @description Delete a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message
 */
export const deleteVideo = async (
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

        const video = await Video.findOneAndDelete({ _id: videoObjectId, owner: user._id });
        if (!video) {
            throw new ApiError(404, 'Video not found or access denied', []);
        }

        // Delete associated likes and views
        await Promise.all([
            Like.deleteMany({ video: videoObjectId }),
            View.deleteMany({ video: videoObjectId }),
        ]);

        logger.info(`Video ${videoId} deleted by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Video deleted successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in deleteVideo: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting video',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/videos/:videoId/publish
 * @description Toggle the publish status of a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Updated video
 */
export const togglePublishStatus = async (
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

        const video = await Video.findOne({ _id: videoObjectId, owner: user._id });
        if (!video) {
            throw new ApiError(404, 'Video not found or access denied', []);
        }

        const newStatus = !video.isPublished;
        const updatedData: any = { isPublished: newStatus };
        if (newStatus) {
            updatedData.publishedAt = new Date();
        }

        const updatedVideo = await Video.findByIdAndUpdate(
            videoObjectId,
            { $set: updatedData },
            { new: true }
        )
        .populate('owner', 'username fullName avatar')
        .lean();

        if (!updatedVideo) {
            throw new ApiError(404, 'Video not found', []);
        }

        // Notify subscribers if published
        if (newStatus) {
            const subscribers = await Subscription.find({ channel: user._id })
                .select('subscriber')
                .lean();
            // const subscriberIds = subscribers.map((sub) => sub.subscriber.toString());
            // const message = `${user.username} uploaded a new video: ${video.title}!`;
            // for (const subscriberId of subscriberIds) {
            //     await addNotificationJob(
            //         subscriberId,
            //         NOTIFICATION_TYPES[3],
            //         user._id.toString(),
            //         message,
            //         (String(video._id)),
            //         undefined,
            //         undefined
            //     );
            // }
        }

        logger.info(`Video ${videoId} ${newStatus ? 'published' : 'unpublished'} by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { isPublished: newStatus, video: updatedVideo },
                `Video ${newStatus ? 'published' : 'unpublished'} successfully`,
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in togglePublishStatus: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while toggling publish status',
            error.errors || []
        );
    }
};