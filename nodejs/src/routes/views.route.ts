import viewController from "@/controllers/view.controller.js";
import { Router } from "express";

const viewsRouter = Router();

viewsRouter.get("/", viewController.homePage);

viewsRouter.get("/capture", viewController.capturePage);

viewsRouter.get("/preview", viewController.cameraPreviewPage);

viewsRouter.get("/cameras", viewController.cameraManagementPage);

viewsRouter.get("/cameras/add", viewController.createCameraPage);

viewsRouter.get("/cameras/:cameraId", viewController.viewCameraDetail);

viewsRouter.get("/demo", (req, res) => {
  res.render("pages/demo");
});

export default viewsRouter;
