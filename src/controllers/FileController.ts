import { Request, Response } from 'express';
import { FileService } from '../services';
import { ApiResponse, asyncHandler, streamFileDownload } from '../utils';

export class FileController {
  static uploadSignature = asyncHandler(async (req: Request, res: Response) => {
    const result = await FileService.requestUploadSignature({
      userId: req.user.id,
      filename: req.body.filename,
      mimeType: req.body.mimeType,
      size: req.body.size,
    });
    res.status(200).json(ApiResponse.success(result, 'Upload signature generated'));
  });

  static completeUpload = asyncHandler(async (req: Request, res: Response) => {
    const file = await FileService.completeUpload({
      userId: req.user.id,
      publicId: req.body.publicId,
      originalName: req.body.originalName,
      resourceType: req.body.resourceType,
      mimeType: req.body.mimeType,
      size: req.body.size,
    });
    res.status(201).json(ApiResponse.created(file, 'Upload completed'));
  });

  static listFiles = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const result = await FileService.listFiles(req.user.id, page, limit);
    res.status(200).json(ApiResponse.success(result, 'Files retrieved'));
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const file = await FileService.getOwnedFile(req.user.id, req.params.id);
    res.status(200).json(ApiResponse.success(file, 'File retrieved'));
  });

  static rename = asyncHandler(async (req: Request, res: Response) => {
    const file = await FileService.renameFile(req.user.id, req.params.id, req.body.name);
    res.status(200).json(ApiResponse.success(file, 'File renamed'));
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    await FileService.deleteFile(req.user.id, req.params.id);
    res.status(200).json(ApiResponse.success(null, 'File deleted'));
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const { file, url } = await FileService.getDownloadFile(req.user.id, req.params.id);
    await streamFileDownload(res, url, file.originalName, file.mimeType);
  });

  static preview = asyncHandler(async (req: Request, res: Response) => {
    const result = await FileService.getDownloadUrl(req.user.id, req.params.id);
    res.status(200).json(ApiResponse.success(result, 'Preview URL generated'));
  });

  static setVisibility = asyncHandler(async (req: Request, res: Response) => {
    const file = await FileService.setVisibility(req.user.id, req.params.id, req.body.visibility);
    res.status(200).json(ApiResponse.success(file, 'Visibility updated'));
  });

  static createShare = asyncHandler(async (req: Request, res: Response) => {
    const result = await FileService.createShare(req.user.id, req.params.id);
    res.status(200).json(ApiResponse.success(result, 'Share link created'));
  });

  static disableShare = asyncHandler(async (req: Request, res: Response) => {
    const file = await FileService.disableShare(req.user.id, req.params.id);
    res.status(200).json(ApiResponse.success(file, 'Sharing disabled'));
  });
}