import mongoose, { Schema, Document } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

/**
 * Interface for User document, extending Mongoose Document for full type safety.
 * Includes custom methods for authentication and token generation.
 */
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    username: string;
    email: string;
    fullName: string;
    avatar: string;
    coverImage?: string;
    bio?: string;
    password: string;  // Hashed; never expose in responses
    refreshToken: string;  // For session refresh; stored securely
    watchHistory: mongoose.Types.ObjectId[];  // References to recent Video IDs; limited for performance (full history in WatchHistory model)
    subscribersCount: number;  // Denormalized count of subscribers (updated via hooks in Subscription model)
    isEmailVerified: boolean;

    /**
     * Compares a plain password against the hashed one.
     * @param currentPassword - Plain text password to compare
     * @returns Promise<boolean> - True if match, false otherwise.
     */
    comparePassword(currentPassword: string): Promise<boolean>;
    
    /**
     * Generates a short-lived JWT access token for API auth.
     * @returns string - Signed JWT token.
     */
    generateAccessToken(): string;

    /**
     * Generates a long-lived JWT refresh token for session renewal.
     * @returns string - Signed JWT token.
     */
    generateRefreshToken(): string;

    /**
     * Virtual for populating subscriber list (for scalability, populates on query).
     */
    subscribers?: IUser[];
}

/**
 * Mongoose schema for User model.
 * Defines structure, validations, indexes, and hooks.
 */
const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes'],
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
        trim: true,
    },
    coverImage: { 
        type: String,
        trim: true, 
    },
    bio: { 
        type: String,
        maxLength: [200, 'Bio cannot exceed 200 characters'],
        trim: true,
        default: 'Default bio given to everyone...',
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
            validate: {
                validator: function (v: mongoose.Types.ObjectId[]) {
                    return v.length <= 100;  // Max 100 recent entries
                },
                message: 'Watch history cannot exceed 100 entries',
            },
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
}, { 
    timestamps: true,
    autoIndex: config.nodeEnv === 'development',
});

// Compound indexes
userSchema.index({ subscribersCount: -1 }); // Descending sort for popular channels
userSchema.index({ username: 'text', fullName: 'text', bio: 'text' });  // Text index for search

// Virtual for subscribers
userSchema.virtual('subscribers', {
    ref: 'Subscription',
    localField: '_id',
    foreignField: 'channel',
    justOne: false,
    options: { sort: { createdAt: -1 } },
});

// Pre-save hook: Hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();   
    } catch (error) {
        next(error as Error);
    }
});

// Pre-deleteOne: Clean up related data
userSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {
        await mongoose.model('Subscription').deleteMany({ $or: [{ subscriber: this._id }, { channel: this._id }] });
        await mongoose.model('Notification').deleteMany({ user: this._id });
        await mongoose.model('Video').deleteMany({ owner: this._id });
        next();   
    } catch (error) {
        next(error as Error);
    }
});

// Instance methods
userSchema.methods.comparePassword = async function (currentPassword: string): Promise<boolean> {
    return await bcrypt.compare(currentPassword, this.password);
};

userSchema.methods.generateAccessToken = function (): string {
    if (!config.accessTokenSecret) {
        throw new Error('ACCESS_TOKEN_SECRET not configured');
    }
    return jwt.sign(
        {
            _id: this._id.toString(),
            username: this.username,
            email: this.email,
            fullName: this.fullName,
        },
        config.accessTokenSecret,
        { expiresIn: '1d' }
    );
};

userSchema.methods.generateRefreshToken = function (): string {
    if (!config.refreshTokenSecret) {
        throw new Error('REFRESH_TOKEN_SECRET not configured');
    }
    return jwt.sign({ _id: this._id.toString() }, config.refreshTokenSecret, { expiresIn: '14d' });
};

// toJSON: Exclude sensitive fields and add id
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);