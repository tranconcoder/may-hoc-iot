import viewController from '@/controllers/view.controlelr';
import { Router } from 'express';

const viewsRouter = Router();

viewsRouter.get("/", viewController.homePage);

viewsRouter.get("/capture", viewController.capturePage);

viewsRouter.get("/preview", viewController.previewPage);

viewsRouter.get("/dashboard", viewController.dashboardPage);

viewsRouter.get("/dashboard/cameras", viewController.cameraManagementPage);

viewsRouter.get("/dashboard/cameras/add", (_, res) => {
  res.render("pages/add-camera", { 
    layout: "traffic-dashboard", 
    pageTitle: "Thêm Camera Mới"
  });
});

// Route xem chi tiết camera
viewsRouter.get("/dashboard/cameras/:cameraId", (req, res) => {
  const { cameraId } = req.params;
  // Ở đây sau này sẽ lấy thông tin camera theo ID từ database
  // Hiện tại sẽ giả lập một camera để hiển thị
  const camera = {
    id: cameraId,
    name: `Camera #${cameraId}`,
    location: "Vị trí mặc định",
    ipAddress: "192.168.1.100",
    streamUrl: "http://example.com/stream",
    status: "active",
    statusText: "Đang hoạt động"
  };
  
  res.render("pages/camera-view", { 
    layout: "traffic-dashboard", 
    pageTitle: `Camera ${cameraId}`,
    camera 
  });
});

export default viewsRouter;
