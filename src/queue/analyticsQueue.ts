// // import BullMQ from 'bullmq';
// import BullMQ from 'bullmq';
// const { Queue } = BullMQ;
// // import { Queue } from 'bullmq/dist/esm/index.js';
// import { config } from '../config';
// import logger from '../utils/logger';
// import { Analytics } from '../models/analytics.model';
// import { Video } from '../models/video.model';
// import { View } from '../models/view.model';
// import { Like } from '../models/like.model';
// import { Comment } from '../models/comment.model';
// import { ApiError } from '../utils/apiError';

// // Define job data interface
// interface AnalyticsJob {
//     date: Date;
// }

// // Initialize queue
// export const analyticsQueue = new Queue<AnalyticsJob>('analytics', {
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

// // Process analytics aggregation job
// export const processAnalyticsAggregation = async (job: { data: AnalyticsJob }) => {
//     const { date } = job.data;
//     try {
//         logger.info(`Processing analytics aggregation for date: ${date.toISOString()}`);

//         const start = new Date(date);
//         const end = new Date(date.getTime() + 86400000); // Next day

//         // Get all video IDs
//         const videos = await Video.find().select('_id');
//         for (const video of videos) {
//             const videoId = video._id;

//             // Count views
//             const viewCount = await View.countDocuments({
//                 video: videoId,
//                 createdAt: { $gte: start, $lt: end }
//             });

//             // Count likes (for Video type)
//             const likeCount = await Like.countDocuments({
//                 type: 'Video',
//                 video: videoId,
//                 createdAt: { $gte: start, $lt: end }
//             });

//             // Count comments
//             const commentCount = await Comment.countDocuments({
//                 video: videoId,
//                 createdAt: { $gte: start, $lt: end }
//             });

//             // Upsert analytics document
//             await Analytics.findOneAndUpdate(
//                 { video: videoId, date },
//                 {
//                     $set: {
//                         views: viewCount,
//                         likes: likeCount,
//                         comments: commentCount
//                     }
//                 },
//                 { upsert: true, new: true }
//             );
//         }

//         logger.info(`Analytics aggregation completed for ${videos.length} videos on ${date.toISOString()}`);
//     } catch (error: any) {
//         logger.error(`Analytics aggregation failed for ${date.toISOString()}: ${error.message}`);
//         throw error;
//     }
// };

// // Add analytics aggregation job to queue
// export const addAnalyticsAggregationJob = async (date: Date) => {
//     try {
//         await analyticsQueue.add('aggregateAnalytics', { date });
//         logger.info(`Added analytics aggregation job for date: ${date.toISOString()}`);
//     } catch (error: any) {
//         logger.error(`Failed to add analytics aggregation job: ${error.message}`);
//         throw new ApiError(500, 'Failed to queue analytics aggregation');
//     }
// };