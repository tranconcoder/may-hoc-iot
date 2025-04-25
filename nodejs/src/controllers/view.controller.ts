import { RequestHandler } from "express";

export default new (class ViewController {
  /* ----------------------------- Home Page ----------------------------- */
  homePage: RequestHandler = (req, res, next) => {
    res.render("pages/home-page", {
      layout: "traffic-dashboard",
      isHome: true,
    });
  };

  /* ----------------------------- Violation Review Page ----------------------------- */
  violationReviewPage: RequestHandler = (req, res, next) => {
    res.render("pages/violation-review", {
      layout: "traffic-dashboard",
      pageTitle: "Duyệt Vi Phạm Giao Thông",
    });
  };

  /* ----------------------------- Capture Page ----------------------------- */
  capturePage: RequestHandler = (req, res, next) => {
    res.render("pages/capture");
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
    // Mô phỏng dữ liệu camera từ database
    const cameras: any[] = [
      {
        id: "1",
        name: "Camera Quảng trường",
        location: "Quảng trường trung tâm",
        ipAddress: "192.168.1.101",
        previewUrl: "/img/camera-preview-1.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "1080p",
      },
      {
        id: "2",
        name: "Camera Ngã tư Lê Lợi",
        location: "Ngã tư Lê Lợi - Nguyễn Huệ",
        ipAddress: "192.168.1.102",
        previewUrl: "/img/camera-preview-2.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "1080p",
      },
      {
        id: "3",
        name: "Camera Công viên",
        location: "Công viên trung tâm",
        ipAddress: "192.168.1.103",
        previewUrl: "/img/camera-preview-3.jpg",
        status: "inactive",
        statusText: "Không hoạt động",
        resolution: "720p",
      },
      {
        id: "4",
        name: "Camera Cổng chính",
        location: "Cổng chính tòa nhà A",
        ipAddress: "192.168.1.104",
        previewUrl: "/img/camera-preview-4.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "1440p",
      },
      {
        id: "5",
        name: "Camera Bãi đỗ xe P1",
        location: "Bãi đỗ xe khu vực 1",
        ipAddress: "192.168.1.105",
        previewUrl: "/img/camera-preview-5.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "1080p",
      },
      {
        id: "6",
        name: "Camera Khu vực hành lang",
        location: "Hành lang tầng 2",
        ipAddress: "192.168.1.106",
        previewUrl: "/img/camera-preview-6.jpg",
        status: "maintenance",
        statusText: "Đang bảo trì",
        resolution: "1080p",
      },
      {
        id: "7",
        name: "Camera Cầu thang",
        location: "Cầu thang chính tòa nhà B",
        ipAddress: "192.168.1.107",
        previewUrl: "/img/camera-preview-7.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "4K",
      },
      {
        id: "8",
        name: "Camera Cổng phụ",
        location: "Cổng phụ tòa nhà C",
        ipAddress: "192.168.1.108",
        previewUrl: "/img/camera-preview-8.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "1080p",
      },
      {
        id: "9",
        name: "Camera Khu vực ăn uống",
        location: "Căn tin tầng 1",
        ipAddress: "192.168.1.109",
        previewUrl: "/img/camera-preview-9.jpg",
        status: "active",
        statusText: "Hoạt động",
        resolution: "720p",
      },
    ];

    // Phân chia camera thành các tab, mỗi tab chứa 4 camera
    const camerasPerTab = 4;
    const cameraTabs: any[][] = [];

    for (let i = 0; i < cameras.length; i += camerasPerTab) {
      cameraTabs.push(cameras.slice(i, i + camerasPerTab));
    }

    res.render("pages/camera-management", {
      layout: "traffic-dashboard",
      pageTitle: "Quản lý Camera",
      cameras, // Giữ lại biến này để tương thích với logic hiện tại
      cameraTabs, // Thêm biến này để hiển thị camera theo tab
      helpers: {
        add: (a: number, b: number) => a + b, // Helper để hiển thị số trang
      },
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

  /* ----------------------------- Camera Preview Page ----------------------------- */
  cameraPreviewPage: RequestHandler = (req, res, next) => {
    res.render("pages/camera-preview", {
      layout: "traffic-dashboard",
      pageTitle: "Xem trực tiếp từ Camera AI",
      styles: ["/css/camera-preview.css"],
    });
  };
})();
