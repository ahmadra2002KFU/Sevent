# Supplier Onboarding UX & Logical Evaluation

**Date:** 2026-04-22
**Language:** Arabic (UI default)

This report details a logical and UX-focused evaluation of the supplier onboarding workflow. It considers the auto-accept email behavior (SMTP bypass) and evaluates the flow through the lens of a new Saudi supplier.

## Executive Summary
The onboarding sequence is highly logical, breaking down a potentially tedious process into manageable chunks (Account → Path → Details → Services → Docs). The use of live previews and logical nudges (e.g., explaining *why* IBAN is needed) is excellent. However, there are critical gaps in **Arabic localization consistency** (i18n) within form validations that break the professional immersion.

## Step-by-Step Logical Critique

### 1. Sign-Up Form
- **Flow & Logic:** The sequence of Work Email → Phone → Password makes logical sense. Real-time validation for Saudi phone numbers is a nice touch.
- **Auto-Accept Behavior:** Since SMTP is not configured for local/dev environments, the system successfully employs auto-accept/auto-verify. The user can log in immediately after sign-up without encountering a hard blocker, which is excellent for conversion if this is intended for a low-friction start.
- **UX Persuasion:** The right sidebar provides solid social proof to encourage completion.

### 2. Path Selection (Company vs Freelancer)
- **Clarity:** Splitting the path early is very logical. It prevents freelancers from being asked for a CR number later.
- **Expectation Setting:** Informing the user of the estimated time (~5 vs ~8 mins) and the documents they need to prepare *before* they start is a best-in-class UX pattern.

### 3. Wizard Step 1: Business Details
- **Standout Feature (Live Preview):** The Live Profile Preview card is a massive logical win. It instantly shows suppliers the *value* of filling out the form by showing how organizers will see them.
- **URL Import:** Allowing import from a website URL reduces friction significantly for established businesses.
- **CRITICAL i18n FLAW:** While the UI is in Arabic, submitting empty or invalid fields triggers validation errors in **English** (e.g., `"Too small: expected string to have >=2 characters"`). This indicates that the Zod schemas (or equivalent validation logic) lack custom Arabic error messages. This breaks trust and localization consistency.

### 4. Wizard Step 2: Category Selection
- **Cognitive Load Management:** Using a hierarchical selection (Main Category → Sub-services) prevents the user from being overwhelmed by a massive list of all possible services.
- **Industry Logic:** Allowing the selection of multiple event types (Business, Private, Exhibitions) reflects the real-world operational model of most Saudi event suppliers.

### 5. Wizard Step 3: Verification Documents
- **Logical Nudging:** The copy linking the IBAN upload to a "24-hour payment guarantee" is brilliant. It reframes a strict compliance requirement into a direct benefit for the supplier.
- **Validation Check:** Interestingly, the validation message here correctly rendered in Arabic (`"شهادة الآيبان مطلوبة"`), unlike Step 1. This inconsistency should be addressed so all validation uses the localized strings.

## Recommended Actions
1. **Unify Validation Messages:** Audit the Zod validation schemas for Step 1 and ensure all `.min()`, `.max()`, and `.required()` checks have custom Arabic error messages provided.
2. **Review Arabic Input Handling:** Ensure the text inputs properly support RTL layout and don't conflict with any input masks that might cause keystroke errors for Arabic characters.
