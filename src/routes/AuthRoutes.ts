import { Router } from 'express';
import { AuthController } from '../controllers';
import { AuthMiddleware } from '../middleware';
import { validate } from '../middleware';
import { loginSchema, registerSchema } from '../dto/auth';

const router = Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.get('/me', AuthMiddleware.authenticate, AuthController.me);

export default router;