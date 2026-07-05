// بوابة واتساب بربط QR — سهم سكرينر
// ============================================
// تربط حسابك في واتساب بمسح رمز QR مرة واحدة (كما في واتساب ويب)، ثم:
//   • ترسل ملخص إشارات اليوم في الوقت المحدد
//   • تسحب التنبيهات اللحظية من /api/alerts كل بضع دقائق وترسلها
//   • ترد على أوامرك الواردة (رمز سهم، صفقاتي، قائمتي، ملخص، مساعدة)
//   • تخدم واجهة JSON للمنصة كي يتم الربط من صفحة «تنبيهاتي» مباشرة
//
// التشغيل:  npm install  ثم  npm start
// إرسال فوري للتجربة:  npm run send-now
// صفحة الحالة والرمز: http://localhost:8899

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------- الإعدادات من gateway/.env ----------
function loadEnv() {
  const env = {};
  const p = join(ROOT, ".env");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
    }
  }
  return env;
}
const ENV = { ...loadEnv(), ...process.env };

const SITE_URL = (ENV.SITE_URL || "https://stocks-platform-seven.vercel.app").replace(/\/$/, "");
const CRON_SECRET = ENV.CRON_SECRET || "";
const SEND_TIME = ENV.SEND_TIME || "22:30";
const SEND_DAYS = (ENV.SEND_DAYS || "1,2,3,4,5").split(",").map((x) => parseInt(x.trim(), 10));
const SEND_TO = ENV.SEND_TO || "self";
const PORT = parseInt(ENV.PORT || "8899", 10);
/** فاصل سحب التنبيهات اللحظية بالدقائق */
const ALERT_POLL_MIN = Math.max(2, parseInt(ENV.ALERT_POLL_MIN || "5", 10));
const SEND_NOW = process.argv.includes("--send-now");

if (!CRON_SECRET) {
  console.error("⚠️  ضع CRON_SECRET في ملف gateway/.env (انسخ .env.example إلى .env)");
}

// شبكة أمان: مكتبة Baileys تسرّب أحياناً وعوداً مرفوضة (مهلات داخلية أثناء
// إعادة الاتصال عند تقلب الشبكة) — بدون هذا تسقط العملية كلها بخطأ واحد عابر.
process.on("unhandledRejection", (reason) => {
  log(`⚠️ رفض وعد غير معالج (تمت مواصلة العمل): ${reason?.message ?? reason}`);
});
process.on("uncaughtException", (err) => {
  log(`⚠️ استثناء غير ملتقط (تمت مواصلة العمل): ${err?.message ?? err}`);
});

// ---------- حالة البوابة ----------
let sock = null;
let connected = false;
let lastQrDataUrl = null;
let selfJid = null;
/** معرّف الخصوصية للحساب نفسه — واتساب يعنون محادثة «أنا» به أحياناً (@lid) */
let selfLid = null;
let lastLog = [];
const startedAt = Math.floor(Date.now() / 1000);
/** معرفات رسائلنا الصادرة — كي لا نفسر ردودنا كأوامر واردة */
const sentIds = new Set();

function log(msg) {
  const line = `[${new Date().toLocaleTimeString("en-GB")}] ${msg}`;
  console.log(line);
  lastLog.push(line);
  if (lastLog.length > 50) lastLog.shift();
}

function jidFor(dest) {
  if (dest && dest !== "self" && /^\d{8,15}$/.test(String(dest).replace(/\D/g, ""))) {
    return String(dest).replace(/\D/g, "") + "@s.whatsapp.net";
  }
  return selfJid;
}

/** تجريد لاحقة الجهاز من المعرف (966x:12@... ← 966x@...) */
function bareJid(jid) {
  return String(jid ?? "").replace(/:\d+@/, "@");
}

/** هل هذه محادثة «أنا»؟ (بصيغة الرقم أو معرّف الخصوصية @lid) */
function isSelfChat(jid) {
  const n = bareJid(jid);
  return (selfJid !== null && n === selfJid) || (selfLid !== null && n === selfLid);
}

