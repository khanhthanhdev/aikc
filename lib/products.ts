import { addDays, differenceInMonths } from "date-fns";
import plur from "plur";
import { config } from "~/config/index.server";

export const getQueueMetrics = (queueLength: number) => {
  const postingRate = Math.max(1, config.submissions.postingRate);
  const safeQueueLength = Math.max(0, queueLength);

  const weeks =
    safeQueueLength === 0 ? 0 : Math.ceil(safeQueueLength / postingRate);
  const days = weeks * 7;
  const months =
    days > 0 ? differenceInMonths(addDays(new Date(), days), new Date()) : 0;

  const eta =
    safeQueueLength === 0
      ? "less than a week"
      : months > 0
        ? `${months}+ ${plur("month", months)}`
        : `${Math.max(1, weeks)} ${plur("week", Math.max(1, weeks))}`;

  return {
    queueLength: safeQueueLength,
    postingRate,
    weeks,
    days,
    months,
    eta,
  };
};
