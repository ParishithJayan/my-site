/* ───────────────────────────────────────────────────────────
   COHORT CONFIG  —  the single source of truth.

   Edit the numbers below, commit, and push. This updates:
     • every price shown on the site (homepage, enroll, etc.)
     • the seat counter in the top bar and enroll page
     • the actual Razorpay charge (api/create-order.js reads this)

   Pricing model: this cohort has a single price — `earlyPrice` and
   `regularPrice` are set to the same value, so `earlyUntil` has no
   effect. To bring back early-bird pricing later, set `earlyPrice`
   lower and `earlyUntil` to the last day it applies.

   seatsFilled: bump this by 1 each time someone pays.
   (You get a payment alert on every registration, so just +1.)
   It only drives the seat counter — it no longer affects price.

   CLOSING REGISTRATION FOR THIS COHORT:
   Set `enrollOpen` to false. The whole site reacts automatically —
   the top bar swaps to the `closedNotice` text below, "Reserve your
   spot" and every other enroll.html link site-wide redirect to
   registration-closed.html, and enroll.html itself bounces anyone
   who lands there directly. Flip it back to true to reopen.
   ─────────────────────────────────────────────────────────── */
(function (root) {
  var CFG = {
    totalSeats: 20,            // total seats in this cohort
    seatsFilled: 5,            // seats already paid for — bump +1 per payment
    earlyPrice: 15000,         // single price this cohort — same as regularPrice
    regularPrice: 15000,       // ₹ everyone pays; one price, no early bird
    earlyUntil: '2026-08-09',  // unused while both prices match; YYYY-MM-DD

    // Marketing stats shown on the homepage hero — edit, commit, push to update.
    engineersTrained: 90,      // shown as "90+" — engineers trained so far
    studentRating: 4.8,        // shown as "4.8 ★" — average student rating
    yearsExperience: 9,        // shown as "9+" — years of production OpenSTAAD automation

    enrollOpen: true,          // false = registration closed, see note above

    // Cohort details used by the automatic welcome email (api/razorpay-webhook.js).
    // NOTE: the announcement bar in each .html still hardcodes the same date and
    // time — update those too when this cohort changes.
    // The WhatsApp group link is deliberately NOT here: this file is served to
    // every visitor. It lives in the WHATSAPP_GROUP_URL env var, server-side only.
    courseName:   'AI + OpenSTAAD Cohort for Structural Engineers',
    startDate:    'August 10, 2026',
    sessionTime:  '9–11 PM IST',
    sessionCount: 10,
    supportEmail: 'jparishith@gmail.com',

    // Shown in the top bar (and used as the redirect target) only when enrollOpen is false.
    closedNotice: {
      bannerText: 'Next cohort is underway — registrations are closed for now.',
      bannerShort: 'Registrations closed for now.',
      bannerCta: 'Get notified →',
      redirectTo: 'registration-closed.html'
    }
  };

  // Price the NEXT registrant pays, based on today's date (IST).
  // Early price holds through the end of `earlyUntil`; regular price after.
  CFG.currentPrice = function () {
    var endOfEarly = new Date(CFG.earlyUntil + 'T23:59:59+05:30');
    return new Date() <= endOfEarly ? CFG.earlyPrice : CFG.regularPrice;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CFG;            // Node (api/create-order.js)
  } else {
    root.CFCE_COHORT = CFG;          // Browser (seats.js)
  }
})(typeof window !== 'undefined' ? window : this);
