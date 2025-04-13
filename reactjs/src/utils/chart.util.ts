import dayjs from "dayjs";
import { ChartTimeRangeEnum } from "../enum/chart.enum";
import { EnvironmentSchema } from "../types/environment";

export const generateXLabelsDay = () => {
    const hoursArray = [];

    for (let i = 0; i < 24; i++) {
        let hour = i % 12 || 12;
        if (hour === 12 && i < 12) {
            hour = 0;
        }
        const amPm = i < 12 ? "AM" : "PM";
        hoursArray.push(`${hour.toString().padStart(2, "0")}:00 ${amPm}`);
    }

    return hoursArray;
};

export const generateXLabelsWeek = (week: number, year: number) => {
    // Lấy ngày đầu tiên của năm
    const firstDayOfYear = dayjs(`${year}-01-01`);

    // Tính ngày bắt đầu của tuần thứ weekNumber
    const startOfWeek = firstDayOfYear.add((week - 1) * 7, "day");

    // Đảm bảo ngày bắt đầu là thứ Hai
    const monday = startOfWeek.startOf("week");

    // Tạo mảng các ngày trong tuần
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push(monday.add(i, "day").format("DD/MM"));
    }

    return days;
};

export const generateXLabelsMonth = (month: number, year: number) => {
    // Tạo ngày đầu tiên của tháng
    const firstDayOfMonth = dayjs(`${year}-${month}-01`);

    // Tìm ngày cuối cùng của tháng
    const lastDayOfMonth = firstDayOfMonth.endOf("month");

    // Tính số ngày trong tháng
    const daysInMonth = lastDayOfMonth.diff(firstDayOfMonth, "day") + 1;

    // Tạo mảng các ngày
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
        days.push(day.toString());
    }

    return days;
};

export const generateXLabelsYear = () =>
    Array.from({ length: 12 }, (_, k) => k + 1 + "");

export const convertEnvironmentSchemaListToDayAxesData = (
    environmentList: Array<EnvironmentSchema>
) => {
    const tempDataGroupByHour = Array(24).fill(0);
    const humidityDataGroupByHour = Array(24).fill(0);
    const tempCountGroupByHour = Array(24).fill(0);
    const humidityCountGroupByHour = Array(24).fill(0);

    environmentList.forEach((item) => {
        const hour = new Date(item.created_at).getHours();

        tempDataGroupByHour[hour] += item.temp;
        humidityDataGroupByHour[hour] += item.humidity;
        tempCountGroupByHour[hour]++;
        humidityCountGroupByHour[hour]++;
    });

    const tempDataAvgGroupByHour = tempDataGroupByHour.map(
        (x, i) => x / tempCountGroupByHour[i] || 0
    );
    const humidityDataAvgGroupByHour = humidityDataGroupByHour.map(
        (x, i) => x / humidityCountGroupByHour[i] || 0
    );

    return {
        tempData: tempDataAvgGroupByHour,
        humidityData: humidityDataAvgGroupByHour,
    };
};

export const convertEnvironmentSchemaListToWeekAxesData = (
    environmentList: Array<EnvironmentSchema>
) => {
    const tempDataGroupByDay: Array<number> = Array(7).fill(0);
    const humidityDataGroupByDay: Array<number> = Array(7).fill(0);
    const tempCountGroupByDay: Array<number> = Array(7).fill(0);
    const humidityCountGroupByDay: Array<number> = Array(7).fill(0);

    environmentList.forEach((item) => {
        const day = new Date(item.created_at).getDay();

        tempDataGroupByDay[day] += item.temp;
        humidityDataGroupByDay[day] += item.humidity;
        tempCountGroupByDay[day]++;
        humidityCountGroupByDay[day]++;
    });
    const tempDataAvgGroupByDay = tempDataGroupByDay.map(
        (x, i) => x / tempCountGroupByDay[i] || 0
    );
    const humidityDataAvgGroupByDay = humidityDataGroupByDay.map(
        (x, i) => x / humidityCountGroupByDay[i] || 0
    );

    return {
        tempData: tempDataAvgGroupByDay,
        humidityData: humidityDataAvgGroupByDay,
    };
};

export const convertEnvironmentSchemaListToMonthAxesData = (
    environmentList: Array<EnvironmentSchema>
) => {
    if (environmentList.length === 0)
        return {
            tempData: [],
            humidityData: [],
        };

    const dateCountOfMonth = dayjs(environmentList[0].created_at).daysInMonth();
    const tempDataGroupByDate: Array<number> = Array(dateCountOfMonth).fill(0);
    const humidityDataGroupByDate: Array<number> =
        Array(dateCountOfMonth).fill(0);
    const tempCountGroupByDate: Array<number> = Array(dateCountOfMonth).fill(0);
    const humidityCountGroupByDate: Array<number> =
        Array(dateCountOfMonth).fill(0);


    environmentList.forEach((item) => {
        const date = new Date(item.created_at).getDate();

        tempDataGroupByDate[date - 1] += item.temp;
        humidityDataGroupByDate[date - 1] += item.humidity;
        tempCountGroupByDate[date - 1]++;
        humidityCountGroupByDate[date - 1]++;
    });

    const tempDataAvgGroupByDate = tempDataGroupByDate.map(
        (x, i) => x / tempCountGroupByDate[i] || 0
    );
    const humidityDataAvgGroupByDate = humidityDataGroupByDate.map(
        (x, i) => x / humidityCountGroupByDate[i] || 0
    );

    return {
        tempData: tempDataAvgGroupByDate,
        humidityData: humidityDataAvgGroupByDate,
    };
};

export const convertEnvironmentSchemaListToYearAxesData = (
    environmentList: Array<EnvironmentSchema>
) => {
    const tempDataGroupByMonth: Array<number> = Array(12).fill(0);
    const humidityDataGroupByMonth: Array<number> = Array(12).fill(0);
    const tempCountGroupByMonth: Array<number> = Array(12).fill(0);
    const humidityCountGroupByMonth: Array<number> = Array(12).fill(0);

    environmentList.forEach((item) => {
        const month = new Date(item.created_at).getMonth();

        tempDataGroupByMonth[month] += item.temp;
        humidityDataGroupByMonth[month] += item.humidity;
        tempCountGroupByMonth[month]++;
        humidityCountGroupByMonth[month]++;
    });

    const tempDataAvgGroupByMonth = tempDataGroupByMonth.map(
        (x, i) => x / tempCountGroupByMonth[i] || 0
    );
    const humidityDataAvgGroupByMonth = humidityDataGroupByMonth.map(
        (x, i) => x / humidityCountGroupByMonth[i] || 0
    );

    return {
        tempData: tempDataAvgGroupByMonth,
        humidityData: humidityDataAvgGroupByMonth,
    };
};

export const generateParamsToGetInfo = (
    timeRange: ChartTimeRangeEnum,
    day: number,
    week: number,
    month: number,
    year: number
) => {
    switch (timeRange) {
        case ChartTimeRangeEnum.Day:
            return {
                day,
                month: month + 1,
                year,
            };

        case ChartTimeRangeEnum.Week:
            return { week, year };

        case ChartTimeRangeEnum.Month:
            return { month: month + 1, year };

        case ChartTimeRangeEnum.Year:
            return { year };
    }
};
