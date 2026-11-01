const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
};

export class Input {
  // isActive() — true, пока идёт игра: только тогда блокируем прокрутку страницы
  constructor(isActive = () => true) {
    this.isActive = isActive;
    this.keys = new Set();
    this.touch = { left: false, right: false, jump: false };
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
  }

  onKey(e, down) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (down) {
      if (!this.isActive()) return;
      e.preventDefault();
      this.keys.add(e.code);
    } else {
      this.keys.delete(e.code);
    }
  }

  isHeld(action) {
    if (this.touch[action]) return true;
    for (const code of this.keys) if (KEY_MAP[code] === action) return true;
    return false;
  }

  get left() { return this.isHeld('left'); }
  get right() { return this.isHeld('right'); }
  get jump() { return this.isHeld('jump'); }

  // Экранные кнопки: удержание работает через pointer-события
  bindTouch(root) {
    for (const btn of root.querySelectorAll('[data-action]')) {
      const action = btn.dataset.action;
      const release = () => { this.touch[action] = false; };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.isActive()) return;
        btn.setPointerCapture?.(e.pointerId);
        this.touch[action] = true;
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  clear() {
    this.keys.clear();
    this.touch.left = this.touch.right = this.touch.jump = false;
  }
}
