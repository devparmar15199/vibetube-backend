import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';
import { ApiResponse } from '../utils/apiResponse';
import logger from '../utils/logger';

const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err) => logger.error(`Redis rate limit error: ${err.message}`));

redisClient.connect().catch((err) => {
    logger.error(`Failed to connect to Redis for rate limiting: ${err.message}`);
});

export const rateLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit to 100 requests per window
    message: async () =>
        ApiResponse.error(429, 'Too many requests, please try again later'),
});