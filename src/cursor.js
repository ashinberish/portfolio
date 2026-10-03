// A playful cartoon cursor: an arrow that tilts as it moves and squishes on click.
// Only for mouse/trackpad users; touch keeps the default.

const ARROW = `
<svg viewBox="0 0 28 30" aria-hidden="true">
  <path d="M4 3 L4 23.5 L9.4 18.6 L13 26.4 L17.2 24.6 L13.6 16.9 L21 16.6 Z" />
</svg>`;

export function createCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const arrow = document.createElement('div');
  arrow.className = 'cursor';
  arrow.innerHTML = ARROW;
  document.body.append(arrow);
  document.documentElement.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let tilt = 0;
  let lastX = x;
  let visible = false;

  const show = (on) => {
    visible = on;
    document.documentElement.classList.toggle('cursor-hidden', !on);
  };
  show(false);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    x = e.clientX;
    y = e.clientY;
    if (!visible) {
      lastX = x;
      show(true);
    }
    const hover = e.target.closest?.('a, button');
    document.documentElement.classList.toggle('cursor-hover', Boolean(hover));
  });
  document.addEventListener('pointerleave', () => show(false));
  window.addEventListener('blur', () => show(false));

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    document.documentElement.classList.add('cursor-down');
  });
  window.addEventListener('pointerup', () => document.documentElement.classList.remove('cursor-down'));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Arrow leans into horizontal movement, then settles.
    const speed = (x - lastX) / Math.max(dt, 1e-3);
    lastX = x;
    const target = reduced ? 0 : Math.max(-22, Math.min(22, speed * 0.02));
    tilt += (target - tilt) * Math.min(1, dt * 10);

    arrow.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
