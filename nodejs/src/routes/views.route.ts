import { Router } from 'express';

const viewsRouter = Router();

viewsRouter.get("/", (_, res) => {
  res.render("pages/home-page", { layout: "traffic-dashboard" });
});

viewsRouter.get("/capture", (_, res) => {
  res.render("pages/capture");
});

viewsRouter.get("/preview", (_, res) => {
  res.render("pages/preview");
});

// Thêm routes cho dashboard
viewsRouter.get("/dashboard", (_, res) => {
  res.render("pages/home-page", { layout: "dashboard-layout", isHome: true });
});

// Route quản lý camera
viewsRouter.get("/dashboard/cameras", (_, res) => {
  // Mặc định chưa có dữ liệu camera
  const cameras = [];
  res.render("pages/camera-management", { 
    layout: "traffic-dashboard", 
    pageTitle: "Quản lý Camera",
    cameras 
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
