// Intentionally empty.
// Replaces Next.js' built-in `polyfill-module` (Array.from, Array.prototype.at,
// Array.prototype.flat/flatMap, Object.fromEntries, Object.hasOwn,
// String.prototype.trimStart/trimEnd, Symbol.prototype.description,
// Promise.prototype.finally) which are all natively supported by every browser
// listed in the project's `browserslist` config (Chrome 105+, Firefox 104+,
// Safari 15.4+, Edge 105+). Keeping the polyfill ships ~14 KiB of dead JS,
// which Lighthouse flags under the "Avoid serving legacy JavaScript" audit.
