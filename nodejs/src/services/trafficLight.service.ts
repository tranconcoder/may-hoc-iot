import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";
import trafficLightModel from "@/models/trafficLight.model.js";

export default new class TrafficLightService {
    async getTrafficLightByTime(time: number){
      // Sử dụng MongoDB Aggregation Pipeline để tìm bản ghi có thời gian gần nhất với time đã cho
      const trafficLights = await trafficLightModel
        .aggregate([
          {
            $addFields: {
              createdAtValue: { $toLong: "$created_at" },
            },
          },
          {
            $addFields: {
              timeDifference: {
                $subtract: [time, "$createdAtValue"]
              },
            },
          },
          {
            $match: {
              timeDifference: {
                $lte: 0
              }
            }
          },
          {
            $sort: { timeDifference: 1 },
          },
          {
            $limit: 1,
          },
        ])
        .exec();

      // Trả về null nếu không tìm thấy kết quả, ngược lại trả về bản ghi đầu tiên
      // console.log("trafficLights: ", trafficLights);
      const trafficLight = trafficLights.length > 0 ? trafficLights[0].traffic_status : null;

      return trafficLight as TrafficLightEnum;
    }
}