/* Reads cohort-config.js and fills seat + price counters across the page.
   Markup hooks (put these data-attributes on any element):
     [data-seat-filled]     → number of seats taken
     [data-seat-total]      → total seats in the cohort
     [data-seat-remaining]  → seats still available
     [data-seat-bar]        → element whose width becomes the % filled
     [data-seat-full]       → shown only when the cohort is full
     [data-price-current]   → price the next registrant pays (₹)
     [data-price-early]     → early-seat price (₹)
     [data-price-regular]   → regular-seat price (₹)
   Does not touch payment, order, or any existing logic. */
(function () {
  var cfg = window.CFCE_COHORT || {};
  var total = Math.max(parseInt(cfg.totalSeats, 10) || 0, 0);
  var filled = Math.min(Math.max(parseInt(cfg.seatsFilled, 10) || 0, 0), total);
  var remaining = Math.max(total - filled, 0);
  var pct = total ? Math.round((filled / total) * 100) : 0;

  function inr(n) { return '₹' + (parseInt(n, 10) || 0).toLocaleString('en-IN'); }
  var earlyStr = inr(cfg.earlyPrice);
  var regularStr = inr(cfg.regularPrice);
  var currentStr = inr(typeof cfg.currentPrice === 'function' ? cfg.currentPrice() : cfg.earlyPrice);

  function setText(sel, val) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = val; });
  }

  function apply() {
    setText('[data-seat-filled]', filled);
    setText('[data-seat-total]', total);
    setText('[data-seat-remaining]', remaining);
    setText('[data-price-current]', currentStr);
    setText('[data-price-early]', earlyStr);
    setText('[data-price-regular]', regularStr);
    document.querySelectorAll('[data-seat-bar]').forEach(function (el) { el.style.width = pct + '%'; });
    document.querySelectorAll('[data-seat-full]').forEach(function (el) {
      el.style.display = remaining === 0 ? '' : 'none';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
