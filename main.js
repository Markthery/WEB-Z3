import { Game } from './Game.js';

const $ = (id) => document.getElementById(id);

new Game({
  canvas: $('game'),
  startBtn: $('start'),
  pauseBtn: $('pause'),
  restartBtn: $('restart'),
  scoreEl: $('score'),
  keysEl: $('keys'),
  bestEl: $('best'),
  touchEl: $('touch'),
});
