/**
 * Menu-level translations for the cabinet (English, Japanese, Hindi).
 *
 * Scope: the attract screen, the main menu card, the top bar, result actions and
 * the control hint. In-run HUD call-outs, combo names, panels (combos, notes,
 * settings) and the Street School script stay English for now.
 * Brand and mode names (MOSS STOMPER, THE LONG WAY HOME, STREET STRUT,
 * RHYTHM ROYALTY, MOSSQUAKE) are never translated.
 */
export type Lang = "en" | "ja" | "hi";
export const LANGS: readonly Lang[] = ["en", "ja", "hi"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", ja: "日本語", hi: "हिन्दी" };
/** English name shown under each native label, so anyone can find their way back. */
/** Names in the language menu: each in its own script. */
export const LANG_NATIVE: Record<Lang, string> = { en: "English", ja: "日本語", hi: "हिन्दी" };
export const LANG_ENGLISH: Record<Lang, string> = { en: "English", ja: "Japanese", hi: "Hindi" };
/** Always multilingual: readable whichever language the cabinet is stuck in. */
export const LANG_ARIA = "Language / 言語 / भाषा";
export const LANG_STORAGE_KEY = "moss-stomper-lang";

export type MenuCopy = {
  tapToStart: string;
  anyKey: string;
  loading: (pct: number) => string;
  eyebrow: string;
  tagline: string;
  routeSub: string;
  strutSub: string;
  best: string;
  playGroup: string;
  moreGroup: string;
  school: string;
  schoolSr: string;
  practice: string;
  combos: string;
  stages: string;
  lab: string;
  notes: string;
  settings: string;
  settingsSr: string;
  hold: string;
  go: string;
  exit: string;
  sound: string;
  muted: string;
  mute: string;
  unmute: string;
  full: string;
  back: string;
  runItBack: string;
  cabinet: string;
  stride: string;
  stomp: string;
  style: string;
  builtIn: string;
  language: string;
};

export const MENU_COPY: Record<Lang, MenuCopy> = {
  en: {
    tapToStart: "TAP TO START",
    anyKey: "ANY KEY · ENTER · START ON A PAD",
    loading: (pct) => `Loading the block… ${pct}%`,
    eyebrow: "FRANKSTON AFTER HOURS / B$S ARCADE",
    tagline: "STRIDE. STOMP. ATTITUDE.",
    routeSub: "ONE ROUTE · YOUR BEST FOOTWORK",
    strutSub: "FREE PLAY · NO FINISH LINE",
    best: "BEST",
    playGroup: "Play",
    moreGroup: "More",
    school: "SCHOOL",
    schoolSr: " · replay the Street School tutorial",
    practice: "PRACTICE",
    combos: "COMBOS",
    stages: "STAGE CARDS",
    lab: "LAB",
    notes: "NOTES",
    settings: "SETTINGS",
    settingsSr: " · SOUND, SYNC & KEYS",
    hold: "HOLD",
    go: "GO",
    exit: "EXIT",
    sound: "SOUND",
    muted: "MUTED",
    mute: "Mute sound",
    unmute: "Sound muted. Unmute",
    full: "FULL",
    back: "BACK",
    runItBack: "RUN IT BACK",
    cabinet: "CABINET",
    stride: "STRIDE",
    stomp: "STOMP",
    style: "STYLE",
    builtIn: "BUILT IN FRANKSTON",
    language: "Language",
  },
  ja: {
    tapToStart: "タップしてスタート",
    anyKey: "どのキーでも · ENTER · パッドの START",
    loading: (pct) => `街を読み込み中… ${pct}%`,
    eyebrow: "真夜中のフランクストン / B$S アーケード",
    tagline: "歩け。踏み鳴らせ。キメろ。",
    routeSub: "一本道 · 最高のステップで",
    strutSub: "フリープレイ · ゴールなし",
    best: "ベスト",
    playGroup: "プレイ",
    moreGroup: "その他",
    school: "スクール",
    schoolSr: " · ストリート・スクールのチュートリアルをもう一度",
    practice: "練習",
    combos: "コンボ",
    stages: "ステージ",
    lab: "ラボ",
    notes: "メモ",
    settings: "設定",
    settingsSr: " · サウンド・同期・キー",
    hold: "一時停止",
    go: "再開",
    exit: "やめる",
    sound: "サウンド",
    muted: "ミュート中",
    mute: "サウンドをミュート",
    unmute: "ミュート中。ミュートを解除",
    full: "全画面",
    back: "戻る",
    runItBack: "もう一回",
    cabinet: "メニューへ",
    stride: "歩く",
    stomp: "踏む",
    style: "キメ",
    builtIn: "フランクストン生まれ",
    language: "言語",
  },
  hi: {
    tapToStart: "शुरू करने के लिए टैप करें",
    anyKey: "कोई भी की · ENTER · पैड पर START",
    loading: (pct) => `मोहल्ला लोड हो रहा है… ${pct}%`,
    eyebrow: "आधी रात का फ्रैंकस्टन / B$S आर्केड",
    tagline: "चलो। धमको। अंदाज़ दिखाओ।",
    routeSub: "एक रास्ता · आपका सबसे अच्छा फ़ुटवर्क",
    strutSub: "फ़्री प्ले · कोई फ़िनिश लाइन नहीं",
    best: "बेस्ट",
    playGroup: "खेलें",
    moreGroup: "और",
    school: "स्कूल",
    schoolSr: " · स्ट्रीट स्कूल ट्यूटोरियल फिर से चलाएँ",
    practice: "अभ्यास",
    combos: "कॉम्बो",
    stages: "स्टेज कार्ड",
    lab: "लैब",
    notes: "नोट्स",
    settings: "सेटिंग्स",
    settingsSr: " · साउंड, सिंक और कीज़",
    hold: "रुकें",
    go: "चलें",
    exit: "बाहर",
    sound: "साउंड",
    muted: "म्यूट",
    mute: "साउंड म्यूट करें",
    unmute: "साउंड म्यूट है। अनम्यूट करें",
    full: "फ़ुल स्क्रीन",
    back: "वापस",
    runItBack: "फिर से खेलें",
    cabinet: "मेन्यू",
    stride: "चाल",
    stomp: "धमक",
    style: "अंदाज़",
    builtIn: "फ्रैंकस्टन में बना",
    language: "भाषा",
  },
};

function isLang(value: string | null | undefined): value is Lang {
  return value === "en" || value === "ja" || value === "hi";
}

/** ?lang= wins, then the saved choice, then the browser language, then English. */
export function detectLang(
  search = typeof location === "undefined" ? "" : location.search,
  stored: string | null = safeGet(),
  browser: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language],
): Lang {
  const fromQuery = new URLSearchParams(search).get("lang");
  if (isLang(fromQuery)) return fromQuery;
  if (isLang(stored)) return stored;
  for (const tag of browser) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function safeGet(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode: the choice just lasts for this visit.
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
