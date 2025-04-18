import cameraController from "@/controllers/camera.controller";
import { catchError } from "@/middlewares/handleError.middware";
import { Router } from "express";

const router = Router();

router.post("/create", catchError(cameraController.create))


export default router;