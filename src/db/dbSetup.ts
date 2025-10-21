import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

const connectDB = async (retries = 5, delay = 5000) => {
    try {
        const response = await mongoose.connect(process.env.MONGO_URI!, {
            dbName: 'VibeTube',
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB connected successfully! Host: ', response.connection.host);
    } catch (error: any) {
        console.error('MongoDB connection failed:', error.message);
        if (retries > 0) {
            console.log(`Retrying connection in ${delay}ms... (${retries} attempts left)`);
            setTimeout(() => connectDB(retries - 1, delay * 2), delay);
        } else {
            process.exit(1);
        }
    }
};

export default connectDB;