async function sendToJid(jid, text, { trackSent = true } = {}) {
  if (!connected || !sock) throw new Error("not connected");
  if (!jid) throw new Error("no destination");
  const sent = await sock.sendMessage(jid, { text });
  if (trackSent && sent?.key?.id) {
    sentIds.add(sent.key.id);
    if (sentIds.size > 500) {
      for (const id of Array.from(sentIds).slice(0, 250)) sentIds.delete(id);
    }
  }
  return jid;
}

async function sendTo(dest, text, opts) {
  return sendToJid(jidFor(dest), text, opts);
}

// ---------- الاتصال بواتساب ----------
async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(join(ROOT, "auth"));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Sahm Screener", "Chrome", "1.0"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      lastQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      const term = await QRCode.toString(qr, { type: "terminal", small: true });
      console.log("\n🔗 امسح الرمز من واتساب: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز\n");
      console.log(term);
      log(`أو من صفحة «تنبيهاتي» في المنصة، أو: http://localhost:${PORT}`);
    }

    if (connection === "open") {
      connected = true;
      lastQrDataUrl = null;
      // معرف حسابك (لإرسال «رسالة إلى نفسي») — بصيغتي الرقم والخصوصية
      const raw = sock.user?.id ?? "";
      selfJid = bareJid(raw);
      const rawLid = sock.user?.lid ?? "";
      selfLid = rawLid ? bareJid(rawLid) : null;
      log(`✅ متصل بواتساب: ${selfJid}${selfLid ? ` (lid: ${selfLid})` : ""}`);
      if (SEND_NOW) {
        await runJob("تجربة فورية (--send-now)");
        process.exit(0);
      }
      // أول سحب للتنبيهات بعد نصف دقيقة من الاتصال
      setTimeout(() => pollAlerts("بعد الاتصال"), 30_000);
    }

    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        log("❌ فُصل الحساب (تسجيل خروج) — حُذفت الجلسة، امسح رمز QR الجديد للربط من جديد.");
        rmSync(join(ROOT, "auth"), { recursive: true, force: true });
        selfJid = null;
        setTimeout(connect, 2000);
      } else {
        log(`⚠️ انقطع الاتصال (${code ?? "?"}) — إعادة محاولة بعد 5 ثوانٍ…`);
        setTimeout(connect, 5000);
      }
    }
  });

  // ---------- الأوامر الواردة ----------
  // notify: رسائل واردة حية. append: تشمل ما يُرسل من هذه الجلسة نفسها —
  // نعالجه أيضاً كي يعمل اختبار echo، وحارس sentIds يمنع تفسير ردودنا كأوامر.
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      try {
        await handleIncoming(msg);
      } catch (e) {
        log(`❌ خطأ في معالجة رسالة واردة: ${e?.message ?? e}`);
      }
    }
  });
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? null;
}

