# التجربة المحلية على جهازك (قبل الخادم الخاص)

تشغّل المنصة كاملة — بالحسابات وقاعدة البيانات وقائمة المتابعة وسجل
الصفقات — على جهازك بأمر واحد، لتجربتها كما ستعمل على الخادم تماماً.

## المتطلب الوحيد: Docker Desktop

حمّله وثبّته (مرة واحدة): https://www.docker.com/products/docker-desktop/
— ثم شغّله وانتظر حتى تصبح أيقونته خضراء.

## التشغيل

### ويندوز — الأسهل
حمّل المشروع ثم انقر نقراً مزدوجاً على **`start-local.bat`** — سيبني
ويشغّل كل شيء ويفتح المتصفح على `http://localhost:3000`.

### أي نظام — سطر الأوامر
```bash
git clone https://github.com/m7mdhmph71-svg/stocks-platform.git
cd stocks-platform
docker compose -f docker-compose.local.yml up -d --build
# افتح http://localhost:3000
```

أول بناء يستغرق بضع دقائق (تنزيل الصور وبناء المنصة) — التشغيلات
التالية ثوانٍ.

## ماذا تجرب؟

1. من «دخول» أنشئ حسابك — سترى «قائمتي» و«صفقاتي» في القائمة
2. ابحث عن أي سهم واضغط «☆ تابِع السهم» — ثم عد لقائمتك
3. من صفحة سهم اضغط «📒 دخلت الصفقة» — وتابعها في «صفقاتي» بشريط
   التقدم بين الوقف والهدف
4. بياناتك محفوظة محلياً في Docker volume — تبقى بعد إعادة التشغيل

## أوامر مفيدة

```bash
# الإيقاف (تبقى البيانات)
docker compose -f docker-compose.local.yml down

# الإيقاف وحذف قاعدة البيانات
docker compose -f docker-compose.local.yml down -v

# مشاهدة سجلات التطبيق
docker compose -f docker-compose.local.yml logs -f app

# التحديث بعد سحب كود جديد
git pull && docker compose -f docker-compose.local.yml up -d --build
```

> ملاحظة: هذه النسخة المحلية بأسرار افتراضية مكشوفة — للتجربة فقط.
> النشر الحقيقي يكون بـ`docker-compose.yml` الرئيسي مع أسرار قوية
> (راجع `deploy/README-SERVER.md`).
