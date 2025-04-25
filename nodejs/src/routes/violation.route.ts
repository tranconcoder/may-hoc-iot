import { Router } from "express";
import violationController from "@/controllers/violation.controller.js";
import { catchError } from "@/middlewares/handleError.middware.js";

const router = Router();

router.get("/all", catchError(violationController.getAllViolations));

router.get("/image/:violation_id", catchError(violationController.getImageBuffer));

export default router;