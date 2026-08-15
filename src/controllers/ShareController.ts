import { Request, Response } from 'express';
import { FileService } from '../services';
import { ApiResponse, asyncHandler, streamFileDownload } from '../utils';

export class ShareController {
  static getByToken = asyncHandler(async (req: Request, res: Response) => {
    const result = await FileService.getPublicFile(req.params.shareToken);
    res.status(200).json(ApiResponse.success(result, 'Shared file retrieved'));
  });

  static downloadByToken = asyncHandler(async (req: Request, res: Response) => {
    const { file, url } = await FileService.getPublicDownloadFile(req.params.shareToken);
    await streamFileDownload(res, url, file.originalName, file.mimeType);
  });
}