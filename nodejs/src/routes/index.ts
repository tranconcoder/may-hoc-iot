import { Application } from "express";
import viewsRouter from "@/routes/views.route.js";
import apiRouter from "@/routes/api.route.js";


export default function handleRoute(app: Application) {
    app.use("/api", apiRouter);
    app.use("/views", viewsRouter);
}
