import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import logger from '../utils/logger';

export const errorMiddleware = (
    error: Error | ApiError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (error instanceof ApiError) {
        logger.error(`API Error: ${error.message}, Status: ${error.statusCode}, Errors: ${error.errors.join(', ')}`);
        return res.status(error.statusCode).json(
            ApiResponse.error(error.statusCode, error.message, error.errors)
        );
    }
    
    logger.error(`Unexpected error: ${error.message}\n${error.stack}`);
    return res.status(500).json(
        ApiResponse.error(500, 'Internal server error')
    );
};