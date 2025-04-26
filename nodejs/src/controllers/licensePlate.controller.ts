import { RequestHandler } from "express";
import { OkResponse } from "@/core/success.response.js";
import licensePlateService from "@/services/licensePlate.service.js";
import { BadRequestErrorResponse } from "@/core/error.core.js";

export default new (class LicensePlateController {
  /* -------------------------------------------------------------------------- */
  /*                         Search for license plates                          */
  /* -------------------------------------------------------------------------- */
  searchLicensePlates: RequestHandler = async (req, res, next) => {
    const { licensePlate, startDate, endDate, cameraId, page, limit } =
      req.query;

    // Validate required parameters
    if (!licensePlate) {
      throw new BadRequestErrorResponse("License plate number is required");
    }

    // Parse parameters
    const parsedPage = page ? parseInt(page as string) : 1;
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedStartDate = startDate
      ? new Date(startDate as string)
      : undefined;
    const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

    // Execute search
    const results = await licensePlateService.searchLicensePlates(
      licensePlate as string,
      parsedStartDate,
      parsedEndDate,
      cameraId as string,
      parsedPage,
      parsedLimit
    );

    new OkResponse({
      message: "License plates retrieved successfully",
      metadata: results,
    }).send(res);
  };

  /* -------------------------------------------------------------------------- */
  /*                      Get license plate detection details                   */
  /* -------------------------------------------------------------------------- */
  getLicensePlateDetails: RequestHandler = async (req, res, next) => {
    const { id } = req.params;

    const details = await licensePlateService.getLicensePlateDetails(id);

    new OkResponse({
      message: "License plate details retrieved successfully",
      metadata: details,
    }).send(res);
  };

  /* -------------------------------------------------------------------------- */
  /*                       Get license plate detection image                    */
  /* -------------------------------------------------------------------------- */
  getLicensePlateImage: RequestHandler = async (req, res, next) => {
    const { id } = req.params;

    const imageBuffer = await licensePlateService.getLicensePlateImage(id);

    res.setHeader("Content-Type", "image/jpeg");
    res.send(imageBuffer);
  };

  /* -------------------------------------------------------------------------- */
  /*                             Get all cameras                                */
  /* -------------------------------------------------------------------------- */
  getAllCameras: RequestHandler = async (req, res, next) => {
    const cameras = await licensePlateService.getAllCameras();

    new OkResponse({
      message: "Cameras retrieved successfully",
      metadata: cameras,
    }).send(res);
  };

  /* -------------------------------------------------------------------------- */
  /*                         Render license plate search page                   */
  /* -------------------------------------------------------------------------- */
  renderSearchPage: RequestHandler = async (req, res, next) => {
    const cameras = await licensePlateService.getAllCameras();

    res.render("pages/license-plate-search", {
      layout: "traffic-dashboard",
      pageTitle: "Tìm kiếm biển số xe",
      cameras: cameras,
    });
  };
})();
