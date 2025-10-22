import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'
import { ApiError } from './utils/apiError';
import { ApiResponse } from './utils/apiResponse';

// Route imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import subscriptionRoutes from './routes/subscription.routes';
import videoRoutes from './routes/video.routes';

const app = express();

// Security middleware
app.use(helmet());

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// CORS and cookie parsing
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/videos', videoRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json(ApiResponse.error(404, null, 'Route not found'));
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(
            ApiResponse.error(err.statusCode, null, err.message, err.errors)
        );
    }
    // For other errors
    console.error('Unhandled error:', err);
    res.status(500).json(ApiResponse.error(500, null, 'Internal Server Error', [err.message]));
});

export default app;