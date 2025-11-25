export interface ApiResponseMeta {
    pagination?: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export class ApiResponse<T> {
    statusCode: number;
    data: T | null;
    message: string;
    success: boolean;
    errors?: string[];
    meta?: ApiResponseMeta;

    constructor(
        statusCode: number, 
        data: T | null, 
        message: string = 'Success',
        errors: string[] = [],
        meta?: ApiResponseMeta
    ) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.errors = errors;
        this.success = statusCode < 400 && errors.length === 0;
        this.meta = meta;
    }

    static success<T>(
        data: T,
        message: string = 'Success',
        statusCode: number = 200,
        meta?: ApiResponseMeta
    ): ApiResponse<T> {
        return new ApiResponse(statusCode, data, message, [], meta);
    }

    static error(
        statusCode: number,
        message: string = 'Error',
        errors: string[] = [],
        meta?: ApiResponseMeta
    ): ApiResponse<null> {
        return new ApiResponse(statusCode, null, message, errors, meta);
    }
}