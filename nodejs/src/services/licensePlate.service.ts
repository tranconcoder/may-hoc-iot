import licensePlateDetectedModel from "@/models/licensePlateDetected.model.js";
import cameraModel from "@/models/camera.model.js";
import {
  InternalServerErrorResponse,
  NotFoundErrorResponse,
} from "@/core/error.core.js";
import mongoose from "mongoose";

export default new (class LicensePlateService {
  /**
   * Search license plates by plate number
   * @param licensePlate License plate number (partial or complete)
   * @param startDate Optional start date for search range
   * @param endDate Optional end date for search range
   * @param cameraId Optional specific camera to search
   * @param page Page number for pagination
   * @param limit Items per page
   */
  async searchLicensePlates(
    licensePlate: string,
    startDate?: Date,
    endDate?: Date,
    cameraId?: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      // Basic query with plate number search
      const query: any = {
        license_plate: { $regex: new RegExp(licensePlate, "i") },
      };

      // Add date range if provided
      if (startDate || endDate) {
        query.detected_at = {};
        if (startDate) {
          query.detected_at.$gte = startDate;
        }
        if (endDate) {
          query.detected_at.$lte = endDate;
        }
      }

      // Add camera filter if provided
      if (cameraId) {
        query.camera_id = new mongoose.Types.ObjectId(cameraId);
      }

      // Count total results for pagination
      const totalResults = await licensePlateDetectedModel.countDocuments(
        query
      );

      // Calculate pagination values
      const skip = (page - 1) * limit;
      const totalPages = Math.ceil(totalResults / limit);

      // Execute query with pagination
      const results = await licensePlateDetectedModel
        .find(query)
        .sort({ detected_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "camera_id",
          select: "camera_name camera_location",
        })
        .lean();

      return {
        results,
        pagination: {
          total: totalResults,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error: any) {
      console.error("Error searching license plates:", error);
      throw new InternalServerErrorResponse("Failed to search license plates");
    }
  }

  /**
   * Get details of a specific license plate detection
   * @param id License plate detection ID
   */
  async getLicensePlateDetails(id: string) {
    try {
      const licensePlate = await licensePlateDetectedModel
        .findById(id)
        .populate({
          path: "camera_id",
          select: "camera_name camera_location",
        })
        .lean();

      if (!licensePlate) {
        throw new NotFoundErrorResponse("License plate detection not found");
      }

      return licensePlate;
    } catch (error: any) {
      if (error instanceof NotFoundErrorResponse) {
        throw error;
      }
      console.error("Error getting license plate details:", error);
      throw new InternalServerErrorResponse(
        "Failed to get license plate details"
      );
    }
  }

  /**
   * Get license plate image
   * @param id License plate detection ID
   */
  async getLicensePlateImage(id: string) {
    try {
      const licensePlate = await licensePlateDetectedModel.findById(id);

      if (!licensePlate) {
        throw new NotFoundErrorResponse("License plate detection not found");
      }

      // Check both possible field names for image buffer
      const imageBuffer =
        licensePlate.image_buffer || (licensePlate as any).imageBuffer;

      if (!imageBuffer) {
        console.error(`No image buffer found for license plate ID: ${id}`);
        throw new NotFoundErrorResponse("License plate image not found");
      }

      return imageBuffer;
    } catch (error: any) {
      if (error instanceof NotFoundErrorResponse) {
        throw error;
      }
      console.error("Error getting license plate image:", error);
      throw new InternalServerErrorResponse(
        "Failed to get license plate image"
      );
    }
  }

  /**
   * Get all cameras for dropdown selection
   */
  async getAllCameras() {
    try {
      return await cameraModel
        .find({}, { _id: 1, camera_name: 1, camera_location: 1 })
        .lean();
    } catch (error: any) {
      console.error("Error getting cameras:", error);
      throw new InternalServerErrorResponse("Failed to get cameras");
    }
  }
})();
