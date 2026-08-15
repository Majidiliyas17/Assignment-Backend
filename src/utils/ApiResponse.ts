export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export class ApiResponse {
  static success<T>(data: T, message = 'Success'): ApiSuccess<T> {
    return { success: true, message, data };
  }

  static created<T>(data: T, message = 'Resource created'): ApiSuccess<T> {
    return { success: true, message, data };
  }

  static list<T>(data: T[], pagination: unknown, message = 'Success'): ApiSuccess<{ files: T[]; pagination: unknown }> {
    return { success: true, message, data: { files: data, pagination } };
  }
}