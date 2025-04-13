import dayjs, { Dayjs } from "dayjs";
import { EnvironmentModel } from "../config/database/schema/environment.schema";
import { Date } from "../types/date";
import weekOfYear from "dayjs/plugin/weekOfYear";
import _ from "lodash"

dayjs.extend(weekOfYear);

export default class EnvironmentServices {
    public static async getInfo(date: Date) {
        let start: Dayjs, end: Dayjs;

        // Query by fullDate
        switch (true) {
            case Boolean(date.day && date.month):
                const fullDate = dayjs(
                    `${date.year}-${date.month}-${date.day}`
                );
                start = fullDate.startOf("day");
                end = fullDate.endOf("day");
                break;
            case !!date.week:
                const weekDate = dayjs()
                    .year(date.year)
                    .week(date.week as number);
                start = weekDate.startOf("week");
                end = weekDate.endOf("week");
                break;
            case !!date.month:
                // Query by month
                const monthDate = dayjs(`${date.year}-${date.month}-01`);
                start = monthDate.startOf("month");
                end = monthDate.endOf("month");
                break;
            default:
                // Query by year
                const yearDate = dayjs(`${date.year}-01-01`);
                start = yearDate.startOf("year");
                end = yearDate.endOf("year");
        }

        const environmentData = await EnvironmentModel.find({
            created_at: {
                $gte: start,
                $lte: end,
            },
        }).lean();

        return environmentData;
    }

    public static async getCurrentInfo() {
        const data = await EnvironmentModel.findOne(
            {},
            {},
            { sort: { created_at: -1 } }
        ).lean();

        return _.pick(data, ["temp", "humidity"]);
    }
}
