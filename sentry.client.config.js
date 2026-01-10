import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://622dc549edf3d8786e6f155a2b5039ec@o94582.ingest.us.sentry.io/4510646873030656",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  enableLogs: true,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});