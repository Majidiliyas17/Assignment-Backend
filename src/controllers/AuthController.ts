import { Request, Response } from 'express';
import { AuthService } from '../services';
import { ApiResponse } from '../utils';
import { asyncHandler } from '../utils';

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    res.status(201).json(ApiResponse.created(result, 'Account created successfully'));
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);
    res.status(200).json(ApiResponse.success(result, 'Login successful'));
  });

  static me = asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.getCurrentUser(req.user.id);
    res.status(200).json(ApiResponse.success(user, 'Current user'));
  });
}