import mongoose, { Schema, Document, type QueryWithHelpers } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    watchHistory: mongoose.Types.ObjectId[];  // References to Video IDs; limited for performance
    subscribersCount: number;  // Denormalized count of subscribers (updated via hooks)
    isEmailVerified: boolean;
    isDeleted: boolean;
    deletedAt?: Date;  // Timestamp for soft delete audit

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

// Schema definition with validation and defaults
const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        lowercase: true,
        trim: true,
        // Custom validator for alphanumeric + underscores/dashes
        match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes'],
        index: true,  // Single field index for lookups
        minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
        index: true,  // Single field index for auth queries
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxLength: [50, 'Full name cannot exceed 50 characters'],
    },
    avatar: {
        type: String,   // Cloudinary URL
        required: [true, 'Avatar is required'],
        trim: true,
    },
    coverImage: { 
        type: String,   // Optional Cloudinary URL for channel banner
        trim: true, 
    },
    bio: { 
        type: String,
        maxLength: [200, 'Bio cannot exceed 200 characters'],
        trim: true,
    },
    password: { 
        type: String,
        required: [true, 'Password is required'], 
        minlength: [8, 'Password must be at least 8 characters'],
        select: false,  // Exclude from queries by default for security
    },
    refreshToken: { 
        type: String,
        select: false,  // Exclude for security
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Video',
            // Limit array size for scalability
            validate: {
                validator: function (v: mongoose.Types.ObjectId[]) {
                    return v.length <= 100;  // Max 100 entries
                },
                message: 'Watch history cannot exceed 100 entries',
            },
        },
    ],
    subscribersCount: {
        type: Number,
        default: 0,
        min: 0, // Ensure non-negative
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
    }
}, { 
    timestamps: true,   // Auto-add createdAt/updatedAt
    autoIndex: process.env.NODE_ENV === 'development', // Defer indexing in prod for faster startup
});

// Compound indexes for common queries
// Soft delete + verification for active user fetches
userSchema.index({ isDeleted: 1, isEmailVerified: 1 });

// Descending sort for popular channels
userSchema.index({ subscribersCount: -1 });

// Text index for search (username + fullName + bio)
userSchema.index({ username: 'text', fullName: 'text', bio: 'text' });

// Virtual for subscribers (populate from Subscription model)
userSchema.virtual('subscribers', {
    ref: 'Subscription',
    localField: '_id',
    foreignField: 'channel',
    justOne: false, // Array
    options: { sort: { createdAt: -1 } }, // Recent first
});

// Pre-save hook: Hash password if modified (secure one-way)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        this.password = await bcrypt.hash(this.password, 12);   // Increased salt rounds for security
        next();   
    } catch (error) {
        next(error as Error);
    }
});

// Instance methods for auth
userSchema.methods.comparePassword = async function (currentPassword: string): Promise<boolean> {
    return await bcrypt.compare(currentPassword, this.password);
};

userSchema.methods.generateAccessToken = function (): string {
    if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new Error('ACCESS_TOKEN_SECRET not configured');
    }
    return jwt.sign(
        {
            _id: this._id.toString(),
            username: this.username,
            email: this.email,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: '1d' } // Short-lived for security
    );
};

userSchema.methods.generateRefreshToken = function (): string {
    if (!process.env.REFRESH_TOKEN_SECRET) {
        throw new Error('REFRESH_TOKEN_SECRET not configured');
    }
    return jwt.sign(
        { _id: this._id.toString() },
        process.env.REFRESH_TOKEN_SECRET!,
        { expiresIn: '14d' }    // Longer for session persistence
    );
};

// Transform toJSON: Exclude sensitive fields in API responses
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    delete obj.isDeleted;
    delete obj.deletedAt;
    return obj;
};

// Soft delete middleware: Filter out deleted docs in queries
// Applied to multiple hooks for comprehensiveness
userSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
    (this as QueryWithHelpers<unknown, Document>).find({ isDeleted: { $ne: true } });
    next();
});

// Export model
export const User = mongoose.model<IUser>('User', userSchema);