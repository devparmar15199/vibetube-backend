export interface ApiResponseMeta {
    pagination?: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export class ApiResponse<T = any> {
    public statusCode: number;
    public data: T;
    public message: string;
    public success: boolean;
    public meta?: ApiResponseMeta;

    constructor(statusCode: number, data: T, message: string = 'Success', meta?: ApiResponseMeta) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
        this.meta = meta;
    }

    static success<T = any>(
        data: T,
        message: string = 'Success',
        statusCode: number = 200,
        meta?: ApiResponseMeta
    ): ApiResponse<T> {
        const response = new ApiResponse(statusCode, data, message, meta);
        response.success = true;
        return response;
    }

    static error<T = any>(
        statusCode: number,
        data: T = null as T,
        message: string,
        errors: string[] = []
    ): ApiResponse<T> {
        const response = new ApiResponse(statusCode, data, message);
        response.success = false;
        if (errors.length > 0) {
            response.data = { ...data, errors } as T;
        }
        return response;
    }
}