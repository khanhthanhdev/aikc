export interface DefaultAd {
  buttonLabel?: string;
  description: string;
  faviconUrl?: string | null;
  name: string;
  type: string;
  websiteUrl: string;
}

export const adsConfig: {
  defaultAd: DefaultAd;
} = {
  defaultAd: {
    name: "Advertise with AI Knowledge Cloud",
    description:
      "Promote your tool to thousands of developers and students looking for the best tools.",
    websiteUrl: "/advertise",
    buttonLabel: "Learn More",
    type: "All",
  },
};
