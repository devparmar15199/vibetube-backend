import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    port: z.number().default(3000),
    mongoUri: z.string().url(),
    accessTokenSecret: z.string().min(1),
    refreshTokenSecret: z.string().min(1),
    cloudinary: z.object({
        cloudName: z.string().min(1),
        apiKey: z.string().min(1),
        apiSecret: z.string().min(1),
    }),
    redis: z.object({
        url: z.string().url().default('redis-18650.crce217.ap-south-1-1.ec2.cloud.redislabs.com:18650'),
    }),
});

export const config = configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT || '3000', 10),
    mongoUri: process.env.MONGO_URI,
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    redis: {
        url: process.env.REDIS_URL,
    },
});