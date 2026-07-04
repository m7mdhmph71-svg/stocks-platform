// بوابة واتساب بربط QR — سهم سكرينر
// ============================================
// تربط حسابك في واتساب بمسح رمز QR مرة واحدة (كما في واتساب ويب)،
// ثم كل يوم في الوقت المحدد تسحب رسالة إشارات اليوم من منصتك على
// Vercel وترسلها إلى واتسابك مباشرة. تعمل على أي جهاز يبقى شغالاً.
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
const SEND_NOW = process.argv.includes("--send-now");

if (!CRON_SECRET) {
  console.error("⚠️  ضع CRON_SECRET في ملف gateway/.env (انسخ .env.example إلى .env)");
}

// ---------- حالة البوابة ----------
let sock = null;
let connected = false;
let lastQrDataUrl = null;
let selfJid = null;
let lastLog = [];

function log(msg) {
  const line = `[${new Date().toLocaleTimeString("en-GB")}] ${msg}`;
  console.log(line);
  lastLog.push(line);
  if (lastLog.length > 50) lastLog.shift();
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
      log(`أو افتح صفحة الرمز في المتصفح: http://localhost:${PORT}`);
    }

    if (connection === "open") {
      connected = true;
      lastQrDataUrl = null;
      // معرف حسابك (لإرسال «رسالة إلى نفسي»)
      const raw = sock.user?.id ?? "";
      selfJid = raw.replace(/:\d+@/, "@");
      log(`✅ متصل بواتساب: ${selfJid}`);
      if (SEND_NOW) {
        await runJob("تجربة فورية (--send-now)");
        process.exit(0);
      }
    }

    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        log("❌ فُصل الحساب (تسجيل خروج) — سيُحذف ملف الجلسة، أعد التشغيل وامسح QR من جديد.");
        rmSync(join(ROOT, "auth"), { recursive: true, force: true });
        process.exit(1);
      } else {
        log(`⚠️ انقطع الاتصال (${code ?? "?"}) — إعادة محاولة بعد 5 ثوانٍ…`);
        setTimeout(connect, 5000);
      }
    }
  });
}

// ---------- جلب رسالة اليوم من المنصة وإرسالها ----------
function targetJid() {
  if (SEND_TO !== "self" && /^\d{8,15}$/.test(SEND_TO)) {
    return SEND_TO + "@s.whatsapp.net";
  }
  return selfJid;
}

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
    const jid = targetJid();
    await sock.sendMessage(jid, { text });
    log(`✅ أُرسلت رسالة الإشارات إلى ${jid}`);
    return { ok: true };
  } catch (e) {
    log(`❌ خطأ أثناء الإرسال: ${e?.message ?? e}`);
    return { ok: false, detail: String(e?.message ?? e) };
  }
}

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

// ---------- صفحة الحالة المحلية ----------
createServer(async (req, res) => {
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
         <p>الإرسال المجدول: ${SEND_TIME} أيام (${SEND_DAYS.join(",")}) إلى ${SEND_TO === "self" ? "حسابك نفسه" : SEND_TO}</p>`
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
