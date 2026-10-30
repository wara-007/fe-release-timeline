# Release room — FE Timeline

เว็บ Next.js สำหรับดู Timeline ของ Frontend ทั้ง App และ Web ทีมแก้ Google Sheet เดิม แล้วเว็บอ่านข้อมูลมาแสดง ไม่มี login และไม่มีการเขียนข้อมูลกลับไปที่ชีต

## เปิดใช้งาน

ต้องมี Node.js 20.9 ขึ้นไป

```sh
npm ci
npm run dev
```

เปิด http://127.0.0.1:3000

Production:

```sh
npm run build
npm start
```

## ข้อมูลที่ใช้จริง
- อ่านแท็บ `Project timeline 2026` และ `Project timeline 2025` ผ่าน XLSX export ของ Google โดยไม่ต้องใช้ token สำหรับไฟล์ปัจจุบัน
- ใช้เลขวันและเดือนจากหัวปฏิทิน ปีจากชื่อแท็บ รวมข้อความและสีของแต่ละช่วงงาน รองรับ theme colors และไม่สร้าง milestone จากสีวันหยุด
- เปิดหน้าครั้งแรกอ่านจาก server; ระหว่างเปิดหน้าเว็บจะรีเฟรชทุก 60 วินาที มีปุ่มรีเฟรชด้วยตนเอง และ server cache เพื่อไม่ดึงไฟล์ซ้ำสำหรับผู้ใช้พร้อมกัน
- อ่านไม่สำเร็จจะเก็บข้อมูลล่าสุดพร้อมคำเตือน หากเริ่มต้นอ่านไม่ได้จะใช้ snapshot ที่บันทึกจากไฟล์จริง พร้อมเวลาและป้ายแยกจากข้อมูลสด
- สถานะที่ไม่ระบุยังเป็น `unknown` วันที่ผ่านไปไม่ถือว่า Done หรือ Deployed
- หน้าแรกเน้นช่วงปัจจุบัน/อนาคต งานไม่มีวันยังแสดงไว้ให้ทีมเติมแผน งานที่วันตามแผนผ่านไปแล้วดูได้ใน History > แผนที่ผ่านมา โดยไม่อ้างว่า deploy แล้ว
- Platform อ่านจากชื่องานและ App release ที่มีวันที่; override ได้ด้วย Note
- รออ่าน style จาก conditional formatting: รุ่นนี้ใช้สี fill ที่ export มาใน XLSX หากเปลี่ยนชีตเป็นกติกาสีอัตโนมัติควรตรวจผลเทียบต้นฉบับ

## ระบุรอบ release, สถานะ และ image ใน Sheet เดิม

รุ่นนี้ไม่แก้ชีตให้และไม่เพิ่มแท็บ ใช้ **Insert note / แทรกบันทึก ที่เซลล์ชื่องานในคอลัมน์ A** ได้ เมื่อต้องการระบุข้อมูลเพิ่มเติม:

```text
release: Release 1
stream: web-main
status: Done
image: web:release-001
platform: web
owner: ชื่อผู้รับผิดชอบ
```

ข้อความข้างต้นเป็นตัวอย่างรูปแบบ ไม่ใช่ข้อมูลจริงของชีต

ทุกงานในรอบต้องระบุ `release` และ `stream` เดียวกัน ตัวอย่าง Release 1 มีสามงาน ให้ใส่ Note ระบุ Release 1 ในทั้งสามงาน ใช้ image เดียวกันได้

สถานะที่รองรับ:

| สถานะ | ความหมาย |
|---|---|
| Planned | กำหนดงานที่จะเข้ารอบ |
| Merging | กำลังรวมโค้ด |
| Testing | กำลังทดสอบ build |
| Done | รวมโค้ดครบและเทสผ่าน |
| Deployed / Released | ยืนยันว่า deploy production แล้ว |

- รอบจะเป็น Done เมื่อทุกงานเป็น Done หรือ Deployed และเป็น Deployed เมื่อทุกงานเป็น Deployed
- Release 2 จะแสดงว่าเริ่ม merge ได้เมื่อ Release 1 ใน stream เดียวกันเป็น Done หรือ Deployed
- ลำดับรอบใช้ตำแหน่งแถวแรกของแต่ละรอบในชีต ต้องเรียง Release 1 ก่อน Release 2 งานในหนึ่งรอบอาจอยู่หลายแถว
- ไม่มีข้อมูลรอบก่อนหน้าหรือ stream จะแสดงว่า “ยังตรวจสอบไม่ได้” ไม่สรุปว่า merge ได้
- วันตรงกันอย่างเดียวไม่ถูกสร้างเป็นรอบเดียวกัน การจัดกลุ่มอัตโนมัติใช้ version, วัน release และ platform ที่ตรงกัน และไม่ใช้เพื่อยืนยันสิทธิ์เริ่ม merge
- `Done` ที่อยู่ในชื่องานเดิมเป็นเพียงข้อความจากต้นฉบับ ไม่ถือเป็นสถานะรอบ release
- การ์ด “พร้อมส่งต่อให้ SA” ต้องมีทั้ง Done และ image/build
- งาน Web/App ที่แยก artifact หรือกำหนดส่ง ให้แยก stream/record ตามการทำงานจริง

