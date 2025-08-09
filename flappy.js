/* =========================================================
   Flappy Bird+ (no libraries)
   + Autoplay AI Mode (targets next gap center)
   ========================================================= */

/* ------------------ Canvas & HUD ------------------ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// HUD elements
const $score = document.getElementById('score');
const $high  = document.getElementById('high');
const $power = document.getElementById('power');
const $btnStart = document.getElementById('btnStart');
const $btnPause = document.getElementById('btnPause');
const $btnAI    = document.getElementById('btnAI');

// Persisted high score
const HIGH_KEY = 'flappy_highscore_v1';
let highScore = Number(localStorage.getItem(HIGH_KEY) || 0);
$high.textContent = `High: ${highScore}`;

/* ------------------ Game Constants ------------------ */
let rngSeed = Date.now();                   // tiny RNG seed
const rand = () => (rngSeed ^= rngSeed<<13, rngSeed ^= rngSeed>>7, rngSeed ^= rngSeed<<17, (rngSeed>>>0)/4294967296);

const G = 2100;                             // gravity (px/s^2)
const FLAP_VY = -580;                       // flap impulse
const WORLD_SPEED = 200;                    // base scroll speed
const GAP_MIN = 140, GAP_MAX = 200;         // pipe gap size range
const PIPE_SPACING = 230, PIPE_WIDTH = 80;
const GROUND_H = 90;

const COIN_R = 9, POWER_R = 12;

// --- AI tuning ---
const AI_MIN_LOOKAHEAD = 0.18;   // seconds; ignore micro-timesteps
const AI_MAX_LOOKAHEAD = 0.85;   // seconds; don't aim too far ahead
const AI_BASE_MARGIN   = 10;     // px dead-zone around target
const AI_SPEED_MARGIN  = 0.04;   // extra margin per |vy| pixel/s
const AI_VY_CAP        = 320;    // if falling faster than this, consider flapping
const AI_FLAP_COOLDOWN = 140;    // ms between flaps to prevent spam
let   aiLastFlapAtMs   = 0;      // timestamp of last AI flap

/* ------------------ Power-ups ------------------ */
const POWERS = { NONE:'NONE', SHIELD:'SHIELD', SLOW:'SLOW', DOUBLE:'DOUBLE' };
const POWER_DURATION = { SLOW:5000, DOUBLE:6000 };

/* ------------------ Session State ------------------ */
let s;
let aiEnabled = false; // <— NEW: global AI flag

function resetState(){
  s = {
    running:false, paused:false,
    tPrev: performance.now(), slowFactor:1,
    score:0,
    bird:{ x:W*0.28, y:H*0.45, vx:0, vy:0, r:18, alive:true, shield:false },
    pipes:[], coins:[], powerups:[],
    sincePower:0,
    activePower: POWERS.NONE, powerUntil: 0
  };
  // pre-spawn a few pipes
  let x = W + 200;
  for(let i=0;i<6;i++){ spawnPipeAt(x); x += PIPE_SPACING; }
}

/* ------------------ Spawns ------------------ */
function spawnPipeAt(x){
  const gapH = Math.round(GAP_MIN + (GAP_MAX-GAP_MIN)*rand());
  const margin = 60;
  const gapY = Math.round(lerp(margin+gapH/2, H - GROUND_H - margin - gapH/2, rand()));
  s.pipes.push({ x, gapY, gapH, passed:false });

  // occasional coin inside the gap
  if(rand() < 0.65) s.coins.push({ x:x + PIPE_WIDTH/2, y:gapY, taken:false });

  // periodic power-up slightly after the pipe
  s.sincePower++;
  if(s.sincePower >= 4 && rand()<0.55){
    s.sincePower = 0;
    const type = choosePowerType();
    s.powerups.push({ x:x + 140, y: gapY + (rand()<0.5? -gapH*0.25 : gapH*0.25), type, taken:false });
  }
}
function choosePowerType(){ const r=rand(); return r<0.4?POWERS.SHIELD : r<0.7?POWERS.SLOW : POWERS.DOUBLE; }

