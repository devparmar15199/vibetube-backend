import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();          
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const validationErrors = error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`);
                logger.error(`Validation error: ${validationErrors.join(', ')}`);
                throw new ApiError(400, 'Validation failed', validationErrors);
            }
            logger.error(`Unexpected validation error: ${error.message}`);
            throw new ApiError(400, 'Invalid request data');
        }
    };
};