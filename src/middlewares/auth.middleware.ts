import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../models/user.model';
import { ApiResponse } from '../utils/apiResponse';
import { config } from '../config';
import logger from '../utils/logger';

interface JWTPayload {
    _id: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

export const verifyToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get token from header or cookie
        const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json(
                ApiResponse.error(401, 'No token provided')
            );
        }

        // Verify token
        const decoded = jwt.verify(token, config.accessTokenSecret) as JWTPayload;

        // Find user
        const user = await User.findById(decoded._id).select('-password -refreshToken');
        if (!user) {
            return res.status(401).json(
                ApiResponse.error(401, 'Invalid token: User not found')
            );
        }

        // Attach typed user to request object
        req.user = user;
        next();
    } catch (error: any) {
        logger.error(`Authentication error: ${error.message}`);
        return res.status(401).json(
            ApiResponse.error(401, 'Invalid or expired token')
        );
    }
};