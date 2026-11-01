import { moveAndCollide } from './collision.js';

// Физика в пикселях и секундах
const SPEED = 260;       // макс. скорость, px/s
const ACCEL = 2200;      // разгон, px/s²
const FRICTION = 2600;   // торможение, px/s²
const GRAVITY = 1800;    // px/s²
const JUMP_SPEED = 640;  // начальная скорость прыжка, px/s (высота ≈ 114 px)
const MAX_FALL = 900;

export class Player {
  constructor(x, y) {
    this.w = 30;
    this.h = 40;
    this.spawn = { x, y };
    this.reset();
  }

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.jumpHeld = false;
  }

  update(dt, input, platforms, worldWidth) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) this.facing = dir;

    // плавный разгон и торможение
    const target = dir * SPEED;
    const rate = (dir ? ACCEL : FRICTION) * dt;
    if (this.vx < target) this.vx = Math.min(this.vx + rate, target);
    else if (this.vx > target) this.vx = Math.max(this.vx - rate, target);

    // прыжок только с опоры, один раз на нажатие
    if (input.jump) {
      if (!this.jumpHeld && this.onGround) {
        this.vy = -JUMP_SPEED;
        this.onGround = false;
      }
      this.jumpHeld = true;
    } else {
      this.jumpHeld = false;
    }

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    moveAndCollide(this, platforms, dt);

    // границы экрана по горизонтали
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > worldWidth) { this.x = worldWidth - this.w; this.vx = 0; }
  }
}
