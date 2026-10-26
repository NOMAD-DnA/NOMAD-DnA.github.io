/* Actual recorded XYZ trajectories. Orthographic rotation; no per-axis gain. */
(() => {
  'use strict';
  const COLORS = { gt: '#344b4e', ours: '#007fae', imu: '#dd7c2a' };
  const boundsCache = new WeakMap();
  const azimuth = 35 * Math.PI / 180, elevation = 50 * Math.PI / 180;
  const ca = Math.cos(azimuth), sa = Math.sin(azimuth);
  const ce = Math.cos(elevation), se = Math.sin(elevation);
  const rotate = (x, y, z) => [ca * x - sa * y, -se * (sa * x + ca * y) - ce * z];
  const plane = [[-36, -22, 0], [38, -22, 0], [38, 27, 0], [-36, 27, 0]];
  const axis = [-36, 27];

  function at(rows, t, keepJump = false) {
    if (!rows?.length || t < rows[0][0] || t > rows.at(-1)[0] + .3) return null;
    let lo = 0, hi = rows.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid][0] <= t) lo = mid + 1; else hi = mid; }
    const a = rows[Math.max(0, lo - 1)], b = rows[lo];
    if (!b || (keepJump && Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) > .75)) return a;
    const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
    return [t, ...[1, 2, 3].map(i => a[i] + (b[i] - a[i]) * f)];
  }
  function bounds(series) {
    if (boundsCache.has(series)) return boundsCache.get(series);
    let minZ = 0, maxZ = 0;
    const points = [...plane];
    for (const name of ['gt', 'ours', 'imu']) for (const r of series[name] || []) {
      points.push(r.slice(1, 4)); minZ = Math.min(minZ, r[3]); maxZ = Math.max(maxZ, r[3]);
    }
    const roughStep = Math.max(50, (maxZ - minZ) / 5);
    const decade = 10 ** Math.floor(Math.log10(roughStep));
    const zStep = [1, 2, 5, 10].find(v => v * decade >= roughStep) * decade;
    const zFloor = Math.floor(minZ / zStep) * zStep;
    const zCeiling = maxZ > zStep * .2 ? Math.ceil(maxZ / zStep) * zStep : 0;
    points.push([axis[0], axis[1], zFloor], [axis[0], axis[1], zCeiling]);
    const projected = points.map(p => rotate(...p));
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, zFloor, zCeiling, zStep };
    for (const p of projected) {
      b.x0 = Math.min(b.x0, p[0]); b.x1 = Math.max(b.x1, p[0]);
      b.y0 = Math.min(b.y0, p[1]); b.y1 = Math.max(b.y1, p[1]);
    }
    boundsCache.set(series, b); return b;
  }
  function text(ctx, value, x, y, color = '#74858a', align = 'left', size = 11, bold = false) {
    ctx.font = `${bold ? 600 : 400} ${size}px Arial, sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
  }
  function line(ctx, points, color, width = 1, dash = []) {
    if (!points.length) return;
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }
  function marker(ctx, p, color, radius = 4) {
    ctx.beginPath(); ctx.arc(...p, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  window.drawNomadTrajectory3D = function (canvas, { t, series, visible = {}, cloud = false, phases = [], events = [], modeled = false }) {
    const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height;
    if (!w || !h || !series) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const b = bounds(series), left = w < 430 ? 37 : 50, right = w < 430 ? 72 : 106, top = 34, bottom = 24;
    const scale = Math.min((w - left - right) / (b.x1 - b.x0), (h - top - bottom) / (b.y1 - b.y0));
    const usedW = (b.x1 - b.x0) * scale, usedH = (b.y1 - b.y0) * scale;
    const ox = left + (w - left - right - usedW) / 2, oy = top + (h - top - bottom - usedH) / 2;
    const project = p => { const q = rotate(...p); return [ox + (q[0] - b.x0) * scale, oy + (q[1] - b.y0) * scale]; };
    const world = (x, y, z = 0) => project([x, y, z]);
    const projectedPlane = plane.map(project);
    c.beginPath(); projectedPlane.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    c.fillStyle = '#f4f7f6'; c.fill(); c.strokeStyle = '#d8e2e1'; c.lineWidth = 1; c.stroke();
    for (let x = -30; x <= 30; x += 10) line(c, [world(x, -22), world(x, 27)], '#e4eaea', .7);
    for (let y = -20; y <= 20; y += 10) line(c, [world(-36, y), world(38, y)], '#e4eaea', .7);
    const factory = [[-14, -11, 0], [26, -11, 0], [26, 11, 0], [-14, 11, 0], [-14, -11, 0]];
    line(c, factory.map(project), '#a3b1b2', 1.1);
    const factoryLabel = world(6, 0); text(c, 'FACTORY', factoryLabel[0], factoryLabel[1], '#b1babc', 'center', 8, true);

    // Z remains in metres at the same metric scale as X/Y; depth foreshortening is only camera rotation.
    const z0 = world(...axis, b.zCeiling), zn = world(...axis, b.zFloor);
    line(c, [z0, zn], '#a6b5b8', 1);
    for (let z = b.zCeiling; z >= b.zFloor; z -= b.zStep) {
      const p = world(...axis, z); line(c, [[p[0] - 4, p[1]], [p[0] + 3, p[1]]], '#a6b5b8');
      text(c, `${z}`, p[0] - 9, p[1], '#7f9298', 'right', 10);
      if (z < 0) line(c, [p, [p[0] + 18, p[1]]], '#dbe3e4', .8, [2, 3]);
    }
    text(c, 'Z [m]', z0[0] - 9, z0[1] - 15, '#657f87', 'right', 10, true);
    const xAxis = world(38, -22), yAxis = world(38, 27);
    text(c, 'X [m]', xAxis[0] + 5, xAxis[1] + 7, '#7f9298', 'left', 10);
    text(c, 'Y [m]', yAxis[0] + 5, yAxis[1] - 5, '#7f9298', 'left', 10);

    const current = Object.fromEntries(['gt', 'ours', 'imu'].map(name => [name, at(series[name], t, name === 'ours')]));
    const shown = name => visible[name] !== false;
    if (cloud && shown('ours') && current.ours) {
      const row = current.ours, radius = window.nomadCloudRadius(t, phases);
      for (const multiplier of [1.7, 1.2, .7]) {
        const ps = Array.from({ length: 65 }, (_, i) => world(row[1] + radius * multiplier * Math.cos(i * Math.PI / 32), row[2] + radius * .7 * multiplier * Math.sin(i * Math.PI / 32), row[3]));
        c.beginPath(); ps.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
        c.fillStyle = '#007fae0c'; c.fill(); c.strokeStyle = '#007fae35'; c.lineWidth = .65; c.stroke();
      }
    }
    for (const name of ['gt', 'ours', 'imu']) {
      if (!shown(name)) continue;
      const points = []; for (const row of series[name] || []) { if (row[0] > t) break; points.push(project(row.slice(1, 4))); }
      if (current[name]) points.push(project(current[name].slice(1, 4)));
      line(c, points, COLORS[name], name === 'imu' ? 2.8 : name === 'ours' ? 2.5 : 1.6, name === 'gt' ? [4, 3] : []);
    }
    for (const event of events) {
      if (t < event.t || !['loss', 'regain'].includes(event.type)) continue;
      const g = at(series.gt, event.t); if (!g) continue;
      const p = project(g.slice(1, 4)); c.strokeStyle = '#cf5157'; c.lineWidth = 1.2;
      if (event.type === 'loss') {
        line(c, [[p[0] - 3, p[1] - 3], [p[0] + 3, p[1] + 3]], '#cf5157', 1.2);
        line(c, [[p[0] - 3, p[1] + 3], [p[0] + 3, p[1] - 3]], '#cf5157', 1.2);
      } else { c.beginPath(); c.arc(...p, 3.5, 0, Math.PI * 2); c.stroke(); }
    }
    let error3D = null, deltaZ = null;
    if (current.gt && current.imu && shown('imu')) {
      const g = project(current.gt.slice(1, 4)), m = project(current.imu.slice(1, 4));
      error3D = Math.hypot(...[1, 2, 3].map(i => current.imu[i] - current.gt[i])); deltaZ = current.imu[3] - current.gt[3];
      if (error3D > 2) line(c, [g, m], '#dd7c2a70', 1.1, [4, 4]);
      if (error3D > 1) {
        const labelX = Math.min(w - 88, m[0] + 18), labelY = Math.min(h - 36, Math.max(64, m[1] - 13));
        line(c, [m, [labelX - 5, labelY + 6]], '#dd7c2a66', .8);
        text(c, `IMU  ${error3D.toFixed(1)} m`, labelX, labelY, COLORS.imu, 'left', 12, true);
        text(c, `Δz ${deltaZ.toFixed(1)} m`, labelX, labelY + 17, '#a97950', 'left', 10);
      }
    }
    for (const name of ['gt', 'ours', 'imu']) if (current[name] && shown(name)) marker(c, project(current[name].slice(1, 4)), COLORS[name], name === 'imu' ? 4.5 : 3.5);
    text(c, modeled ? 'XYZ 위치 · IMU 오차 모델' : '실제 XYZ 위치', 15, 16, '#45626b', 'left', 11, true);
    text(c, '축별 동일 축척 · 고정 시점', w - 15, 16, '#81959a', 'right', 10);
    text(c, '지면 Z = 0', 15, h - 11, '#8a9c9f', 'left', 10);
    return { error3D, deltaZ, scale, zFloor: b.zFloor, projection: 'orthographic, equal metric scale' };
  };
})();
