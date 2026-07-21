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
     [data-engineers-trained] → engineers trained so far (shown as "N+")
     [data-student-rating]  → average student rating (shown as "N ★")
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

  // When enrollOpen is false: swap the top bar to the closed-cohort message
  // and send every link that points at enroll.html to the waitlist page instead.
  // No-op (and untouched) whenever enrollOpen is true.
  var ENROLL_LINK = /^\/?enroll(\.html)?(?:[?#].*)?$/i;

  function applyClosedState() {
    if (cfg.enrollOpen !== false) return;
    var notice = cfg.closedNotice || {};
    var target = notice.redirectTo || 'registration-closed.html';

    document.querySelectorAll('.announce-bar').forEach(function (bar) {
      var link = bar.querySelector('a');
      if (link) link.setAttribute('href', target);
      var full = bar.querySelector('.announce-text');
      var short = bar.querySelector('.announce-text-short');
      var cta = bar.querySelector('.announce-cta');
      if (full && notice.bannerText) full.textContent = notice.bannerText;
      if (short && notice.bannerShort) short.textContent = notice.bannerShort;
      if (cta && notice.bannerCta) cta.textContent = notice.bannerCta;
    });

    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && ENROLL_LINK.test(href)) a.setAttribute('href', target);
    });
  }

  function apply() {
    setText('[data-seat-filled]', filled);
    setText('[data-seat-total]', total);
    setText('[data-seat-remaining]', remaining);
    setText('[data-price-current]', currentStr);
    setText('[data-price-early]', earlyStr);
    setText('[data-price-regular]', regularStr);
    if (cfg.engineersTrained) setText('[data-engineers-trained]', cfg.engineersTrained + '+');
    if (cfg.studentRating) setText('[data-student-rating]', cfg.studentRating + ' ★');
    document.querySelectorAll('[data-seat-bar]').forEach(function (el) { el.style.width = pct + '%'; });
    document.querySelectorAll('[data-seat-full]').forEach(function (el) {
      el.style.display = remaining === 0 ? '' : 'none';
    });
    applyClosedState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
