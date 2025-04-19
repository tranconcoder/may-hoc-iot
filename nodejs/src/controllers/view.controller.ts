import { RequestHandler } from "express"

export default new (class ViewController {
  /* ----------------------------- Home Page ----------------------------- */
  homePage: RequestHandler = (req, res, next) => {
    res.render("pages/home-page", {
      layout: "traffic-dashboard",
      isHome: true,
    });
  };

  /* ----------------------------- Capture Page ----------------------------- */
  capturePage: RequestHandler = (req, res, next) => {
    res.render("pages/capture");
  };

  /* ----------------------------- Preview Page ----------------------------- */
  previewPage: RequestHandler = (req, res, next) => {
    res.render("pages/preview");
  };

  /* ----------------------------- Create Camera Page ----------------------------- */
  createCameraPage: RequestHandler = (req, res, next) => {
    res.render("pages/add-camera", {
      layout: "traffic-dashboard",
      pageTitle: "Thêm Camera Mới",
    });
  };

  /* ----------------------------- Camera Management Page ----------------------------- */
  cameraManagementPage: RequestHandler = (req, res, next) => {
    const cameras: any[] = [];

    res.render("pages/camera-management", {
      layout: "traffic-dashboard",
      pageTitle: "Quản lý Camera",
      cameras,
    });
  };

  /* ----------------------------- View Camera Detail Page ----------------------------- */ 
  viewCameraDetail: RequestHandler = (req, res, next) => {
    const { cameraId } = req.params;

    const camera = {
      id: cameraId,
      name: `Camera #${cameraId}`,
      location: "Vị trí mặc định",
      ipAddress: "192.168.1.100",
      streamUrl: "http://example.com/stream",
      status: "active",
      statusText: "Đang hoạt động",
    };

    res.render("pages/camera-view", {
      layout: "traffic-dashboard",
      pageTitle: `Camera ${cameraId}`,
      camera,
    });
  };
})();