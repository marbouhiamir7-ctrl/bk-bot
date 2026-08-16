// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const hash = this.getAttribute('href').replace(/^\/#/, '#');
        const target = document.querySelector(hash);
        if (target) {
            e.preventDefault();
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

// Live stats from API
function countUp(el, target) {
    const dur = 1200;
    const start = performance.now();
    function frame(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(frame);
}

async function loadLiveStats() {
    try {
        const r = await fetch('/api/botinfo');
        const data = await r.json();
        const stats = (data && data.stats) || {};
        document.querySelectorAll('.stat-number[data-stat]').forEach(el => {
            const key = el.getAttribute('data-stat');
            if (key && stats[key] !== undefined) countUp(el, Number(stats[key]) || 0);
        });
    } catch (e) {
        console.warn('Live stats unavailable:', e);
    }
}

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadLiveStats();
                statsObserver.disconnect();
            }
        });
    }, { threshold: 0.3 });
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

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
        const item = q.parentElement;
        const answer = item.querySelector('.faq-answer');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(i => {
            i.classList.remove('open');
            i.querySelector('.faq-answer').style.maxHeight = null;
        });
        if (!isOpen) {
            item.classList.add('open');
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }
    });
});

// Command simulator
const simForm = document.getElementById('simForm');
const simInput = document.getElementById('simInput');
const simLog = document.getElementById('simLog');

function escSim(str) {
    return String(str).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[c]));
}

function simAppend(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const node = div.firstChild;
    simLog.appendChild(node);
    simLog.scrollTop = simLog.scrollHeight;
    return node;
}

function simTyping() {
    return simAppend(`<div class="sim-msg bot typing"><div class="sim-avatar bot"><i class="fab fa-discord"></i></div><div class="sim-msg-bubble"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></div></div>`);
}

function simResponse(cls, title, desc) {
    simAppend(`<div class="sim-msg bot"><div class="sim-avatar bot"><i class="fab fa-discord"></i></div><div class="sim-msg-bubble"><div class="sim-embed ${cls}"><div class="sim-embed-title">${title}</div><div class="sim-embed-desc">${desc}</div></div></div></div>`);
}

function buildResponse(cmd, target) {
    const t = target ? `**${target}**` : '**@user**';
    switch (cmd) {
        case 'ban':
            return ['sim-embed-danger', 'Member Banned', `${t} has been banned. Reason: Server raiding.\nUse <code>/unban</code> to reverse this action.`];
        case 'unban':
            return ['sim-embed-success', 'Member Unbanned', `${t} has been unbanned and can rejoin the server.`];
        case 'kick':
            return ['sim-embed-warn', 'Member Kicked', `${t} has been kicked from the server.`];
        case 'mute':
            return ['sim-embed-warn', 'Member Muted', `${t} muted for 10 minutes. Use <code>/unmute</code> to lift it early.`];
        case 'unmute':
            return ['sim-embed-success', 'Member Unmuted', `${t} can talk again.`];
        case 'warn':
            return ['sim-embed-warn', 'Warning Issued', `${t} warned (1/3). Three warnings result in an automatic mute.`];
        case 'warnings':
            return ['sim-embed-info', 'Warnings', `${t} has 1 warning on record.`];
        case 'clear':
            return ['sim-embed-success', 'Messages Cleared', `Cleared 50 messages in the channel.`];
        case 'massban':
            return ['sim-embed-danger', 'Mass Ban', `Banned 14 users matching the raider filter.`];
        case 'masskick':
            return ['sim-embed-warn', 'Mass Kick', `Kicked 11 users flagged as raiders.`];
        case 'security':
            return ['sim-embed-info', 'Security Status', `Anti-Nuke: <strong>ON</strong> · Anti-Raid: <strong>ON</strong> · Anti-Spam: <strong>ON</strong> · Anti-Link: <strong>ON</strong>\nAll systems operational.`];
        case 'level':
            return ['sim-embed-success', 'Level 24', `${t} · 12,480 XP · Rank #3 on the leaderboard.`];
        case 'leaderboard':
            return ['sim-embed-info', 'Top Members', `<strong>#1</strong> amir — 25,110 XP\n<strong>#2</strong> yassine — 18,940 XP\n<strong>#3</strong> you — 12,480 XP`];
        case 'poll':
            return ['sim-embed-success', 'Poll Created', `"Should we enable anti-raid?" — React with ✅ or ❌ to vote.`];
        case 'giveaway':
            return ['sim-embed-info', 'Giveaway Started', `🎉 Nitro Classic giveaway! Ends in 24 hours. Click the button to enter.`];
        case 'ticket':
            return ['sim-embed-success', 'Ticket Created', `Ticket <code>#1024</code> opened in the support category. Staff have been notified.`];
        case 'close':
            return ['sim-embed-warn', 'Ticket Closed', `Ticket <code>#1024</code> closed and archived.`];
        case 'help':
            return ['sim-embed-info', 'BK BOT Help', `Try <code>/moderation</code>, <code>/security</code>, <code>/giveaway</code>, <code>/ticket</code>, <code>/level</code>, <code>/setupstats</code>, <code>/addcommand</code>, <code>/setwelcome</code> and more.`];
        case 'announce':
            return ['sim-embed-success', 'Announcement Sent', `Your announcement was posted in <code>#announcements</code>.`];
        case 'setupstats':
            return ['sim-embed-success', 'Stats Channels Ready', `Live member / online / boost counters are now updating in real time.`];
        case 'serverinfo':
            return ['sim-embed-info', 'Server Info', `<strong>Members:</strong> 1,284 · <strong>Boosts:</strong> 14 · <strong>Online:</strong> 362\nSecurity level: <strong>Maximum</strong>`];
        case 'userinfo':
            return ['sim-embed-info', 'User Info', `**${target || '@user'}** · Joined 2 years ago · 3 roles · No warnings.`];
        case 'status':
            return ['sim-embed-success', 'All Systems Operational', `BK BOT is online and protecting this server 24/7.`];
        default:
            return ['sim-embed-info', 'Unknown Command', `Command not recognized. Type <code>/help</code> to see everything BK BOT can do.`];
    }
}

if (simForm && simInput && simLog) {
    simForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = simInput.value.trim().replace(/^\//, '');
        if (!raw) return;
        simInput.value = '';
        simAppend(`<div class="sim-msg user"><div class="sim-avatar"><i class="fas fa-user"></i></div><div class="sim-msg-bubble"><code>/${escSim(raw)}</code></div></div>`);
        const typing = simTyping();
        setTimeout(() => {
            typing.remove();
            const parts = raw.split(/\s+/);
            const cmd = (parts[0] || '').toLowerCase();
            const target = parts.slice(1).join(' ');
            const [cls, title, desc] = buildResponse(cmd, target);
            simResponse(cls, title, desc);
            simLog.scrollTop = simLog.scrollHeight;
        }, 700);
    });
}
