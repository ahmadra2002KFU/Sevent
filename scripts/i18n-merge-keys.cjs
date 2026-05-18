/**
 * One-shot helper for the RFQ language-leakage sweep: deep-merges new
 * translation keys into src/messages/{en,ar}.json without disturbing existing
 * keys, key order, CRLF line endings, or 2-space indentation.
 *
 * Only ADDS keys that are missing — never overwrites an existing value. Run:
 *   node scripts/i18n-merge-keys.cjs
 */
const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.join(__dirname, "..", "src", "messages");

// ---------------------------------------------------------------------------
// New keys for Stage 0 — shared enum/value maps consumed across the RFQ surface.
// ---------------------------------------------------------------------------
const ADDITIONS = {
  en: {
    pagination: { ariaLabel: "Pagination" },
    admin: {
      rfqs: {
        status: { pending: "Pending" },
        filter: { pending: "Pending" },
      },
    },
    rfqRequirements: {
      unknownKind:
        "These requirements use a format this view doesn't recognize.",
      noStructuredRequirements: "No structured requirements were provided.",
      yes: "Yes",
      no: "No",
      field: {
        kind: "Category type",
        seating_style: "Seating style",
        indoor_outdoor: "Indoor / outdoor",
        needs_parking: "Parking needed",
        needs_kitchen: "Kitchen needed",
        meal_type: "Meal type",
        dietary: "Dietary requirements",
        service_style: "Service style",
        coverage_hours: "Coverage hours",
        deliverables: "Deliverables",
        crew_size: "Crew size",
        qty: "Quantity",
        notes: "Notes",
      },
    },
    supplier: {
      rfqInbox: {
        fallbackCategoryLabel: "RFQ",
        quoteCorrupt:
          "This quote's data is corrupt — please re-send your quote.",
      },
      quote: {
        removeLineItemAriaLabel: "Remove line item",
        errors: {
          positiveAmountRequired:
            "Enter a positive SAR amount (up to 2 decimals).",
          requiredField: "This field is required.",
          supplierProfileNotFound: "Supplier profile not found.",
          invalidSubmission:
            "Some fields are missing or invalid. Please review the highlighted fields and try again.",
          technicalProposalTooLarge:
            "Technical proposal must be 10 MB or smaller.",
          technicalProposalNotPdf: "Technical proposal must be a PDF.",
          supplierMismatch:
            "You are not allowed to quote for this supplier.",
          inviteLookupFailed:
            "We couldn't verify your invite. Please try again.",
          rfqNotOpen: "This RFQ is no longer open for quoting.",
          rfqLookupFailed:
            "We couldn't load this RFQ. Please try again.",
          rfqOrEventNotFound: "RFQ or linked event not found.",
          quoteNotEditable:
            "This quote can no longer be edited because it has reached a final state.",
          packageRequired:
            "Rule-engine quotes require a package selection.",
          packageLookupFailed:
            "We couldn't load the selected package. Please try again.",
          packageNotFound: "Package not found for this supplier.",
          packageInactive: "The selected package is inactive.",
          rulesLookupFailed:
            "We couldn't load your pricing rules. Please try again.",
          rpcNoRow: "The quote was not saved. Please try again.",
          rpcFailed:
            "We couldn't save this quote. Please try again.",
          unknown: "Something went wrong. Please try again.",
        },
      },
      proposalUpload: {
        errors: {
          supplierProfileNotFound: "Supplier profile not found.",
          invalidRequest: "Invalid request.",
          fileRequired: "Please choose a PDF to upload.",
          fileTooLarge: "File must be 10 MB or smaller.",
          fileNotPdf: "File must be a PDF.",
          inviteNotFound: "Invite not found.",
          quoteRequired:
            "You haven't submitted a quote yet for this RFQ — submit one first.",
          noActiveRequest:
            "There is no active proposal request for this quote.",
          uploadFailed: "Upload failed. Please try again.",
          saveFailed:
            "We couldn't save your proposal. Please try again.",
          requestNoLongerPending:
            "This proposal request is no longer pending. Please refresh and try again.",
        },
      },
      decline: {
        errors: {
          invalidSubmission: "Invalid decline submission.",
          supplierProfileNotFound: "Supplier profile not found.",
          declineFailed:
            "We couldn't record your decline. Please try again.",
        },
      },
    },
    requirementValues: {
      kind: {
        venues: "Venue",
        catering: "Catering",
        photography: "Photography",
        generic: "General",
      },
      seating_style: {
        rounds: "Round tables",
        theatre: "Theatre",
        classroom: "Classroom",
        cocktail: "Cocktail",
        majlis: "Majlis",
      },
      indoor_outdoor: {
        indoor: "Indoor",
        outdoor: "Outdoor",
        either: "Indoor or outdoor",
      },
      meal_type: {
        buffet: "Buffet",
        plated: "Plated service",
        coffee_break: "Coffee break",
        cocktail: "Cocktail reception",
      },
      dietary: {
        halal_only: "Halal only",
        vegetarian: "Vegetarian",
        vegan: "Vegan",
        gluten_free: "Gluten-free",
        nut_free: "Nut-free",
      },
      service_style: {
        self_serve: "Self-serve",
        served: "Full service",
        mixed: "Mixed",
      },
      deliverables: {
        photos: "Photos",
        video: "Video",
        drone: "Drone footage",
        same_day_edit: "Same-day edit",
        printed_album: "Printed album",
      },
    },
    lineItemKind: {
      package: "Package",
      qty_discount: "Quantity discount",
      date_surcharge: "Date surcharge",
      distance_fee: "Distance fee",
      duration_multiplier: "Duration adjustment",
      free_form: "Custom item",
    },
    quoteStatus: {
      draft: "Draft",
      sent: "Sent",
      accepted: "Accepted",
      rejected: "Rejected",
      expired: "Expired",
      withdrawn: "Withdrawn",
    },
    bookingStatus: {
      confirmation: {
        awaiting_supplier: "Awaiting supplier",
        confirmed: "Confirmed",
        cancelled: "Cancelled",
      },
      payment: {
        unpaid: "Unpaid",
        deposit_paid: "Deposit paid",
        balance_paid: "Balance paid",
        paid: "Paid in full",
      },
      service: {
        scheduled: "Scheduled",
        in_progress: "In progress",
        completed: "Completed",
        disputed: "Disputed",
      },
    },
    organizer: {
      rfqWizard: {
        errors: {
          invalidSubmission: "Invalid RFQ submission.",
          invalidRequirements: "Invalid requirements payload.",
          forbidden: "You don't have permission to send this RFQ.",
          invalidDeadline:
            "Invalid response deadline — choose 24h, 48h, or 72h.",
          inviteListMalformed: "The invite list is malformed.",
          shortlistEmpty:
            "Shortlist is empty — pick at least one supplier.",
          shortlistTooLarge:
            "Too many suppliers on the shortlist (max 20).",
          eventNotFound: "Event not found or not accessible.",
          invalidInviteSource:
            "Invalid invite source in the shortlist.",
          rfqCreateNoId: "RFQ creation returned no id. Please try again.",
          unknown: "We couldn't send the RFQ. Please try again.",
        },
      },
      rfqs: {
        source: {
          self_applied: "Applied via marketplace",
          unknown: "Unknown source",
        },
        titleFallback: "RFQ",
        declineReason: {
          too_busy: "Supplier is fully booked",
          out_of_area: "Outside service area",
          price_mismatch: "Budget mismatch",
          other: "Other",
          unknown: "Not specified",
        },
        // I-24: parity with admin.rfqs.status — `pending` is a code-level
        // fallback for any out-of-enum DB value so the organizer surface never
        // shows an untranslated raw slug if the DB enum is later widened.
        status: {
          pending: "Pending",
        },
      },
      shortlist: {
        reasons: {
          offersInCategory: "Offers packages in this category",
          newToSevent: "New to Sevent",
        },
      },
      quote: {
        quoteCorrupt:
          "This quote's data is corrupt — ask the supplier to re-send.",
        totalsHeading: "Totals",
        vatWithRate: "VAT ({pct}%)",
        rfpErrors: {
          invalidRequest: "Invalid request.",
          quoteNotFound: "Quote not found.",
          organizerMismatch: "You are not the organizer of this RFQ.",
          alreadyPending:
            "A proposal request is already pending for this supplier.",
          sendFailed:
            "We couldn't send the request. Please try again.",
          requestNotFound: "Request not found.",
          requestNotPending: "This request is no longer pending.",
          cancelFailed:
            "We couldn't cancel the request. Please try again.",
          cancelRaced:
            "This request is no longer pending. Please refresh.",
        },
        compare: {
          conflictMark: "⚠ Conflict",
        },
        csv: {
          criterion: "Criterion",
          location: "Location",
          inviteSource: "Invite source",
          dateConflict: "Date conflict",
          total: "Total (SAR)",
          subtotal: "Subtotal (SAR)",
          setupFee: "Setup fee (SAR)",
          travelFee: "Travel fee (SAR)",
          teardownFee: "Teardown fee (SAR)",
          vatPct: "VAT %",
          vatAmount: "VAT amount (SAR)",
          depositPct: "Deposit %",
          paymentSchedule: "Payment schedule",
          cancellation: "Cancellation",
          inclusions: "Inclusions",
          exclusions: "Exclusions",
          lineItems: "Line items",
          notes: "Notes",
          expires: "Expires",
          submitted: "Submitted",
          techProposal: "Technical proposal",
          rfpStatus: "Proposal request status",
          verified: "(verified)",
          yes: "yes",
          no: "no",
          attached: "attached",
          truncatedSuffix:
            "… ({count} items truncated; open in app for full)",
          lineItem: "{label} (qty {qty}, {unitPrice}/u, total {total})",
          source: {
            self_applied: "Applied via marketplace",
            auto_match: "Auto-matched",
            organizer_picked: "Organizer-picked",
          },
          rfp: {
            requested: "Requested",
            fulfilled: "Fulfilled",
            cancelled: "Cancelled",
          },
        },
      },
    },
  },
  ar: {
    pagination: { ariaLabel: "ترقيم الصفحات" },
    admin: {
      rfqs: {
        status: { pending: "قيد الانتظار" },
        filter: { pending: "قيد الانتظار" },
      },
    },
    rfqRequirements: {
      unknownKind: "هذه المتطلبات بصيغة لا تتعرّف عليها هذه الواجهة.",
      noStructuredRequirements: "لم تُقدَّم متطلبات منظَّمة.",
      yes: "نعم",
      no: "لا",
      field: {
        kind: "نوع الفئة",
        seating_style: "نمط الجلوس",
        indoor_outdoor: "داخلي / خارجي",
        needs_parking: "يلزم موقف سيارات",
        needs_kitchen: "يلزم مطبخ",
        meal_type: "نوع الوجبة",
        dietary: "المتطلبات الغذائية",
        service_style: "نمط الخدمة",
        coverage_hours: "ساعات التغطية",
        deliverables: "المُخرجات",
        crew_size: "عدد أفراد الطاقم",
        qty: "الكمية",
        notes: "ملاحظات",
      },
    },
    supplier: {
      rfqInbox: {
        fallbackCategoryLabel: "طلب عرض سعر",
        quoteCorrupt:
          "بيانات هذا العرض تالفة — يرجى إعادة إرسال عرضك.",
      },
      quote: {
        removeLineItemAriaLabel: "إزالة البند",
        errors: {
          positiveAmountRequired:
            "أدخل مبلغاً موجباً بالريال (حتى منزلتين عشريتين).",
          requiredField: "هذا الحقل مطلوب.",
          supplierProfileNotFound: "لم يُعثر على ملف المورّد.",
          invalidSubmission:
            "بعض الحقول ناقصة أو غير صحيحة. راجع الحقول المميّزة وحاول مرة أخرى.",
          technicalProposalTooLarge:
            "يجب ألّا يتجاوز حجم العرض الفني 10 ميغابايت.",
          technicalProposalNotPdf:
            "يجب أن يكون العرض الفني بصيغة PDF.",
          supplierMismatch: "لا يُسمح لك بتقديم عرض نيابة عن هذا المورّد.",
          inviteLookupFailed:
            "تعذّر التحقق من دعوتك. حاول مرة أخرى.",
          rfqNotOpen: "لم يعد طلب السعر هذا مفتوحاً للتسعير.",
          rfqLookupFailed:
            "تعذّر تحميل طلب السعر هذا. حاول مرة أخرى.",
          rfqOrEventNotFound: "لم يُعثر على طلب السعر أو الفعالية المرتبطة به.",
          quoteNotEditable:
            "لم يعد بالإمكان تعديل هذا العرض لأنه بلغ حالة نهائية.",
          packageRequired:
            "تتطلّب عروض محرّك القواعد اختيار باقة.",
          packageLookupFailed:
            "تعذّر تحميل الباقة المختارة. حاول مرة أخرى.",
          packageNotFound: "لم يُعثر على الباقة لهذا المورّد.",
          packageInactive: "الباقة المختارة غير مفعّلة.",
          rulesLookupFailed:
            "تعذّر تحميل قواعد التسعير الخاصة بك. حاول مرة أخرى.",
          rpcNoRow: "لم يُحفظ العرض. حاول مرة أخرى.",
          rpcFailed: "تعذّر حفظ هذا العرض. حاول مرة أخرى.",
          unknown: "حدث خطأ ما. حاول مرة أخرى.",
        },
      },
      proposalUpload: {
        errors: {
          supplierProfileNotFound: "لم يُعثر على ملف المورّد.",
          invalidRequest: "طلب غير صالح.",
          fileRequired: "الرجاء اختيار ملف PDF للرفع.",
          fileTooLarge: "يجب ألّا يتجاوز حجم الملف 10 ميغابايت.",
          fileNotPdf: "يجب أن يكون الملف بصيغة PDF.",
          inviteNotFound: "لم يُعثر على الدعوة.",
          quoteRequired:
            "لم تقدّم عرضاً بعد لطلب السعر هذا — قدّم عرضاً أولاً.",
          noActiveRequest:
            "لا يوجد طلب عرض فني نشط لهذا العرض.",
          uploadFailed: "فشل الرفع. حاول مرة أخرى.",
          saveFailed: "تعذّر حفظ عرضك. حاول مرة أخرى.",
          requestNoLongerPending:
            "لم يعد طلب العرض الفني هذا معلّقاً. حدّث الصفحة وحاول مرة أخرى.",
        },
      },
      decline: {
        errors: {
          invalidSubmission: "بيانات الرفض غير صالحة.",
          supplierProfileNotFound: "لم يُعثر على ملف المورّد.",
          declineFailed: "تعذّر تسجيل رفضك. حاول مرة أخرى.",
        },
      },
    },
    requirementValues: {
      kind: {
        venues: "قاعة",
        catering: "ضيافة",
        photography: "تصوير",
        generic: "عام",
      },
      seating_style: {
        rounds: "طاولات دائرية",
        theatre: "ترتيب مسرحي",
        classroom: "ترتيب فصل دراسي",
        cocktail: "كوكتيل",
        majlis: "مجلس",
      },
      indoor_outdoor: {
        indoor: "داخلي",
        outdoor: "خارجي",
        either: "داخلي أو خارجي",
      },
      meal_type: {
        buffet: "بوفيه",
        plated: "تقديم على الطاولة",
        coffee_break: "استراحة قهوة",
        cocktail: "حفل كوكتيل",
      },
      dietary: {
        halal_only: "حلال فقط",
        vegetarian: "نباتي",
        vegan: "نباتي صرف",
        gluten_free: "خالٍ من الجلوتين",
        nut_free: "خالٍ من المكسرات",
      },
      service_style: {
        self_serve: "خدمة ذاتية",
        served: "خدمة كاملة",
        mixed: "مختلط",
      },
      deliverables: {
        photos: "صور",
        video: "فيديو",
        drone: "تصوير جوي بالدرون",
        same_day_edit: "مونتاج في نفس اليوم",
        printed_album: "ألبوم مطبوع",
      },
    },
    lineItemKind: {
      package: "باقة",
      qty_discount: "خصم الكمية",
      date_surcharge: "رسوم إضافية حسب التاريخ",
      distance_fee: "رسوم المسافة",
      duration_multiplier: "تعديل حسب المدة",
      free_form: "بند مخصص",
    },
    quoteStatus: {
      draft: "مسودة",
      sent: "مُرسل",
      accepted: "مقبول",
      rejected: "مرفوض",
      expired: "منتهي الصلاحية",
      withdrawn: "مسحوب",
    },
    bookingStatus: {
      confirmation: {
        awaiting_supplier: "بانتظار المورّد",
        confirmed: "مؤكّد",
        cancelled: "ملغي",
      },
      payment: {
        unpaid: "غير مدفوع",
        deposit_paid: "العربون مدفوع",
        balance_paid: "الرصيد مدفوع",
        paid: "مدفوع بالكامل",
      },
      service: {
        scheduled: "مجدول",
        in_progress: "قيد التنفيذ",
        completed: "مكتمل",
        disputed: "محل نزاع",
      },
    },
    organizer: {
      rfqWizard: {
        errors: {
          invalidSubmission: "بيانات طلب السعر غير صالحة.",
          invalidRequirements: "بيانات المتطلبات غير صالحة.",
          forbidden: "لا تملك صلاحية إرسال طلب السعر هذا.",
          invalidDeadline:
            "مهلة الردّ غير صالحة — اختر 24 أو 48 أو 72 ساعة.",
          inviteListMalformed: "قائمة الدعوات غير صحيحة.",
          shortlistEmpty:
            "القائمة المختصرة فارغة — اختر مورّداً واحداً على الأقل.",
          shortlistTooLarge:
            "عدد المورّدين في القائمة المختصرة كبير جداً (الحد الأقصى 20).",
          eventNotFound: "لم يُعثر على الفعالية أو لا يمكن الوصول إليها.",
          invalidInviteSource:
            "مصدر دعوة غير صالح في القائمة المختصرة.",
          rfqCreateNoId:
            "لم يُرجِع إنشاء طلب السعر معرّفاً. حاول مرة أخرى.",
          unknown: "تعذّر إرسال طلب السعر. حاول مرة أخرى.",
        },
      },
      rfqs: {
        source: {
          self_applied: "تقدّم عبر السوق",
          unknown: "مصدر غير معروف",
        },
        titleFallback: "طلب عرض سعر",
        declineReason: {
          too_busy: "المورّد محجوز بالكامل",
          out_of_area: "خارج نطاق الخدمة",
          price_mismatch: "عدم توافق الميزانية",
          other: "أخرى",
          unknown: "غير محدّد",
        },
        // I-24: parity with admin.rfqs.status — `pending` كحالة احتياطية.
        status: {
          pending: "قيد الانتظار",
        },
      },
      shortlist: {
        reasons: {
          offersInCategory: "يقدّم باقات في هذه الفئة",
          newToSevent: "جديد على سيڤنت",
        },
      },
      quote: {
        quoteCorrupt:
          "بيانات هذا العرض تالفة — اطلب من المورّد إعادة إرساله.",
        totalsHeading: "الإجماليات",
        vatWithRate: "ضريبة القيمة المضافة ({pct}%)",
        rfpErrors: {
          invalidRequest: "طلب غير صالح.",
          quoteNotFound: "لم يُعثر على العرض.",
          organizerMismatch: "أنت لست منظّم طلب السعر هذا.",
          alreadyPending:
            "يوجد طلب عرض فني معلّق بالفعل لهذا المورّد.",
          sendFailed: "تعذّر إرسال الطلب. حاول مرة أخرى.",
          requestNotFound: "لم يُعثر على الطلب.",
          requestNotPending: "لم يعد هذا الطلب معلّقاً.",
          cancelFailed: "تعذّر إلغاء الطلب. حاول مرة أخرى.",
          cancelRaced:
            "لم يعد هذا الطلب معلّقاً. حدّث الصفحة.",
        },
        compare: {
          conflictMark: "⚠ تعارض",
        },
        csv: {
          criterion: "البند",
          location: "الموقع",
          inviteSource: "مصدر الدعوة",
          dateConflict: "تعارض في التاريخ",
          total: "الإجمالي (ر.س)",
          subtotal: "الإجمالي الفرعي (ر.س)",
          setupFee: "رسوم التجهيز (ر.س)",
          travelFee: "رسوم التنقل (ر.س)",
          teardownFee: "رسوم الإزالة (ر.س)",
          vatPct: "نسبة ضريبة القيمة المضافة",
          vatAmount: "مبلغ ضريبة القيمة المضافة (ر.س)",
          depositPct: "نسبة العربون",
          paymentSchedule: "جدول الدفع",
          cancellation: "سياسة الإلغاء",
          inclusions: "يشمل",
          exclusions: "لا يشمل",
          lineItems: "البنود",
          notes: "ملاحظات",
          expires: "تنتهي الصلاحية",
          submitted: "تاريخ الإرسال",
          techProposal: "العرض الفني",
          rfpStatus: "حالة طلب العرض الفني",
          verified: "(موثّق)",
          yes: "نعم",
          no: "لا",
          attached: "مرفق",
          truncatedSuffix:
            "… (تم اقتطاع {count} بند؛ افتح التطبيق للاطلاع الكامل)",
          lineItem:
            "{label} (الكمية {qty}، {unitPrice}/للوحدة، الإجمالي {total})",
          source: {
            self_applied: "تقدّم عبر السوق",
            auto_match: "مطابقة تلقائية",
            organizer_picked: "اختيار المنظّم",
          },
          rfp: {
            requested: "تم الطلب",
            fulfilled: "تم التنفيذ",
            cancelled: "ملغي",
          },
        },
      },
    },
  },
};

/** Deep-merge `src` into `dst`, only adding keys that don't already exist. */
function mergeMissing(dst, src, trail) {
  const added = [];
  for (const [k, v] of Object.entries(src)) {
    const here = trail ? `${trail}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (dst[k] === undefined) dst[k] = {};
      if (typeof dst[k] !== "object") {
        throw new Error(`type clash at ${here}: existing value is not an object`);
      }
      added.push(...mergeMissing(dst[k], v, here));
    } else {
      if (dst[k] === undefined) {
        dst[k] = v;
        added.push(here);
      }
    }
  }
  return added;
}

for (const locale of ["en", "ar"]) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const usesCrlf = raw.includes("\r\n");
  const obj = JSON.parse(raw);
  const added = mergeMissing(obj, ADDITIONS[locale], "");
  let out = JSON.stringify(obj, null, 2) + "\n";
  if (usesCrlf) out = out.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, out, "utf8");
  console.log(`${locale}.json: added ${added.length} keys`);
  for (const k of added) console.log(`  + ${k}`);
}
