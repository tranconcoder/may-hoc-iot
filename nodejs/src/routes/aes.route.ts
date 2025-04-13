import { Router } from 'express';
import AESController from '../controllers/aes.controller';

const aesRouter = Router();

aesRouter.put('/check-api-key', AESController.checkApiKey);
aesRouter.post('/init', AESController.init);

export default aesRouter;
