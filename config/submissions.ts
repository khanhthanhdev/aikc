import { env } from "~/env";

export const submissionsConfig = {
  postingRate: 3,
  sendPublishEmail: env.PUBLISH_SUBMITTER_EMAILS,
};
