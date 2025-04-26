import { Request, Response } from "express";

export default new (class HomeController {
  async renderHomePage(req: Request, res: Response) {
    try {
      res.render("home", {
        title: "Traffic Monitoring System",
        layout: "main",
      });
    } catch (error: any) {
      console.error("Error rendering home page:", error);
      res.status(500).render("error", {
        title: "Error",
        layout: "main",
        error: error.message || "An unexpected error occurred",
      });
    }
  }
})();