/* ------------------ Helpers ------------------ */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

/* ------------------ Input / Controls ------------------ */
let pointerDown=false;
function flap(){
  if(!s.running){ startGame(); return; }
  if(!s.bird.alive) return;
  s.bird.vy = FLAP_VY;
}
function pauseToggle(){ if(!s.running) return; s.paused=!s.paused; $btnPause.textContent = s.paused ? '▶ Resume' : '⏸ Pause'; }
function aiToggle(){
  aiEnabled = !aiEnabled;
  $btnAI.textContent = `🤖 AI: ${aiEnabled?'On':'Off'}`;
  // If AI turned on and game not running, start it. Also auto-restart on death.
  if(aiEnabled && (!s.running || !s.bird.alive)) startGame();
}

window.addEventListener('keydown', (e)=>{
  if(e.code==='Space'){ e.preventDefault(); flap(); }
  if(e.code==='KeyP'){ pauseToggle(); }
  if(e.code==='KeyR'){ restart(); }
  if(e.code==='KeyA'){ aiToggle(); }
});
canvas.addEventListener('pointerdown', e=>{ pointerDown=true; flap(); });
canvas.addEventListener('pointerup',   ()=>{ pointerDown=false; });
$btnStart.addEventListener('click', ()=> s.running ? restart() : startGame());
$btnPause.addEventListener('click', pauseToggle);
$btnAI.addEventListener('click', aiToggle);

/* ------------------ Game Loop ------------------ */
function startGame(){
  s.running = true; s.paused = false; s.bird.alive = true;
  s.tPrev = performance.now();
  $btnStart.textContent = '⟲ Restart';
  $btnPause.textContent = '⏸ Pause';
}
function restart(){
  resetState();
  $score.textContent = `Score: 0`;
  setPower(POWERS.NONE);
  $btnStart.textContent = '▶ Start';
  $btnPause.textContent = '⏸ Pause';
}

function loop(t){
  requestAnimationFrame(loop);
  const dtRaw = (t - s.tPrev) / 1000;
  s.tPrev = t;

  if(!s.running || s.paused){
    render(0);
    return;
  }

  // Slow-mo time dilation
  s.slowFactor = s.activePower===POWERS.SLOW ? 0.5 : 1;
  let dt = dtRaw * s.slowFactor;

  // If AI is on, let it decide to flap BEFORE physics integrates
  if(aiEnabled && s.bird.alive) aiController();

  update(dt);
  render(dt);
}
requestAnimationFrame(loop);

