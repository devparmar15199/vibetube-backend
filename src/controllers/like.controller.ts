import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Like } from '../models/like.model';
import { Video } from '../models/video.model';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
// import { addNotificationJob } from '../queue/notificationQueue';
import { NOTIFICATION_TYPES } from '../utils/constants';
import logger from '../utils/logger';

interface PaginationParams {
    page?: number;
    limit?: number;
    type?: 'video' | 'post' | 'comment';
}

/**
 * @route POST /api/v1/likes/:type/:id
 * @description Toggle like status for a video, post, or comment
 * @access Private (requires authentication)
 * @param {string} type - Content type ('video', 'post', or 'comment')
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Like status (liked or unliked) and updated likes count
 */
export const toggleLike = async (
    req: Request<{ type: 'video' | 'post' | 'comment'; id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { type, id } = req.params;

        // Validate type
        if (!['video', 'post', 'comment'].includes(type.toLowerCase())) {
            throw new ApiError(400, 'Invalid like type', []);
        }

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid content ID', []);
        }

        const targetId = new mongoose.Types.ObjectId(id);

        // Validate target existence
        let targetModel: any;
        let targetField: string = type.toLowerCase();
        switch (type.toLowerCase()) {
            case 'video':
                targetModel = Video;
                break;
            case 'post':
                targetModel = Post;
                break;
            case 'comment':
                targetModel = Comment;
                break;
        }

        const target = await targetModel.findById(targetId);
        if (!target) {
            throw new ApiError(404, `${type} not found`, []);
        }

        // Check existing like
        const existingLike = await Like.findOne({
            type: type.toLowerCase(),
            [targetField]: targetId,
            likedBy: user._id,
        });

        let liked = false;
        let likesCount = target.likesCount || 0;

        if (existingLike) {
            // Unlike
            await Like.deleteOne({ _id: existingLike._id });
            likesCount = Math.max(0, likesCount - 1);
        } else {
            // Like
            await Like.create({
                type: type.toLowerCase(),
                [targetField]: targetId,
                likedBy: user._id
            });
            liked = true;
            likesCount++;

            // Queue notification for content owner (if not the liker)
            // if (target.owner.toString() !== user._id.toString()) {
            //     const message = `${user.username} liked your ${type.toLowerCase()}`;
            //     await addNotificationJob(
            //         target.owner.toString(),
            //         NOTIFICATION_TYPES[1],
            //         user._id.toString(),
            //         message,
            //         type.toLowerCase() === 'video' ? id : undefined,
            //         type.toLowerCase() === 'post' ? id : undefined,
            //         type.toLowerCase() === 'comment' ? id : undefined
            //     );
            // }
        }

        // Update likesCount in target
        await targetModel.findByIdAndUpdate(targetId, { likesCount });

        logger.info(`User ${user._id} ${liked ? 'liked' : 'unliked'} ${type} ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { liked, likesCount }, 
                `${type} ${liked ? 'liked' : 'unliked'} successfully`,
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in toggleLike: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while toggling like',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/likes/:type/:id/count
 * @description Get the number of likes for a video, post, or comment
 * @access Public
 * @param {string} type - Content type ('video', 'post', or 'comment')
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Like count
 */
export const getLikesCount = async (
    req: Request<{ type: 'video' | 'post' | 'comment'; id: string }>,
    res: Response
) => {
    try {
        const { type, id } = req.params;

        // Validate type
        if (!['video', 'post', 'comment'].includes(type.toLowerCase())) {
            throw new ApiError(400, 'Invalid type', []);
        }

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid content ID', []);
        }

        const targetId = new mongoose.Types.ObjectId(id);
        const targetField = type.toLowerCase();

        // Validate target existence
        let targetModel: any;
        switch (type.toLowerCase()) {
            case 'video':
                targetModel = Video;
                break;
            case 'post':
                targetModel = Post;
                break;
            case 'comment':
                targetModel = Comment;
                break;
        }

        const target = await targetModel.findById(targetId).select('likesCount');
        if (!target) {
            throw new ApiError(404, `${type} not found`, []);
        }

        logger.info(`Fetched likes count for ${type} ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { likesCount: target.likesCount || 0 }, 
                'Likes count fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getLikesCount: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching likes count',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/likes/:type/:id/is-liked
 * @description Check if the authenticated user liked a video, post, or comment
 * @access Private (requires authentication)
 * @param {string} type - Content type ('video', 'post', or 'comment')
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Boolean indicating if liked
 */
export const isLiked = async (
    req: Request<{ type: 'video' | 'post' | 'comment'; id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { type, id } = req.params;

        // Validate type
        if (!['video', 'post', 'comment'].includes(type.toLowerCase())) {
            throw new ApiError(400, 'Invalid type', []);
        }

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid content ID', []);
        }

        const targetId = new mongoose.Types.ObjectId(id);
        const targetField = type.toLowerCase();

        const like = await Like.findOne({
            type: type.toLowerCase(),
            [targetField]: targetId,
            likedBy: user._id,
        });

        logger.info(`Checked like status for user ${user._id} on ${type} ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { isLiked: !!like },
                'Like status checked successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in isLiked: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while checking like status',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/likes/user
 * @description Get all content liked by the authenticated user
 * @access Private (requires authentication)
 * @param {string} [type] - Optional content type filter ('video', 'post', or 'comment')
 * @returns {ApiResponse} List of liked content with pagination
 */
export const getLikedByUser = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { page = 1, limit = 10, type } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate type if provided
        if (type && !['video', 'post', 'comment'].includes(type.toLowerCase())) {
            throw new ApiError(400, 'Invalid type filter', []);
        }

        const match: any = { likedBy: user._id };
        if (type) {
            match.type = type.toLowerCase();
        }

        const likes = await Like.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: type?.toLowerCase() || 'videos',
                    localField: type?.toLowerCase() || 'video',
                    foreignField: '_id',
                    as: 'item',
                    pipeline: [
                        { 
                            $project: { 
                                title: 1, 
                                thumbnail: 1,
                                content: type?.toLowerCase() === 'comment' ? 1 : undefined, 
                            }
                        },
                    ],
                },
            },
            { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } }
        ]);

        const totalLikes = await Like.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalLikes,
                totalPages: Math.ceil(totalLikes / Number(limit))
            }
        };

        logger.info(`Fetched liked items for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { likes, totalLikes },
                'Liked items fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getLikedByUser: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching liked items',
            error.errors || []
        );
    }
};