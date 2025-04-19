import { Router } from "express";
import UserController from "@/controllers/user.controller.js";
import { catchError } from "@/middlewares/handleError.middware.js";
import { uploadNewFacesMiddleware } from "@/middlewares/multer.middleware.js";

const userRouter = Router();

userRouter.post(
    "/add",
    uploadNewFacesMiddleware,
    catchError(UserController.addUser)
);

export default userRouter;
