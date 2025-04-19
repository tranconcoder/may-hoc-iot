import viewController from "@/controllers/view.controller";
import { Router } from "express";

const viewsRouter = Router();

viewsRouter.get("/", viewController.homePage);

viewsRouter.get("/capture", viewController.capturePage);

viewsRouter.get("/preview", viewController.previewPage);

viewsRouter.get("/dashboard", viewController.dashboardPage);

viewsRouter.get("/cameras", viewController.cameraManagementPage);

viewsRouter.get("/cameras/add", (_, res) => {
  res.render("pages/add-camera", {
    layout: "traffic-dashboard",
    pageTitle: "Thêm Camera Mới",
  });
});

// Route xem chi tiết camera
viewsRouter.get("/cameras/:cameraId", viewController.viewCameraDetail);

export default viewsRouter;
