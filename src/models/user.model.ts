import mongoose, { Schema, Document } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    username: string;
    email: string;
    fullName: string;
    avatar: string;
    coverImage?: string;
    bio?: string;
    password: string;
    refreshToken: string;
    watchHistory: mongoose.Types.ObjectId[];
    subscribersCount: number;
    isEmailVerified: boolean;
    isDeleted: boolean;

    generateAccessToken(): string;
    generateRefreshToken(): string;
    comparePassword(currentPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
        minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
        index: true,
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxLength: [50, 'Full name cannot exceed 50 characters'],
    },
    avatar: {
        type: String,
        required: [true, 'Avatar is required'],
    },
    coverImage: { type: String },
    bio: { 
        type: String,
        maxLength: [200, 'Bio cannot exceed 200 characters'], 
    },
    password: { 
        type: String,
        required: [true, 'Password is required'], 
        minlength: [8, 'Password must be at least 8 characters'],
        select: false,
    },
    refreshToken: { 
        type: String,
        select: false,
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Video',
        },
    ],
    subscribersCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

// Indexes
userSchema.index({ isDeleted: 1, isEmailVerified: 1 });
userSchema.index({ subscribersCount: -1 });

// Pre-save hook for password hashing
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Methods
userSchema.methods.comparePassword = async function (currentPassword: string): Promise<boolean> {
    return await bcrypt.compare(currentPassword, this.password);
};

userSchema.methods.generateAccessToken = function (): string {
    return jwt.sign(
        {
            _id: this._id.toString(),
            username: this.username,
            email: this.email,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: '1d' }
    );
};

userSchema.methods.generateRefreshToken = function (): string {
    return jwt.sign(
        { _id: this._id.toString() },
        process.env.REFRESH_TOKEN_SECRET!,
        { expiresIn: '14d' }
    );
};

// Query middleware for soft delete
userSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

export const User = mongoose.model<IUser>('User', userSchema);