import dotenv from 'dotenv';
import connectDB from './db/dbSetup.ts';
import app from './app.ts';

dotenv.config({ path: './.env' });

const startServer = async () => {
    try {
        await connectDB();
        const PORT = parseInt(process.env.PORT || '3001', 10);
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();