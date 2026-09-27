/**
 * PRAVEEN. A — Command Center & Engineering Portfolio Script
 * Vanilla JavaScript (Completely Static, No External Dependencies)
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTelemetryClock();
  initTypewriter();
  initSkillsFilter();
  initCodeCopyButtons();
  initContactForm();
  initImageLightbox();
  highlightActiveNav();
});

/* ==========================================================================
   1. Active Navigation Indicator & Sticky Header
   ========================================================================== */
function highlightActiveNav() {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href').toLowerCase();
    
    // Check if path ends with href or if at root / matches index.html
    if (currentPath.endsWith(href) || 
       (currentPath.endsWith('/') && href === 'index.html') ||
       (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function initNavbar() {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');

  // Sticky header shadow & border on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  // Mobile menu toggle
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('open');
      navMenu.classList.toggle('open');
      const isExpanded = navToggle.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    // Close when clicking nav link
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('open');
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target) && navMenu.classList.contains('open')) {
        navToggle.classList.remove('open');
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

/* ==========================================================================
   2. Live HUD Telemetry Clock
   ========================================================================== */
function initTelemetryClock() {
  const clockElement = document.getElementById('hud-clock');
  if (!clockElement) return;

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/* ==========================================================================
   3. Interactive Typewriter on Hero Subtitles
   ========================================================================== */
function initTypewriter() {
  const typewriterTarget = document.getElementById('typewriter-text');
  if (!typewriterTarget) return;

  const roles = [
    "Mechatronics Engineering Student",
    "Full Stack Developer",
    "AI Prompt Engineer",
    "Robotics & Automation Builder",
    "Intelligent Systems Integrator"
  ];

  let roleIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  const typingSpeed = 70;
  const pauseEnd = 2000;
  const deletingSpeed = 35;

  function type() {
    const currentRole = roles[roleIdx];
    
    if (isDeleting) {
      typewriterTarget.textContent = currentRole.substring(0, charIdx - 1);
      charIdx--;
    } else {
      typewriterTarget.textContent = currentRole.substring(0, charIdx + 1);
      charIdx++;
    }

    if (!isDeleting && charIdx === currentRole.length) {
      setTimeout(() => { isDeleting = true; type(); }, pauseEnd);
      return;
    }

    if (isDeleting && charIdx === 0) {
      isDeleting = false;
      roleIdx = (roleIdx + 1) % roles.length;
      setTimeout(type, 300);
      return;
    }

    const nextSpeed = isDeleting ? deletingSpeed : typingSpeed;
    setTimeout(type, nextSpeed);
  }

  type();
}

/* ==========================================================================
   4. Skills Filter Navigation
   ========================================================================== */
function initSkillsFilter() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const skillCards = document.querySelectorAll('.skill-category-card');

  if (!filterButtons.length) return;

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      skillCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'block';
          setTimeout(() => { card.style.opacity = '1'; }, 10);
        } else {
          card.style.opacity = '0';
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   5. Code Copy Buttons
   ========================================================================== */
function initCodeCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-btn');

  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const codeTarget = button.closest('.code-block-wrap')?.querySelector('code');
      if (!codeTarget) return;

      const codeText = codeTarget.innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        const originalText = button.textContent;
        button.textContent = '✓ COPIED!';
        button.style.background = 'var(--hud-green)';
        button.style.borderColor = 'var(--hud-green)';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
          button.style.borderColor = '';
        }, 2200);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  });
}

/* ==========================================================================
   6. Contact Form Simulation (Static Form Feedback)
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');

  if (!form || !feedback) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Send';

    if (submitBtn) {
      submitBtn.innerHTML = 'TRANSMITTING MESSAGE...';
      submitBtn.disabled = true;
    }

    setTimeout(() => {
      feedback.className = 'form-feedback success';
      feedback.innerHTML = '<strong>[TRANSMISSION CONFIRMED]</strong> Thank you! Your message has been logged into Praveen\'s command system. Response expected within 24 hours.';
      feedback.style.display = 'block';
      form.reset();

      if (submitBtn) {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
      }
    }, 900);
  });
}

/* ==========================================================================
   7. Image Lightbox Modal
   ========================================================================== */
function initImageLightbox() {
  const galleryImages = document.querySelectorAll('.image-grid img, .media-card img');
  if (!galleryImages.length) return;

  let modal = document.querySelector('.modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content-wrap">
        <button class="modal-close-btn" aria-label="Close modal">&times;</button>
        <img src="" alt="Enlarged inspection view">
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
        modal.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  }

  const modalImg = modal.querySelector('img');

  galleryImages.forEach(img => {
    img.addEventListener('click', () => {
      if (modalImg) {
        modalImg.src = img.src;
        modalImg.alt = img.alt || 'Inspection preview';
        modal.classList.add('active');
      }
    });
  });
}
