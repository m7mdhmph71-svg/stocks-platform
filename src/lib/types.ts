// ============================================================
// العقد المركزي للأنواع — كل الوحدات تعتمد على هذا الملف
// Central type contract — all modules depend on this file.
// ============================================================

/** شمعة سعرية يومية */
export interface Candle {
  /** Unix seconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** صف سهم مُوحَّد بعد جلبه من أي مزوّد بيانات */
export interface StockRow {
  ticker: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;

  price: number;
  /** نسبة التغير عن إغلاق الأمس % */
  changePercent: number | null;
  /** نسبة التغير عن افتتاح اليوم % */
  changeFromOpenPercent: number | null;

  volume: number | null;
  /** متوسط حجم التداول 3 أشهر */
  avgVolume3m: number | null;
  /** الحجم النسبي = الحجم الحالي / المتوسط */
  relativeVolume: number | null;

  marketCap: number | null;
  /** الأسهم الحرة (عدد الأسهم) */
  floatShares: number | null;
  sharesOutstanding: number | null;

  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;

  /** أداء أسبوع % (٥ جلسات) — يُملأ من بيانات التاريخ عند توفرها */
  weekPerfPercent: number | null;

  /** يُملآن عند الإثراء */
  shariah: ShariahResult | null;
  targets: TargetsResult | null;
}

// ------------------------------------------------------------
// الفحص الشرعي (منهجية معايير AAOIFI — تقديري)
// ------------------------------------------------------------

export type ShariahVerdict =
  | "COMPLIANT" // متوافق
  | "MIXED" // مختلط — يجوز مع التطهير عند بعض أهل العلم
  | "NON_COMPLIANT" // غير متوافق
  | "UNKNOWN"; // بيانات غير كافية

export type ShariahRatioKey = "debt" | "interestSecurities" | "impureIncome";

export interface ShariahRatio {
  key: ShariahRatioKey;
  labelAr: string;
  /** القيمة % (0-100) أو null إذا غابت البيانات */
  value: number | null;
  /** الحد الأقصى المسموح % */
  limit: number;
  pass: boolean | null;
  /** شرح مختصر بالعربية لطريقة الحساب */
  detailAr: string;
}

export interface ShariahResult {
  verdict: ShariahVerdict;
  verdictAr: string;
  /** هل النشاط الأساسي مباح؟ */
  businessCompliant: boolean | null;
  businessReasonAr: string | null;
  ratios: ShariahRatio[];
  /**
   * نسبة التطهير: الدخل غير المباح ÷ إجمالي الإيراد (٪).
   * يُطهَّر بها من الأرباح الموزعة/الرأسمالية بحسب المنهج المتَّبع.
   */
  purificationRatio: number | null;
  /** مبلغ التطهير التقديري لكل سهم سنوياً بالدولار */
  purificationPerShare: number | null;
  methodologyAr: string;
  /** تاريخ آخر بيانات مالية استُخدمت */
  asOf: string | null;
}

// ------------------------------------------------------------
// الأهداف والتوقعات
// ------------------------------------------------------------

/** الاستراتيجيات: الثلاث الأصلية + «الاتجاه الصاعد» (منهج القوة الموثق) */
export type StrategyKey = "liquidity" | "momentum" | "longterm" | "trend";

export type Trend = "UP" | "DOWN" | "SIDEWAYS";

export interface TargetLevel {
  label: string; // "الهدف الأول" ...
  price: number;
  /** النسبة من السعر الحالي % */
  percent: number;
  /** الأساس الفني للهدف بالعربية */
  basisAr: string;
}

export interface TechnicalSnapshot {
  rsi14: number | null;
  atr14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  high50d: number | null;
  low50d: number | null;
  high52w: number | null;
  low52w: number | null;
  pivot: {
    p: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  } | null;
  /**
   * قيعان متأرجحة حديثة (fractal: قاع أدنى من جيرانه) بترتيب زمني تصاعدي —
   * أساس أوقاف «بنية السوق»: السوق يحترم القيعان الفعلية لا المعادلات.
   */
  swingLows: number[];
  /** قمم متأرجحة حديثة بترتيب زمني تصاعدي — مقاومات فعلية لأهداف بنية السوق */
  swingHighs: number[];
  weekPerfPercent: number | null;
  monthPerfPercent: number | null;
}

export interface TargetsResult {
  strategy: StrategyKey;
  strategyAr: string;
  /** سعر الدخول المرجعي (السعر الحالي) */
  entry: number;
  stopLoss: number | null;
  stopLossBasisAr: string | null;
  targets: TargetLevel[];
  /** نسبة العائد/المخاطرة عند الهدف الأول */
  riskReward: number | null;
  trend: Trend | null;
  trendAr: string | null;
  /** درجة الفرصة 0-100 */
  score: number | null;
  /** نص التوقع بالعربية (آلي — ليس توصية) */
  expectationAr: string;
  indicators: TechnicalSnapshot;
}

// ------------------------------------------------------------
// الفلاتر
// ------------------------------------------------------------

/** الحقول القابلة للفلترة محلياً على StockRow (بعد الإثراء الفني) */
export type FilterField =
  | "price"
  | "volume"
  | "avgVolume3m"
  | "relativeVolume"
  | "floatShares"
  | "marketCap"
  | "changePercent"
  | "changeFromOpenPercent"
  | "weekPerfPercent";

export type FilterOp = "gt" | "lt" | "gte" | "lte" | "btwn";

export interface FilterCondition {
  field: FilterField;
  op: FilterOp;
  /** رقم واحد أو [أدنى, أعلى] عند btwn */
  value: number | [number, number];
  /** null في الحقل = لا يجتاز الشرط */
}

/** شرح رمز فلتر Finviz كما قدّمه المستخدم */
export interface FilterLegendItem {
  code: string;
  meaningAr: string;
}

export interface ScreenerPreset {
  key: StrategyKey;
  nameAr: string;
  taglineAr: string;
  descriptionAr: string;
  /** سلسلة فلاتر Finviz الأصلية f=... */
  finvizQuery: string;
  legend: FilterLegendItem[];
  /** الشروط القابلة للتطبيق محلياً على بيانات Yahoo */
  conditions: FilterCondition[];
  /**
   * شروط إضافية تُقيَّم بعد الإثراء الفني (تخص longterm غالباً):
   * تُنفَّذ داخل محرك الفرز وليست FilterCondition عادية.
   */
  advancedNotesAr: string[];
}

// ------------------------------------------------------------
// استجابات الـ API
// ------------------------------------------------------------

export type DataSource = "yahoo" | "finviz" | "demo";

/** مفاتيح تبويبات الفرز: الاستراتيجيات الثلاث + السوق السعودي + المخصص */
export type ScreenerPresetKey = StrategyKey | "saudi" | "custom";

export interface ScreenerResponse {
  preset: ScreenerPresetKey;
  source: DataSource;
  /** ISO timestamp */
  asOf: string;
  total: number;
  rows: StockRow[];
  notesAr: string[];
}

export interface StockDetailResponse {
  source: DataSource;
  asOf: string;
  row: StockRow;
  /** آخر ~260 شمعة يومية للرسم */
  candles: Candle[];
  /** أهداف لكل استراتيجية */
  targetsByStrategy: Record<StrategyKey, TargetsResult>;
  /** متوسط هدف المحللين إن توفر */
  analystTargetMean: number | null;
  analystRecommendation: string | null;
  notesAr: string[];
}

// ------------------------------------------------------------
// المدخلات الخام من مزوّد البيانات (يوحّدها كل مزوّد)
// ------------------------------------------------------------

/** بيانات مالية خام لازمة للفحص الشرعي وفلتر الاستثمار */
export interface Fundamentals {
  ticker: string;
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
  marketCap: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  shortTermInvestments: number | null;
  longTermInvestments: number | null;
  totalRevenue: number | null;
  interestIncome: number | null;
  interestExpense: number | null;
  netIncome: number | null;
  sharesOutstanding: number | null;
  floatShares: number | null;
  /** متوسط هدف المحللين */
  targetMeanPrice: number | null;
  recommendationKey: string | null;

  // — نسب لازمة لفلتر الاستثمار طويل المدى —
  /** نسبة التداول (الأصول المتداولة/الخصوم المتداولة) */
  currentRatio: number | null;
  /** الدين/حقوق الملكية (نسبة، مثال 0.45) */
  debtToEquity: number | null;
  /** هامش الربح الإجمالي (نسبة 0-1) */
  grossMargins: number | null;
  /** العائد على حقوق الملكية (نسبة 0-1) — أقرب متاح لـ ROI */
  returnOnEquity: number | null;
  /** مكرر الربحية الحالي */
  trailingPE: number | null;
  /** نمو الربحية المتوقع للسنة القادمة (نسبة 0-1) إن توفر */
  epsGrowthNextYear: number | null;
  /** نمو الربحية سنوي (ربع/سنة مقارنة بمثيلتها، نسبة 0-1) */
  earningsGrowthYoY: number | null;
  /** تاريخ الإيرادات السنوية (الأقدم أولاً، حتى ٤ سنوات من ياهو) */
  revenueHistory: number[];
  /** تاريخ صافي الدخل السنوي (الأقدم أولاً) */
  netIncomeHistory: number[];

  /** تاريخ آخر ميزانية/قوائم */
  asOf: string | null;
}
