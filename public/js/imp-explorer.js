/* Impressum explorer: a topic dropdown built from the .imp-list rows. Picking a topic
   backspaces the previous answer, plays a short loading sequence (sweeping bar, bouncing
   dots, scrambled label) and then types the new answer with a moving caret. */
(function(){
  const root=document.getElementById('impPick');
  if(!root) return;
  const btn=document.getElementById('impPickBtn');
  const menu=document.getElementById('impPickMenu');
  const current=document.getElementById('impPickCurrent');
  const topicEl=document.getElementById('impTopic');
  const wrap=document.getElementById('impTypedWrap');
  const typed=document.getElementById('impTyped');
  const live=document.getElementById('impLive');
  const rows=[...document.querySelectorAll('.imp-list .imp-row')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const GLYPHS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/?';

  let index=0, active=0, run=0, started=false, keyPickAt=0;

  const clean=s=>s.replace(/\s+/g,' ').trim();
  const topic=i=>{
    const dd=rows[i].querySelector('dd'), main=dd.cloneNode(true), note=dd.querySelector('small');
    main.querySelectorAll('small').forEach(el=>el.remove());
    const text=clean(main.textContent);
    return {label:clean(rows[i].querySelector('dt').textContent), text, html:dd.innerHTML,
            full: note ? `${text} – ${clean(note.textContent)}` : text};
  };

  const isOpen=()=>root.classList.contains('open');

  function buildMenu(){
    menu.innerHTML='';
    rows.forEach((_,i)=>{
      const li=document.createElement('li');
      li.id='impOpt'+i;
      li.style.setProperty('--i',i);
      li.setAttribute('role','option');
      li.setAttribute('aria-selected', String(i===index));
      li.textContent=topic(i).label;
      li.addEventListener('click',()=>{ select(i); close(); btn.focus(); });
      li.addEventListener('pointermove',()=>{ if(active!==i){ active=i; highlight(); } });
      menu.appendChild(li);
    });
    current.textContent=topic(index).label;
  }

  function highlight(){
    [...menu.children].forEach((li,i)=>li.classList.toggle('active', i===active));
    btn.setAttribute('aria-activedescendant','impOpt'+active);
    menu.children[active]?.scrollIntoView({block:'nearest'});
  }
  function open(){ root.classList.add('open'); btn.setAttribute('aria-expanded','true'); active=index; highlight(); }
  function close(){ root.classList.remove('open'); btn.setAttribute('aria-expanded','false'); btn.removeAttribute('aria-activedescendant'); }

  function select(i){
    index=i;
    [...menu.children].forEach((li,k)=>li.setAttribute('aria-selected', String(k===i)));
    type(i);
  }

  async function scramble(els, target, duration, me){
    const chars=Array.from(target), start=performance.now();
    for(;;){
      if(me!==run) return;
      const p=Math.min(1,(performance.now()-start)/duration), shown=Math.floor(p*p*chars.length);
      const text=chars.map((c,k)=> k<shown||c===' ' ? c : GLYPHS[Math.random()*GLYPHS.length|0]).join('');
      els.forEach(el=>el.textContent=text);
      if(p>=1) return;
      await sleep(45);
    }
  }

  async function type(i){
    const me=++run, t=topic(i);
    live.textContent=`${t.label}: ${t.full}`;
    if(reduce){ current.textContent=topicEl.textContent=t.label; typed.innerHTML=t.html; return; }

    wrap.classList.add('typing');
    let text=typed.textContent;
    typed.textContent=text;
    while(text.length){
      if(me!==run) return;
      text=text.slice(0,-Math.max(1,Math.ceil(text.length/14)));
      typed.textContent=text;
      await sleep(16);
    }

    root.classList.add('loading'); wrap.classList.add('loading');
    await scramble([current, topicEl], t.label, 850, me);
    if(me!==run) return;
    root.classList.remove('loading'); wrap.classList.remove('loading');
    await sleep(120);

    const chars=Array.from(t.text);
    for(let k=1;k<=chars.length;k++){
      if(me!==run) return;
      typed.textContent=chars.slice(0,k).join('');
      await sleep(/[ ,.·&/–-]/.test(chars[k-1]) ? 70+Math.random()*60 : 32+Math.random()*38);
    }
    if(me!==run) return;
    typed.innerHTML=t.html;
    wrap.classList.remove('typing');
  }

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
  },{threshold:.4}).observe(wrap);

  addEventListener('i18n:change',()=>{ buildMenu(); if(started){ typed.textContent=''; type(index); } });
})();
