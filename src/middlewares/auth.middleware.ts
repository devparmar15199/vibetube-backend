import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.ts';
import { ApiResponse } from '../utils/apiResponse.ts';

interface JWTPayload {
    _id: string;
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
                ApiResponse.error(401, null, 'No token provided')
            );
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as JWTPayload;

        // Find user
        const user = await User.findById(decoded._id).select('-password -refreshToken');
        if (!user) {
            return res.status(401).json(
                ApiResponse.error(401, null, 'Invalid token')
            );
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json(
            ApiResponse.error(401, null, 'Invalid or expired token')
        );
    }
};