/* ------------------ Update ------------------ */
function update(dt){
  const b = s.bird;

  // Physics
  b.vy += G * dt;
  b.y  += b.vy * dt;

  // Scroll world
  const speed = WORLD_SPEED;
  for(const p of s.pipes) p.x -= speed * dt;
  for(const c of s.coins) c.x -= speed * dt;
  for(const pu of s.powerups) pu.x -= speed * dt;

  // Spawn new pipes as needed
  const rightMost = s.pipes.length ? s.pipes[s.pipes.length-1].x : 0;
  if(rightMost < W - PIPE_SPACING) spawnPipeAt(W + 60);

  // Cull offscreen
  s.pipes = s.pipes.filter(p=> p.x > -PIPE_WIDTH-10);
  s.coins = s.coins.filter(c=> c.x > -20 && !c.taken);
  s.powerups = s.powerups.filter(pu=> pu.x > -20 && !pu.taken);

  // Bounds
  if(b.y - b.r < 0){ b.y = b.r; b.vy = 0; }
  if(b.y + b.r > H - GROUND_H){ b.y = H - GROUND_H - b.r; killBird(); }

  // Pipe collisions & pass scoring
  for(const p of s.pipes){
    const inX = (b.x + b.r > p.x) && (b.x - b.r < p.x + PIPE_WIDTH);
    const gapTop = p.gapY - p.gapH/2;
    const gapBot = p.gapY + p.gapH/2;
    const hitTop = b.y - b.r < gapTop;
    const hitBot = b.y + b.r > gapBot;

    if(inX && (hitTop || hitBot)){
      if(b.shield){ b.shield=false; flashPowerText('Shield broke!'); b.vy = Math.min(b.vy,0) + FLAP_VY*0.6; }
      else { killBird(); }
    }
    if(!p.passed && p.x + PIPE_WIDTH < b.x - b.r){
      p.passed = true;
      addScore(s.activePower===POWERS.DOUBLE ? 2 : 1);
    }
  }

  // Coins
  for(const c of s.coins){
    if(c.taken) continue;
    if(circleRectOverlap(b.x,b.y,b.r, c.x-COIN_R,c.y-COIN_R, COIN_R*2,COIN_R*2)){
      c.taken = true;
      addScore((s.activePower===POWERS.DOUBLE ? 2 : 1) * 5);
      pulseHUD($score);
    }
  }

  // Power-ups
  for(const pu of s.powerups){
    if(pu.taken) continue;
    if(circleRectOverlap(b.x,b.y,b.r, pu.x-POWER_R,pu.y-POWER_R, POWER_R*2,POWER_R*2)){
      pu.taken=true; activatePower(pu.type);
    }
  }
  if(s.activePower===POWERS.SLOW   && performance.now()>s.powerUntil) setPower(POWERS.NONE);
  if(s.activePower===POWERS.DOUBLE && performance.now()>s.powerUntil) setPower(POWERS.NONE);
}

/* ------------------ AI Controller ------------------
   Simple heuristic controller:
   - Look at the next pipe ahead of the bird.
   - Aim for the center of its gap (with slight forward-look).
   - Flap when below target or falling too fast.
   - Auto-start and auto-restart if the bird dies.
---------------------------------------------------- */
function aiController(){
  // Auto-start
  if(!s.running) startGame();

  // Auto-restart after death
  if(!s.bird.alive){
    setTimeout(()=>{ if(aiEnabled && (!s.running || !s.bird.alive)) { restart(); startGame(); }}, 350);
    return;
  }

  const b = s.bird;

  // Find the next pipe AHEAD of the bird
  let next = null;
  for(const p of s.pipes){
    if(p.x + PIPE_WIDTH >= b.x - 6){ next = p; break; }
  }
  if(!next) return;

  // Horizontal distance to the FRONT of the next pipe (safer than center)
  const dx = (next.x - (b.x - b.r));
  const baseSpeed = WORLD_SPEED; // scroll speed
  let t = dx / Math.max(60, baseSpeed); // ETA in seconds

  // Clamp the look-ahead into a sane range
  t = Math.min(AI_MAX_LOOKAHEAD, Math.max(AI_MIN_LOOKAHEAD, t));

  // Target the center of the gap with a tiny upward bias
  const targetY = next.gapY - 4;

  // Predict vertical position with NO flap
  const yNoFlap = b.y + b.vy * t + 0.5 * G * t * t;

  // Predict vertical position IF we flap now (reset vy to FLAP_VY)
  const yFlap   = b.y + FLAP_VY * t + 0.5 * G * t * t;

  // Dynamic dead-zone grows with |vy| so we don't micro-flap
  const margin = AI_BASE_MARGIN + Math.abs(b.vy) * AI_SPEED_MARGIN;

  // Decision logic (bang-bang with hysteresis & overshoot check):
  //  - If we will be BELOW the band -> consider flap.
  //  - BUT only flap if flapping won't overshoot ABOVE the band.
  //  - Also, if we’re plummeting too fast, allow a safety flap.
  const now = performance.now();
  const canFlap = (now - aiLastFlapAtMs) > AI_FLAP_COOLDOWN;

  const willBeBelow = (yNoFlap > (targetY + margin));
  const flapOvershoots = (yFlap < (targetY - margin)); // would end up too high

  const fallingTooFast = b.vy > AI_VY_CAP;

  if(canFlap && ( (willBeBelow && !flapOvershoots) || fallingTooFast )){
    b.vy = FLAP_VY;               // do a single flap
    aiLastFlapAtMs = now;         // start cooldown
  }

  // Ground panic: always flap if dangerously low
  if(canFlap && b.y > (H - GROUND_H - 1.65*b.r)){
    b.vy = FLAP_VY;
    aiLastFlapAtMs = performance.now();
  }
}