async function handleIncoming(msg) {
  const jid = msg.key?.remoteJid ?? "";
  const id = msg.key?.id ?? "";
  // رسائلنا الصادرة ليست أوامر
  if (sentIds.has(id)) return;
  // مجموعات وقنوات وحالات: تجاهل — نقبل الخاص بصيغتي الرقم والخصوصية
  if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) return;
  // رسائل قديمة من قبل تشغيل البوابة (إعادة مزامنة): تجاهل
  const ts = Number(msg.messageTimestamp ?? 0);
  if (ts > 0 && ts < startedAt - 60) return;

  const text = (extractText(msg) ?? "").trim();
  if (!text) return;

  // نستقبل الأوامر فقط من محادثة «أنا» ومن رقم SEND_TO المضبوط
  const fromSelfChat = isSelfChat(jid);
  const fromConfigured =
    SEND_TO !== "self" &&
    bareJid(jid) === SEND_TO.replace(/\D/g, "") + "@s.whatsapp.net";
  if (!fromSelfChat && !fromConfigured) {
    log(`تجاهل رسالة من محادثة غير مسموحة: ${bareJid(jid)}`);
    return;
  }

  // ردودنا طويلة/متعددة الأسطر — الأوامر قصيرة من سطر واحد
  if (text.includes("\n") || text.length > 32) return;

  log(`📥 أمر وارد: ${text}`);
  // رقم المرسل للمنصة: محادثة «أنا» قد تصل بصيغة @lid بلا رقم — نستخدم رقم الحساب
  const fromPhone = fromSelfChat
    ? (selfJid ?? "").split("@")[0]
    : bareJid(jid).split("@")[0];
  let reply = null;
  try {
    const res = await fetch(`${SITE_URL}/api/whatsapp/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ from: fromPhone, text }),
      signal: AbortSignal.timeout(290_000),
    });
    if (res.ok) {
      const data = await res.json();
      reply = data.reply ?? null;
    } else {
      log(`❌ فشل أمر المنصة: HTTP ${res.status}`);
    }
  } catch (e) {
    log(`❌ تعذّر الوصول للمنصة: ${e?.message ?? e}`);
  }
  if (reply) {
    // الرد في المحادثة نفسها التي وصل منها الأمر
    await sendToJid(jid, reply);
    log(`📤 رُدّ على الأمر «${text}»`);
  }
}

// ---------- جلب رسالة اليوم من المنصة وإرسالها ----------
async function runJob(reason) {
  try {
    if (!connected || !sock) {
      log("تخطي الإرسال: غير متصل بواتساب بعد.");
      return { ok: false, detail: "not connected" };
    }
    log(`جلب إشارات اليوم من المنصة… (${reason})`);
    const res = await fetch(
      `${SITE_URL}/api/digest?secret=${encodeURIComponent(CRON_SECRET)}&dry=1`,
      { signal: AbortSignal.timeout(280_000) }
    );
    if (!res.ok) {
      log(`❌ فشل جلب الملخص: HTTP ${res.status}`);
      return { ok: false, detail: `digest ${res.status}` };
    }
    const data = await res.json();
    const text = data.message;
    if (!text) {
      log("❌ استجابة بلا رسالة.");
      return { ok: false, detail: "empty message" };
    }
    const jid = await sendTo(SEND_TO, text);
    log(`✅ أُرسلت رسالة الإشارات إلى ${jid}`);
    return { ok: true };
  } catch (e) {
    log(`❌ خطأ أثناء الإرسال: ${e?.message ?? e}`);
    return { ok: false, detail: String(e?.message ?? e) };
  }
}

// ---------- التنبيهات اللحظية من /api/alerts ----------
let alertsInflight = false;

async function pollAlerts(reason) {
  if (!connected || alertsInflight || !CRON_SECRET) return;
  alertsInflight = true;
  try {
    const res = await fetch(
      `${SITE_URL}/api/alerts?secret=${encodeURIComponent(CRON_SECRET)}`,
      { signal: AbortSignal.timeout(290_000) }
    );
    if (!res.ok) {
      log(`⚠️ فشل سحب التنبيهات: HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    if (alerts.length === 0) return;
    log(`🔔 ${alerts.length} تنبيه جديد (${reason})`);
    for (const a of alerts) {
      try {
        await sendTo(a.to, a.text);
        // مهلة قصيرة بين الرسائل — لا نرسل دفعة واحدة
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        log(`❌ تعذّر إرسال تنبيه: ${e?.message ?? e}`);
      }
    }
  } catch (e) {
    log(`⚠️ خطأ في سحب التنبيهات: ${e?.message ?? e}`);
  } finally {
    alertsInflight = false;
  }
}

setInterval(() => pollAlerts("دوري"), ALERT_POLL_MIN * 60_000);

// ---------- الجدولة اليومية ----------
const SENT_FILE = join(ROOT, "last-sent.txt");
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
setInterval(async () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const day = now.getDay() === 0 ? 7 : now.getDay(); // الأحد=7
  if (`${hh}:${mm}` !== SEND_TIME) return;
  if (!SEND_DAYS.includes(day)) return;
  const already = existsSync(SENT_FILE) && readFileSync(SENT_FILE, "utf8") === todayKey();
  if (already) return;
  writeFileSync(SENT_FILE, todayKey());
  await runJob(`الجدولة اليومية ${SEND_TIME}`);
}, 20_000);

