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

## 2026-10-31 — Separated operational statuses

- แยก Release, Dev BE, Dev FE และ QA เป็นสถานะที่ผู้รับผิดชอบยืนยันคนละค่า
- แยก Image / Build และ Timeline Health เป็นค่าที่ระบบคำนวณ ไม่ปะปนกับสถานะ Release
- แสดงสถานะทุกกลุ่มบน Release card และอธิบายแหล่งข้อมูลใน Release details
- Timeline Health ใช้วันจบ Dev FE จาก Sheet และไม่เปลี่ยน Done/Deployed อัตโนมัติ

## 2026-11-03 — Hybrid Release Management

- เพิ่มและแก้ไข Release จากหน้า Release board โดยเก็บใน Supabase
- เลือกสมาชิกจากงานใน Sheet และเพิ่มงานนอก Sheet พร้อมช่วง Dev FE/QA ได้
- Release จาก Sheet ใช้ override โดยไม่เขียนกลับ Google Sheets
- งาน custom ถูกนำไปแสดงร่วมใน Release card, details และ Timeline
- ใช้ Archive แทน hard delete
- Migration `20261103090000_create_managed_releases.sql` ถูก apply แล้ว
- ตามคำสั่งผู้ใช้ ไม่รัน Test หรือ Build ในรอบนี้

## 2026-11-03 — Multi-tag Release artifacts

- Release เลือก Tag `Web`, `App`, `BE` ได้มากกว่า 1 ค่า และเก็บ Tag ใน Supabase
- แยกเลขส่งมอบเป็น Web image, App version/build และ BE image ตาม Tag ที่เลือก
- แต่ละ Tag มีค่าล่าสุด ปุ่มคัดลอก Comment และ History แยกจากกัน
- การ์ด Release แสดง Tag และเลขส่งมอบล่าสุดของแต่ละ Tag
- Migration `20261103113000_add_release_tags.sql` ถูก apply และตรวจพบคอลัมน์ `tags` แล้ว
- Google Sheets ยังคงเป็น read-only และตามคำสั่งผู้ใช้ ไม่รัน Test หรือ Build

## 2026-11-03 — Unassigned features and deploy health

- เพิ่มหน้า Unassigned features สำหรับงานที่ไม่มีวัน Deploy/Release และยังไม่ถูกเลือกเข้า managed Release
- เพิ่ม/แก้ไข/Archive Feature นอก Sheet โดยเก็บใน Supabase พร้อมสถานะ Feature
- Feature ที่สร้างจากเว็บสามารถเลือกเข้า Release และจะหายจากหน้า Unassigned
- Release editor แสดงงานค้างจาก Unassigned เป็นตัวเลือกหลัก พร้อมสมาชิกเดิมของ Release ขณะแก้ไข
- งานที่อยู่ใน Release อื่นแสดงแบบ disabled และย้ายข้าม Release ได้หลัง confirmation
- Release card ใช้ countdown จากวัน Release; งานใน Release แสดง overdue แยกแต่ละ Feature จนเป็น Deployed
- Apply migrations `20261103140000_create_managed_features.sql` และ `20261103141000_add_managed_feature_status.sql` แล้ว
- Google Sheets ยังคงเป็น read-only และตามคำสั่งผู้ใช้ ไม่รัน Test หรือ Build

