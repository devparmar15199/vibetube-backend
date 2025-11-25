import { createClient } from 'redis';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../utils/logger';

const redisClient = createClient({
    url: config.redis.url,
});

redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));

redisClient.connect().catch((err) => {
    logger.error(`Failed to connect to Redis: ${err.message}`);
});

export const cacheMiddleware = (cacheKeyPrefix: string, ttl: number = 3600) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET') return next();

        const cacheKey = `${cacheKeyPrefix}:${req.originalUrl}`;
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                logger.info(`Cache hit for ${cacheKey}`);
                return res.json(JSON.parse(cachedData));
            }

            // Store original json method
            const originalJson = res.json;
            res.json = function (data: any) {
                redisClient.setEx(cacheKey, ttl, JSON.stringify(data)).catch((err) => {
                    logger.error(`Failed to cache data for ${cacheKey}: ${err.message}`);
                });
                return originalJson.call(this, data);  
            };

            next();
        } catch (error: any) {
            logger.error(`Cache middleware error: ${error.message}`);
            next();
        }
    };
};