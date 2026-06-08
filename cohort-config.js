/* ───────────────────────────────────────────────────────────
   COHORT CONFIG  —  the single source of truth.

   Edit the numbers below, commit, and push. This updates:
     • every price shown on the site (homepage, enroll, etc.)
     • the seat counter in the top bar and enroll page
     • the actual Razorpay charge (api/create-order.js reads this)

   Pricing model: register on or before `earlyUntil` (IST) and you
   pay `earlyPrice`. From the next day onward it is `regularPrice`.

   seatsFilled: bump this by 1 each time someone pays.
   (You get a payment alert on every registration, so just +1.)
   It only drives the seat counter — it no longer affects price.
   ─────────────────────────────────────────────────────────── */
(function (root) {
  var CFG = {
    totalSeats: 20,            // total seats in this cohort
    seatsFilled: 5,            // seats already paid for — bump +1 per payment
    earlyPrice: 12000,         // ₹ for registrations on or before earlyUntil
    regularPrice: 15000,       // ₹ from the day after earlyUntil
    earlyUntil: '2026-06-15'   // last day (IST) to get earlyPrice; YYYY-MM-DD
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
