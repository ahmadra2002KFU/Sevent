"""Inject messaging-feature i18n keys into src/messages/{en,ar}.json.

Idempotent: if a key already exists at the destination path, it is left in
place. Keys are inserted under:

    .messaging              — user-facing thread surface
    .admin.messages         — admin-side thread + compose surface
    .notifications.kinds.message — bell badge labels (delegated to phase-3)

Run from repo root: `python scripts/messaging-i18n-add.py`.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path

EN = {
    "messaging": {
        "title": "Messages",
        "empty": "No conversations yet.",
        "newThread": "New message",
        "back": "Back to messages",
        "you": "You",
        "admin": "Admin",
        "system": "System",
        "edited": "edited",
        "viewDetails": "View details",
        "loadingMore": "Loading more…",
        "newMessages": "{count, plural, one {# new message} other {# new messages}}",
        "filters": {
            "status": {"label": "Status", "open": "Open", "closed": "Closed", "all": "All"},
            "unread": {"label": "Unread", "all": "All", "only": "Only unread"},
        },
        "status": {"new": "New", "triaged": "In progress", "resolved": "Resolved", "closed": "Closed"},
        "thread": {
            "subject": "Subject",
            "noSubject": "(no subject)",
            "closedNotice": "This conversation is closed.",
            "openedFromCampaign": "Part of a broadcast",
        },
        "composer": {
            "placeholder": "Write a reply…",
            "newPlaceholder": "Type your message…",
            "send": "Send",
            "sending": "Sending…",
            "errorEmpty": "Please write something before sending.",
            "errorClosed": "This conversation is closed.",
            "error": "Couldn't send. Try again.",
        },
        "newThreadForm": {
            "title": "New message",
            "category": "Category",
            "categoryHint": "Optional — helps the team triage faster.",
            "categoryAll": "Choose…",
            "subject": "Subject (optional)",
            "subjectPlaceholder": "What is this about?",
            "body": "Message",
            "bodyPlaceholder": "Tell us what's going on…",
            "submit": "Send message",
            "submitting": "Sending…",
            "errorEmpty": "Please write a message.",
            "error": "Couldn't send. Try again.",
        },
    },
    "admin": {
        "messages": {
            "pageTitle": "Messages",
            "pageDescription": "Threaded conversations with users — feedback, support, and announcements.",
            "compose": "Compose message",
            "empty": "No conversations yet.",
            "errorLoad": "Failed to load conversations",
            "filters": {
                "status": {
                    "label": "Status",
                    "all": "All",
                    "new": "New",
                    "triaged": "In progress",
                    "resolved": "Resolved",
                    "open": "Open",
                    "closed": "Closed",
                },
                "role": {
                    "label": "Role",
                    "all": "All roles",
                    "supplier": "Suppliers",
                    "organizer": "Organizers",
                    "admin": "Admins",
                    "agency": "Agencies",
                },
                "unread": {"label": "Unread", "all": "All", "only": "Only unread"},
                "search": {"label": "Search", "placeholder": "Subject or message text…"},
            },
            "columns": {
                "when": "Last activity",
                "user": "User",
                "role": "Role",
                "subject": "Subject",
                "status": "Status",
                "snippet": "Last message",
            },
            "row": {"unread": "Unread", "noSubject": "(no subject)", "noEmail": "(account removed)"},
            "thread": {
                "back": "Back to messages",
                "recipient": "User",
                "noEmail": "(account removed)",
                "subjectPlaceholder": "(no subject)",
                "campaign": "Part of campaign",
            },
            "actions": {
                "close": "Close",
                "reopen": "Reopen",
                "triage": "Mark in progress",
                "resolve": "Mark resolved",
                "reopened": "Reopened.",
                "closed": "Closed.",
            },
            "reply": {
                "placeholder": "Reply to this user…",
                "send": "Send reply",
                "sending": "Sending…",
                "errorClosed": "This conversation is closed. Reopen to reply.",
                "error": "Couldn't send the reply.",
            },
            "composeForm": {
                "title": "Compose message",
                "back": "Back to messages",
                "targetType": "Send to",
                "targetTypeUser": "A specific user",
                "targetTypeRole": "Everyone in a role",
                "targetTypeAll": "All users",
                "userSearch": "Find user (email or name)",
                "userSearchPlaceholder": "Type to search…",
                "userSelected": "Selected: {name}",
                "noUserSelected": "No user selected.",
                "role": "Role",
                "subject": "Subject",
                "subjectPlaceholder": "Short headline",
                "body": "Message",
                "bodyPlaceholder": "What do you want to tell them?",
                "recipientCount": "{count, plural, =0 {No recipients} one {# recipient} other {# recipients}}",
                "send": "Send message",
                "sending": "Sending…",
                "confirmTitle": "Send to {count} recipients?",
                "confirmDescription": "Each recipient will receive their own thread. They can reply directly.",
                "confirmCancel": "Cancel",
                "confirmSend": "Yes, send",
                "errorEmpty": "Subject and message are required.",
                "errorNoTarget": "Please pick a target user or role.",
                "errorTooMany": "Bulk sends are limited to {limit} recipients per campaign.",
                "successSingle": "Message sent.",
                "successBulk": "Sent to {count, plural, one {# recipient} other {# recipients}}.",
            },
        },
    },
    "notifications": {
        "kinds": {
            "message": {
                "received": "New message",
                "reply_received": "New reply",
            }
        }
    },
}

AR = {
    "messaging": {
        "title": "الرسائل",
        "empty": "لا توجد محادثات بعد.",
        "newThread": "رسالة جديدة",
        "back": "رجوع إلى الرسائل",
        "you": "أنت",
        "admin": "المشرف",
        "system": "النظام",
        "edited": "تم تعديلها",
        "viewDetails": "عرض التفاصيل",
        "loadingMore": "جاري التحميل…",
        "newMessages": "{count, plural, one {رسالة جديدة} other {# رسائل جديدة}}",
        "filters": {
            "status": {"label": "الحالة", "open": "مفتوحة", "closed": "مغلقة", "all": "الكل"},
            "unread": {"label": "غير المقروءة", "all": "الكل", "only": "غير المقروءة فقط"},
        },
        "status": {"new": "جديد", "triaged": "قيد المعالجة", "resolved": "تم الحل", "closed": "مغلقة"},
        "thread": {
            "subject": "الموضوع",
            "noSubject": "(بدون موضوع)",
            "closedNotice": "هذه المحادثة مغلقة.",
            "openedFromCampaign": "ضمن حملة عامة",
        },
        "composer": {
            "placeholder": "اكتب ردًا…",
            "newPlaceholder": "اكتب رسالتك…",
            "send": "إرسال",
            "sending": "جاري الإرسال…",
            "errorEmpty": "يرجى كتابة شيء قبل الإرسال.",
            "errorClosed": "هذه المحادثة مغلقة.",
            "error": "تعذر الإرسال. حاول مرة أخرى.",
        },
        "newThreadForm": {
            "title": "رسالة جديدة",
            "category": "الفئة",
            "categoryHint": "اختياري — يساعدنا في الفرز بسرعة.",
            "categoryAll": "اختر…",
            "subject": "الموضوع (اختياري)",
            "subjectPlaceholder": "ما عنوان الرسالة؟",
            "body": "الرسالة",
            "bodyPlaceholder": "أخبرنا بما يحدث…",
            "submit": "إرسال الرسالة",
            "submitting": "جاري الإرسال…",
            "errorEmpty": "يرجى كتابة الرسالة.",
            "error": "تعذر الإرسال. حاول مرة أخرى.",
        },
    },
    "admin": {
        "messages": {
            "pageTitle": "الرسائل",
            "pageDescription": "محادثات مترابطة مع المستخدمين — ملاحظات ودعم وإعلانات.",
            "compose": "كتابة رسالة",
            "empty": "لا توجد محادثات بعد.",
            "errorLoad": "تعذر تحميل المحادثات",
            "filters": {
                "status": {
                    "label": "الحالة",
                    "all": "الكل",
                    "new": "جديدة",
                    "triaged": "قيد المعالجة",
                    "resolved": "تم حلها",
                    "open": "مفتوحة",
                    "closed": "مغلقة",
                },
                "role": {
                    "label": "الدور",
                    "all": "كل الأدوار",
                    "supplier": "الموردون",
                    "organizer": "المنظمون",
                    "admin": "المشرفون",
                    "agency": "الوكالات",
                },
                "unread": {"label": "غير المقروءة", "all": "الكل", "only": "غير المقروءة فقط"},
                "search": {"label": "بحث", "placeholder": "في الموضوع أو نص الرسالة…"},
            },
            "columns": {
                "when": "آخر نشاط",
                "user": "المستخدم",
                "role": "الدور",
                "subject": "الموضوع",
                "status": "الحالة",
                "snippet": "آخر رسالة",
            },
            "row": {"unread": "غير مقروءة", "noSubject": "(بدون موضوع)", "noEmail": "(تم حذف الحساب)"},
            "thread": {
                "back": "رجوع إلى الرسائل",
                "recipient": "المستخدم",
                "noEmail": "(تم حذف الحساب)",
                "subjectPlaceholder": "(بدون موضوع)",
                "campaign": "ضمن حملة",
            },
            "actions": {
                "close": "إغلاق",
                "reopen": "إعادة فتح",
                "triage": "وضع علامة قيد المعالجة",
                "resolve": "وضع علامة محلولة",
                "reopened": "تم إعادة الفتح.",
                "closed": "تم الإغلاق.",
            },
            "reply": {
                "placeholder": "ردّ على هذا المستخدم…",
                "send": "إرسال الرد",
                "sending": "جاري الإرسال…",
                "errorClosed": "هذه المحادثة مغلقة. أعد فتحها للرد.",
                "error": "تعذر إرسال الرد.",
            },
            "composeForm": {
                "title": "كتابة رسالة",
                "back": "رجوع إلى الرسائل",
                "targetType": "إرسال إلى",
                "targetTypeUser": "مستخدم محدد",
                "targetTypeRole": "كل من في دور معين",
                "targetTypeAll": "جميع المستخدمين",
                "userSearch": "ابحث عن مستخدم (بريد إلكتروني أو اسم)",
                "userSearchPlaceholder": "اكتب للبحث…",
                "userSelected": "المختار: {name}",
                "noUserSelected": "لم يتم اختيار مستخدم.",
                "role": "الدور",
                "subject": "الموضوع",
                "subjectPlaceholder": "عنوان قصير",
                "body": "الرسالة",
                "bodyPlaceholder": "ماذا تريد إخبارهم؟",
                "recipientCount": "{count, plural, =0 {لا يوجد مستلمون} one {مستلم واحد} other {# مستلمين}}",
                "send": "إرسال الرسالة",
                "sending": "جاري الإرسال…",
                "confirmTitle": "إرسال إلى {count} مستلمين؟",
                "confirmDescription": "سيستلم كل شخص نسخته الخاصة من المحادثة ويستطيع الرد مباشرة.",
                "confirmCancel": "إلغاء",
                "confirmSend": "نعم، أرسل",
                "errorEmpty": "الموضوع والرسالة مطلوبان.",
                "errorNoTarget": "يرجى اختيار مستخدم أو دور.",
                "errorTooMany": "الإرسال الجماعي محدود بـ {limit} مستلمًا لكل حملة.",
                "successSingle": "تم إرسال الرسالة.",
                "successBulk": "أُرسلت إلى {count, plural, one {مستلم واحد} other {# مستلمين}}.",
            },
        },
    },
    "notifications": {
        "kinds": {
            "message": {
                "received": "رسالة جديدة",
                "reply_received": "رد جديد",
            }
        }
    },
}


def deep_merge(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            if k not in dst:
                dst[k] = v


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    for path, payload in [(repo / "src/messages/en.json", EN), (repo / "src/messages/ar.json", AR)]:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        deep_merge(data, payload)
        with path.open("w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"updated {path.relative_to(repo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
