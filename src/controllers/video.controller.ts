import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Video, type IVideo } from '../models/video.model';
import { User, type IUser } from '../models/user.model';
import { Like, type ILike } from '../models/like.model';
import { View, type IView } from '../models/view.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { uploadToCloudinary } from '../utils/cloudinarySetup';

interface UploadVideoBody {
    title: string;
    description?: string;
    category?: string;
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
 * @route POST /videos
 * @desc Upload a new video
 * @access Private
 */
export const uploadVideo = async (
    req: Request<{}, {}, UploadVideoBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ video: IVideo | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { title, description, category = 'Other', subscribersOnly = false } = req.body;

        // Validate required fields
        if (!title?.trim()) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Title is required')
            );
        }

        const files = req.files as MulterFiles;
        const videoFilePath = files?.videoFile?.[0]?.path;
        const thumbnailPath = files?.thumbnail?.[0]?.path;

        if (!videoFilePath) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Video file is required')
            );
        }

        // Upload video to Cloudinary
        const videoResult = await uploadToCloudinary(videoFilePath, 'video');
        if (!videoResult?.secure_url) {
            return res.status(500).json(
                ApiResponse.error(500, null, 'Failed to upload video')
            );
        }

        // Upload or generate thumbnail
        let thumbnailResult;
        if (thumbnailPath) {
            thumbnailResult = await uploadToCloudinary(thumbnailPath, 'image');
        } else {
            thumbnailResult = await uploadToCloudinary(videoFilePath, 'image', {
                resource_type: 'video',
                transformation: [{ quality: 'auto:good', fetch_format: 'auto' }]
            });
        }

        if (!thumbnailResult?.secure_url) {
            return res.status(500).json(
                ApiResponse.error(500, null, 'Failed to upload thumbnail')
            );
        }

        const duration = 100;

        const video = await Video.create({
            videoFile: videoResult.secure_url,
            thumbnail: thumbnailResult.secure_url,
            owner: user._id,
            title: title.trim(),
            description: description?.trim() || '',
            duration,
            category,
            subscribersOnly,
            views: 0,
            likesCount: 0,
            commentsCount: 0,
            isPublished: false,
            isDeleted: false,
        });

        // Fetch video with owner
        const uploadedVideo = await Video.findById(video._id)
            .populate('ownerDetails', 'username fullName avatar subscribersCount');

        return res.status(201).json(
            ApiResponse.success(
                { video: uploadedVideo }, 
                'Video uploaded successfully',
                201
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null, 
                'Internal Server Error while uploading video',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /videos/:videoId
 * @desc Get video by ID
 * @access Public
 */
export const getVideoById = async (
    req: Request<{ videoId: string }>,
    res: Response<ApiResponse<{ video: IVideo | null; owner: IUser | null } | null>>
) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?._id;

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findById(videoObjectId)
            .populate('ownerDetails', 'username fullName avatar subscribersCount isEmailVerified');

        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found')
            );
        }

        // Increment view
        const viewerId = userId || null;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;
        const viewKey = viewerId ? { video: videoObjectId, viewer: viewerId } : { video: videoObjectId, ipAddress }
        
        const existingView = await View.findOne(viewKey);
        if (!existingView) {
            await View.create({
                video: videoObjectId,
                ...(viewerId && { viewer: viewerId }),
                ...(ipAddress && { ipAddress })
            });
        }

        const response = {
            video,
            owner: video.ownerDetails as IUser
        };

        return res.status(200).json(
            ApiResponse.success(
                response,
                'Video fetched successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null, 
                'Internal Server Error while fetching video',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /videos
 * @desc Get all videos
 * @access Public
 */
export const getAllVideos = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const { page = 1, limit = 10, search = '', category, sortBy = 'publishedAt' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filter: any = {
            isPublished: true,
            isDeleted: { $ne: true }
        };

        if (search) filter.title = { $regex: search, $options: 'i' };
        if (category) filter.category = category;

        const videos = await Video.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'ownerDetails',
                    pipeline: [
                        { $match: { isDeleted: { $ne: true } } },
                        { $project: { username: 1, fullName: 1, avatar: 1 } }
                    ]
                }
            },
            { $unwind: '$ownerDetails' },
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
        
        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                `${totalVideos} videos found`,
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching videos',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /videos/:videoId
 * @desc Update video details
 * @access Private
 */
export const updateVideo = async (
    req: Request<{ videoId: string }, {}, UploadVideoBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ video: IVideo | null } | null>>
) => {
    try {
        const user = req.user;
        const { videoId } = req.params;
        const { title, description, category, subscribersOnly = false } = req.body;

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findOne({
            _id: videoObjectId,
            owner: user?._id,
            isDeleted: { $ne: true }
        });

        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found or access denied')
            );
        }

        const updatedData: any = {
            title: title.trim() || video.title,
            description: description?.trim() || video.description,
            category: category || video.category,
            subscribersOnly: subscribersOnly || video.subscribersOnly,
        };

        const updatedVideo = await Video.findByIdAndUpdate(
            videoObjectId,
            { $set: updatedData },
            { new: true, runValidators: true }
        ).populate('ownerDetails', 'username fullName avatar');

        return res.status(200).json(
            ApiResponse.success(
                { video: updatedVideo },
                'Video updated successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while updating video',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /videos/:videoId
 * @desc Delete a video (soft delete)
 * @access Private
 */
export const deleteVideo = async (
    req: Request<{ videoId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        const { videoId } = req.params;
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findOneAndUpdate(
            { 
                _id: videoObjectId, 
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { 
                isDeleted: true,
                deletedAt: new Date()
            },
            { new: true }
        );

        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found or access denied')
            );
        }

        return res.status(200).json(
            ApiResponse.success({}, 'Video deleted successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while deleting video',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /videos/:videoId/publish
 * @desc Toggle publication status of a video
 * @access Private
 */
export const togglePublishStatus = async (
    req: Request<{ videoId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ isPublished: boolean; video: IVideo | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { videoId } = req.params;
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findOne(
            { 
                _id: videoObjectId, 
                owner: user?._id, 
                isDeleted: { $ne: true } 
            }
        );

        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found or access denied')
            );
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
        ).populate('ownerDetails', 'username fullName avatar');

        return res.status(200).json(
            ApiResponse.success(
                { isPublished: newStatus, video: updatedVideo },
                `Video ${newStatus ? 'published' : 'unpublished'} successfully`,
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while toggling publish status',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /videos/users/:userId/videos
 * @desc Get videos by user ID
 * @access Public
 */
export const getUserVideos = async (
    req: Request<{ userId: string }, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const ownerObjectId = new mongoose.Types.ObjectId(userId);

        const match: any = {
            owner: ownerObjectId,
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
                    as: 'ownerDetails',
                    pipeline: [
                        { $match: { isDeleted: { $ne: true } } },
                        { $project: { username: 1, fullName: 1, avatar: 1 } }
                    ]
                }
            },
            { $unwind: '$ownerDetails' },
            {
                $project: {
                    title: 1,
                    thumbnail: 1,
                    duration: 1,
                    views: 1,
                    likesCount: 1,
                    createdAt: 1,
                    owner: '$ownerDetails'
                }
            },
            { $sort: { publishedAt: -1 } },
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
                `${totalVideos} videos found`,
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching user videos',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /videos/:videoId/like
 * @desc Like or unlike a video
 * @access Private
 */
export const toggleLike  = async (
    req: Request<{ videoId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ liked: boolean; likesCount: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { videoId } = req.params;
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findById(videoObjectId);
        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found')
            );
        }

        // Check existing like
        const existingLike = await Like.findOne({
            type: 'Video',
            video: videoObjectId,
            likedBy: user._id,
            isDeleted: { $ne: true }
        });

        let liked = false;
        let likesCount = video.likesCount;

        if (existingLike) {
            // Unlike
            await Promise.all([
                Like.findByIdAndUpdate(existingLike._id, {
                    isDeleted: true,
                    deletedAt: new Date()
                }),
                Video.findByIdAndUpdate(videoObjectId, { $inc: { likesCount: -1 } })
            ]);
            likesCount--;
        } else {
            // Like
            await Promise.all([
                Like.create({
                    type: 'Video',
                    video: videoObjectId,
                    likedBy: user._id
                }),
                Video.findByIdAndUpdate(videoObjectId, { $inc: { likesCount: 1 } })
            ]);
            liked = true;
            likesCount++;
        }

        return res.status(200).json(
            ApiResponse.success(
                { liked, likesCount },
                `Video ${liked ? 'liked' : 'unliked'} successfully`,
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while toggling like status',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /videos/:videoId/likes
 * @desc Get likes count for a video
 * @access Public
 */
export const getLikesCount = async (
    req: Request<{ videoId: string }>,
    res: Response<ApiResponse<{ likesCount: number } | null>>
) => {
    try {
        const { videoId } = req.params;
        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findById(videoObjectId).select('likesCount');
        if (!video) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'Video not found')
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                { likesCount: video.likesCount },
                'Likes count fetched successfully',
                200
            )
        )
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching likes count',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};