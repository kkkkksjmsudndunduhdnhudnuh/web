/* Bambini Kinder Praxis – einfache Mehrsprachigkeit (i18n)
   Deutsch ist die Quellsprache (bereits im HTML enthalten). Für alle
   anderen Sprachen werden Übersetzungen aus /i18n/<seite>.json geladen
   und auf Elemente mit data-i18n / data-i18n-html / data-i18n-attr
   angewendet. */
(function(){
  const LANGS=[
    {code:'de', label:'Deutsch'},
    {code:'en', label:'English'},
    {code:'es', label:'Español'},
    {code:'fr', label:'Français'},
    {code:'tr', label:'Türkçe'},
    {code:'ru', label:'Русский'},
    {code:'ar', label:'العربية'}
  ];
  const RTL=['ar'];
  const STORAGE_KEY='bambini-lang';

  let dict=null, dyn=null, current='de';
  let originals=null;

  function pageName(){
    return document.body.getAttribute('data-i18n-page') || 'index';
  }

  function getSavedLang(){
    let saved=null;
    try{ saved=localStorage.getItem(STORAGE_KEY); }catch(e){}
    return LANGS.some(l=>l.code===saved) ? saved : 'de';
  }

  function setHtmlLangDir(lang){
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', RTL.includes(lang) ? 'rtl' : 'ltr');
  }

  function captureOriginals(){
    originals={text:new Map(), html:new Map(), attr:new Map()};
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      originals.text.set(el, el.textContent);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el=>{
      originals.html.set(el, el.innerHTML);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el=>{
      const map={};
      el.getAttribute('data-i18n-attr').split('|').forEach(pair=>{
        const attr=pair.split(':')[0].trim();
        map[attr]=el.getAttribute(attr);
      });
      originals.attr.set(el, map);
    });
  }

  function applyDom(){
    const d = current==='de' ? null : (dict || {});
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key=el.getAttribute('data-i18n');
      el.textContent = (d && d[key]!=null) ? d[key] : originals.text.get(el);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el=>{
      const key=el.getAttribute('data-i18n-html');
      el.innerHTML = (d && d[key]!=null) ? d[key] : originals.html.get(el);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el=>{
      const orig=originals.attr.get(el);
      el.getAttribute('data-i18n-attr').split('|').forEach(pair=>{
        const [attrRaw,keyRaw]=pair.split(':');
        const attr=attrRaw.trim(), key=(keyRaw||'').trim();
        const val = (d && d[key]!=null) ? d[key] : orig[attr];
        el.setAttribute(attr, val);
      });
    });
  }

  function updateSwitcher(){
    document.querySelectorAll('.lang-btn').forEach(btn=>{
      const active = btn.getAttribute('data-lang')===current;
      btn.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  async function loadDict(lang){
    if(lang==='de') return {dict:null, dyn:null};
    try{
      const res=await fetch(`/i18n/${pageName()}.json`);
      if(!res.ok) return {dict:{}, dyn:null};
      const all=await res.json();
      const d=all[lang]||{};
      const rest={...d};
      delete rest._dyn;
      return {dict:rest, dyn:d._dyn||null};
    }catch(e){
      return {dict:{}, dyn:null};
    }
  }

  async function setLang(lang){
    if(!LANGS.some(l=>l.code===lang)) lang='de';
    current=lang;
    try{ localStorage.setItem(STORAGE_KEY, lang); }catch(e){}
    setHtmlLangDir(lang);
    const loaded=await loadDict(lang);
    dict=loaded.dict; dyn=loaded.dyn;
    applyDom();
    updateSwitcher();
    window.dispatchEvent(new CustomEvent('i18n:change', {detail:{lang: current, dyn: dyn}}));
  }

  function init(){
    captureOriginals();
    current=getSavedLang();
    setHtmlLangDir(current);
    document.body.addEventListener('click', e=>{
      const btn=e.target.closest('.lang-btn');
      if(btn) setLang(btn.getAttribute('data-lang'));
    });
    setLang(current);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  window.i18n = {
    setLang,
    get current(){ return current; },
    get dyn(){ return dyn; },
    LANGS
  };
})();
