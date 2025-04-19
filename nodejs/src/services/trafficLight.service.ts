import trafficLightModel from "@/models/trafficLight.model.js";

export default new class TrafficLightService {
    async getTrafficLightByTime(time: number) {
        const trafficLight = await trafficLightModel.findOne({}, {}, {
            sort: {
                $expr: {
                    $abs: {
                        $subtract: ["$created_at", time]
                    }
                }
            },
        });

        return trafficLight;
    }
}