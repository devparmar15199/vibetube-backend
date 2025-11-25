import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Comment } from '../models/comment.model';
import { Video } from '../models/video.model';
import { Post } from '../models/post.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
// import { addNotificationJob } from '../queue/notificationQueue';
import { NOTIFICATION_TYPES } from '../utils/constants';
import logger from '../utils/logger';

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
 * @route POST /api/v1/comments/:type/:id
 * @description Add a comment to a video or post
 * @access Private (requires authentication)
 * @param {string} type - Content type ('video' or 'post')
 * @param {string} id - ID of the video or post
 * @param {Object} body - Comment data (content, optional parentComment)
 * @returns {ApiResponse} Created comment
 */
export const addComment = async (
    req: Request<{ type: 'video' | 'post'; id: string }, {}, AddCommentBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { type, id } = req.params;
        const { content, parentComment } = req.body;

        if (!content?.trim()) {
            throw new ApiError(400, 'Comment content is required', []);        
        }

        // Validate type and target existence
        let targetModel: any;
        let targetField: string;
        switch (type.toLowerCase()) {
            case 'video':
                targetModel = Video;
                targetField = 'video';
                break;
            case 'post':
                targetModel = Post;
                targetField = 'post';
                break;
            default:
                throw new ApiError(400, 'Invalid comment type', []);
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid target ID', []);
        }
        
        const target = await targetModel.findById(id);
        if (!target) {
            throw new ApiError(404, `${type} not found`, []);
        }

        // Validate parent comment if provided
        let parentId: mongoose.Types.ObjectId | undefined;
        if (parentComment) {
            if (!mongoose.Types.ObjectId.isValid(parentComment)) {
                throw new ApiError(400, 'Invalid parent comment ID', []);
            }
            parentId = new mongoose.Types.ObjectId(parentComment);
            const parent = await Comment.findById(parentId);
            if (!parent) {
                throw new ApiError(404, 'Parent comment not found', []);
            }
        }

        // Create comment
        const comment = await Comment.create({
            content: content.trim(),
            [targetField]: id,
            owner: user._id,
            parentComment: parentId,
            likesCount: 0,
        });

        // Populate owner for response
        const populatedComment = await Comment.findById(comment._id)
            .populate('owner', 'username avatar');

        // Queue notification for content owner (if not the commenter)
        // if (target.owner.toString() !== user._id.toString()) {
        //     const message = `${user.username} commented on your ${type.toLowerCase()}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`;
        //     await addNotificationJob(
        //         target.owner.toString(),
        //         NOTIFICATION_TYPES[2],
        //         user._id.toString(),
        //         message,
        //         type.toLowerCase() === 'video' ? id : undefined,
        //         type.toLowerCase() === 'post' ? id : undefined,
        //         (String(comment._id))
        //     );
        // }

        logger.info(`Comment added by user ${user._id} on ${type} ${id}`);

        return res.status(201).json(
            ApiResponse.success(
                { comment: populatedComment }, 
                'Comment added successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in addComment: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while adding comment',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/comments/:commentId
 * @description Update a comment's content
 * @access Private (requires authentication)
 * @param {string} commentId - ID of the comment to update
 * @param {Object} body - Updated comment data (content)
 * @returns {ApiResponse} Updated comment
 */
export const updateComment = async (
    req: Request<{ commentId: string }, {}, UpdateCommentBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { commentId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            throw new ApiError(400, 'Updated content is required', []);
        }

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new ApiError(400, 'Invalid comment ID', []);
        }
        
        const comment = await Comment.findOneAndUpdate(
            {
                _id: commentId,
                owner: user._id,
            },
            { content: content.trim() },
            { new: true, runValidators: true }
        ).populate('owner', 'username avatar');

        if (!comment) {
            throw new ApiError(404, 'Comment not found or you do not own it', []);
        }

        logger.info(`Comment ${commentId} updated by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { comment }, 
                'Comment updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateComment: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating comment',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/comments/:commentId
 * @description Delete a comment and its replies
 * @access Private (requires authentication)
 * @param {string} commentId - ID of the comment to delete
 * @returns {ApiResponse} Success message
 */
export const deleteComment = async (
    req: Request<{ commentId: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { commentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new ApiError(400, 'Invalid comment ID', []);
        }
        
        const comment = await Comment.findOne({ _id: commentId, owner: user._id });
        if (!comment) {
            throw new ApiError(404, 'Comment not found or you do not own it', []);
        }

        // Delete comment and its replies 
        await Comment.deleteMany({
            $or: [
                { _id: commentId },
                { parentComment: commentId }
            ],
        });

        logger.info(`Comment ${commentId} and its replies deleted by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success({}, 'Comment deleted successfully', 200)
        );
    } catch (error: any) {
        logger.error(`Error in deleteComment: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting comment',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/comments/:type/:id
 * @description Get comments for a video or post
 * @access Public
 * @param {string} type - Content type ('video' or 'post')
 * @param {string} id - ID of the video or post
 * @returns {ApiResponse} List of comments with pagination
 */
export const getComments = async (
    req: Request<{ type: 'video' | 'post'; id: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { type, id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate type
        let targetField: string;
        switch (type.toLowerCase()) {
            case 'video':
                targetField = 'video';
                break;
            case 'post':
                targetField = 'post';
                break;
            default:
                throw new ApiError(400, 'Invalid type', []);
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid target ID', []);
        }

        const targetId = new mongoose.Types.ObjectId(id);
        
        // Aggregation pipeline for top-level comments
        const comments = await Comment.aggregate([
            { 
                $match: {
                    [targetField]: targetId,
                    parentComment: { $exists: false },
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
                    ],
                },
            },
            { $addFields: { repliesCount: { $size: '$replies' } } }
        ]);

        // Count total top-level comments
        const totalComments = await Comment.countDocuments({
            [targetField]: targetId,
            parentComment: { $exists: false },
        });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalComments,
                totalPages: Math.ceil(totalComments / Number(limit)),
            },
        };

        logger.info(`Fetched comments for ${type} ${id}`);
        
        return res.status(200).json(
            ApiResponse.success(
                { comments, totalComments }, 
                'Comment fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getComments: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching comments',
            error.errors || []
        );
    }
};