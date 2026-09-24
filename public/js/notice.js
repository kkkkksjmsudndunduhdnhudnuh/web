/* Announcement banner managed in the Mitarbeiterbereich (tab "Hinweis"). Shown below the
   navigation until dismissed; a changed text shows again. */
(function(){
  const main=document.getElementById('main');
  if(!main) return;
  const css=`.site-notice{position:relative; z-index:5; background:var(--pine); color:#F4F3E8;
    font-size:.95rem; line-height:1.5; animation:siteNoticeIn .6s var(--ease) both}
  .site-notice.wichtig{background:var(--terra)}
  .site-notice-inner{display:flex; align-items:center; gap:1rem; padding-block:.8rem}
  .site-notice-dot{width:9px; height:9px; flex:none; border-radius:50%; background:#fff; opacity:.9;
    box-shadow:0 0 0 4px rgba(255,255,255,.18)}
  .site-notice p{flex:1; margin:0}
  .site-notice button{flex:none; width:32px; height:32px; border-radius:50%; display:grid; place-items:center;
    color:inherit; opacity:.8; transition:background-color .25s var(--ease), opacity .25s var(--ease)}
  .site-notice button:hover{opacity:1; background:rgba(255,255,255,.14)}
  .site-notice button svg{width:14px; height:14px; stroke:currentColor; stroke-width:2; stroke-linecap:round}
  .site-notice.out{animation:siteNoticeOut .35s var(--ease) forwards}
  @keyframes siteNoticeIn{from{opacity:0; transform:translateY(-8px)}}
  @keyframes siteNoticeOut{to{opacity:0; transform:translateY(-8px)}}`;

  fetch('/api/hinweis').then(r=>r.ok?r.json():null).then(h=>{
    if(!h || !h.aktiv || !h.text) return;
    const key='bambini-hinweis-weg';
    try{ if(localStorage.getItem(key)===h.text) return; }catch{}

    const style=document.createElement('style');
    style.textContent=css;
    document.head.appendChild(style);

    const bar=document.createElement('div');
    bar.className='site-notice'+(h.stil==='wichtig'?' wichtig':'');
    bar.setAttribute('role','status');
    bar.innerHTML='<div class="container site-notice-inner"><span class="site-notice-dot" aria-hidden="true"></span><p></p>'
      +'<button type="button" aria-label="Hinweis schließen"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12"/></svg></button></div>';
    bar.querySelector('p').textContent=h.text;
    bar.querySelector('button').addEventListener('click',()=>{
      try{ localStorage.setItem(key,h.text); }catch{}
      bar.classList.add('out');
      bar.addEventListener('animationend',()=>bar.remove(),{once:true});
    });
    main.parentNode.insertBefore(bar, main);
  }).catch(()=>{});
})();