// ---------- خادم HTTP: واجهة JSON للمنصة + صفحة الحالة ----------
function authorized(req, url) {
  if (!CRON_SECRET) return false;
  const header = req.headers["x-gateway-secret"];
  const qs = url.searchParams.get("secret");
  return header === CRON_SECRET || qs === CRON_SECRET;
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // —— واجهة JSON للمنصة (بسر مشترك) ——
  if (url.pathname.startsWith("/api/")) {
    if (!authorized(req, url)) {
      return json(res, 401, { error: "unauthorized" });
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      return json(res, 200, { connected, qr: lastQrDataUrl, selfJid });
    }
    if (req.method === "POST" && url.pathname === "/api/send") {
      const body = await readJson(req);
      if (!body?.text) return json(res, 400, { error: "text required" });
      try {
        // echo:true (للاختبار): لا تُسجَّل كصادرة فتعود إلينا وتُعالج كأمر وارد
        const jid = await sendTo(body.to ?? "self", String(body.text), {
          trackSent: !body.echo,
        });
        log(`📤 أُرسلت رسالة عبر واجهة المنصة إلى ${jid}`);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, 502, { ok: false, error: String(e?.message ?? e) });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/digest-now") {
      const r = await runJob("طلب من صفحة «تنبيهاتي»");
      return json(res, r.ok ? 200 : 502, r);
    }
    if (req.method === "POST" && url.pathname === "/api/logout") {
      try {
        log("فصل الربط بطلب من المنصة…");
        try {
          await sock?.logout();
        } catch {
          // الجلسة قد تكون منقطعة أصلاً — نحذف الاعتماد محلياً
        }
        rmSync(join(ROOT, "auth"), { recursive: true, force: true });
        connected = false;
        selfJid = null;
        lastQrDataUrl = null;
        setTimeout(connect, 1500);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, 500, { ok: false, error: String(e?.message ?? e) });
      }
    }
    return json(res, 404, { error: "not found" });
  }

  // —— صفحة الحالة المحلية (كما كانت) ——
  if (req.method === "POST" && req.url === "/test") {
    const r = await runJob("زر الإرسال التجريبي");
    res.writeHead(r.ok ? 200 : 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  const qrPart = lastQrDataUrl
    ? `<p>امسح الرمز من واتساب: <b>الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</b></p>
       <img src="${lastQrDataUrl}" alt="QR" style="image-rendering:pixelated;border:8px solid #fff;border-radius:12px" />
       <script>setTimeout(()=>location.reload(), 15000)</script>`
    : connected
      ? `<p style="color:#15855c;font-size:1.3rem">✅ متصل بواتساب (${selfJid ?? ""})</p>
         <form method="post" action="/test"><button style="font-size:1rem;padding:.6rem 1.4rem;border-radius:.7rem;border:0;background:#15855c;color:#fff;cursor:pointer">أرسل رسالة الإشارات الآن (تجربة)</button></form>
         <p>الإرسال المجدول: ${SEND_TIME} أيام (${SEND_DAYS.join(",")}) إلى ${SEND_TO === "self" ? "حسابك نفسه" : SEND_TO}</p>
         <p>سحب التنبيهات اللحظية: كل ${ALERT_POLL_MIN} دقائق</p>`
      : `<p>⏳ جارٍ الاتصال… إن ظهر رمز QR في نافذة الأوامر فامسحه، أو حدّث هذه الصفحة.</p>
         <script>setTimeout(()=>location.reload(), 5000)</script>`;
  res.end(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>بوابة واتساب — سهم سكرينر</title></head>
<body style="font-family:Tahoma,Arial;background:#f4f4f5;display:flex;flex-direction:column;align-items:center;padding:2rem;text-align:center">
<h2>بوابة واتساب — سهم سكرينر</h2>
${qrPart}
<details style="margin-top:2rem;max-width:640px;text-align:start"><summary>آخر السجلات</summary>
<pre style="direction:ltr;text-align:left;font-size:.75rem;background:#18181b;color:#a1a1aa;padding:1rem;border-radius:.7rem;overflow:auto">${lastLog.join("\n")}</pre></details>
</body></html>`);
}).listen(PORT, () => log(`صفحة الحالة: http://localhost:${PORT}`));

connect();
