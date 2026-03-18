document.addEventListener('DOMContentLoaded', () => {
    document.cookie = 'br_seen_landing=1; Path=/; Max-Age=2592000; SameSite=Lax';

    const navbar = document.getElementById('navbar');
    const logoSpan = document.getElementById('logo-span');
    const link1 = document.getElementById('link-1');
    const link2 = document.getElementById('link-2');
    const link3 = document.getElementById('link-3');
    const link4 = document.getElementById('link-4');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // ===== Navbar Scroll Effect =====
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('glass-nav');
            navbar.classList.remove('py-5');
            navbar.classList.add('py-3');
            logoSpan?.classList.remove('text-transparent', 'bg-clip-text', 'bg-gradient-to-r', 'from-white', 'to-onda');
            logoSpan?.classList.add('text-gray-900');
            link1?.classList.remove('text-white'); link1?.classList.add('text-gray-600', 'hover:text-corallo');
            link2?.classList.remove('text-white'); link2?.classList.add('text-gray-600', 'hover:text-corallo');
            link3?.classList.remove('text-white'); link3?.classList.add('text-gray-600', 'hover:text-corallo');
            link4?.classList.remove('text-white'); link4?.classList.add('text-gray-600', 'hover:text-corallo');
            mobileBtn?.classList.remove('text-white'); mobileBtn?.classList.add('text-gray-900');
        } else {
            navbar.classList.remove('glass-nav');
            navbar.classList.add('py-5');
            navbar.classList.remove('py-3');
            logoSpan?.classList.add('text-transparent', 'bg-clip-text', 'bg-gradient-to-r', 'from-white', 'to-onda');
            logoSpan?.classList.remove('text-gray-900');
            link1?.classList.add('text-white'); link1?.classList.remove('text-gray-600', 'hover:text-corallo');
            link2?.classList.add('text-white'); link2?.classList.remove('text-gray-600', 'hover:text-corallo');
            link3?.classList.add('text-white'); link3?.classList.remove('text-gray-600', 'hover:text-corallo');
            link4?.classList.add('text-white'); link4?.classList.remove('text-gray-600', 'hover:text-corallo');
            mobileBtn?.classList.add('text-white'); mobileBtn?.classList.remove('text-gray-900');
        }
    });

    // ===== Mobile Menu =====
    mobileBtn?.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    const mobileLinks = mobileMenu?.querySelectorAll('a') || [];
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });

    // ===== Scroll Reveal (IntersectionObserver) =====
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.08,
        rootMargin: '0px 0px -60px 0px'
    });

    // Observe all elements with reveal classes
    document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right').forEach(el => {
        revealObserver.observe(el);
    });

    // ===== Animated Counters =====
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(el => {
        counterObserver.observe(el);
    });

    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-counter'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        const prefix = el.getAttribute('data-prefix') || '';
        const duration = 1800;
        const start = performance.now();

        function renderValue(value) {
            if (suffix === 'min') {
                el.innerHTML = prefix + value + '<span class="text-3xl ml-1">min</span>';
            } else {
                el.textContent = prefix + value + suffix;
            }
        }

        // If target is 0, just render immediately
        if (target === 0) {
            renderValue(0);
            return;
        }

        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            renderValue(current);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // ===== Smooth Scroll for anchor links =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ===== Summer Countdown Timer =====
    function updateCountdown() {
        const summer = new Date('2026-06-21T00:00:00');
        const now = new Date();
        const diff = summer - now;

        if (diff <= 0) {
            const el = document.getElementById('summer-countdown');
            if (el) el.innerHTML = '<span class="text-lg">☀️</span><span class="text-sm font-bold text-corallo">L\'estate è arrivata! Scarica l\'app!</span>';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const daysEl = document.getElementById('cd-days');
        const hoursEl = document.getElementById('cd-hours');
        const minsEl = document.getElementById('cd-mins');
        const secsEl = document.getElementById('cd-secs');

        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
        if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // ===== Waitlist Counter (reuse existing counter system) =====
    document.querySelectorAll('.waitlist-counter').forEach(el => {
        counterObserver.observe(el);
    });

    // ===== Email Form Feedback =====
    const emailForm = document.querySelector('#download form');
    if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = emailForm.querySelector('input[type="email"]');
            const btn = emailForm.querySelector('button[type="submit"]');
            if (input && input.value) {
                const original = btn.textContent;
                btn.textContent = '✓ Registrato!';
                btn.classList.add('bg-green-500');
                btn.classList.remove('bg-corallo');
                input.value = '';
                input.disabled = true;
                btn.disabled = true;
                setTimeout(() => {
                    btn.textContent = original;
                    btn.classList.remove('bg-green-500');
                    btn.classList.add('bg-corallo');
                    input.disabled = false;
                    btn.disabled = false;
                }, 3000);
            }
        });
    }
});
