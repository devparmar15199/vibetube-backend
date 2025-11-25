import mongoose from 'mongoose';
import { config } from '../config';
import logger from '../utils/logger';

mongoose.set('strictQuery', true);

const connectDB = async (retries = 5, delay = 5000) => {
    try {
        const response = await mongoose.connect(config.mongoUri, {
            dbName: 'VibeTube',
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
            socketTimeoutMS: 45000,
        });
        logger.info(`MongoDB connected successfully! Host: ${response.connection.host}`);
    } catch (error: any) {
        logger.error(`MongoDB connection failed: ${error.message}`);
        if (retries > 0) {
            logger.info(`Retrying connection in ${delay}ms... (${retries} attempts left)`);
            setTimeout(() => connectDB(retries - 1, delay * 2), delay);
        } else {
            logger.error('MongoDB connection failed after all retries');
            process.exit(1);
        }
    }
};

export default connectDB;