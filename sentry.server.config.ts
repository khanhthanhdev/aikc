// biome-ignore lint/performance/noNamespaceImport: Sentry SDK uses namespace imports per official docs
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  enableLogs: true,

  integrations: [
    Sentry.vercelAIIntegration({ recordInputs: true, recordOutputs: true }),
  ],
});
