import { Application } from "express";
import apiRouter from "./api.route";
import viewsRouter from "./views.route";

export default function handleRoute(app: Application) {
    app.use("/api", apiRouter);
    app.use("/views", viewsRouter);
}
