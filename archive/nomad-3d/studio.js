const model = document.querySelector('#vehicle');
const shell = document.querySelector('#viewer-shell');
const stage = document.querySelector('#stage');
const status = document.querySelector('#load-status');
const loading = document.querySelector('#loading');
const loadingText = document.querySelector('#loading-text');
const errorPanel = document.querySelector('#error-panel');
const rotate = document.querySelector('#rotate');
const background = document.querySelector('#background');
const presets = [...document.querySelectorAll('[data-view]')];
const views = {overview: '-30deg 72deg 2.25m', front: '0deg 85deg 2.25m',
  back: '180deg 85deg 2.25m', left: '-90deg 85deg 2.25m',
  right: '90deg 85deg 2.25m', top: '0deg 0deg 2.25m'};

function stopRotation() {
  model.autoRotate = false;
  rotate.setAttribute('aria-pressed', 'false');
}
function selectView(name) {
  stopRotation();
  model.resetTurntableRotation();
  model.cameraTarget = 'auto auto auto';
  model.cameraOrbit = views[name];
  model.fieldOfView = '32deg';
  presets.forEach(button => {
    const selected = button.dataset.view === name;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function failed() {
  loading.hidden = true;
  errorPanel.hidden = false;
  status.textContent = '불러오기 실패';
  status.classList.remove('ready');
}

model.addEventListener('progress', event => {
  const percent = Math.round(event.detail.totalProgress * 100);
  document.querySelector('#progress-fill').style.width = `${percent}%`;
  loadingText.textContent = percent >= 100 ? '화면 준비 중…' : `모델 불러오는 중 · ${percent}%`;
});
model.addEventListener('load', () => {
  loading.hidden = true;
  errorPanel.hidden = true;
  status.textContent = '회전할 준비 완료';
  status.classList.add('ready');
});
model.addEventListener('error', failed);
model.addEventListener('camera-change', event => {
  if (event.detail.source === 'user-interaction') {
    presets.forEach(button => {button.classList.remove('selected');button.setAttribute('aria-pressed', 'false');});
  }
});
['pointerdown', 'wheel', 'keydown'].forEach(type => model.addEventListener(type, stopRotation, {passive: true}));
presets.forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
document.querySelector('#reset').addEventListener('click', () => selectView('overview'));
rotate.addEventListener('click', () => {
  model.autoRotate = !model.autoRotate;
  rotate.setAttribute('aria-pressed', String(model.autoRotate));
});
background.addEventListener('click', () => {
  const light = stage.dataset.background !== 'light';
  stage.dataset.background = light ? 'light' : 'dark';
  background.setAttribute('aria-pressed', String(light));
  background.innerHTML = `<span aria-hidden="true">◐</span> ${light ? '어두운 배경' : '밝은 배경'}`;
});
const fullscreen = document.querySelector('#fullscreen');
if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  } catch {status.textContent = '이 브라우저에서는 전체 화면을 사용할 수 없어요.';}
});
document.addEventListener('fullscreenchange', () => {
  fullscreen.setAttribute('aria-label', document.fullscreenElement ? '전체 화면 닫기' : '3D 뷰어 전체 화면');
});
document.querySelector('#retry').addEventListener('click', () => location.reload());
window.addEventListener('error', event => {
  if (event.target instanceof HTMLScriptElement && event.target.src.includes('model-viewer')) failed();
}, true);
// Keep downloads usable even on a browser without custom elements / WebGL.
setTimeout(() => {if (!customElements.get('model-viewer')) failed();}, 12000);
