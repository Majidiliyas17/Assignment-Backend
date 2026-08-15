import { Router } from 'express';
import authRoutes from './AuthRoutes';
import fileRoutes from './FileRoutes';
import healthRoutes from './HealthRoutes';
import shareRoutes from './ShareRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/files', fileRoutes);
router.use(shareRoutes);
router.use(healthRoutes);

export default router;