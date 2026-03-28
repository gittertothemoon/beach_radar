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
                el.textContent = `${prefix}${value}`;
                const suffixEl = document.createElement('span');
                suffixEl.className = 'text-3xl ml-1';
                suffixEl.textContent = 'min';
                el.appendChild(suffixEl);
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
            if (el) {
                el.textContent = '';
                const icon = document.createElement('span');
                icon.className = 'text-lg';
                icon.textContent = '☀️';
                const text = document.createElement('span');
                text.className = 'text-sm font-bold text-corallo';
                text.textContent = "L'estate è arrivata! La lista prioritaria è aperta.";
                el.append(icon, text);
            }
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

    // ===== Community Counter (reuse existing counter system) =====
    document.querySelectorAll('.signup-counter').forEach(el => {
        counterObserver.observe(el);
    });

    // ===== Email Form Submission (Supabase signup via API) =====
    const SIGNUP_ENDPOINT = '/api/signup';
    const BUSINESS_REQUEST_ENDPOINT = '/api/business-request';
    const ACCOUNT_PREFS_STORAGE_KEY = 'w2b-account-prefs-v1';

    const parseQueryParams = (search) => {
        const paramsObj = {};
        const searchParams = new URLSearchParams(search || '');
        for (const [key, value] of searchParams.entries()) {
            paramsObj[key] = value;
        }
        return paramsObj;
    };

    const buildAttribution = (paramsObj) => {
        const allowedKeys = [
            'poster',
            'city',
            'fbclid',
            'gclid',
            'msclkid',
            'ttclid',
            'igshid',
            'twclid',
            'gbraid',
            'wbraid',
        ];
        const out = {};
        allowedKeys.forEach((key) => {
            if (paramsObj[key]) out[key] = paramsObj[key];
        });
        return out;
    };

    const readAccountPrefs = () => {
        try {
            const raw = localStorage.getItem(ACCOUNT_PREFS_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    };

    const readPreferredLanguage = (paramsObj) => {
        if (paramsObj.lang === 'en' || paramsObj.lang === 'it') {
            return paramsObj.lang;
        }
        const prefs = readAccountPrefs();
        return prefs.language === 'en' ? 'en' : 'it';
    };

    const readPreferredInterests = () => {
        const prefs = readAccountPrefs();
        if (!Array.isArray(prefs.interests)) return [];
        return prefs.interests
            .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
            .map((entry) => entry.trim().slice(0, 32))
            .slice(0, 8);
    };

    const submitSignup = async (payload) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 7000);
        try {
            const response = await fetch(SIGNUP_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true,
                signal: controller.signal,
            });

            let data = null;
            try {
                data = await response.json();
            } catch (_) {
                data = null;
            }

            if (!response.ok) {
                const error = new Error('request_failed');
                error.code = data && data.error ? data.error : 'request_failed';
                throw error;
            }

            return data || { ok: true, already: false };
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    const initSignupForm = (form) => {
        const input = form.querySelector('[data-signup-input]');
        const honeypot = form.querySelector('input[name="company"]');
        const submitBtn = form.querySelector('[data-signup-submit]');
        const feedbackEl = form.querySelector('[data-signup-feedback]');
        if (!input || !submitBtn) return;

        const setFeedback = (message, tone) => {
            if (!feedbackEl) return;
            feedbackEl.textContent = message;
            feedbackEl.classList.remove('text-onda/90', 'text-green-300', 'text-red-300');
            if (tone === 'success') {
                feedbackEl.classList.add('text-green-300');
                return;
            }
            if (tone === 'error') {
                feedbackEl.classList.add('text-red-300');
                return;
            }
            feedbackEl.classList.add('text-onda/90');
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = String(input.value || '').trim().toLowerCase();
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            if (!emailValid) {
                setFeedback('Inserisci un indirizzo email valido.', 'error');
                return;
            }

            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            input.disabled = true;
            submitBtn.textContent = 'Invio...';
            setFeedback('Stiamo salvando la tua iscrizione.', 'neutral');

            try {
                const params = parseQueryParams(window.location.search);
                const utm = {};
                Object.keys(params).forEach((key) => {
                    if (key.toLowerCase().startsWith('utm_')) {
                        utm[key] = params[key];
                    }
                });

                const payload = {
                    email,
                    lang: readPreferredLanguage(params),
                    page: window.location.pathname,
                    referrer: document.referrer || null,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
                    device: {
                        w: window.innerWidth,
                        h: window.innerHeight,
                        dpr: window.devicePixelRatio || 1,
                        ua: navigator.userAgent,
                    },
                    hp: honeypot ? String(honeypot.value || '').trim() : '',
                    utm,
                    attribution: buildAttribution(params),
                    project: 'where2beach',
                    version: 'landing_v2',
                    meta: {
                        interests: readPreferredInterests(),
                        source: params.from || 'landing',
                    },
                };

                const result = await submitSignup(payload);
                submitBtn.classList.add('bg-green-500');
                submitBtn.classList.remove('bg-corallo');
                submitBtn.textContent = '✓ Sei in lista';
                input.value = '';
                if (result && result.already) {
                    setFeedback('Email già presente: posizione in lista confermata.', 'success');
                } else {
                    setFeedback('Perfetto. Ti avviseremo appena apriamo il lancio.', 'success');
                }
            } catch (error) {
                const code = error && error.code ? error.code : '';
                if (code === 'invalid_email') {
                    setFeedback('Inserisci un indirizzo email valido.', 'error');
                } else if (code === 'rate_limited') {
                    setFeedback('Troppi tentativi ravvicinati. Riprova tra poco.', 'error');
                } else {
                    setFeedback('Errore temporaneo. Riprova tra qualche secondo.', 'error');
                }
                submitBtn.classList.remove('bg-green-500');
                submitBtn.classList.add('bg-corallo');
                submitBtn.textContent = originalBtnText;
            } finally {
                if (submitBtn.textContent !== '✓ Sei in lista') {
                    submitBtn.disabled = false;
                    input.disabled = false;
                }
            }
        });
    };

    const signupForms = document.querySelectorAll('[data-signup-form]');
    signupForms.forEach((form) => initSignupForm(form));

    const submitBusinessRequest = async (payload) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(BUSINESS_REQUEST_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true,
                signal: controller.signal,
            });

            let data = null;
            try {
                data = await response.json();
            } catch (_) {
                data = null;
            }

            if (!response.ok) {
                const error = new Error('request_failed');
                error.code = data && data.error ? data.error : 'request_failed';
                throw error;
            }

            return data || { ok: true, already: false, notified: false };
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    const initBusinessRequestForm = (form) => {
        const businessType = form.querySelector('[data-business-type]');
        const companyName = form.querySelector('[data-business-company]');
        const city = form.querySelector('[data-business-city]');
        const contactName = form.querySelector('[data-business-contact]');
        const role = form.querySelector('[data-business-role]');
        const email = form.querySelector('[data-business-email]');
        const phone = form.querySelector('[data-business-phone]');
        const message = form.querySelector('[data-business-message]');
        const honeypot = form.querySelector('[data-business-hp]');
        const consent = form.querySelector('[data-business-consent]');
        const submitBtn = form.querySelector('[data-business-submit]');
        const feedbackEl = form.querySelector('[data-business-feedback]');

        if (!businessType || !companyName || !city || !contactName || !role || !email || !consent || !submitBtn) {
            return;
        }

        const setFeedback = (text, tone) => {
            if (!feedbackEl) return;
            feedbackEl.textContent = text;
            feedbackEl.classList.remove('text-red-500', 'text-emerald-600', 'text-gray-500');
            if (tone === 'error') {
                feedbackEl.classList.add('text-red-500');
                return;
            }
            if (tone === 'success') {
                feedbackEl.classList.add('text-emerald-600');
                return;
            }
            feedbackEl.classList.add('text-gray-500');
        };

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailValue = String(email.value || '').trim().toLowerCase();
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
            if (!emailValid) {
                setFeedback('Inserisci un indirizzo email valido.', 'error');
                return;
            }
            if (!consent.checked) {
                setFeedback('Devi accettare la privacy per inviare la richiesta.', 'error');
                return;
            }

            const params = parseQueryParams(window.location.search);
            const utm = {};
            Object.keys(params).forEach((key) => {
                if (key.toLowerCase().startsWith('utm_')) utm[key] = params[key];
            });

            const initialText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Invio...';
            setFeedback('Invio richiesta in corso.', 'neutral');

            try {
                const payload = {
                    businessType: String(businessType.value || '').trim(),
                    companyName: String(companyName.value || '').trim(),
                    city: String(city.value || '').trim(),
                    contactName: String(contactName.value || '').trim(),
                    role: String(role.value || '').trim(),
                    email: emailValue,
                    phone: phone ? String(phone.value || '').trim() : '',
                    message: message ? String(message.value || '').trim() : '',
                    lang: readPreferredLanguage(params),
                    hp: honeypot ? String(honeypot.value || '').trim() : '',
                    utm,
                    attribution: buildAttribution(params),
                    meta: {
                        page: window.location.pathname,
                        referrer: document.referrer || null,
                        source: params.src || params.from || 'landing',
                        interests: readPreferredInterests(),
                    },
                };

                const result = await submitBusinessRequest(payload);
                if (result && result.already) {
                    setFeedback('Richiesta già ricevuta di recente. Ti ricontattiamo a breve.', 'success');
                } else {
                    setFeedback('Perfetto, richiesta inviata. Il team business ti contatterà presto.', 'success');
                }
                submitBtn.textContent = 'Richiesta inviata ✓';
                form.reset();
                submitBtn.disabled = false;
                window.setTimeout(() => {
                    submitBtn.textContent = initialText || 'Invia richiesta partnership';
                }, 1800);
            } catch (error) {
                const code = error && error.code ? error.code : '';
                if (code === 'rate_limited') {
                    setFeedback('Troppi tentativi ravvicinati. Riprova tra poco.', 'error');
                } else if (code === 'invalid_email') {
                    setFeedback('Email non valida.', 'error');
                } else {
                    setFeedback('Errore temporaneo. Riprova tra qualche minuto.', 'error');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = initialText || 'Invia richiesta partnership';
            }
        });
    };

    const businessRequestForms = document.querySelectorAll('[data-business-request-form]');
    businessRequestForms.forEach((form) => initBusinessRequestForm(form));
});
