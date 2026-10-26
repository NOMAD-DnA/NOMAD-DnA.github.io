/* Presentation-only cloud size, not estimated covariance or a confidence level. */
(() => {
  'use strict';
  const BASE_RADIUS = 1.4;
  const GROWTH_PER_SECOND = .36;
  const RECOVERY_SECONDS = 3.5;

  // Integrate the scenario intervals from the beginning on every query.
  // Seeking, reverse seeking, pause and playback speed must give the same size.
  window.nomadCloudRadius = function (time, phases) {
    let radius = BASE_RADIUS;
    for (const phase of phases) {
      if (time <= phase.start) break;
      const elapsed = Math.max(0, Math.min(time, phase.end) - phase.start);
      if (phase.gnss === 'NO_FIX') {
        if (phase.featureIntent === 'poor') radius += GROWTH_PER_SECOND * elapsed;
        // Recovered features arrest illustrative growth; they do not erase it.
      } else {
        radius = BASE_RADIUS + (radius - BASE_RADIUS) * Math.exp(-elapsed / RECOVERY_SECONDS);
      }
      if (time < phase.end) break;
    }
    return radius;
  };
})();