## การเชื่อมข้อมูลและ deploy

แอปนี้ใช้ Node.js server จริง เพราะต้องอ่าน XLSX โดยไม่ขึ้นกับ CORS ของเบราว์เซอร์ Deploy บน Vercel ด้วย framework `Next.js` หรือโฮสต์ Node/Docker ที่รองรับ Next.js ได้ ไม่ใช่ static-only HTML

ไฟล์ปัจจุบันอ่าน public export ได้ ไม่ได้เปลี่ยนสิทธิ์แชร์ของ Google Sheet หากภายหลังเปลี่ยนเป็น private ให้ตั้งค่าเฉพาะฝั่ง server ตาม `.env.example` และแชร์ไฟล์ read-only ให้ service account:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

ห้ามใช้ `NEXT_PUBLIC_` กับ credential และไม่ต้องให้ผู้ชมเว็บล็อกอิน Google

Snapshot fallback เป็นข้อมูลจริงที่มีเวลา ไม่ใช่ข้อมูลสาธิต อัปเดตไฟล์ fallback ด้วย `npm run snapshot:update` และ deploy ใหม่เมื่อจำเป็น ข้อมูลสดไม่ต้อง deploy ใหม่เมื่อทีมแก้ชีต

## ตรวจสอบ

```sh
npm test
npm run typecheck
npm run build
```

Tests ครอบคลุมการอ่านช่วงวันและสี, theme/holiday, งานไม่มีวันที่, DevBE ที่ไม่ควรถูกสร้างเป็น feature, การจัดกลุ่มหลายงาน, Done/Deployed, การเริ่ม merge ตาม stream, Platform และวันปัจจุบัน Asia/Bangkok

## Image / App build ที่กรอกจากเว็บ — Supabase

บันทึกจริงใน Supabase project `rxqffuavqnxlgmjoolzn` ตาราง `public.fe_release_builds` แทนไฟล์บนเครื่อง ข้อมูลแชร์กันทุกเครื่องและยังอยู่หลัง restart/deploy ใหม่ ไม่มีการแก้ Google Sheets

ตั้งค่าฝั่ง server ใน `.env.local` (ถูก ignore โดย Git):

```text
SUPABASE_URL=https://rxqffuavqnxlgmjoolzn.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key ของโปรเจกต์>
```

ค่าเหล่านี้ไม่ใช้ `NEXT_PUBLIC_` แอปเรียกผ่าน Next.js `/api/builds` ซึ่งตรวจ input และ same-origin ก่อน upsert ผ่าน Supabase Data API ไม่มี SDK dependency และไม่มี admin/service key

โมเดลปัจจุบันยังไม่ล็อกอินตามคำขอ: เปิด RLS พร้อม SELECT/INSERT/UPDATE policies สำหรับ shared anonymous editing เฉพาะตารางนี้ ไม่ grant DELETE หากภายหลังต้องจำกัดผู้แก้ไข ต้องเพิ่ม authentication/authorization ที่ API และ RLS ร่วมกัน การเก็บ publishable key เฉพาะ server ไม่ใช่การยืนยันตัวผู้ใช้

Migration ที่ apply จริง: `supabase/migrations/20261030081417_create_fe_release_builds.sql` ชื่อ `create_fe_release_builds` ไม่มีข้อมูลชีตหรือเลข build จริงใน migration

ถ้าอ่านหรือบันทึกฐานข้อมูลไม่ได้ API จะส่ง error โดยไม่ fallback ไปไฟล์เงียบ ๆ และปุ่มบันทึกจะรอให้โหลดข้อมูลเดิมสำเร็จก่อน ไม่มีข้อมูล local file เดิมให้ย้ายในตอนเชื่อมต่อ

ข้อจำกัดเดิม: record ID ของ feature ยังผูกกับเลขแถวในชีต ส่วน release ที่ไม่ได้ระบุ ID ผูกกับกลุ่มแผน หลีกเลี่ยงย้ายแถว/เปลี่ยนกลุ่มขณะมี build บันทึกไว้จนกว่าจะเพิ่มการจับคู่ ID ถาวร ขั้นตอนนี้เปลี่ยนเฉพาะที่เก็บข้อมูล ไม่เปลี่ยนการจับคู่งาน

## Repository data policy

สำเนาชีต `src/data/sheet-snapshot.json` เก็บเฉพาะบนเครื่อง ไม่รวมใน Git หรือประวัติที่ push ขึ้น repository public แอปอ่านชีตสดได้ตามเดิม หากต้องการ fallback บนเครื่อง ให้รัน `npm run snapshot:update` ไฟล์ที่สร้างจะถูก ignore อัตโนมัติ หากอ่านสดไม่ได้และไม่มี fallback เว็บจะแสดงข้อผิดพลาดแทนการแสดงข้อมูลสมมุติ
