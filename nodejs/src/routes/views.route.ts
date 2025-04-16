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


export default viewsRouter;
