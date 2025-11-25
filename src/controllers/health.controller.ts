import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';
import { config } from '../config';

interface HealthStatus {
    api: string;
    mongo: string;
    redis: string;
    healthy: boolean;
}

/**
 * @route GET /api/v1/health
 * @description Check the health status of the API (MongoDB, Redis, etc.)
 * @access Public
 * @returns {ApiResponse} Health status of services
 */
export const healthCheck = async (req: Request, res: Response) => {
    try {
        const healthStatus: HealthStatus = {
            api: 'healthy',
            mongo: 'unknown',
            redis: 'unknown',
            healthy: true,
        };

        // Check MongoDB connection
        const mongoState = mongoose.connection.readyState;
        switch (mongoState) {
            case 0:
                healthStatus.mongo = 'disconnected';
                healthStatus.healthy = false;
                break;
            case 1:
                healthStatus.mongo = 'connected';
                break;
            case 2:
                healthStatus.mongo = 'connecting';
                healthStatus.healthy = false;
                break;
            case 3:
                healthStatus.mongo = 'disconnecting';
                healthStatus.healthy = false;
                break;
            default:
                healthStatus.mongo = 'unknown';
                healthStatus.healthy = false;
        }

        // Check Redis connection
        const redisClient = createClient({
            url: config.redis.url,
        });

        try {
            await redisClient.connect();
            const pingResult = await redisClient.ping();
            healthStatus.redis = pingResult === 'PONG' ? 'connected' : 'unhealthy';
            await redisClient.quit();
        } catch (redisError) {
            healthStatus.redis = 'disconnected';
            healthStatus.healthy = false;
            logger.error(`Redis health check failed: ${redisError instanceof Error ? redisError.message : 'Unknown error'}`);
        }

        logger.info(`Health check: ${JSON.stringify(healthStatus)}`);

        if (!healthStatus.healthy) {
            return res.status(503).json(
                ApiResponse.error(
                    503,
                    'Service unhealthy',
                    ['One or more services are not functioning properly']
                )
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                { status: healthStatus },
                'All services are healthy',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in healthCheck: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error during health check',
            error.errors || []
        );
    }
};