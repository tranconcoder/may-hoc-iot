import { RequestHandler } from "express"

export default new class ViewController {
    homePage: RequestHandler = (req, res, next) => {
        res.render("pages/home-page", { layout: "traffic-dashboard" });
    }

    capturePage: RequestHandler = (req, res, next) => {
        res.render("pages/capture");
    }

    previewPage: RequestHandler = (req, res, next) => {
        res.render("pages/preview");
    }

    dashboardPage: RequestHandler = (req, res, next) => {
        res.render("pages/home-page", { layout: "dashboard-layout", isHome: true });
    }


    cameraManagementPage: RequestHandler = (req, res, next) => {
        const cameras: any[] = [];

        res.render("pages/camera-management", { 
            layout: "traffic-dashboard", 
            pageTitle: "Quản lý Camera",
            cameras 
        });
    }
        

}