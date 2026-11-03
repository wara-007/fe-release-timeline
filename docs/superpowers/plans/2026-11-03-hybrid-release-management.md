# Hybrid Release Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มและแก้ไข Release ที่ประกอบด้วยงานจาก Sheet และงานนอก Sheet โดยไม่เขียนกลับ Sheet

**Architecture:** เก็บ Supabase-owned release definitions และ members แยกจากข้อมูล Sheet แล้ว merge ผ่าน projection ก่อนส่งให้ UI ใช้งาน Route Handler เป็น boundary สำหรับ validation และ anonymous shared editing

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Postgres/Data API

**Spec:** `docs/superpowers/specs/2026-11-03-hybrid-release-management-design.md`

## Global Constraints

- Google Sheets ต้อง read-only เสมอ
- ไม่มี Login ตาม scope ปัจจุบัน
- ใช้ Archive แทน hard delete
- ไม่รัน Test/Build ตามคำสั่งผู้ใช้ใน session นี้

## Review Focus

- Sheet feature ID ที่หายหลัง Sheet เปลี่ยนแถวต้องไม่ทำให้ทั้ง Release หาย
- Release override ต้องไม่แก้ object ต้นทางจาก Sheet
- custom date range ต้องรับเฉพาะ YYYY-MM-DD และ start ไม่เกิน end
- API ต้อง reject cross-origin writes และ payload ที่ใหญ่เกินกำหนด
- archived Release ต้องไม่แสดงใน current board แต่ข้อมูลยังอยู่ใน Supabase

---

### Task 1: Persistence and API

**Files:** migration, `src/lib/release-management.ts`, `src/app/api/releases/route.ts`

- [x] เพิ่มตาราง release definitions และ members พร้อม RLS/grants
- [x] เพิ่ม Data API adapter สำหรับ read/upsert/archive
- [x] เพิ่ม GET/POST Route Handler พร้อม validation และ same-origin protection

### Task 2: Projection

**Files:** `src/lib/release-management-view.ts`, `src/lib/types.ts`

- [x] merge override เข้ากับ Sheet releases โดยไม่ mutate source
- [x] สร้าง Release/Feature สำหรับ manual releases และ custom work items
- [x] รักษา missing Sheet references ไว้เป็น warning ใน details

### Task 3: Add/Edit UI

**Files:** `src/components/dashboard.tsx`, `src/app/globals.css`

- [x] โหลด managed releases และ merge ก่อน filter/metrics/cards
- [x] เพิ่มปุ่ม Add Release และ Release editor drawer
- [x] เลือกงาน Sheet และจัดการ custom work items
- [x] เพิ่ม Edit/Archive action และ source badges

### Task 4: Documentation and handoff

**Files:** `README.md`, `task_plan.md`

- [x] อธิบาย ownership ระหว่าง Sheet กับ Supabase
- [x] ระบุ migration และข้อจำกัด anonymous editing
