# Unassigned Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้า Unassigned features, managed feature ใน Supabase และ countdown/overdue ที่อิงวัน Deploy/Release ระดับ Feature

**Architecture:** รวม Sheet features กับ managed features ผ่าน projection เดียว แล้วคำนวณ assignment จากวัน Deploy/Release หรือ active release membership หน้า Release ใช้ฟังก์ชัน health ระดับ Release/Feature ที่ไม่มี side effects

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Postgres/REST

**Spec:** `docs/superpowers/specs/2026-11-03-unassigned-features-design.md`

## Global Constraints

- Google Sheets เป็น read-only เสมอ
- ไม่มี login; Supabase ใช้ anonymous shared editing ตามระบบปัจจุบัน
- ใช้ Archive แทน delete สำหรับ managed features
- ไม่รัน Test หรือ Build ตามคำสั่งผู้ใช้ในรอบนี้

## Review Focus

- Sheet feature มี production/release date ต้องไม่เข้า Unassigned
- Sheet feature ไม่มี date แต่ถูกเลือกเข้า managed release ต้องไม่เข้า Unassigned
- Managed feature ที่ถอดออกจาก Release ต้องกลับเข้า Unassigned
- `Done` หลังวัน Deploy ยังต้องแสดง overdue จนเป็น `Deployed`
- Release/feature ที่ไม่มีวันต้องแสดงข้อความไม่ระบุวันโดยไม่คำนวณจำนวนวันผิด

---

### Task 1: Managed Feature Storage

**Files:**
- Create: `supabase/migrations/20261103140000_create_managed_features.sql`
- Create: `src/lib/managed-feature-store.ts`
- Create: `src/app/api/features/route.ts`

**Interfaces:**
- Produces: `ManagedFeature`, `getManagedFeatureStore().read()`, `save()`

- [x] เพิ่ม schema, RLS, policies และแก้ member source constraint ให้รองรับ `managed`
- [x] เพิ่ม REST store และ API validation/same-origin protection
- [x] Apply migration และ query schema ยืนยันคอลัมน์/constraint

### Task 2: Feature Projection and Assignment

**Files:**
- Modify: `src/lib/release-management.ts`
- Modify: `src/lib/release-management-view.ts`
- Modify: `src/components/dashboard.tsx`

**Interfaces:**
- Consumes: `ManagedFeature[]`
- Produces: merged `Feature[]`, assigned ID set และ unassigned list

- [x] Project managed features เป็น `Feature` โดยใช้ ID คงที่
- [x] Resolve member source `managed` จาก feature store
- [x] คำนวณ Unassigned จาก `featureDate(feature) === null` และไม่มี active membership
- [x] โหลด/refresh managed features จาก API

### Task 3: Unassigned Features UI

**Files:**
- Modify: `src/components/dashboard.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `unassigned` view และ `ManagedFeatureEditor`

- [x] เพิ่ม navigation/view/counter และรายการพร้อม source badge
- [x] เพิ่ม search/platform filter และเปิด Feature details
- [x] เพิ่มฟอร์มสร้าง/แก้ไข/Archive managed feature
- [x] เพิ่ม managed features ในตัวเลือกสมาชิกของ Release editor

### Task 4: Release and Feature Date Health

**Files:**
- Modify: `src/components/dashboard.tsx`

**Interfaces:**
- Produces: `releaseCountdown(release,today)`, `featureDeployHealth(feature,today)`

- [x] เปลี่ยนการ์ด Release ให้ใช้ release date countdown
- [x] แสดง health ของแต่ละ Feature ใน Release details
- [x] คง `Deployed` เป็นสถานะเดียวที่หยุด overdue หลังวัน Deploy

### Task 5: Documentation and Static Verification

**Files:**
- Modify: `task_plan.md`

- [x] อัปเดต progress/decisions และ migration status
- [x] ตรวจ `git diff --check` และ review diff ตาม success criteria
- [x] ไม่รัน Test หรือ Build ตามคำสั่งผู้ใช้ และรายงาน limitation นี้

