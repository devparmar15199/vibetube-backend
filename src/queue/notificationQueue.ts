// // import BullMQ from 'bullmq';
// import BullMQ from 'bullmq';
// const { Queue } = BullMQ;
// // import { Queue } from 'bullmq/dist/esm/index.js';
// import { config } from '../config';
// import { Notification } from '../models/notification.model';
// import logger from '../utils/logger';
// import { ApiError } from '../utils/apiError';
// import { NOTIFICATION_TYPES } from '../utils/constants';

// // Define job data interface
// interface NotificationJob {
//     userId: string;
//     type: typeof NOTIFICATION_TYPES[number];
//     fromUserId: string;
//     videoId?: string;
//     postId?: string;
//     commentId?: string;
//     message: string;
// }

// // Initialize queue
// export const notificationQueue = new Queue<NotificationJob>('notification', {
//     connection: {
//         host: new URL(config.redis.url).hostname,
//         port: parseInt(new URL(config.redis.url).port || '6379', 10),
//         maxRetriesPerRequest: 5,
//     },
//     defaultJobOptions: {
//         attempts: 3,
//         backoff: {
//             type: 'exponential',
//             delay: 1000,
//         },
//     },
// });

// // Process notification job
// export const processNotification = async (job: { data: NotificationJob }) => {
//     const { userId, type, fromUserId, videoId, postId, commentId, message } = job.data;
//     try {
//         logger.info(`Processing notification job for userId: ${userId}, type: ${type}`);

//         // Validate notification type
//         if (!NOTIFICATION_TYPES.includes(type)) {
//             throw new ApiError(400, `Invalid notification type: ${type}`);
//         }

//         // Create notification in database
//         await Notification.create({
//             user: userId,
//             type,
//             fromUser: fromUserId,
//             video: videoId,
//             post: postId,
//             comment: commentId,
//             message,
//             isRead: false,
//         });

//         // TODO: Implement actual notification delivery (e.g., email, push)
//         logger.info(`Notification created for userId: ${userId}, type: ${type}`);
//     } catch (error: any) {
//         logger.error(`Notification processing failed for userId: ${userId}: ${error.message}`);
//         throw error;
//     }
// };

// // Add notification job to queue
// export const addNotificationJob = async (
//     userId: string,
//     type: typeof NOTIFICATION_TYPES[number],
//     fromUserId: string,
//     message: string,
//     videoId?: string,
//     postId?: string,
//     commentId?: string
// ) => {
//     try {
//         await notificationQueue.add('sendNotification', {
//             userId,
//             type,
//             fromUserId,
//             videoId,
//             postId,
//             commentId,
//             message,
//         });
//         logger.info(`Added notification job for userId: ${userId}, type: ${type}`);
//     } catch (error: any) {
//         logger.error(`Failed to add notification job: ${error.message}`);
//         throw new ApiError(500, 'Failed to queue notification');
//     }
// };