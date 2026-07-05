// فهرس شركات السوق السعودي الرئيسي (تداول) — الرمز والاسمان العربي والإنجليزي.
// الغرض: البحث بالعربية (ياهو لا يعرف «أرامكو») وعرض الأسماء العربية في
// الواجهات والرسائل. قائمة يدوية لأشهر الشركات — الرموز غير المدرجة هنا
// تبقى تعمل بأسمائها الإنجليزية من ياهو، فالفهرس تحسين وليس شرطاً.
//
// ملاحظة صيانة: عند إدراجات جديدة كبيرة في تداول أضف سطراً هنا.

export interface SaudiCompany {
  /** الرمز الرقمي بلا لاحقة (مثال: 2222) */
  code: string;
  nameAr: string;
  nameEn: string;
}

export const SAUDI_COMPANIES: SaudiCompany[] = [
  // — الطاقة والبتروكيماويات —
  { code: "2222", nameAr: "أرامكو السعودية", nameEn: "Saudi Aramco" },
  { code: "2010", nameAr: "سابك", nameEn: "SABIC" },
  { code: "2020", nameAr: "سابك للمغذيات الزراعية", nameEn: "SABIC Agri-Nutrients" },
  { code: "2310", nameAr: "سبكيم", nameEn: "Sipchem" },
  { code: "2350", nameAr: "كيان السعودية", nameEn: "Saudi Kayan" },
  { code: "2290", nameAr: "ينساب", nameEn: "Yansab" },
  { code: "2330", nameAr: "المتقدمة", nameEn: "Advanced Petrochemical" },
  { code: "2060", nameAr: "التصنيع الوطنية", nameEn: "Tasnee" },
  { code: "2380", nameAr: "بترو رابغ", nameEn: "Petro Rabigh" },
  { code: "2223", nameAr: "لوبريف", nameEn: "Luberef" },
  { code: "2381", nameAr: "الحفر العربية", nameEn: "Arabian Drilling" },
  { code: "2382", nameAr: "أديس القابضة", nameEn: "ADES Holding" },
  { code: "2250", nameAr: "المجموعة السعودية للاستثمار الصناعي", nameEn: "SIIG" },
  { code: "2170", nameAr: "اللجين القابضة", nameEn: "Alujain" },
  { code: "2210", nameAr: "نماء للكيماويات", nameEn: "Nama Chemicals" },
  { code: "2001", nameAr: "كيمانول", nameEn: "Chemanol" },
  { code: "2080", nameAr: "الغاز والتصنيع الأهلية", nameEn: "GASCO" },
  { code: "5110", nameAr: "الكهرباء السعودية", nameEn: "Saudi Electricity" },
  { code: "2082", nameAr: "أكوا باور", nameEn: "ACWA Power" },
  { code: "4082", nameAr: "مرافق", nameEn: "MARAFIQ" },
  { code: "1211", nameAr: "معادن", nameEn: "Ma'aden" },

  // — البنوك والتمويل —
  { code: "1120", nameAr: "مصرف الراجحي", nameEn: "Al Rajhi Bank" },
  { code: "1180", nameAr: "البنك الأهلي السعودي", nameEn: "Saudi National Bank" },
  { code: "1010", nameAr: "بنك الرياض", nameEn: "Riyad Bank" },
  { code: "1150", nameAr: "مصرف الإنماء", nameEn: "Alinma Bank" },
  { code: "1060", nameAr: "البنك السعودي الأول (ساب)", nameEn: "SAB" },
  { code: "1080", nameAr: "البنك العربي الوطني", nameEn: "Arab National Bank" },
  { code: "1050", nameAr: "بنك الجزيرة", nameEn: "Bank AlJazira" },
  { code: "1030", nameAr: "البنك السعودي للاستثمار", nameEn: "SAIB" },
  { code: "1140", nameAr: "بنك البلاد", nameEn: "Bank Albilad" },
  { code: "1111", nameAr: "مجموعة تداول السعودية", nameEn: "Saudi Tadawul Group" },
  { code: "1182", nameAr: "أملاك العالمية", nameEn: "Amlak International" },
  { code: "1183", nameAr: "سهل", nameEn: "SHL Finance" },
  { code: "4081", nameAr: "النايفات للتمويل", nameEn: "Nayifat Finance" },

  // — الاتصالات والتقنية —
  { code: "7010", nameAr: "إس تي سي", nameEn: "stc" },
  { code: "7020", nameAr: "موبايلي (اتحاد اتصالات)", nameEn: "Mobily" },
  { code: "7030", nameAr: "زين السعودية", nameEn: "Zain KSA" },
  { code: "7040", nameAr: "اتصالات عذيب (جو)", nameEn: "Etihad Atheeb (GO)" },
  { code: "7202", nameAr: "سلوشنز (حلول إس تي سي)", nameEn: "solutions by stc" },
  { code: "7203", nameAr: "علم", nameEn: "Elm" },
  { code: "7200", nameAr: "إم آي إس (المعمر)", nameEn: "Al Moammar (MIS)" },

  // — الأغذية والتجزئة —
  { code: "2280", nameAr: "المراعي", nameEn: "Almarai" },
  { code: "2050", nameAr: "مجموعة صافولا", nameEn: "Savola Group" },
  { code: "2270", nameAr: "سدافكو", nameEn: "SADAFCO" },
  { code: "6010", nameAr: "نادك", nameEn: "NADEC" },
  { code: "6001", nameAr: "حلواني إخوان", nameEn: "Halwani Bros" },
  { code: "6004", nameAr: "كاتريون (التموين)", nameEn: "CATRION" },
  { code: "4001", nameAr: "أسواق عبدالله العثيم", nameEn: "Al Othaim Markets" },
  { code: "4161", nameAr: "بن داود القابضة", nameEn: "BinDawood Holding" },
  { code: "4190", nameAr: "جرير للتسويق", nameEn: "Jarir Marketing" },
  { code: "4003", nameAr: "إكسترا", nameEn: "eXtra" },
  { code: "4050", nameAr: "ساسكو", nameEn: "SASCO" },
  { code: "4200", nameAr: "الدريس للخدمات البترولية", nameEn: "Aldrees Petroleum" },
  { code: "4240", nameAr: "سينومي ريتيل (الحكير)", nameEn: "Cenomi Retail" },
  { code: "4180", nameAr: "مجموعة فتيحي", nameEn: "Fitaihi Group" },

  // — الصحة والتعليم —
  { code: "4013", nameAr: "مستشفى د. سليمان الحبيب", nameEn: "Dr. Sulaiman Al Habib" },
  { code: "4164", nameAr: "صيدليات النهدي", nameEn: "Nahdi Medical" },
  { code: "4002", nameAr: "المواساة للخدمات الطبية", nameEn: "Mouwasat Medical" },
  { code: "4004", nameAr: "دلة الصحية", nameEn: "Dallah Health" },
  { code: "4005", nameAr: "رعاية (الرعاية الطبية)", nameEn: "Care (NMCC)" },
  { code: "4007", nameAr: "الحمادي القابضة", nameEn: "Al Hammadi Holding" },
  { code: "8210", nameAr: "بوبا العربية", nameEn: "Bupa Arabia" },
  { code: "4292", nameAr: "عطاء التعليمية", nameEn: "ATAA Educational" },
  { code: "4291", nameAr: "الوطنية للتعليم", nameEn: "National Co. for Learning" },

  // — التأمين —
  { code: "8010", nameAr: "التعاونية للتأمين", nameEn: "Tawuniya" },
  { code: "8030", nameAr: "ميدغلف للتأمين", nameEn: "MEDGULF" },
  { code: "8230", nameAr: "تكافل الراجحي", nameEn: "Al Rajhi Takaful" },

  // — العقار والتطوير —
  { code: "4300", nameAr: "دار الأركان", nameEn: "Dar Al Arkan" },
  { code: "4250", nameAr: "جبل عمر", nameEn: "Jabal Omar" },
  { code: "4220", nameAr: "إعمار المدينة الاقتصادية", nameEn: "Emaar The Economic City" },
  { code: "4100", nameAr: "مكة للإنشاء والتعمير", nameEn: "Makkah Construction" },
  { code: "4090", nameAr: "طيبة للاستثمار", nameEn: "Taiba Investments" },
  { code: "4020", nameAr: "الرياض للتعمير", nameEn: "Arriyadh Development" },
  { code: "6060", nameAr: "الشرقية للتنمية", nameEn: "Ash-Sharqiyah Development" },
  { code: "4321", nameAr: "سينومي سنترز (المراكز العربية)", nameEn: "Cenomi Centers" },

  // — الأسمنت ومواد البناء —
  { code: "3010", nameAr: "أسمنت العربية", nameEn: "Arabian Cement" },
  { code: "3020", nameAr: "أسمنت اليمامة", nameEn: "Yamama Cement" },
  { code: "3030", nameAr: "أسمنت السعودية", nameEn: "Saudi Cement" },
  { code: "3040", nameAr: "أسمنت القصيم", nameEn: "Qassim Cement" },
  { code: "3050", nameAr: "أسمنت المنطقة الجنوبية", nameEn: "Southern Province Cement" },
  { code: "3060", nameAr: "أسمنت ينبع", nameEn: "Yanbu Cement" },
  { code: "3080", nameAr: "أسمنت المنطقة الشرقية", nameEn: "Eastern Province Cement" },
  { code: "3090", nameAr: "أسمنت تبوك", nameEn: "Tabuk Cement" },
  { code: "2040", nameAr: "الخزف السعودي", nameEn: "Saudi Ceramics" },
  { code: "1304", nameAr: "اليمامة للصناعات الحديدية", nameEn: "Al Yamamah Steel" },
  { code: "1320", nameAr: "الأنابيب السعودية", nameEn: "Saudi Steel Pipe" },
  { code: "2110", nameAr: "الكابلات السعودية", nameEn: "Saudi Cable" },
  { code: "4142", nameAr: "مجموعة كابلات الرياض", nameEn: "Riyadh Cables Group" },

  // — النقل والخدمات —
  { code: "4030", nameAr: "البحري", nameEn: "Bahri" },
  { code: "4031", nameAr: "الخدمات الأرضية السعودية", nameEn: "Saudi Ground Services" },
  { code: "4260", nameAr: "بدجت السعودية", nameEn: "Budget Saudi" },
  { code: "4261", nameAr: "ذيب لتأجير السيارات", nameEn: "Theeb Rent a Car" },
  { code: "1810", nameAr: "سيرا القابضة", nameEn: "Seera Group" },
  { code: "1830", nameAr: "وقت اللياقة", nameEn: "Leejam Sports" },
  { code: "1831", nameAr: "مهارة للموارد البشرية", nameEn: "Maharah HR" },
  { code: "4210", nameAr: "المجموعة السعودية للأبحاث والإعلام", nameEn: "SRMG" },
  { code: "4071", nameAr: "العربية لخدمات الإعلان الخارجي", nameEn: "Al Arabia (Outdoor)" },
  { code: "2190", nameAr: "سيسكو القابضة", nameEn: "SISCO Holding" },
];

