/* Magnetic buttons: [data-magnetic] elements glide toward the cursor and slide back
   when it leaves. The resting centre excludes the button's own offset, so its movement
   never feeds back into the measurement (which caused the jitter). */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  const PULL=.3;     // how far the button follows the cursor
  const GLIDE=.09;   // lower = icier, longer glide

  document.querySelectorAll('[data-magnetic]').forEach(btn=>{
    let x=0, y=0, tx=0, ty=0, raf=0;
    const tick=()=>{
      x+=(tx-x)*GLIDE; y+=(ty-y)*GLIDE;
      if(Math.abs(tx-x)<.05 && Math.abs(ty-y)<.05){ x=tx; y=ty; raf=0; }
      else raf=requestAnimationFrame(tick);
      btn.style.transform= x||y ? `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)` : '';
    };
    const go=()=>{ if(!raf) raf=requestAnimationFrame(tick); };
    btn.addEventListener('pointermove',e=>{
      const r=btn.getBoundingClientRect();
      const cx=r.left-x+r.width/2, cy=r.top-y+r.height/2;
      tx=(e.clientX-cx)*PULL; ty=(e.clientY-cy)*PULL;
      go();
    });
    btn.addEventListener('pointerleave',()=>{ tx=0; ty=0; go(); });
  });
})();
