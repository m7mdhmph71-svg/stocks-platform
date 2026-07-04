#!/bin/bash
# سهم سكرينر — تشغيل محلي بنقرة مزدوجة (ماك)
# يتكفل بكل شيء: تشغيل Docker إن كان مطفأً، سحب آخر التحديثات،
# تفادي تعارض المنافذ تلقائياً، ثم فتح المتصفح على المنصة.

cd "$(dirname "$0")"
echo "🚀 سهم سكرينر — تشغيل محلي"
echo

# 1) تأكد أن Docker يعمل — وشغّله إن كان مطفأً
if ! docker ps >/dev/null 2>&1; then
  echo "⏳ Docker Desktop مطفأ — جارٍ تشغيله…"
  open -a Docker
  for i in $(seq 1 60); do
    sleep 2
    if docker ps >/dev/null 2>&1; then break; fi
  done
  if ! docker ps >/dev/null 2>&1; then
    echo "❌ لم يقلع Docker خلال دقيقتين — شغّله يدوياً ثم أعد النقر على هذا الملف."
    read -r -p "اضغط Enter للإغلاق…"
    exit 1
  fi
fi
echo "✅ Docker يعمل"

# 2) اسحب آخر التحديثات (إن توفر git والمجلد مستنسخ به)
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo "⬇️  جلب آخر تحديثات المنصة…"
  git pull --ff-only || echo "(تعذر السحب — نكمل بالنسخة الحالية)"
fi

# 3) اختر منفذاً حراً تلقائياً
PORT=3000
for p in 3000 3005 3010 3020; do
  if ! lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then PORT=$p; break; fi
done
echo "🔌 المنفذ: $PORT"

# 4) شغّل (يبني عند الحاجة فقط)
APP_PORT=$PORT docker compose -f docker-compose.local.yml up -d --build || {
  echo "❌ فشل التشغيل — أرسل ناتج هذا الأمر للمساعدة:"
  echo "   docker compose -f docker-compose.local.yml logs app --tail 20"
  read -r -p "اضغط Enter للإغلاق…"
  exit 1
}

echo
echo "✅ المنصة تعمل: http://localhost:$PORT"
echo "   للإيقاف لاحقاً: docker compose -f docker-compose.local.yml down"
sleep 2
open "http://localhost:$PORT"
