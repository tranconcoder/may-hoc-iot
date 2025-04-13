import { Router } from "express";
import UserController from "../controllers/user.controller";
import { catchError } from "../middlewares/handleError.middware";
import { uploadNewFacesMiddleware } from "../middlewares/multer.middleware";

const userRouter = Router();

userRouter.post(
    "/add",
    uploadNewFacesMiddleware,
    catchError(UserController.addUser)
);

export default userRouter;
