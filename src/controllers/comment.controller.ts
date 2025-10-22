import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Comment, type IComment } from '../models/comment.model';
import { Video } from '../models/video.model';
import { Post } from '../models/post.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { type IUser } from '../models/user.model';

interface AddCommentBody {
    content: string;
    parentComment?: string;
}

interface UpdateCommentBody {
    content: string;
}

interface PaginationParams {
    page?: number;
    limit?: number;
}

/**
 * @route POST /comments/:type/:id
 * @desc Add a comment to a video/post
 * @access Private
 */
export const addComment = async (
    req: Request<{ type: 'Video' | 'Post'; id: string }, {}, AddCommentBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ comment: IComment | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { type, id } = req.params;
        const { content, parentComment } = req.body;

        if (!content?.trim()) {
            return res.status(400).json(ApiResponse.error(400, null, 'Comment content is required'));
        }

        const targetId = new mongoose.Types.ObjectId(id);

        // Validate type and target existence
        let targetModel: any;
        let targetField: string;
        switch (type) {
            case 'Video':
                targetModel = Video;
                targetField = 'video';
                break;
            case 'Post':
                targetModel = Post;
                targetField = 'post';
                break;
            default:
                return res.status(400).json(ApiResponse.error(400, null, 'Invalid comment type'));
        }
        
        const target = await targetModel.findById(targetId);
        if (!target) {
            return res.status(404).json(ApiResponse.error(404, null, `${type} not found`));
        }

        // Optional parent for replies
        let parentId: mongoose.Types.ObjectId | undefined;
        if (parentComment) {
            parentId = new mongoose.Types.ObjectId(parentComment);
            const parent = await Comment.findById(parentId);
            if (!parent) {
                return res.status(404).json(ApiResponse.error(404, null, 'Parent comment not found'));
            }
        }

        const comment = await Comment.create({
            content: content.trim(),
            [targetField]: targetId,
            owner: user._id,
            parentComment: parentId,
            likesCount: 0,
            isDeleted: false,
        });

        // Populate owner for response
        const populatedComment = await Comment.findById(comment._id)
            .populate('owner', 'username avatar');

        return res.status(200).json(
            ApiResponse.success(
                { comment: populatedComment }, 
                'Comment added successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while adding comment',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /comments/:commentId
 * @desc Update a comment
 * @access Private
 */
export const updateComment = async (
    req: Request<{ commentId: string }, {}, UpdateCommentBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ comment: IComment | null } | null>>
) => {
    try {
        const user = req.user;
        const { commentId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json(ApiResponse.error(400, null, 'Updated content is required'));
        }

        const commentObjectId = new mongoose.Types.ObjectId(commentId);
        
        const comment = await Comment.findOneAndUpdate(
            {
                _id: commentObjectId,
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { content: content.trim() },
            { new: true, runValidators: true }
        ).populate('owner', 'username avatar');

        if (!comment) {
            return res.status(404).json(ApiResponse.error(404, null, 'Comment not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                { comment }, 
                'Comment updated successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while updating comment',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /comments/:commentId
 * @desc Delete a comment
 * @access Private
 */
export const deleteComment = async (
    req: Request<{ commentId: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        const { commentId } = req.params;
        const commentObjectId = new mongoose.Types.ObjectId(commentId);
        
        const comment = await Comment.findOneAndUpdate(
            {
                _id: commentObjectId,
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!comment) {
            return res.status(404).json(ApiResponse.error(404, null, 'Comment not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                {}, 
                'Comment deleted successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while deleting comment',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /comments/:type/:id
 * @desc Get comments for a video/post
 * @access Public
 */
export const getComments = async (
    req: Request<{ type: 'Video' | 'Post'; id: string }, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ comments: IComment[]; totalComments: number } | null>>
) => {
    try {
        const { type, id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const targetId = new mongoose.Types.ObjectId(id);

        let targetField: string;
        switch (type) {
            case 'Video':
                targetField = 'video';
                break;
            case 'Post':
                targetField = 'post';
                break;
            default:
                return res.status(400).json(ApiResponse.error(400, null, 'Invalid type'));
        }
        
        const comments = await Comment.aggregate([
            { 
                $match: {
                    [targetField]: targetId,
                    parentComment: { $exists: false },
                    isDeleted: { $ne: true }
                }  
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, avatar: 1 } }]
                }
            },
            { $unwind: '$owner' },
            {
                $lookup: {
                    from: 'comments',
                    localField: '_id',
                    foreignField: 'parentComment',
                    as: 'replies',
                    pipeline: [
                        { $match: { isDeleted: { $ne: true } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'owner',
                                foreignField: '_id',
                                as: 'owner',
                                pipeline: [{ $project: { username: 1, avatar: 1 } }]
                            }
                        },
                        { $unwind: '$owner' }
                    ]
                }
            },
            { $addFields: { repliesCount: { $size: '$replies' } } }
        ]);

        const totalComments = await Comment.countDocuments({
            [targetField]: targetId,
            parentComment: { $exists: false },
            isDeleted: { $ne: true }
        });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalComments,
                totalPages: Math.ceil(totalComments / Number(limit))
            }
        };

        return res.status(200).json(
            ApiResponse.success(
                { comments, totalComments }, 
                'Comment fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching comments',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};