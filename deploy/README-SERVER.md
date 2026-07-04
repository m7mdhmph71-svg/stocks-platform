# نشر المنصة على خادم خاص (VPS)

دليل كامل من الصفر — النتيجة: منصتك على نطاقك الخاص بشهادة تشفير تلقائية،
مع قاعدة بيانات وحسابات مستخدمين وجدولة الملخص اليومي، كلها بأمر واحد.

## 1) اشترِ خادماً ونطاقاً (~نصف ساعة)

- **الخادم**: أي VPS بمواصفات 2 vCPU / 4GB RAM تكفي بامتياز للبداية
  (Hetzner CX22 ~ €4/شهر، أو DigitalOcean/Contabo/غيرها). اختر Ubuntu 24.04.
- **النطاق**: من أي مسجّل (Namecheap/GoDaddy/…). أضف سجل **A** يشير إلى
  عنوان IP الخادم، مثل: `sahm.yourdomain.com → 203.0.113.10`

## 2) جهّز الخادم (مرة واحدة)

ادخل عبر SSH ثم:

```bash
# تثبيت Docker
curl -fsSL https://get.docker.com | sh

# جلب المشروع
git clone https://github.com/m7mdhmph71-svg/stocks-platform.git
cd stocks-platform

# الإعدادات
cp deploy/.env.server.example .env
nano .env   # ضع DOMAIN وكلمات السر (ولّدها بـ: openssl rand -hex 32)
```

## 3) شغّل كل شيء

```bash
docker compose up -d --build
```

هذا يبني ويشغّل: التطبيق + PostgreSQL (بياناتها محفوظة في volume) +
Caddy (يستخرج شهادة TLS تلقائياً لنطاقك) + جدولة الملخص اليومي.

بعد دقائق: افتح `https://sahm.yourdomain.com` — المنصة تعمل بالحسابات
مفعّلة (سجّل أول حساب لك من صفحة «دخول»).

## 4) التحديثات لاحقاً

```bash
cd stocks-platform
git pull
docker compose up -d --build
```

## 5) نسخ احتياطي لقاعدة البيانات

```bash
docker compose exec db pg_dump -U sahm sahm > backup-$(date +%F).sql
```

ضعه في cron أسبوعياً وارفع الملف خارج الخادم.

## استكشاف الأخطاء

| العرض | السبب الغالب | الحل |
|---|---|---|
| الموقع لا يفتح | DNS لم ينتشر بعد | انتظر حتى ساعة، تحقق بـ `dig +short نطاقك` |
| شهادة TLS فشلت | المنفذان 80/443 محجوبان | افتحهما في جدار حماية مزوّد الخادم |
| «الحسابات غير مفعّلة» | DATABASE_URL لم يصل للتطبيق | تأكد من `.env` ثم `docker compose up -d` |
| سجلّات التطبيق | — | `docker compose logs -f app` |
