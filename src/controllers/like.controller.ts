import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Like, type ILike } from '../models/like.model';
import { Video } from '../models/video.model';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { type IUser } from '../models/user.model';

interface PaginationParams {
    page?: number;
    limit?: number;
    type?: 'Video' | 'Post' | 'Comment';
}

/**
 * @route POST /likes/:type/:id
 * @desc Toggle like on a video/post/comment
 * @access Private
 */
export const toggleLike = async (
    req: Request<{ type: 'Video' | 'Post' | 'Comment'; id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ liked: boolean; likesCount: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { type, id } = req.params;
        const targetId = new mongoose.Types.ObjectId(id);

        // Validate type and target existence
        let targetModel: any;
        switch (type) {
            case 'Video':
                targetModel = Video;
                break;
            case 'Post':
                targetModel = Post;
                break;
            case 'Comment':
                targetModel = Comment;
                break;
            default:
                return res.status(400).json(ApiResponse.error(400, null, 'Invalid like type'));
        }
        
        const target = await targetModel.findById(targetId);
        if (!target) {
            return res.status(404).json(ApiResponse.error(404, null, `${type} not found`));
        }

        // Check existing like
        const existingLike = await Like.findOne({
            type,
            [type.toLowerCase()]: targetId,
            likedBy: user._id,
            isDeleted: { $ne: true }
        });

        let liked = false;
        let likesCount = target.likesCount;

        if (existingLike) {
            // Unlike
            await Like.findByIdAndUpdate(existingLike._id, {
                isDeleted: true,
                deletedAt: new Date()
            });
            likesCount--;
        } else {
            // Like
            await Like.create({
                type,
                [type.toLowerCase()]: targetId,
                likedBy: user._id
            });
            liked = true;
            likesCount++;
        }

        await targetModel.findByIdAndUpdate(targetId, { likesCount });

        return res.status(200).json(
            ApiResponse.success(
                { liked, likesCount }, 
                `${type} ${liked ? 'liked' : 'unliked'} successfully`,
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while toggling like',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /likes/:type/:id/count
 * @desc Get likes count for a video/post/comment
 * @access Public
 */
export const getLikesCount = async (
    req: Request<{ type: 'Video' | 'Post' | 'Comment'; id: string }>,
    res: Response<ApiResponse<{ likesCount: number } | null>>
) => {
    try {
        const { type, id } = req.params;
        const targetId = new mongoose.Types.ObjectId(id);

        // Validate type and target existence
        let targetModel: any;
        switch (type) {
            case 'Video':
                targetModel = Video;
                break;
            case 'Post':
                targetModel = Post;
                break;
            case 'Comment':
                targetModel = Comment;
                break;
            default:
                return res.status(400).json(ApiResponse.error(400, null, 'Invalid type'));
        }
        
        const target = await targetModel.findById(targetId).select('likesCount');
        if (!target) {
            return res.status(404).json(ApiResponse.error(404, null, `${type} not found`));
        }

        return res.status(200).json(
            ApiResponse.success(
                { likesCount: target.likesCount }, 
                'Likes count fetched successfully',
                200
            )
        );
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

/**
 * @route GET /likes/:type/:id/is-liked
 * @desc Check if user has liked a video/post/comment
 * @access Private
 */
export const isLiked = async (
    req: Request<{ type: 'Video' | 'Post' | 'Comment'; id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{ isLiked: boolean } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { type, id } = req.params;
        const targetId = new mongoose.Types.ObjectId(id);

        const like = await Like.findOne({
            type,
            [type.toLowerCase()]: targetId,
            likedBy: user._id,
            isDeleted: { $ne: true }
        });

        return res.status(200).json(
            ApiResponse.success(
                { isLiked: !!like }, 
                'Like status checked successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while checking like status',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /likes/user
 * @desc Get items liked by the user
 * @access Private
 */
export const getLikedByUser = async (
    req: Request<{}, {}, {}, PaginationParams, { user: IUser }>,
    res: Response<ApiResponse<{ likes: ILike[]; totalLikes: number } | null>>
) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, type } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {
            likedBy: user?._id,
            isDeleted: { $ne: true }
        };
        if (type) match.type = type;

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
                    pipeline: [{ $project: { title: 1, thumbnail: 1 } }]
                }
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

        return res.status(200).json(
            ApiResponse.success(
                { likes, totalLikes },
                'Liked items fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching liked items',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};