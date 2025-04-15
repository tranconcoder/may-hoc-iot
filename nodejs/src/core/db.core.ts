import mongoose from "mongoose";

export default class DBCore {
    private static instance: DBCore;
    private constructor() {
        this.connect();
    }

    public static getInstance(): DBCore {
        if (!DBCore.instance) {
            DBCore.instance = new DBCore();
        }
        return DBCore.instance;
    }

    public connect(): void {
        mongoose.connect("mongodb://localhost:27017/traffic-detection").then(() => {
            console.log("Connected to MongoDB");
        }).catch((err) => {
            console.log("Error connecting to MongoDB", err);
        });
    }
}
