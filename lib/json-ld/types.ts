import type {
  BreadcrumbList,
  FAQPage,
  Organization,
  SoftwareApplication,
  WebApplication,
  WebSite,
  WithContext,
} from "schema-dts";

export type SoftwareApplicationSchema = WithContext<
  SoftwareApplication | WebApplication
>;
export type BreadcrumbSchema = WithContext<BreadcrumbList>;
export type OrganizationSchema = WithContext<Organization>;
export type WebSiteSchema = WithContext<WebSite>;
export type FAQPageSchema = WithContext<FAQPage>;
