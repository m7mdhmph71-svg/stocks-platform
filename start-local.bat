@echo off
chcp 65001 >nul
title سهم سكرينر — تشغيل محلي
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo.
  echo يتطلب التشغيل المحلي Docker Desktop — حمّله من:
  echo   https://www.docker.com/products/docker-desktop/
  echo ثم أعد تشغيل هذا الملف.
  pause
  exit /b 1
)

echo بناء وتشغيل المنصة محلياً (أول مرة تستغرق دقائق للبناء)...
docker compose -f docker-compose.local.yml up -d --build
if errorlevel 1 (
  echo.
  echo حدث خطأ — تأكد أن Docker Desktop يعمل ثم أعد المحاولة.
  pause
  exit /b 1
)

echo.
echo ✅ المنصة تعمل الآن مع الحسابات وقاعدة البيانات:
echo    http://localhost:3000
echo.
echo للإيقاف:            docker compose -f docker-compose.local.yml down
echo للإيقاف مع الحذف:   docker compose -f docker-compose.local.yml down -v
start http://localhost:3000
pause
