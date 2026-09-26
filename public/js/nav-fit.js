/* Switches the top bar to the hamburger menu whenever its links don't fit – the needed
   width depends on the language and the loaded font, so it is measured, not guessed. */
(function(){
  const bar=document.querySelector('.nav-inner');
  if(!bar) return;
  const fit=()=>{
    document.body.classList.remove('nav-compact');
    if(bar.scrollWidth>bar.clientWidth+1) document.body.classList.add('nav-compact');
  };
  addEventListener('resize',fit);
  addEventListener('i18n:change',fit);
  if(document.fonts) document.fonts.ready.then(fit);
  fit();
})();
