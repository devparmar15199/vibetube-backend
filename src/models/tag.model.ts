import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config';

/**
 * Interface for Tag document.
 * Used for categorizing videos beyond predefined categories, enabling better search and recommendation.
 */
export interface ITag extends Document {
    name: string;
    usageCount: number;
}

/**
 * Mongoose schema for Tag model.
 */
const tagSchema = new Schema<ITag>({
    name: {
        type: String,
        required: [true, 'Tag name is required'],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [2, 'Tag name must be at least 2 characters'],
        maxlength: [50, 'Tag name cannot exceed 50 characters'],
        index: true,
    },
    usageCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    autoIndex: config.nodeEnv === 'development',
});

// toJSON 
tagSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    obj.id = obj._id;
    return obj;
};

export const Tag = mongoose.model<ITag>('Tag', tagSchema);