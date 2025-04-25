import { OkResponse } from "@/core/success.response.js";
import violationService from "@/services/violation.service.js";
import { RequestHandler } from "express";
import { ViolationStatus } from "@/enums/trafficViolation.enum.js";
import { BadRequestErrorResponse } from "@/core/error.core.js";

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

    updateViolationStatus: RequestHandler = async (req, res, next) => {
        const { violation_id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!Object.values(ViolationStatus).includes(status)) 
            throw new BadRequestErrorResponse("Invalid status");

        const updatedViolation = await violationService.updateViolationStatus(violation_id, status);

        new OkResponse({
            message: "Violation status updated successfully",
            metadata: updatedViolation,
        }).send(res);
    };
};
