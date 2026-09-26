/* Language dropdowns ([data-lang-menu]) in the top bar and the mobile menu. Picking a
   language is handled by i18n.js (click on .lang-btn); this file opens/closes the menus
   and shows the current language by its own name. */
(function(){
  const menus=[...document.querySelectorAll('[data-lang-menu]')];
  if(!menus.length) return;
  const nameOf=code=>{
    const l=window.i18n && window.i18n.LANGS.find(x=>x.code===code);
    return l ? l.label : code;
  };

  menus.forEach(root=>{
    const btn=root.querySelector('.nav-lang-btn');
    const close=()=>{ root.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const open=!root.classList.contains('open');
      menus.forEach(m=>{ m.classList.remove('open'); m.querySelector('.nav-lang-btn').setAttribute('aria-expanded','false'); });
      if(open){ root.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
    });
    root.querySelectorAll('.lang-btn').forEach(b=>b.addEventListener('click',()=>{ close(); btn.focus({preventScroll:true}); }));
    document.addEventListener('click',e=>{ if(!root.contains(e.target)) close(); });
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape' && root.classList.contains('open')){ e.stopPropagation(); close(); btn.focus(); return; }
      if(!['ArrowDown','ArrowUp'].includes(e.key)) return;
      const items=[...root.querySelectorAll('.lang-btn')];
      if(!root.classList.contains('open')){ e.preventDefault(); btn.click(); items[0].focus(); return; }
      const i=items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
    });
  });

  const update=()=>{
    const code=window.i18n ? window.i18n.current : 'de';
    menus.forEach(root=>{ root.querySelector('.lang-current').textContent=nameOf(code); });
  };
  addEventListener('i18n:change', update);
  update();
})();
