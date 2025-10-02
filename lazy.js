document.addEventListener('DOMContentLoaded',()=>{
  const imgs=[...document.querySelectorAll('img[loading="lazy"]')];
  const apply=(img)=>{ img.classList.add('lazy-loaded'); };
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting){ apply(e.target); io.unobserve(e.target);} });
    },{ rootMargin:'100px' });
    imgs.forEach(i=> io.observe(i));
  } else {
    imgs.forEach(apply);
  }
});