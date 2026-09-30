/**
 * Day boundaries for the admin panel.
 *
 * The admins work in Vietnam but the server runs in UTC, so date-fns'
 * `startOfDay` would start "today" at 07:00 local time. These helpers take the
 * day in Vietnam time instead. Vietnam has no daylight saving time, so the
 * fixed offset is exact all year.
 */
const ADMIN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const ADMIN_UTC_OFFSET = "+07:00";

/** `yyyy-MM-dd` of an instant, as the day is called in admin time. */
const toAdminDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TIME_ZONE }).format(date);

type Day = string | Date;

const dayString = (day: Day) => (typeof day === "string" ? day : toAdminDay(day));

/**
 * First instant of a day in admin time.
 * @param day A `yyyy-MM-dd` string (as the date range picker sends it) or an
 * instant whose admin-time day is meant. Defaults to today.
 */
export const startOfAdminDay = (day: Day = new Date()) =>
  new Date(`${dayString(day)}T00:00:00.000${ADMIN_UTC_OFFSET}`);

/** Last instant of a day in admin time. Same input as `startOfAdminDay`. */
export const endOfAdminDay = (day: Day = new Date()) =>
  new Date(`${dayString(day)}T23:59:59.999${ADMIN_UTC_OFFSET}`);
