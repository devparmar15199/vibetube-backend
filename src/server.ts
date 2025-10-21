import dotenv from 'dotenv';
import connectDB from './db/dbSetup';
import app from './app';

if (!process.env.NODE_ENV) {
    dotenv.config({ path: './.env' });
}

const startServer = async () => {
    try {
        await connectDB();
        const PORT = parseInt(process.env.PORT || '3001', 10);
        const server = app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                console.log('Process terminated.');
            });
        });
    } catch (error: any) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();