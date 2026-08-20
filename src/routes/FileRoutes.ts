import { Router } from 'express';
import { FileController } from '../controllers';
import { AuthMiddleware } from '../middleware';
import { validate } from '../middleware';
import { visibilitySchema } from '../dto/share';
import { completeUploadSchema, listFilesSchema, renameFileSchema, uploadSignatureSchema } from '../dto/file';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/upload-signature', validate(uploadSignatureSchema), FileController.uploadSignature);
router.post('/complete', validate(completeUploadSchema), FileController.completeUpload);
router.get('/', validate(listFilesSchema, 'query'), FileController.listFiles);
router.get('/usage', FileController.getStorageUsage);
router.patch('/:id/visibility', validate(visibilitySchema), FileController.setVisibility);
router.post('/:id/share', FileController.createShare);
router.delete('/:id/share', FileController.disableShare);
router.get('/:id/download', FileController.download);
router.get('/:id/preview', FileController.preview);
router.get('/:id', FileController.getById);
router.patch('/:id', validate(renameFileSchema), FileController.rename);
router.delete('/:id', FileController.remove);

export default router;