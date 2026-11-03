# Unassigned Features and Release Countdown Design

## Intent

ให้ทีมเห็นเวลาที่เหลือก่อน Deploy/Release จากวันปล่อยจริง และเห็นงานตกหล่นที่ยังไม่มีรอบ Release แยกจาก Release board อย่างชัดเจน โดย Google Sheets ยังคงเป็น read-only และข้อมูลที่สร้างจากเว็บเก็บใน Supabase

## Goals

- Release card แสดง countdown จากวัน Deploy/Release: เหลืออีกกี่วัน, Release วันนี้, ผ่านวัน Release กี่วัน, Deployed แล้ว หรือยังไม่ระบุวัน
- ตรวจงานเกินกำหนดระดับ Feature ไม่สรุปว่า Release ทั้งรอบ Overdue จากวันจบ Dev FE
- Feature ที่วัน Deploy ผ่านแล้วและสถานะยังไม่เป็น `Deployed` แสดง `เกินกำหนด X วัน`; สถานะ `Done` ยังถือว่าค้างจนกว่าจะยืนยัน `Deployed`
- เพิ่มหน้า `Unassigned features` ในเมนูหลัก
- หน้าใหม่รวมงานจาก Sheet ที่ไม่มีวัน Deploy/Release และไม่ได้ถูกเลือกเข้า Release กับงานที่สร้างจากเว็บซึ่งยังไม่ได้เข้า Release
- เพิ่ม Feature นอก Sheet ได้จากหน้าใหม่ และเลือก Feature นั้นเข้า Release ภายหลังได้

## Assignment Rules

Feature ถือว่าอยู่ใน Release เมื่อเป็นจริงอย่างน้อยหนึ่งข้อ:

1. มีวัน Deploy/Release ที่อ่านจาก Google Sheet (`production` หรือ `release` stage ที่ไม่ใช่ tentative)
2. เป็นสมาชิกของ Release ที่ active ซึ่งสร้างหรือ override ผ่าน Release room

Feature ที่ไม่เข้าเงื่อนไขทั้งสองข้อจะแสดงใน `Unassigned features` งานที่ถูกเลือกเข้า Release แล้วต้องหายจากหน้านี้ทันที และถ้าถูกนำออกจาก Release ต้องกลับมาแสดงอีกครั้ง

## Data Model

ใช้แนวทางที่ผู้ใช้เลือก: สร้างตาราง `fe_managed_features` ใน Supabase แยกจาก Release เพื่อให้งานมีตัวตนได้ก่อนมีรอบ Release

ข้อมูลขั้นต่ำของงานที่สร้างจากเว็บ:

- ชื่องาน
- Platform (`web`, `app`, `shared`, `unknown`)
- Owner
- วันเริ่ม/จบ Dev FE
- วันเริ่ม/จบ QA
- รายละเอียด/หมายเหตุ
- Archived flag และเวลา created/updated

เพิ่มชนิดสมาชิก `managed` ใน `fe_managed_release_members` โดย `feature_id` อ้างถึง ID ของ `fe_managed_features` ในระดับแอป งานเดิมชนิด `sheet` และ `custom` ยังคงอ่านได้เพื่อไม่กระทบข้อมูลที่มีอยู่

ตารางใหม่เปิด RLS และใช้สิทธิ์ anonymous shared editing ตามรูปแบบของโปรเจกต์ปัจจุบัน ไม่มี login และไม่มีการเปิดสิทธิ์ delete; ใช้ Archive สำหรับงานจากเว็บ

## UI

### Release board

- แทนที่ Timeline Health ที่อิงวันจบ Dev FE ด้วย Release countdown ที่อิง `release.date`
- หลังวัน Release ใช้ข้อความ `ผ่านวัน Release X วัน` ไม่ตีความว่า Release ทั้งรอบล้มเหลว
- ใน Release details งานแต่ละ Feature แสดงสถานะเวลาแยกกัน:
  - `เหลืออีก X วัน`
  - `Deploy วันนี้`
  - `เกินกำหนด X วัน` เมื่อยังไม่ `Deployed`
  - `Deployed แล้ว`
  - `ยังไม่ระบุวัน Deploy`

### Unassigned features

- เป็น View ใหม่ใน navigation ระดับเดียวกับ Timeline, Release board และ History
- แสดงจำนวนงานค้าง, ค้นหา และกรอง Platform ได้
- การ์ด/รายการแยกแหล่งข้อมูล `From Sheet` และ `Web added`
- งานจาก Sheet เปิดรายละเอียดและลิงก์กลับแถวต้นฉบับได้ แต่แก้จากเว็บไม่ได้
- มีปุ่ม `เพิ่ม Feature` สำหรับสร้างงานนอก Sheet ใน Supabase
- Release editor แสดงรายการเดียวจากงานค้างใน `Unassigned features` ทั้ง From Sheet และ Web added พร้อมสมาชิกเดิมของ Release
- Feature ที่อยู่ใน Release อื่นยังมองเห็นแต่ checkbox ถูกปิด พร้อมชื่อรอบปัจจุบันและปุ่มย้าย; ต้องยืนยันก่อน และการบันทึกจะถอดออกจากรอบเดิม

## Non-goals

- ไม่เขียนสถานะ วัน หรือสมาชิก Release กลับ Google Sheets
- ไม่เปลี่ยนสถานะ Feature หรือ Release อัตโนมัติจากวันที่
- ไม่ทำ login, permission รายบุคคล หรือ workflow deploy
- ไม่ย้ายงาน `custom` เดิมใน Release ออกมาเป็น managed feature อัตโนมัติในรอบนี้

## Approaches Considered

1. **ตาราง Feature แยกใน Supabase — เลือกใช้:** โครงสร้างตรงความหมาย งานอยู่ได้ก่อนมี Release และนำกลับมาใช้ใน Release editor ได้
2. **Release จำลองชื่อ Backlog — ไม่เลือก:** ทำได้เร็วแต่ทำให้ข้อมูล Backlog ปะปนกับ Release จริงและต้องซ่อนในหลายหน้าจอ

## Success Criteria

- Feature จาก Sheet ที่ไม่มีวัน Deploy/Release ปรากฏในหน้า Unassigned และหายไปเมื่อเลือกเข้า Release
- Feature ที่มีวัน Deploy/Release ใน Sheet ไม่ปรากฏในหน้า Unassigned แม้ไม่มี release metadata
- Feature จากเว็บบันทึกข้ามการรีเฟรชได้ และเลือกเข้า Release ได้
- Release card countdown ใช้วัน Release; Feature ที่เลยวัน Deploy และยังไม่ `Deployed` แสดงจำนวนวันที่เกินกำหนดของตัวเอง
- ทุก mutation เก็บใน Supabase และไม่มี request ที่เขียน Google Sheets

