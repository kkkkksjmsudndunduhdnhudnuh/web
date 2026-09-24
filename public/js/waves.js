/* Scroll-driven wave background.
   Every [data-wave] section brings in the next wave: it rises from the bottom until it
   almost fills the screen, and the previous wave's colour stays above it. The optional
   attribute value (tea | pink | lilac | vanilla) picks the colour.
   Wave curves use getwaves.io's math (d3 curveBasis on a 1440x320 grid, heights snapped
   to 32), closed periodically so the double-width copy can drift in a seamless loop. */
(function(){
  const host=document.querySelector('.bgwaves');
  if(!host) return;

  const COLORS={tea:'var(--tea)', pink:'var(--pink)', lilac:'var(--lilac)', vanilla:'var(--vanilla)'};
  const ORDER=['tea','pink','lilac','vanilla'];
  const SHAPES=[[160,288,96,224,128,256],[192,64,256,128,224],[96,224,32,192],[224,96,256,160,288,64]];
  const REST=+(document.body.dataset.waveRest||.68);   // first wave's resting top edge (fraction of viewport)
  const TOP=.1;     // "almost full" position once its section has scrolled in

  const n1=v=>+v.toFixed(1);
  function wavePath(ys){
    const n=ys.length, step=1440/n, Y=i=>ys[((i%n)+n)%n];
    let d=`M0,${n1((Y(-1)+4*Y(0)+Y(1))/6)}`;
    for(let i=0;i<2*n;i++){
      const x=i*step;
      d+=`C${n1(x+step/3)},${n1((2*Y(i)+Y(i+1))/3)},${n1(x+2*step/3)},${n1((Y(i)+2*Y(i+1))/3)},${n1(x+step)},${n1((Y(i)+4*Y(i+1)+Y(i+2))/6)}`;
    }
    return d+'L2880,320L0,320Z';
  }
  const svg=(ys,cls)=>`<svg class="wave ${cls}" viewBox="0 0 2880 320" preserveAspectRatio="none"><path d="${wavePath(ys)}"/></svg>`;

  const sections=[...document.querySelectorAll('[data-wave]')];
  const names=sections.length ? sections.map((s,i)=>COLORS[s.dataset.wave]?s.dataset.wave:ORDER[i%ORDER.length]) : [ORDER[0]];
  const bands=names.map((name,i)=>{
    const band=document.createElement('div');
    band.className='wave-band';
    band.style.setProperty('--c',COLORS[name]);
    band.innerHTML=svg(SHAPES[(i+1)%SHAPES.length],'back')+'<div class="wave-fill back"></div>'
      +svg(SHAPES[i%SHAPES.length],'front')+'<div class="wave-fill"></div>';
    host.appendChild(band);
    return band;
  });

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease=t=>t*t*(3-2*t);
  const G0=TOP-REST;
  let H=innerHeight, target=G0, current=null, raf=0;

  // g counts how many waves have risen: band i sits at (TOP + i - g) viewport heights.
  // A wave rises while its section's top travels from the viewport bottom to 20% from the
  // top; sections already on screen at load start rising from the first scroll instead.
  function progress(){
    if(reduce) return G0;
    const y=scrollY;
    let g=G0;
    sections.forEach((s,i)=>{
      const top=s.getBoundingClientRect().top+y;
      const start=Math.max(0,top-H), end=Math.max(start+H*.45, top-H*.2);
      const q=ease(Math.min(1,Math.max(0,(y-start)/(end-start))));
      g+= i===0 ? q*-G0 : q;
    });
    return g;
  }
  function frame(){
    raf=0;
    current= current===null ? target : current+(target-current)*.12;
    if(Math.abs(target-current)<.0004) current=target;
    else raf=requestAnimationFrame(frame);
    bands.forEach((b,i)=>{ b.style.transform=`translate3d(0,${((TOP+i-current)*H).toFixed(1)}px,0)`; });
  }
  function update(){ target=progress(); if(!raf) raf=requestAnimationFrame(frame); }

  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',()=>{ H=innerHeight; update(); });
  addEventListener('load',update);
  update();
})();
