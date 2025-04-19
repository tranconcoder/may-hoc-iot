import type { Application } from "express";

import path from "path";
import { create, ExpressHandlebars } from "express-handlebars";
import exHbsHelpers from "../utils/handlebars.util.js";

export default class SetupHandlebars {
    private app: Application;
    private exHandlebars: ExpressHandlebars;

    constructor(app: Application) {
        this.app = app;
        this.exHandlebars = create({
            extname: ".hbs",
            helpers: exHbsHelpers,
        });
    }

    public setup() {
        this.app.engine(".hbs", this.exHandlebars.engine);
        this.app.set("view engine", ".hbs");
        this.app.set("views", path.join(import.meta.dirname, "../views"));
    }
}
