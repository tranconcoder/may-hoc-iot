// Express
import { Router } from 'express';

// Middleware
import {
	uploadNewFacesMiddleware,
	uploadRecognitionFaceMiddleware,
} from '../middlewares/multer.middleware';

// Controller
import EmployeeController from '../controllers/employee.controller';

const employeeRouter = Router();
const employeeController = new EmployeeController();

/* employeeRouter.post(
    "/upload-face",
    uploadFaceMiddleware,
    employeeController.uploadFace
);
employeeRouter.post(
    "/recognition-face",
    uploadRecognitionFaceMiddleware,
    employeeController.uploadRecognitionFace
); */

export default employeeRouter;
