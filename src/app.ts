import express, { type Request, type Response, type NextFunction } from 'express';
import corsMiddleware from './middlewares/cors.middleware';
import cookieParser from 'cookie-parser';
import helmetMiddleware from './middlewares/helmet.middleware';
// import { rateLimiter } from './middlewares/rateLimit.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { ApiResponse } from './utils/apiResponse';

// Route imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import subscriptionRoutes from './routes/subscription.routes';
import videoRoutes from './routes/video.routes';
import playlistRoutes from './routes/playlist.routes';
import commentRoutes from './routes/comment.routes';
import likeRoutes from './routes/like.routes';
import postRoutes from './routes/post.routes';
import viewRoutes from './routes/view.routes';
import notificationRoutes from './routes/notification.routes';
import tagRoutes from './routes/tag.routes';
import watchHistoryRoutes from './routes/watchHistory.routes';
import analyticsRoutes from './routes/analytics.routes';
import healthRoutes from './routes/health.routes';

const app = express();

// Security and rate limiting middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
// app.use(rateLimiter);

// Body parsing and cookies
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(express.static('public'));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/playlists', playlistRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/views', viewRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/watch-history', watchHistoryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/health', healthRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json(ApiResponse.error(404, 'Route not found', []));
});

// Global error handler
app.use(errorMiddleware);

export default app;