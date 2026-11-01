// Пересечение двух прямоугольников {x, y, w, h}
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Двигает тело по осям раздельно и разрешает столкновения с платформами.
// По Y используется прежнее положение, поэтому герой не проваливается сквозь опору.
export function moveAndCollide(body, platforms, dt) {
  // --- по X: упор в боковую стену платформы
  body.x += body.vx * dt;
  for (const p of platforms) {
    if (!overlaps(body, p)) continue;
    if (body.vx > 0) body.x = p.x - body.w;
    else if (body.vx < 0) body.x = p.x + p.w;
    body.vx = 0;
  }

  // --- по Y: приземление сверху или удар головой снизу
  const prevY = body.y;
  body.y += body.vy * dt;
  body.onGround = false;
  for (const p of platforms) {
    if (!overlaps(body, p)) continue;
    if (prevY + body.h <= p.y + 0.5) {
      body.y = p.y - body.h; // встал на платформу
      body.vy = 0;
      body.onGround = true;
    } else if (prevY >= p.y + p.h - 0.5) {
      body.y = p.y + p.h; // ударился головой
      body.vy = 0;
    }
  }
}
