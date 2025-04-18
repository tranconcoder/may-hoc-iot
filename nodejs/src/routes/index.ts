import { Application } from "express";
import viewsRouter from "./views.route";
import apiRouter from "./api.route";


export default function handleRoute(app: Application) {
    app.use("/api", apiRouter);
    app.use("/views", viewsRouter);
}
