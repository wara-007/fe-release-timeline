# Hybrid Release Management

## Intent

ให้ทีมสร้างและแก้ไข Release จาก Release room โดย Google Sheets ยังคงเป็นแหล่ง Timeline แบบ read-only งานใน Release เลือกได้ทั้งงานจาก Sheet และงานที่เพิ่มจากเว็บ

## Design

- Supabase เก็บ Release ที่สร้างจากเว็บและ override ของ Release ที่มาจาก Sheet
- Release หนึ่งรายการเก็บชื่อ, version, วันที่ release, stream, platform, description, archive flag และลำดับสมาชิก
- สมาชิก Release อ้างถึงงานจาก Sheet ด้วย feature ID หรือเป็นงาน custom ที่มี title, platform, owner, ช่วง Dev FE, ช่วง QA และ note
- งานจาก Sheet ไม่ถูกคัดลอกทั้งก้อน และยังอ่านค่าล่าสุดจาก Sheet; Supabase เก็บเฉพาะ membership/override
- งาน custom ถูกแปลงเป็น Feature ใน projection ฝั่งเว็บเพื่อใช้การ์ด, details และ Timeline เดิมร่วมกัน
- การแก้ Release จาก Sheet สร้าง override ด้วย ID เดิม ส่วน Release ใหม่ใช้ ID ที่ Supabase สร้างและ prefix `manual:`
- ใช้ Archive แทน hard delete เพื่อรักษาประวัติ
- ไม่มี Login ตาม scope ปัจจุบัน จึงใช้ RLS สำหรับ anonymous shared editing เช่นเดียวกับสถานะและ image/build

## UI

- ปุ่ม `เพิ่ม Release` บน Release board เปิด drawer editor
- ปุ่ม `แก้ไข Release` อยู่ใน Release details
- Editor เลือกงานจาก Sheet, เพิ่ม/ลบงาน custom และแก้ metadata ของ Release
- Badge แสดง `From Sheet`, `Web added` และ `Edited in Release room`

## Non-goals

- ไม่แก้ Google Sheets
- ไม่ทำ Login หรือ permission รายบุคคล
- ไม่ hard delete Release หรือประวัติ
