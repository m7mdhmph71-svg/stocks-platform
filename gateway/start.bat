@echo off
chcp 65001 >nul
title بوابة واتساب - سهم سكرينر
cd /d "%~dp0"

if not exist .env (
  echo.
  echo لم يوجد ملف .env — سيُنشأ من المثال. افتحه وضع CRON_SECRET ثم أعد التشغيل.
  copy .env.example .env >nul
  notepad .env
  exit /b 1
)

if not exist node_modules (
  echo تثبيت الحزم لأول مرة...
  call npm install --omit=dev
)

echo تشغيل البوابة... صفحة الرمز والحالة: http://localhost:8899
node index.mjs
pause
