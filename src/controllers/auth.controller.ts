import type { Request, Response } from 'express';
import { User, IUser } from '../models/user.model.ts';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.ts';
import { ApiResponse } from '../utils/apiResponse.ts';
import { uploadToCloudinary } from '../utils/cloudinarySetup.ts';

interface MulterFiles {
    avatar?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
}

interface RegisterRequestBody {
    username: string;
    email: string;
    fullName: string;
    password: string;
}

interface LoginRequestBody {
    username?: string;
    email?: string;
    password: string;
}

interface RefreshTokenBody {
    refreshToken: string;
}

// Generate tokens + save refresh
const getAccessAndRefreshToken = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found while generating tokens');

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
export const registerUser = async (
    req: Request<{}, {}, RegisterRequestBody>,
    res: Response<ApiResponse<{ user: IUser | null; accessToken: string; refreshToken: string } | null>>
) => {
    try {
        // Step 1: Extract user details from request body
        const { username, email, fullName, password } = req.body;

        if ([username, email, fullName, password].some(field => !field?.trim())) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'All fields (username, email, fullName, password) are required')
            );
        }

        // Step 2: Check for existing user with same username or email
        const existingUser = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: email.toLowerCase() },
            ]
        });
        if (existingUser) {
            return res.status(409).json(
                ApiResponse.error(409, null, 'User with this email or username already exists')
            );
        }

        // Step 3: Upload to Cloudinary
        const files = req.files as MulterFiles;
        const avatarLocalPath = files?.avatar?.[0]?.path;
        const coverImageLocalPath = files?.coverImage?.[0]?.path;

        if (!avatarLocalPath) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Avatar file is required')
            );
        }

        const avatar = await uploadToCloudinary(avatarLocalPath, 'image');
        const coverImage = coverImageLocalPath 
            ? await uploadToCloudinary(coverImageLocalPath, 'image')
            : null;

        if (!avatar?.secure_url) {
            return res.status(500).json(
                ApiResponse.error(500, null, 'Failed to upload avatar')
            );
        }

        // Step 4: Create user
        const user = await User.create({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            fullName,
            password,
            avatar: avatar.secure_url,
            coverImage: coverImage?.secure_url || '',
            subscribersCount: 0,
            isEmailVerified: false,
            isDeleted: false,
        });

        // Step 5: Fetch without sensitive fields
        const createdUser = await User.findById(user._id).select('-password -refreshToken');

        // Step 6: Generate tokens
        const { accessToken, refreshToken } = await getAccessAndRefreshToken(user._id.toString());
        
        // Step 7: Send response
        return res
            .status(201)
            .cookie('accessToken', accessToken, { httpOnly: true, secure: true })
            .cookie('refreshToken', refreshToken, { httpOnly: true, secure: true })
            .json(
                ApiResponse.success(
                    {
                        user: createdUser,
                        accessToken,
                        refreshToken
                    },
                    'User registered successfully',
                    201
                )
            );
    } catch (error) {
        return res
            .status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while registering user',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /login
 * @desc Login user
 * @access Public
 */
export const loginUser = async (
    req: Request<{}, {}, LoginRequestBody>,
    res: Response<ApiResponse<{ user: IUser | null; accessToken: string; refreshToken: string } | null>>
) => {
    try {
        // Step 1: Extract login credentials
        const { username, email, password } = req.body;

        if ((!username && !email) || !password) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Username/email and password are required')
            );
        }

        // Step 2: Find user by username or email
        const query: any = {};
        if (username) query.username = username.toLowerCase();
        if (email) query.email = email.toLowerCase();
        
        const user = await User.findOne(query).select('+password');

        if (!user) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'User does not exist')
            );
        }

        // Step 3: Validate password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json(
                ApiResponse.error(401, null, 'Invalid credentials')
            );
        }

        // Step 4: Generate tokens
        const { accessToken, refreshToken } = await getAccessAndRefreshToken(user._id.toString());

        // Step 5: Fetch user without sensitive fields
        const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

        // Step 6: Send response
        return res
            .status(200)
            .cookie('accessToken', accessToken, { httpOnly: true, secure: true })
            .cookie('refreshToken', refreshToken, { httpOnly: true, secure: true })
            .json(
                ApiResponse.success(
                    { user: loggedInUser, accessToken, refreshToken },
                    'User logged in successfully',
                    200
                )
            );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while logging in',
                error instanceof Error ? [error.message] : []
            )
        );
    }   
};

/**
 * @route POST /logout
 * @desc Logout user
 * @access Private
 */
export const logoutUser = async (
    req: Request, 
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(
                ApiResponse.error(401, null, 'Unauthorized')
            );
        }

        await User.findByIdAndUpdate(user._id, { $set: { refreshToken: '' } });

        res.clearCookie('accessToken', { httpOnly: true, secure: true });
        res.clearCookie('refreshToken', { httpOnly: true, secure: true });

        res.status(200).json(
            ApiResponse.success({}, 'User logged out successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while logging out',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /refresh-token
 * @desc Refresh access token
 * @access Private
 */
export const refreshToken = async (
    req: Request<{}, {}, RefreshTokenBody>,
    res: Response<ApiResponse<{ accessToken: string; refreshToken: string } | null>>
) => {
    try {
        const { refreshToken: incomingRefreshToken } = req.body;
        if (!incomingRefreshToken) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Refresh token is required')
            );
        }

        const decoded = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET!
        ) as { _id: string };

        const user = await User.findById(decoded._id).select('+refreshToken');
        if (!user || user.refreshToken !== incomingRefreshToken) {
            return res.status(401).json(
                ApiResponse.error(401, null, 'Invalid or expired refresh token')
            );
        }

        const { accessToken, refreshToken: newRefreshToken } = await getAccessAndRefreshToken(user._id.toString());

        return res.status(200).json(
            ApiResponse.success(
                { accessToken, refreshToken: newRefreshToken },
                'Tokens refreshed successfully',
                200
            )
        );
    } catch (error) {
        return res.status(401).json(
            ApiResponse.error(
                401,
                null,
                'Invalid or expired refresh token',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};