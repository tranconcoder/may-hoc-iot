import viewController from "@/controllers/view.controller";
import { Router } from "express";

const viewsRouter = Router();

viewsRouter.get("/", viewController.homePage);

viewsRouter.get("/capture", viewController.capturePage);

viewsRouter.get("/preview", viewController.previewPage);

viewsRouter.get("/cameras", viewController.cameraManagementPage);

viewsRouter.get("/cameras/add", viewController.createCameraPage);

viewsRouter.get("/cameras/:cameraId", viewController.viewCameraDetail);

export default viewsRouter;
