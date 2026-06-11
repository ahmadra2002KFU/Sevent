/**
 * Bilingual (Arabic + English) article boilerplate for the booking contract.
 *
 * IMPORTANT — these are PLACEHOLDER clauses, not finalised legal text. Every
 * article whose `isPlaceholder` is true renders under a visible "pending legal
 * review" banner in the PDF. The wording is a reasonable Saudi-market default
 * intended to be reviewed and ratified by qualified legal counsel before this
 * document is relied upon. Article 6 (Dispute Resolution) deliberately refers
 * to an arbitration *body* — the Saudi Center for Commercial Arbitration
 * (SCCA) — and NOT to any named individual arbitrators.
 *
 * Articles 1–3 are data-driven framing: their bodies reference the Scope,
 * Price and Payment sections that the template renders from the quote
 * snapshot, so they are not flagged as placeholders.
 *
 * This text lives here (not in `messages/*.json`) on purpose: it is legal
 * document content that must be byte-stable and reviewed as a single unit,
 * distinct from the UI string catalogue.
 */

export type ArticleId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Article = {
  id: ArticleId;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  /** When true, the PDF renders a "pending legal review" banner above it. */
  isPlaceholder: boolean;
};

export const PLACEHOLDER_NOTICE_EN =
  "Draft clause — pending legal review.";
export const PLACEHOLDER_NOTICE_AR =
  "بند مبدئي — قيد المراجعة القانونية.";

export const ARTICLES: readonly Article[] = Object.freeze([
  {
    id: 1,
    title_en: "Article 1 — Scope of Work",
    title_ar: "المادة الأولى — نطاق العمل",
    body_en:
      "The Second Party shall provide the services and deliverables itemised in this agreement for the event described above, at the stated location and on the agreed date(s).",
    body_ar:
      "يلتزم الطرف الثاني بتقديم الخدمات والمخرجات المفصّلة في هذه الاتفاقية للفعالية الموضحة أعلاه، في المكان المحدد وبالتواريخ المتفق عليها.",
    isPlaceholder: false,
  },
  {
    id: 2,
    title_en: "Article 2 — Price",
    title_ar: "المادة الثانية — قيمة العقد",
    body_en:
      "The total price of the services is as set out in the Price section below, in Saudi Riyals (SAR). Unless stated otherwise, prices are exclusive of Value Added Tax (VAT), which is added at the statutory rate.",
    body_ar:
      "إجمالي قيمة الخدمات هو المبيّن في قسم القيمة أدناه بالريال السعودي. وما لم يُذكر خلاف ذلك، فإن الأسعار لا تشمل ضريبة القيمة المضافة، وتُضاف بالنسبة النظامية المقررة.",
    isPlaceholder: false,
  },
  {
    id: 3,
    title_en: "Article 3 — Payment Terms",
    title_ar: "المادة الثالثة — شروط الدفع",
    body_en:
      "Payment shall be made in accordance with the Payment section below, including any required advance or deposit. All amounts are payable to the Second Party.",
    body_ar:
      "يتم السداد وفقاً لما هو مبيّن في قسم الدفع أدناه، بما في ذلك أي دفعة مقدمة أو عربون مطلوب. وتُسدَّد جميع المبالغ لصالح الطرف الثاني.",
    isPlaceholder: false,
  },
  {
    id: 4,
    title_en: "Article 4 — Obligations of the Provider",
    title_ar: "المادة الرابعة — التزامات الطرف الثاني",
    body_en:
      "The Second Party undertakes to: (a) perform the work to high professional and quality standards; (b) adhere to the agreed delivery, installation and operation dates; (c) keep all equipment maintained and operational for the duration of the service; (d) provide qualified personnel for the event; and (e) bear its own artistic and operational costs without additional charge to the First Party.",
    body_ar:
      "يتعهد الطرف الثاني بما يلي: (أ) تنفيذ الأعمال وفق أعلى معايير الجودة والاحترافية؛ (ب) الالتزام بمواعيد التسليم والتركيب والتشغيل المتفق عليها؛ (ج) الحفاظ على جميع المعدات صالحة وجاهزة للعمل طوال مدة الخدمة؛ (د) توفير كوادر مؤهلة للفعالية؛ (هـ) تحمّل تكاليفه الفنية والتشغيلية دون أي رسوم إضافية على الطرف الأول.",
    isPlaceholder: true,
  },
  {
    id: 5,
    title_en: "Article 5 — Penalties",
    title_ar: "المادة الخامسة — الغرامات والتعويضات",
    body_en:
      "If the Second Party fails to perform, or delays, the agreed work, the First Party may deduct the value of the unexecuted portion, and the Second Party shall be liable for direct damages arising from such delay or failure.",
    body_ar:
      "في حال إخفاق الطرف الثاني في التنفيذ أو تأخره عن الأعمال المتفق عليها، يحق للطرف الأول خصم قيمة الجزء غير المنفَّذ، ويكون الطرف الثاني مسؤولاً عن الأضرار المباشرة الناتجة عن ذلك التأخير أو الإخفاق.",
    isPlaceholder: true,
  },
  {
    id: 6,
    title_en: "Article 6 — Dispute Resolution",
    title_ar: "المادة السادسة — تسوية النزاعات",
    body_en:
      "This agreement is governed by the laws of the Kingdom of Saudi Arabia and the principles of Islamic Sharia. Any dispute arising out of or relating to this agreement shall be settled by arbitration administered by the Saudi Center for Commercial Arbitration (SCCA) in Riyadh, in accordance with its rules.",
    body_ar:
      "تخضع هذه الاتفاقية لأنظمة المملكة العربية السعودية ومبادئ الشريعة الإسلامية. ويُسوّى أي نزاع ينشأ عنها أو يتصل بها عن طريق التحكيم لدى المركز السعودي للتحكيم التجاري في مدينة الرياض وفقاً للوائحه.",
    isPlaceholder: true,
  },
  {
    id: 7,
    title_en: "Article 7 — General Provisions",
    title_ar: "المادة السابعة — أحكام عامة",
    body_en:
      "This document is the binding reference between the parties. Any prior proposals or quotations are supplementary to it. No addition, deletion or amendment is valid unless agreed in writing by both parties.",
    body_ar:
      "تُعد هذه الوثيقة المرجع الملزم بين الطرفين، وتُعتبر أي عروض أو تسعيرات سابقة مكمّلة لها. ولا يُعتد بأي إضافة أو حذف أو تعديل ما لم يتم الاتفاق عليه كتابةً بين الطرفين.",
    isPlaceholder: true,
  },
]);
