import { Router } from 'express';
import { ShareController } from '../controllers';

const router = Router();

router.get('/share/:shareToken/download', ShareController.downloadByToken);
router.get('/share/:shareToken', ShareController.getByToken);

export default router;