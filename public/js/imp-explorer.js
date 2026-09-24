/* Impressum: Liquid Glass topic picker. The options come from the (visually hidden)
   .imp-list rows, so translations apply automatically. Picking a topic fades the old
   answer out, sweeps a sheen across the glass and types the new answer. */
(function(){
  const root=document.getElementById('impPick');
  if(!root) return;
  const btn=document.getElementById('impPickBtn');
  const list=document.getElementById('impPickMenu');
  const menu=list.parentElement;
  const pill=menu.querySelector('.lg-menu-pill');
  const current=document.getElementById('impPickCurrent');
  const answer=document.getElementById('impAnswer');
  const inner=answer.querySelector('.lg-answer-inner');
  const topicEl=document.getElementById('impTopic');
  const wrap=document.getElementById('impTypedWrap');
  const typed=document.getElementById('impTyped');
  const note=document.getElementById('impNote');
  const live=document.getElementById('impLive');
  const rows=[...document.querySelectorAll('.imp-list .imp-row')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  let index=0, active=-1, run=0, started=false, keyPickAt=0;

  const clean=s=>s.replace(/\s+/g,' ').trim();
  const topic=i=>{
    const dd=rows[i].querySelector('dd'), main=dd.cloneNode(true), small=dd.querySelector('small');
    main.querySelectorAll('small').forEach(el=>el.remove());
    const text=clean(main.textContent);
    return {label:clean(rows[i].querySelector('dt').textContent), text, html:main.innerHTML.trim(),
            note: small ? small.innerHTML : '', full: small ? `${text} – ${clean(small.textContent)}` : text};
  };
  const isOpen=()=>root.classList.contains('open');

  /* ---------- Dropdown ---------- */
  function buildMenu(){
    list.innerHTML='';
    rows.forEach((_,i)=>{
      const li=document.createElement('li');
      li.id='impOpt'+i;
      li.style.setProperty('--i',i);
      li.setAttribute('role','option');
      li.setAttribute('aria-selected', String(i===index));
      li.textContent=topic(i).label;
      li.addEventListener('click',()=>{ select(i); close(); btn.focus(); });
      li.addEventListener('pointerenter',()=>{ active=i; highlight(); });
      list.appendChild(li);
    });
    current.textContent=topic(index).label;
  }
  function highlight(){
    const li=list.children[active];
    if(!li){ pill.classList.remove('on'); btn.removeAttribute('aria-activedescendant'); return; }
    li.scrollIntoView({block:'nearest'});
    const m=menu.getBoundingClientRect(), r=li.getBoundingClientRect();
    pill.style.width=r.width+'px'; pill.style.height=r.height+'px';
    pill.style.transform=`translate(${r.left-m.left}px,${r.top-m.top}px)`;
    pill.classList.add('on');
    btn.setAttribute('aria-activedescendant', li.id);
  }
  function open(){
    root.classList.add('open'); btn.setAttribute('aria-expanded','true');
    active=index;
    pill.style.transition='none'; highlight(); pill.offsetWidth; pill.style.transition='';
  }
  function close(){
    root.classList.remove('open'); btn.setAttribute('aria-expanded','false');
    btn.removeAttribute('aria-activedescendant'); pill.classList.remove('on');
  }
  list.addEventListener('pointerleave',()=>{ active=index; highlight(); });

  async function setLabel(text){
    if(reduce){ current.textContent=text; return; }
    current.classList.add('swap'); await sleep(200);
    current.textContent=text; current.classList.remove('swap');
  }
  function select(i){
    index=i;
    [...list.children].forEach((li,k)=>li.setAttribute('aria-selected', String(k===i)));
    setLabel(topic(i).label);
    type(i);
  }

  /* ---------- Answer ---------- */
  async function type(i){
    const me=++run, t=topic(i);
    live.textContent=`${t.label}: ${t.full}`;
    if(reduce){ topicEl.textContent=t.label; typed.innerHTML=t.html; note.innerHTML=t.note; return; }

    topicEl.classList.add('out'); wrap.classList.add('out'); note.classList.add('out');
    await sleep(260);
    if(me!==run) return;
    topicEl.textContent=t.label; typed.textContent=''; note.innerHTML=''; note.classList.remove('out','show');
    topicEl.classList.remove('out'); wrap.classList.remove('out'); wrap.classList.add('typing');
    answer.classList.remove('sheen'); answer.offsetWidth; answer.classList.add('sheen');
    await sleep(240);

    const chars=Array.from(t.text);
    for(let k=1;k<=chars.length;k++){
      if(me!==run) return;
      typed.textContent=chars.slice(0,k).join('');
      await sleep(/[ ,.·&/–-]/.test(chars[k-1]) ? 60+Math.random()*50 : 28+Math.random()*32);
    }
    if(me!==run) return;
    typed.innerHTML=t.html;
    wrap.classList.remove('typing');
    if(t.note){ note.innerHTML=t.note; note.classList.add('show'); }
  }

  // Animate the glass box height as the answer grows or shrinks.
  new ResizeObserver(()=>{ answer.style.height=inner.offsetHeight+'px'; }).observe(inner);

  /* ---------- Refraction (Chromium renders SVG filters in backdrop-filter) ---------- */
  if(window.chrome && CSS.supports('backdrop-filter','blur(1px)')){
    const NS='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(NS,'svg');
    defs.setAttribute('width','0'); defs.setAttribute('height','0'); defs.setAttribute('aria-hidden','true');
    defs.style.position='absolute';
    document.body.appendChild(defs);

    // Displacement map: pixels near the rounded edge are pushed along the edge normal,
    // strongest at the rim, like light bending through the lip of a glass lens.
    function lensMap(w,h,radius,depth){
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d'), img=ctx.createImageData(w,h), d=img.data;
      const hw=w/2, hh=h/2, r=Math.min(radius,hw,hh);
      const sdf=(x,y)=>{
        const qx=Math.abs(x-hw)-(hw-r), qy=Math.abs(y-hh)-(hh-r);
        return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;
      };
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){
        const s=sdf(x+.5,y+.5), t=1+s/depth, i=(y*w+x)*4;
        let dx=0, dy=0;
        if(t>0 && s<=0){
          const gx=sdf(x+1.5,y+.5)-sdf(x-.5,y+.5), gy=sdf(x+.5,y+1.5)-sdf(x+.5,y-.5), len=Math.hypot(gx,gy)||1, m=t*t;
          dx=gx/len*m; dy=gy/len*m;
        }
        d[i]=128+dx*127; d[i+1]=128+dy*127; d[i+2]=128; d[i+3]=255;
      }
      ctx.putImageData(img,0,0);
      return c.toDataURL();
    }

    document.querySelectorAll('.lg-glass').forEach((el,n)=>{
      const id='lg-lens-'+n, blur=el.dataset.lgBlur||8;
      const filter=document.createElementNS(NS,'filter');
      filter.id=id; filter.setAttribute('color-interpolation-filters','sRGB');
      filter.innerHTML='<feImage result="map" x="0" y="0" preserveAspectRatio="none"/>'
        +'<feDisplacementMap in="SourceGraphic" in2="map" scale="-46" xChannelSelector="R" yChannelSelector="G"/>';
      defs.appendChild(filter);
      const image=filter.querySelector('feImage');
      let timer=0;
      const rebuild=()=>{
        const w=Math.round(el.offsetWidth), h=Math.round(el.offsetHeight);
        if(!w||!h) return;
        const radius=parseFloat(getComputedStyle(el).borderTopLeftRadius)||0;
        image.setAttribute('width',w); image.setAttribute('height',h);
        image.setAttribute('href', lensMap(w,h,radius,Math.min(28,h/2)));
        el.style.backdropFilter=`url(#${id}) blur(${blur}px) saturate(150%) brightness(1.03)`;
      };
      new ResizeObserver(()=>{ clearTimeout(timer); timer=setTimeout(rebuild,120); }).observe(el);
    });
  }

  /* ---------- Wiring ---------- */
  btn.addEventListener('click',()=>{
    if(performance.now()-keyPickAt<400) return;
    isOpen() ? close() : open();
  });
  btn.addEventListener('keydown',e=>{
    const n=rows.length;
    if(!isOpen()){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); open(); }
      return;
    }
    if(e.key==='ArrowDown'){ e.preventDefault(); active=Math.min(n-1,active+1); highlight(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); active=Math.max(0,active-1); highlight(); }
    else if(e.key==='Home'){ e.preventDefault(); active=0; highlight(); }
    else if(e.key==='End'){ e.preventDefault(); active=n-1; highlight(); }
    else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); keyPickAt=performance.now(); select(active); close(); }
    else if(e.key==='Escape'){ e.preventDefault(); close(); }
    else if(e.key==='Tab'){ close(); }
  });
  document.addEventListener('click',e=>{ if(!root.contains(e.target)) close(); });

  buildMenu();
  new IntersectionObserver((entries,obs)=>{
    if(entries.some(e=>e.isIntersecting)){ started=true; obs.disconnect(); type(index); }
  },{threshold:.3}).observe(answer);

  addEventListener('i18n:change',()=>{ buildMenu(); if(started) type(index); });
})();
