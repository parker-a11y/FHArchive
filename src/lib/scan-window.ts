/**
 * Opens a scan in its own browser window so it can live on a second monitor.
 * The window is self-contained HTML (no app routing) with independent zoom,
 * pan and rotate — nothing it does affects the transcription editor.
 */
export type ScanWindowHandle = {
  window: Window;
  close: () => void;
};

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function openScanWindow(opts: {
  url: string;
  title: string;
  rotation?: number;
}): ScanWindowHandle | null {
  const win = window.open(
    "",
    `scan-${Math.random().toString(36).slice(2)}`,
    "width=900,height=1000,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!win) return null;

  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeAttr(opts.title)}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; height: 100%; background: #1a1a1a; color: #eee;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; overflow: hidden; }
  #bar { position: fixed; top: 0; left: 0; right: 0; height: 44px; display: flex;
    align-items: center; gap: 6px; padding: 0 10px; background: rgba(20,20,20,.92);
    border-bottom: 1px solid #333; z-index: 10; font-size: 13px; }
  #bar .title { margin-right: auto; opacity: .8; overflow: hidden; white-space: nowrap;
    text-overflow: ellipsis; max-width: 45%; }
  button { background: #2c2c2c; color: #eee; border: 1px solid #444; border-radius: 6px;
    padding: 5px 10px; font-size: 13px; cursor: pointer; }
  button:hover { background: #3a3a3a; }
  #stage { position: absolute; inset: 44px 0 0 0; overflow: hidden; cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  img { position: absolute; top: 0; left: 0; transform-origin: 0 0; user-select: none;
    -webkit-user-drag: none; max-width: none; }
  #hint { position: fixed; bottom: 8px; left: 10px; font-size: 11px; opacity: .45; }
</style></head>
<body>
  <div id="bar">
    <span class="title">${escapeAttr(opts.title)}</span>
    <button id="out">&minus;</button>
    <span id="pct">100%</span>
    <button id="in">+</button>
    <button id="fit">Fit</button>
    <button id="rot">Rotate</button>
  </div>
  <div id="stage"><img id="img" src="${escapeAttr(opts.url)}" alt="" /></div>
  <div id="hint">Scroll to zoom &middot; drag to pan</div>
<script>
(function () {
  var img = document.getElementById('img');
  var stage = document.getElementById('stage');
  var pct = document.getElementById('pct');
  var scale = 1, x = 0, y = 0, rot = ${Number(opts.rotation) || 0};
  function apply() {
    img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ') rotate(' + rot + 'deg)';
    pct.textContent = Math.round(scale * 100) + '%';
  }
  function fit() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var w = img.naturalWidth || sw, h = img.naturalHeight || sh;
    var swap = ((rot % 180) + 180) % 180 === 90;
    var iw = swap ? h : w, ih = swap ? w : h;
    scale = Math.min(sw / iw, sh / ih) * 0.96;
    x = (sw - w * scale) / 2; y = (sh - h * scale) / 2;
    if (swap) { x = (sw - h * scale) / 2 + (h * scale); y = (sh - w * scale) / 2; }
    apply();
  }
  img.addEventListener('load', fit);
  if (img.complete) fit();
  window.addEventListener('resize', fit);
  function zoomAt(cx, cy, factor) {
    var next = Math.min(20, Math.max(0.05, scale * factor));
    var k = next / scale;
    x = cx - (cx - x) * k; y = cy - (cy - y) * k;
    scale = next; apply();
  }
  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY - 44, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  document.getElementById('in').onclick = function () { zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25); };
  document.getElementById('out').onclick = function () { zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8); };
  document.getElementById('fit').onclick = fit;
  document.getElementById('rot').onclick = function () { rot = (rot + 90) % 360; fit(); };
  var down = false, sx = 0, sy = 0;
  stage.addEventListener('pointerdown', function (e) {
    down = true; sx = e.clientX - x; sy = e.clientY - y;
    stage.classList.add('dragging'); stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', function (e) {
    if (!down) return; x = e.clientX - sx; y = e.clientY - sy; apply();
  });
  stage.addEventListener('pointerup', function () { down = false; stage.classList.remove('dragging'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '+' || e.key === '=') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25);
    if (e.key === '-') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8);
    if (e.key === '0') fit();
  });
})();
</script>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  return { window: win, close: () => win.close() };
}
