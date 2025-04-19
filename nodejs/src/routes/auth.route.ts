import { Router } from 'express';
import { catchError } from '@/middlewares/handleError.middware.js';
import AuthController from '@/controllers/auth.controller.js';

const authRouter = Router();

authRouter.post('/login', catchError(AuthController.handleLogin));

export default authRouter;
