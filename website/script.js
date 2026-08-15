// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle
const mobileMenu = document.querySelector('.mobile-menu');
const navLinks = document.querySelector('.nav-links');

if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
}

// Animate stats on scroll
const observerOptions = {
    threshold: 0.5
};

const animateStats = (entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const stats = entry.target.querySelectorAll('.stat-number');
            stats.forEach(stat => {
                const target = stat.textContent;
                if (!isNaN(target)) {
                    let current = 0;
                    const increment = target / 50;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            stat.textContent = target;
                            clearInterval(timer);
                        } else {
                            stat.textContent = Math.floor(current);
                        }
                    }, 30);
                }
            });
        }
    });
};

const statsObserver = new IntersectionObserver(animateStats, observerOptions);
const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// Navbar scroll effect + active link tracking
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Active nav link based on scroll position
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 200;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-links a[href="#${id}"]`);
        if (link) {
            if (scrollY >= top && scrollY < top + height) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });
});

// Scroll Reveal Animation
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .section-glow').forEach(el => {
    revealObserver.observe(el);
});

// Parallax scroll for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const hero = document.querySelector('.hero-visual');
    if (hero && scrolled < 800) {
        hero.style.transform = `translateY(${scrolled * 0.15}px)`;
    }
});

// Console message
console.log('%c BK BOT ', 'background: linear-gradient(135deg, #FF6B6B, #FFA502); color: white; font-size: 20px; padding: 10px 20px; border-radius: 5px;');
console.log('%c The Ultimate Discord Security Bot ', 'color: #8888aa; font-size: 12px;');

// 3D Interactive Card Mouse Tracking
(function() {
    const card = document.getElementById('card3d');
    const scene = document.getElementById('scene');
    
    if (!card || !scene) return;

    let bounds;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let targetRotateX = 0;
    let targetRotateY = 0;
    let isHovering = false;

    function updateBounds() {
        bounds = card.getBoundingClientRect();
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function animate() {
        currentRotateX = lerp(currentRotateX, targetRotateX, 0.08);
        currentRotateY = lerp(currentRotateY, targetRotateY, 0.08);
        currentLightX = lerp(currentLightX, targetLightX, 0.06);
        currentLightY = lerp(currentLightY, targetLightY, 0.06);

        const rx = currentRotateX * 18;
        const ry = currentRotateY * 18;
        const scaleVal = isHovering ? 1.02 : 1;
        const tz = isHovering ? 30 : 0;

        card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scaleVal}) translateZ(${tz}px)`;

        // No light overlay - clean dark card

        // Parallax floating badges
        const badges = document.querySelectorAll('.floating-3d-badge');
        badges.forEach((badge, i) => {
            const depth = 0.6 + i * 0.25;
            const bx = currentRotateY * 12 * depth;
            const by = currentRotateX * 12 * depth;
            badge.style.transform = `translateZ(30px) translateX(${bx}px) translateY(${by}px)`;
        });

        // Parallax orbit rings
        const rings = document.querySelectorAll('.orbit-3d-ring');
        rings.forEach((ring, i) => {
            const depth = 0.15 + i * 0.1;
            const rx2 = currentRotateY * 8 * depth;
            const ry2 = currentRotateX * 8 * depth;
            const baseRotation = [0, 60, 120][i];
            ring.style.transform = `translate(calc(-50% + ${rx2}px), calc(-50% + ${ry2}px)) rotateX(75deg) rotateZ(${baseRotation}deg)`;
        });

        // Parallax particles
        const particles = document.querySelectorAll('.particle');
        particles.forEach((p, i) => {
            const depth = 0.4 + i * 0.15;
            const px = currentRotateY * 20 * depth;
            const py = currentRotateX * 20 * depth;
            p.style.transform = `translate(${px}px, ${py}px)`;
        });

        requestAnimationFrame(animate);
    }

    scene.addEventListener('mouseenter', () => {
        isHovering = true;
        updateBounds();
    });

    scene.addEventListener('mouseleave', () => {
        isHovering = false;
        targetRotateX = 0;
        targetRotateY = 0;
    });

    scene.addEventListener('mousemove', (e) => {
        if (!bounds) updateBounds();
        
        const cx = bounds.left + bounds.width / 2;
        const cy = bounds.top + bounds.height / 2;
        
        targetRotateX = clamp((e.clientY - cy) / (bounds.height / 2), -1, 1);
        targetRotateY = clamp((e.clientX - cx) / (bounds.width / 2), -1, 1);
    });

    // Touch support
    scene.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (!bounds) updateBounds();
        const cx = bounds.left + bounds.width / 2;
        const cy = bounds.top + bounds.height / 2;
        targetRotateX = clamp((touch.clientY - cy) / (bounds.height / 2), -1, 1);
        targetRotateY = clamp((touch.clientX - cx) / (bounds.width / 2), -1, 1);
    }, { passive: false });

    scene.addEventListener('touchend', () => {
        isHovering = false;
        targetRotateX = 0;
        targetRotateY = 0;
    });

    // Per-item tilt
    document.querySelectorAll('[data-tilt]').forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateZ(18px) scale(1.04)';
        });
        
        item.addEventListener('mousemove', function(e) {
            const r = this.getBoundingClientRect();
            const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
            const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
            this.style.transform = `translateZ(18px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.04)`;
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateZ(8px)';
        });
    });

    animate();
    window.addEventListener('resize', updateBounds);
})();
