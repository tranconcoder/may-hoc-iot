import { Router } from "express";
import licensePlateController from "@/controllers/licensePlate.controller.js";
import { catchError } from "@/middlewares/handleError.middware.js";

const licensePlateRouter = Router();

// API routes
licensePlateRouter.get(
  "/search",
  catchError(licensePlateController.searchLicensePlates)
);
licensePlateRouter.get(
  "/details/:id",
  catchError(licensePlateController.getLicensePlateDetails)
);
licensePlateRouter.get(
  "/image/:id",
  catchError(licensePlateController.getLicensePlateImage)
);
licensePlateRouter.get(
  "/cameras",
  catchError(licensePlateController.getAllCameras)
);

export default licensePlateRouter;
