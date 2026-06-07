/* ───────────────────────────────────────────────────────────
   COHORT CONFIG  —  the single source of truth.

   Edit the numbers below, commit, and push. This updates:
     • every price shown on the site (homepage, enroll, etc.)
     • the seat counter in the top bar and enroll page
     • the actual Razorpay charge (api/create-order.js reads this)

   Pricing model: the first `earlySeats` seats pay `earlyPrice`,
   the remaining seats pay `regularPrice`.

   seatsFilled: bump this by 1 each time someone pays.
   (You get a payment alert on every registration, so just +1.)
   ─────────────────────────────────────────────────────────── */
(function (root) {
  var CFG = {
    totalSeats: 20,      // total seats in this cohort
    earlySeats: 10,      // first N seats at the early price
    seatsFilled: 5,       // seats already paid for — bump +1 per payment
    earlyPrice: 12000,   // ₹ for the first `earlySeats` seats
    regularPrice: 15000    // ₹ for the remaining seats
  };

  // Price the NEXT registrant pays, based on how many seats are filled.
  CFG.currentPrice = function () {
    return CFG.seatsFilled < CFG.earlySeats ? CFG.earlyPrice : CFG.regularPrice;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CFG;            // Node (api/create-order.js)
  } else {
    root.CFCE_COHORT = CFG;          // Browser (seats.js)
  }
})(typeof window !== 'undefined' ? window : this);
