/* "Ice" scrolling: Lenis turns wheel and trackpad input into a gliding, inertial scroll.
   Touch keeps the device's native momentum; reduced-motion users get normal scrolling. */
(function(){
  if(!window.Lenis) return;
  const lenis=new Lenis({lerp:.07, autoRaf:true, anchors:true, allowNestedScroll:true, stopInertiaOnNavigate:true});
  let menuOpen=false;
  new MutationObserver(()=>{
    const open=document.body.classList.contains('menu-open');
    if(open===menuOpen) return;
    menuOpen=open;
    open ? lenis.stop() : lenis.start();
  }).observe(document.body,{attributes:true, attributeFilter:['class']});
})();
