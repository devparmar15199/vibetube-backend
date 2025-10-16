import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const response = await mongoose.connect(process.env.MONGO_URI!, {
            dbName: 'VibeTube',
        });
        console.log('MongoDB connected successfully! Host: ', response.connection.host);
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

export default connectDB;