/* ------------------ Render ------------------ */
function render(){
  ctx.clearRect(0,0,W,H);

  // Clouds (simple ovals)
  drawClouds();

  // Pipes
  for(const p of s.pipes) drawPipe(p);

  // Coins
  for(const c of s.coins) if(!c.taken) drawCoin(c);

  // Power-ups
  for(const pu of s.powerups) if(!pu.taken) drawPower(pu);

  // Bird
  drawBird();

  // Ground
  drawGround();

  if(!s.running) drawCenteredText('Tap/Space to Start — or press A for AI', W/2, H*0.30, 20, 'rgba(0,0,0,.45)');
  if(s.paused)   drawCenteredText('Paused', W/2, H*0.45, 42, 'rgba(0,0,0,.45)');
}

/* ---- Visual helpers (same as before) ---- */
const CLOUDS = [
  {y:90,  speed:15,  scale:1.2},
  {y:160, speed:22,  scale:0.8},
  {y:40,  speed:12,  scale:1.5}
];
let cloudOffset=0;
function drawClouds(){
  const dt = 1/60 * (s.running && !s.paused ? (1/s.slowFactor) : 0); // drift regardless of slow-mo
  cloudOffset += dt * 10;
  for(const c of CLOUDS){
    const baseSpeed = c.speed;
    for(let k=0;k<3;k++){
      const x = ((k*220 + cloudOffset*baseSpeed) % (W+260)) - 130;
      cloud(ctx, x, c.y, 80*c.scale, 30*c.scale);
    }
  }
}
function cloud(ctx,x,y,w,h){
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(x,y,w,h,0,0,Math.PI*2);
  ctx.ellipse(x+0.6*w,y-0.4*h,0.7*w,0.7*h,0,0,Math.PI*2);
  ctx.ellipse(x-0.6*w,y-0.3*h,0.6*w,0.6*h,0,0,Math.PI*2);
  ctx.fill(); ctx.restore();
}
let groundOffset=0;
function drawGround(){
  groundOffset = (groundOffset + (s.running && !s.paused ? WORLD_SPEED/60 : 0)) % 40;
  ctx.save();
  ctx.fillStyle='#75cc6f'; ctx.fillRect(0, H-GROUND_H, W, GROUND_H);
  ctx.fillStyle='#63b85d';
  for(let x=-groundOffset; x<W; x+=40) ctx.fillRect(x, H-GROUND_H, 20, GROUND_H);
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(0, H-GROUND_H, W, 4);
  ctx.restore();
}
function drawPipe(p){
  const x=p.x, gapTop=p.gapY - p.gapH/2, gapBot=p.gapY + p.gapH/2;
  ctx.save();
  ctx.fillStyle='#2fb34c';
  ctx.fillRect(x,0,PIPE_WIDTH,gapTop);
  ctx.fillRect(x,gapBot,PIPE_WIDTH,H-GROUND_H-gapBot);
  ctx.fillStyle='#27a143';
  ctx.fillRect(x-4,gapTop-16,PIPE_WIDTH+8,16);
  ctx.fillRect(x-4,gapBot,    PIPE_WIDTH+8,16);
  ctx.restore();
}
function drawCoin(c){
  ctx.save(); ctx.translate(c.x,c.y);
  ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(0,0,COIN_R,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e9b949'; ctx.fillRect(-2,-COIN_R*0.7,4,COIN_R*1.4);
  ctx.restore();
}
function drawPower(pu){
  ctx.save(); ctx.translate(pu.x,pu.y);
  if(pu.type===POWERS.SHIELD){
    ctx.strokeStyle='#4ade80'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,POWER_R,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(0,7); ctx.lineTo(10,-9); ctx.stroke();
  } else if(pu.type===POWERS.SLOW){
    ctx.strokeStyle='#66e1ff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,POWER_R,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,-7); ctx.lineTo(-7,7); ctx.lineTo(7,7); ctx.stroke();
  } else {
    ctx.strokeStyle='#ffb703'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,POWER_R,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.moveTo(0,-6); ctx.lineTo(0,6); ctx.stroke();
  }
  ctx.restore();
}
function drawBird(){
  const b=s.bird;
  ctx.save(); ctx.translate(b.x,b.y);
  ctx.fillStyle='#ffdd57'; ctx.beginPath(); ctx.ellipse(0,0,b.r+2,b.r,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(6,-4,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(7,-4,2.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff9933'; ctx.beginPath(); ctx.moveTo(b.r-6,0); ctx.lineTo(b.r+10,-4); ctx.lineTo(b.r+10,4); ctx.closePath(); ctx.fill();
  const wingY = Math.sin(performance.now()/120)*3; ctx.fillStyle='#f4c84d';
  ctx.beginPath(); ctx.ellipse(-4, wingY, 10, 6, 0, 0, Math.PI*2); ctx.fill();
  if(b.shield){ ctx.strokeStyle='rgba(74,222,128,0.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,b.r+5,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
}
function drawCenteredText(text,x,y,size,color){
  ctx.save(); ctx.fillStyle=color||'#000'; ctx.font=`${size||28}px system-ui,Segoe UI,Roboto,sans-serif`;
  ctx.textAlign='center'; ctx.fillText(text,x,y); ctx.restore();
}

/* ------------------ Collision & UI helpers ------------------ */
function circleRectOverlap(cx,cy,cr, rx,ry,rw,rh){
  const x = clamp(cx, rx, rx+rw), y = clamp(cy, ry, ry+rh);
  const dx=cx-x, dy=cy-y; return dx*dx + dy*dy <= cr*cr;
}
function flashPowerText(txt){ $power.title = txt; }
function pulseHUD(el){ el.animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}], {duration:260, easing:'ease-out'}); }

/* ------------------ Score & Power state ------------------ */
function killBird(){
  if(!s.bird.alive) return;
  s.bird.alive=false; s.running=false;
  if(s.score>highScore){ highScore=s.score; localStorage.setItem(HIGH_KEY,String(highScore)); $high.textContent=`High: ${highScore}`; }
  flashPowerText('Game Over');
  // If AI is on, schedule auto-restart
  if(aiEnabled) setTimeout(()=>{ if(!s.running) restart(), startGame(); }, 350);
}
function addScore(n){ s.score+=n; $score.textContent = `Score: ${s.score}`; }
function setPower(type){
  s.activePower=type;
  $power.textContent = 'Power-up: ' + (type===POWERS.NONE?'–': type===POWERS.SHIELD?'🛡 Shield': type===POWERS.SLOW?'⏳ Slow-Mo':'✖ 2× Score');
  $power.className =
    type===POWERS.NONE   ? 'power-none'   :
    type===POWERS.SHIELD ? 'power-shield' :
    type===POWERS.SLOW   ? 'power-slow'   :
    'power-double';
}
function activatePower(type){
  if(type===POWERS.SHIELD){ s.bird.shield=true; setPower(POWERS.SHIELD); flashPowerText('Shield on!'); }
  if(type===POWERS.SLOW){   s.powerUntil=performance.now()+POWER_DURATION.SLOW; setPower(POWERS.SLOW); flashPowerText('Slow-Motion!'); }
  if(type===POWERS.DOUBLE){ s.powerUntil=performance.now()+POWER_DURATION.DOUBLE; setPower(POWERS.DOUBLE); flashPowerText('2× Score!'); }
  pulseHUD($power);
}

/* ------------------ Boot ------------------ */
resetState();
