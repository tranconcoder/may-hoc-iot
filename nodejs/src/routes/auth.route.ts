import { Router } from 'express';
import { catchError } from '../middlewares/handleError.middware';
import AuthController from '../controllers/auth.controller';

const authRouter = Router();

authRouter.post('/login', catchError(AuthController.handleLogin));

export default authRouter;
