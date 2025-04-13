import { Router } from 'express';
import SecurityGateController from '../controllers/securityGate.controller';
import { catchError } from '../middlewares/handleError.middware';

const securityGateRouter = Router();
const securityGateController = new SecurityGateController();

securityGateRouter.post(
	'/auth-door',
	catchError(securityGateController.authDoor)
);

export default securityGateRouter;
