import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApiError } from './utils/apiError.ts';
import { ApiResponse } from './utils/apiResponse.ts';

// Route imports
import authRoutes from './routes/auth.routes.ts';
import userRoutes from './routes/user.routes.ts';

const app = express();

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ApiError) {
        res.status(err.statusCode).json(ApiResponse.error(err.statusCode, null, err.message, err.errors));
    } else {
        res.status(500).json(ApiResponse.error(500, null, 'Internal Server Error', [err.message]));     
    }
});

export default app;