# FE Release Timeline

Approved conversational scope: Next.js, no login, read the existing Google Sheet; team edits Sheet only. Current App/Web timeline first, released work in history. Release groups list features, image/build and explicit status. Release N+1 can begin merge only when previous release in the same stream is explicitly Done or Deployed.

Approaches considered: timeline only; timeline plus release tracking (selected); changing CI/merge workflows (excluded by user).

UI: calm light operations dashboard, blue accents, Thai explanations and familiar English stage labels. Read-only overview, timeline/release views, history, search/platform/date filters, accessible feature details and source links.

Source: 2026 and 2025 Gantt tabs in the supplied workbook. Planned dates come from calendar columns and explicit row labels. Missing release status remains unknown, and missing image remains blank. Multiple projects sharing an explicit version and release date may be displayed together without asserting unrecorded merge completion. App and Web releases remain distinct where source evidence permits.

Live reads use server-side public XLSX export, or the Google Sheets API with a server-only read-only service account. A timestamped real-source snapshot is an explicitly labeled fallback, never presented as live. No secrets in source or browser. No writes or public-sharing changes to Google Drive.

Success: show actual Sheet features and dates, open source rows, filter App/Web, inspect a release and its features, keep Done separate from Deployed, do not treat elapsed dates as completion, preserve data on refresh errors.
