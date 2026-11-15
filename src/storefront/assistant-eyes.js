/* ===== cursor-following eyes (pupils only, clamped to the eye shape, rAF-smoothed) ===== */
const RM=matchMedia('(prefers-reduced-motion: reduce)'),TOUCH=matchMedia('(pointer: coarse)');
let ptr=null,cur=[0,0],tgt=[0,0],raf=0,idle;
function initEyes(){const f=$('#face');cur=[0,0];tgt=TOUCH.matches?[-1.5,1]:[0,0];if(f)setEyes()}
function setEyes(){document.querySelectorAll('.eye').forEach(e=>e.setAttribute('transform',`translate(${cur[0].toFixed(2)} ${cur[1].toFixed(2)})`))}
function tick(){raf=0;const d=RM.matches?1:.18;cur=[cur[0]+(tgt[0]-cur[0])*d,cur[1]+(tgt[1]-cur[1])*d];setEyes();if(Math.abs(tgt[0]-cur[0])+Math.abs(tgt[1]-cur[1])>.02)raf=requestAnimationFrame(tick)}
document.addEventListener('pointermove',e=>{const f=$('#face');if(!f||e.pointerType==='touch'||TOUCH.matches||RM.matches)return;
 const r=f.getBoundingClientRect(),k=r.width/300,cx=r.left+150*k,cy=r.top+150*k,dx=e.clientX-cx,dy=e.clientY-cy,dist=Math.hypot(dx,dy)||1,m=Math.min(1,dist/(260*k));
 tgt=[dx/dist*m*5.5,dy/dist*m*3.5];clearTimeout(idle);idle=setTimeout(()=>{tgt=[0,0];if(!raf)raf=requestAnimationFrame(tick)},3500);if(!raf)raf=requestAnimationFrame(tick)},{passive:true});
