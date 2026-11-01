import { Player } from './Player.js';
import { Input } from './input.js';
import { overlaps } from './collision.js';

export const WIDTH = 800;
export const HEIGHT = 450;
const MAX_DT = 1 / 30;              // ограничение шага после задержки
const STORAGE_KEY = 'cat-rescue-best';
const FONT = 'system-ui, "Segoe UI", sans-serif';

// Уровень: герой стартует слева внизу, кот в клетке справа на верхней крыше
const LEVEL = {
  start: { x: 40, y: 340 },
  platforms: [
    { x: 0, y: 380, w: 170, h: 20 },
    { x: 250, y: 330, w: 120, h: 20 },
    { x: 440, y: 280, w: 110, h: 20 },
    { x: 250, y: 190, w: 110, h: 20 },
    { x: 470, y: 150, w: 330, h: 20 },
  ],
  items: [
    { x: 295, y: 260, w: 20, h: 20 },
    { x: 295, y: 120, w: 20, h: 20 },
    { x: 624, y: 85, w: 20, h: 20 },
  ],
  hazards: [{ x: 600, y: 132, w: 48, h: 18 }],   // шипы на последней крыше
  finish: { x: 735, y: 100, w: 65, h: 50 },      // клетка с котом
};

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.ctx = ui.canvas.getContext('2d');
    this.input = new Input(() => this.state === 'running');
    this.input.bindTouch(ui.touchEl);
    this.player = new Player(LEVEL.start.x, LEVEL.start.y);
    this.best = this.loadBest();
    this.state = 'ready';   // ready | running | paused | won | lost
    this.rafId = 0;
    this.last = null;
    this.result = null;
    this.stars = Array.from({ length: 40 }, (_, i) => ({
      x: (i * 173) % WIDTH, y: (i * 67) % 220, r: 1 + (i % 3) * 0.5,
    }));
    this.reset();
    this.bindUi();          // обработчики вешаются один раз
    this.setState('ready');
    this.render();
  }

  // ---------- хранилище рекорда ----------
  loadBest() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
  }
  saveBest() {
    try { localStorage.setItem(STORAGE_KEY, String(this.best)); } catch { /* хранилище недоступно */ }
  }

  // ---------- состояния ----------
  bindUi() {
    const { startBtn, pauseBtn, restartBtn } = this.ui;
    startBtn.addEventListener('click', () => { startBtn.blur(); this.start(); });
    pauseBtn.addEventListener('click', () => { pauseBtn.blur(); this.togglePause(); });
    restartBtn.addEventListener('click', () => { restartBtn.blur(); this.restart(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
  }

  setState(state) {
    this.state = state;
    this.input.clear();
    const { startBtn, pauseBtn } = this.ui;
    startBtn.disabled = state !== 'ready';
    pauseBtn.disabled = state !== 'running' && state !== 'paused';
    pauseBtn.textContent = state === 'paused' ? 'Продолжить' : 'Пауза';
  }

  reset() {
    this.player.reset();
    this.items = LEVEL.items.map((it) => ({ ...it, taken: false }));
    this.collected = 0;
    this.score = 0;
    this.time = 0;
    this.result = null;
    this.input.clear();
    this.updateHud();
  }

  start() {
    if (this.state !== 'ready') return;
    this.setState('running');
    this.startLoop();
  }

  pause() {
    if (this.state !== 'running') return;
    this.stopLoop();
    this.setState('paused');
    this.render();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.startLoop();   // время предыдущего кадра сбрасывается внутри
  }

  togglePause() {
    if (this.state === 'running') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  restart() {
    this.stopLoop();
    this.reset();
    this.setState('running');
    this.startLoop();
  }

  end(win, message) {
    this.stopLoop();
    if (win) {
      this.score += Math.max(0, 500 - Math.round(this.time * 10));   // бонус за скорость
      if (this.score > this.best) { this.best = this.score; this.saveBest(); }
    }
    this.result = { win, message };
    this.setState(win ? 'won' : 'lost');
    this.updateHud();
    this.render();
  }

  // ---------- игровой цикл (всегда не больше одного) ----------
  startLoop() {
    if (this.rafId) return;
    this.last = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stopLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    this.last = null;
  }

  loop = (t) => {
    this.rafId = 0;
    if (this.state !== 'running') return;
    if (this.last === null) this.last = t;
    const dt = Math.min((t - this.last) / 1000, MAX_DT);
    this.last = t;
    this.update(dt);
    this.render();
    if (this.state === 'running') this.rafId = requestAnimationFrame(this.loop);
  };

  update(dt) {
    this.time += dt;
    const p = this.player;
    p.update(dt, this.input, LEVEL.platforms, WIDTH);

    for (const it of this.items) {
      if (!it.taken && overlaps(p, it)) {
        it.taken = true;
        this.collected += 1;
        this.score += 100;
        this.updateHud();
      }
    }

    const body = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 };   // чуть мягче хитбокс
    if (LEVEL.hazards.some((h) => overlaps(body, h))) return this.end(false, 'Шипы на крыше! Перепрыгни их.');
    if (p.y > HEIGHT) return this.end(false, 'Ты упал с крыши. Попробуй ещё раз.');

    this.atLockedCage = false;
    if (overlaps(p, LEVEL.finish)) {
      if (this.collected === this.items.length) return this.end(true, '');
      this.atLockedCage = true;
    }
  }

  updateHud() {
    this.ui.scoreEl.textContent = this.score;
    this.ui.keysEl.textContent = `${this.collected}/${this.items.length}`;
    this.ui.bestEl.textContent = this.best;
  }

  // ---------- рисование ----------
  render() {
    const c = this.ctx;
    this.drawBackground(c);
    this.drawPlatforms(c);
    this.drawHazards(c);
    this.drawItems(c);
    this.drawCat(c);
    this.drawPlayer(c);
    this.drawOverlay(c);
  }

  drawBackground(c) {
    const g = c.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#0d1230');
    g.addColorStop(1, '#3a2b5c');
    c.fillStyle = g;
    c.fillRect(0, 0, WIDTH, HEIGHT);
    for (const [i, s] of this.stars.entries()) {
      c.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 2 + i);
      c.fillStyle = '#fff8dc';
      c.fillRect(s.x, s.y, s.r, s.r);
    }
    c.globalAlpha = 1;
    c.fillStyle = '#f7efc2';                       // луна
    c.beginPath(); c.arc(90, 80, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0f1535';
    c.beginPath(); c.arc(102, 72, 26, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 10; i++) {                 // силуэт города
      const h = 110 + ((i * 53) % 90);
      c.fillStyle = '#161a3b';
      c.fillRect(i * 80, HEIGHT - h, 74, h);
      c.fillStyle = '#e9b949';
      for (let y = HEIGHT - h + 14; y < HEIGHT - 10; y += 26) {
        if ((i * 7 + y) % 3 !== 0) c.fillRect(i * 80 + 12, y, 8, 10);
        if ((i * 5 + y) % 4 !== 0) c.fillRect(i * 80 + 44, y, 8, 10);
      }
    }
  }

  drawPlatforms(c) {
    for (const p of LEVEL.platforms) {
      c.fillStyle = '#6b3f2a';
      c.fillRect(p.x, p.y, p.w, p.h);
      c.strokeStyle = '#4a2a1c';
      c.lineWidth = 1;
      for (let x = p.x + 30; x < p.x + p.w; x += 30) {
        c.beginPath(); c.moveTo(x, p.y + 6); c.lineTo(x, p.y + p.h); c.stroke();
      }
      c.fillStyle = '#b5703f';
      c.fillRect(p.x, p.y, p.w, 6);
    }
  }

  drawHazards(c) {
    c.fillStyle = '#ef4a4a';
    for (const h of LEVEL.hazards) {
      for (let x = h.x; x < h.x + h.w; x += 12) {
        c.beginPath();
        c.moveTo(x, h.y + h.h); c.lineTo(x + 6, h.y); c.lineTo(x + 12, h.y + h.h);
        c.fill();
      }
    }
  }

  drawItems(c) {
    for (const it of this.items) {
      if (it.taken) continue;
      const bob = Math.sin(this.time * 4 + it.x) * 3;
      const cx = it.x + 10, cy = it.y + 7 + bob;
      c.fillStyle = '#ffd34d';
      c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0d1230';
      c.beginPath(); c.arc(cx, cy, 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd34d';
      c.fillRect(cx - 2, cy + 6, 4, 11);
      c.fillRect(cx + 2, cy + 11, 5, 3);
    }
  }

  drawCat(c) {
    const f = LEVEL.finish;
    const open = this.collected === this.items.length;
    const cx = f.x + 32;
    const hop = open ? Math.abs(Math.sin(this.time * 6)) * 8 : 0;
    const by = 150 - 12 - hop;
    c.fillStyle = '#f59e0b';
    c.beginPath(); c.ellipse(cx, by, 14, 10, 0, 0, Math.PI * 2); c.fill();      // тело
    c.beginPath(); c.arc(cx + 8, by - 10, 9, 0, Math.PI * 2); c.fill();         // голова
    c.beginPath(); c.moveTo(cx + 1, by - 16); c.lineTo(cx + 3, by - 26); c.lineTo(cx + 8, by - 18); c.fill();
    c.beginPath(); c.moveTo(cx + 9, by - 18); c.lineTo(cx + 14, by - 26); c.lineTo(cx + 16, by - 15); c.fill();
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(cx - 12, by); c.quadraticCurveTo(cx - 24, by - 10, cx - 16, by - 20); c.stroke();
    c.fillStyle = '#111';
    c.fillRect(cx + 5, by - 12, 2, 3); c.fillRect(cx + 11, by - 12, 2, 3);

    c.strokeStyle = '#cbd5e1'; c.lineWidth = 2;
    c.strokeRect(f.x + 8, 108, 50, 42);
    if (!open) {
      for (let x = f.x + 18; x < f.x + 58; x += 10) {
        c.beginPath(); c.moveTo(x, 108); c.lineTo(x, 150); c.stroke();
      }
      c.fillStyle = '#ffd34d'; c.fillRect(f.x + 26, 128, 12, 10);                // замок
    } else {
      c.fillStyle = '#ff6b8b'; c.font = `18px ${FONT}`; c.textAlign = 'center';
      c.fillText('♥', cx, 98);
    }
    if (this.atLockedCage && this.state === 'running') {
      c.fillStyle = '#ffd34d'; c.font = `bold 14px ${FONT}`; c.textAlign = 'right';
      c.fillText('Нужны все ключи!', WIDTH - 8, 98);
    }
  }

  drawPlayer(c) {
    const p = this.player;
    c.fillStyle = '#1e293b';
    c.fillRect(p.x + 5, p.y + 32, 8, 8);
    c.fillRect(p.x + 17, p.y + 32, 8, 8);
    c.fillStyle = '#38bdf8';
    c.fillRect(p.x + 3, p.y + 14, 24, 18);
    c.fillStyle = '#fcd9b6';
    c.beginPath(); c.arc(p.x + 15, p.y + 8, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ef4a4a';
    c.fillRect(p.x + 5, p.y - 1, 20, 5);
    c.fillStyle = '#111';
    c.fillRect(p.x + 14 + p.facing * 4, p.y + 7, 3, 3);
  }

  drawOverlay(c) {
    const texts = {
      ready: ['Спасение кота', 'Собери 3 ключа и открой клетку. Нажми «Старт».'],
      paused: ['Пауза', 'Нажми «Продолжить».'],
      won: ['Кот спасён!', `Счёт: ${this.score} · Рекорд: ${this.best}. «Заново» — сыграть ещё.`],
      lost: ['Не вышло', `${this.result?.message ?? ''} Нажми «Заново».`],
    }[this.state];
    if (!texts) return;
    c.fillStyle = 'rgba(8, 10, 28, 0.62)';
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.textAlign = 'center';
    c.fillStyle = '#fff8dc';
    c.font = `bold 44px ${FONT}`;
    c.fillText(texts[0], WIDTH / 2, HEIGHT / 2 - 10);
    c.font = `20px ${FONT}`;
    c.fillText(texts[1], WIDTH / 2, HEIGHT / 2 + 30);
  }
}
