import dotenv from 'dotenv';
import connectDB from './db/dbSetup';
import { config } from './config';
import app from './app';
import logger from './utils/logger';
import cron from 'node-cron';
// import { addAnalyticsAggregationJob } from './queue/analyticsQueue';

if (!config.nodeEnv) {
    dotenv.config({ path: './.env' });
}

const startServer = async () => {
    try {
        await connectDB();
        const server = app.listen(config.port, () => {
            logger.info(`Server running on http://localhost:${config.port}`);
        });

        // Schedule daily analytics aggregation at midnight
        cron.schedule('0 0 * * *', async () => {
            try {
                const yesterday = new Date();
                yesterday.setHours(0, 0, 0, 0);
                yesterday.setDate(yesterday.getDate() - 1);
                // await addAnalyticsAggregationJob(yesterday);
                logger.info('Daily analytics aggregation job added');
            } catch (error: any) {
                logger.error(`Failed to add daily analytics job: ${error.message}`);
            }
        }, {
            timezone: 'UTC'
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                logger.info('Process terminated.');
                process.exit(0);
            });
        });
    } catch (error: any) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

startServer();