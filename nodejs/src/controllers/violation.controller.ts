import { OkResponse } from "@/core/success.response.js";
import violationModel from "@/models/violation.model.js";
import violationService from "@/services/violation.service.js";
import { RequestHandler } from "express";

export default new class ViolationController {
  getAllViolations: RequestHandler = async (req, res, next) => {
    new OkResponse({
      message: "Get all violations successfully",
      metadata: await violationService.getAllViolations(),
    }).send(res);
  };

  getImageBuffer: RequestHandler = async (req, res, next) => {
    const buffer = await violationService.getImageBuffer(req.params.violation_id);

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);
  };
};