const byCode = new Map(SAUDI_COMPANIES.map((c) => [c.code, c]));

/** الاسم العربي لرمز تداول («2222» أو «2222.SR») — null إن لم يكن في الفهرس */
export function saudiNameAr(ticker: string): string | null {
  const code = ticker.toUpperCase().replace(/\.SR$/, "");
  return byCode.get(code)?.nameAr ?? null;
}

/** تطبيع عربي للبحث: توحيد الهمزات والتاء المربوطة وحذف التشكيل وأل التعريف */
function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ْٰ]/g, "") // تشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .replace(/\s+ال/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * بحث محلي في شركات تداول: بالرمز الرقمي (بادئة) أو بالاسم العربي
 * (مع تطبيع الهمزات) أو الإنجليزي.
 */
export function searchSaudi(query: string, limit = 6): SaudiCompany[] {
  const q = query.trim();
  if (q.length === 0) return [];

  // رمز رقمي: مطابقة بادئة
  if (/^\d{1,4}$/.test(q)) {
    return SAUDI_COMPANIES.filter((c) => c.code.startsWith(q)).slice(0, limit);
  }

  const qn = normalizeAr(q);
  if (qn.length < 2) return [];
  const qe = q.toLowerCase();

  const scored: Array<{ c: SaudiCompany; score: number }> = [];
  for (const c of SAUDI_COMPANIES) {
    const ar = normalizeAr(c.nameAr);
    const en = c.nameEn.toLowerCase();
    let score = 0;
    // مطابقة على بدايات الكلمات فقط — «ابل» يجب ألا تطابق «كابلات»
    if (ar.startsWith(qn) || en.startsWith(qe)) score = 2;
    else if (
      ar.split(/\s+/).some((w) => w.startsWith(qn)) ||
      en.split(/\s+/).some((w) => w.startsWith(qe))
    ) {
      score = 1;
    }
    if (score > 0) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.c);
}
