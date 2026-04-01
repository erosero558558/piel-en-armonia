/* aurora-reborn.js
 * Lógica base de la experiencia Reborn (Fase RB-1)
 */

document.addEventListener('DOMContentLoaded', () => {
  /* -------------------
     RB-04: Navbar Píldora
     ------------------- */
  const navWrapper = document.querySelector('.reborn-nav-wrapper');
  let lastScrollY = window.scrollY;
  
  window.addEventListener('scroll', () => {
    // Reveal animations
    const reveals = document.querySelectorAll('.reveal');
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 50;
        
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add('visible');
        }
    }

    // Navbar scroll logic (hide on scroll down, show on up)
    if (navWrapper) {
      if (window.scrollY > 80) {
        if (window.scrollY > lastScrollY) {
          // Scrolling down
          navWrapper.style.transform = 'translateY(-150%)';
        } else {
          // Scrolling up
          navWrapper.style.transform = 'translateY(0)';
        }
      } else {
        // At the top
        navWrapper.style.transform = 'translateY(0)';
      }
    }
    
    /* -------------------
       RB-05: Hero Cinemático Parallax/Fade
       ------------------- */
    const heroBg = document.querySelector('.reborn-hero-bg');
    if (heroBg) {
      const scrollOp = 1 - (window.scrollY / 600);
      heroBg.style.opacity = Math.max(0, scrollOp) * 0.6; // Base opacity is 0.6
      heroBg.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    }
    
    lastScrollY = window.scrollY;
  }, { passive: true });

  // Disparar evaluación inicial
  window.dispatchEvent(new Event('scroll'));
});
