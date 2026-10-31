# Supabase build storage

Objective: replace local image/build persistence with Supabase project rxqffuavqnxlgmjoolzn. Google Sheets remains strictly read-only.

- [x] Inspect target project (healthy; public schema empty), existing source, Next.js docs and access model.
- [x] Create narrowly scoped fe_release_builds table, RLS and select/insert/update grants for intentional no-login shared editing. No delete permission.
- [x] Write failing storage tests, implement Supabase REST adapter behind Next.js API with no silent file fallback.
- [x] Configure ignored local environment using publishable key. Update UI data-load/save feedback and setup documentation.
- [x] Test real persistence through API, verify database readback, clean only verification rows, run advisors, tests, typecheck and production build.

Decisions: use native fetch, no SDK dependency required. Publishable key is scoped by RLS; visitor editing remains anonymous as authorized. No secret/admin key is obtained or exposed. Existing local file will be imported if present (currently no file). No deployment or GitHub push until existing permission blockers resolved.

Verification: 25 tests passed (including localhost host-normalization regression), TypeScript passed. Real Next.js GET and POST both 200, persisted readback matches; Supabase security advisors returned no lints. No old .release-data file found. Production build and browser UI pending.

Final verification: all 25 tests passed; TypeScript and production build passed. Supabase DB confirmed test image persisted with RLS enabled; anon has no DELETE privilege. Verification row removed (count 0). Browser verified enabled editor after DB load and Supabase/no-Sheets-write copy. Code review found stale editor polling risk; fixed with pristine value derivation and conflict guard for dirty draft. Source trace warning scoped with Turbopack ignore comment; snapshot stays local. No GitHub push or hosting deployment attempted in this task.

Remaining limitation: anonymous editing intentional; feature/release keys retain the previous row/group identity behavior (documented). Supabase currently stores image/build only, not release statuses or audit history.

## Fix: saved image missing from release cards
Root cause: detail drawer overlaid Supabase values, but cards/ready metrics still consumed raw Sheet releases.
Implemented shared immutable mergeSavedBuilds projection: explicit release image overrides feature aggregate; feature builds propagate into release cards; explicit empty values clear old values; selected details resolve fresh projection.
Regression tests added for release/feature saves, precedence, clearing and source preservation. Verification pending. No database or Sheet writes needed for this fix.
## 2026-10-31 — Image / Build history

- เพิ่ม contrast ของข้อความหลักและข้อความประกอบให้ชัดขึ้น
- การบันทึก Image / App build รองรับ comment และเก็บประวัติแบบ append-only ใน Supabase
- การ์ด Release แสดงเลขล่าสุดและมีปุ่ม copy โดยไม่ต้องเปิดรายละเอียด
- หน้ารายละเอียดแสดงเลขล่าสุดและประวัติย้อนหลังพร้อม comment/เวลา
- Google Sheets ยังคงเป็น read-only และไม่ได้รับการแก้ไขจากเว็บ

## 2026-10-31 — Release status editor

- เลือกและบันทึกสถานะ Release ได้จาก Release details
- สถานะล่าสุดเก็บใน Supabase แยกจาก Google Sheets
- การ์ด Release, readiness และตัวเลขพร้อมส่งต่อ SA ใช้สถานะล่าสุดจาก Supabase

