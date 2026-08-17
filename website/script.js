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

// 3D Shield Orb Mouse Tracking
(function() {
    const orb = document.getElementById('card3d');
    const scene = document.getElementById('scene');
    
    if (!orb || !scene) return;

    let bounds;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let targetRotateX = 0;
    let targetRotateY = 0;
    let isHovering = false;

    function updateBounds() {
        bounds = orb.getBoundingClientRect();
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

        const rx = currentRotateX * 20;
        const ry = currentRotateY * 20;
        const scaleVal = isHovering ? 1.05 : 1;

        orb.style.transform = `translate(-50%, -50%) perspective(800px) rotateX(${-rx}deg) rotateY(${ry}deg) scale(${scaleVal})`;

        // Parallax floating badges
        const badges = document.querySelectorAll('.orb-badge');
        badges.forEach((badge, i) => {
            const depth = 0.5 + i * 0.3;
            const bx = currentRotateY * 15 * depth;
            const by = currentRotateX * 15 * depth;
            badge.style.transform = `translateX(${bx}px) translateY(${by}px)`;
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

    animate();
    window.addEventListener('resize', updateBounds);
})();

// Starfield canvas
(function() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = [];
    const STAR_COUNT = 80;

    function resize() {
        const scene = canvas.parentElement;
        canvas.width = scene.offsetWidth;
        canvas.height = scene.offsetHeight;
    }

    function init() {
        resize();
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 1.2 + 0.2,
                a: Math.random(),
                da: (Math.random() - 0.5) * 0.01,
                dx: (Math.random() - 0.5) * 0.15,
                dy: (Math.random() - 0.5) * 0.1
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(s => {
            s.a += s.da;
            s.x += s.dx;
            s.y += s.dy;
            if (s.a <= 0.05 || s.a >= 1) s.da *= -1;
            if (s.x < 0) s.x = canvas.width;
            if (s.x > canvas.width) s.x = 0;
            if (s.y < 0) s.y = canvas.height;
            if (s.y > canvas.height) s.y = 0;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.a * 0.6})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener('resize', resize);
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

// Command simulator — enhanced
const simForm = document.getElementById('simForm');
const simInput = document.getElementById('simInput');
const simLog = document.getElementById('simLog');

function escSim(s) {
    return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#x27;'}[c]));
}

function simNow() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    return simAppend(`<div class="sim-msg bot"><div class="sim-avatar bot"><i class="fas fa-shield-halved"></i></div><div class="sim-msg-body"><div class="sim-msg-head"><span class="sim-msg-name">BK BOT</span><span class="sim-msg-bot-badge">BOT</span><span class="sim-msg-time">${simNow()}</span></div><div class="sim-msg-text" style="display:flex;gap:4px;align-items:center;padding:4px 0"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></div></div></div>`);
}

function simBotMsg(embedHTML, extraHTML) {
    const inner = embedHTML + (extraHTML || '');
    simAppend(`<div class="sim-msg bot"><div class="sim-avatar bot"><i class="fas fa-shield-halved"></i></div><div class="sim-msg-body"><div class="sim-msg-head"><span class="sim-msg-name">BK BOT</span><span class="sim-msg-bot-badge">BOT</span><span class="sim-msg-time">${simNow()}</span></div>${inner}</div></div>`);
}

function simUserMsg(cmd) {
    simAppend(`<div class="sim-msg user"><div class="sim-avatar"><i class="fas fa-user"></i></div><div class="sim-msg-body"><div class="sim-msg-head"><span class="sim-msg-name" style="color:#3ba55d">You</span><span class="sim-msg-time">${simNow()}</span></div><div class="sim-msg-text">/${escSim(cmd)}</div></div></div>`);
}

function simSuggestion(text, cmd) {
    simAppend(`<div class="sim-suggestion" data-cmd="${escSim(cmd)}"><i class="fas fa-wand-magic-sparkles"></i> ${text}</div>`);
}

function buildRichResponse(cmd, target) {
    const t = target ? escSim(target) : '@user';
    const author = `<div class="sim-embed-author"><div class="sim-embed-author-avatar"><i class="fas fa-shield-halved"></i></div><span class="sim-embed-author-name">BK BOT</span></div>`;

    switch (cmd) {
        case 'ban':
            return [`<div class="sim-embed sim-embed-danger">${author}<div class="sim-embed-title">🔨 Member Banned</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">User</div><div class="sim-embed-field-value"><strong>${t}</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Raiding the server — mass-pinging members</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value">Permanent</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Case</div><div class="sim-embed-field-value">#2847</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div><div class="sim-reactions"><span class="sim-reaction active">👍 1</span><span class="sim-reaction">🗑️ 0</span></div>`, `<div class="sim-suggestion" data-cmd="unban ${t}"><i class="fas fa-wand-magic-sparkles"></i> Try <code>/unban ${t}</code> to reverse this</div>`];

        case 'unban':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">✅ Member Unbanned</div><div class="sim-embed-desc"><strong>${t}</strong> has been unbanned and can rejoin the server.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'kick':
            return `<div class="sim-embed sim-embed-warn">${author}<div class="sim-embed-title">👢 Member Kicked</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">User</div><div class="sim-embed-field-value"><strong>${t}</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Spamming in general chat</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div><div class="sim-reactions"><span class="sim-reaction active">👍 1</span></div>`;

        case 'mute':
            return `<div class="sim-embed sim-embed-warn">${author}<div class="sim-embed-title">🔇 Member Muted</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">User</div><div class="sim-embed-field-value"><strong>${t}</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value">10 minutes</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Toxic behavior</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'unmute':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">🔊 Member Unmuted</div><div class="sim-embed-desc"><strong>${t}</strong> can now speak again.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'warn':
            return `<div class="sim-embed sim-embed-warn">${author}<div class="sim-embed-title">⚠️ Warning Issued</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">User</div><div class="sim-embed-field-value"><strong>${t}</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Warnings</div><div class="sim-embed-field-value"><strong>1 / 3</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Inappropriate language</div></div></div><div class="sim-embed-desc">3 warnings triggers an automatic mute.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'warnings':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">📋 Warnings for ${t}</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Total</div><div class="sim-embed-field-value"><strong>1</strong> warning</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Status</div><div class="sim-embed-field-value">Good standing</div></div></div><div class="sim-embed-desc">#1 — Inappropriate language — <code>warn</code> by @admin — 2 days ago</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'clear':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">🧹 Messages Cleared</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Channel</div><div class="sim-embed-field-value"><strong>#general</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Deleted</div><div class="sim-embed-field-value"><strong>50</strong> messages</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Spam cleanup</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-broom"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'massban':
            return `<div class="sim-embed sim-embed-danger">${author}<div class="sim-embed-title">🔨 Mass Ban Executed</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Users Banned</div><div class="sim-embed-field-value"><strong>14</strong> accounts</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Reason</div><div class="sim-embed-field-value">Suspected raid accounts — rapid join + no profile</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'masskick':
            return `<div class="sim-embed sim-embed-warn">${author}<div class="sim-embed-title">👢 Mass Kick Executed</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Users Kicked</div><div class="sim-embed-field-value"><strong>11</strong> accounts</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Moderator</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gavel"></i> BK BOT Moderation</div><span>${simNow()}</span></div></div>`;

        case 'security':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">🛡️ Security Dashboard</div><div class="sim-embed-desc">All protection systems are active and monitoring.</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Nuke</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Active</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Raid</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Watching</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Spam</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Scanning</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Link</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Filtering</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Status</div><div class="sim-embed-field-value"><strong style="color:#57f287">All systems operational</strong></div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-shield-halved"></i> BK BOT Security</div><span>Last checked ${simNow()}</span></div></div><div class="sim-reactions"><span class="sim-reaction active">⚡ 4</span><span class="sim-reaction">🛡️ 2</span></div>`;

        case 'level':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">📊 Level Card — ${t}</div><div class="sim-embed-image"><div class="sim-embed-image-bar" style="width:83%"></div><div class="sim-embed-image-bg"></div></div><div class="sim-embed-desc" style="text-align:center;font-size:0.66rem;color:rgba(255,255,255,0.4);margin-bottom:0">12,480 / 15,000 XP — 83%</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Level</div><div class="sim-embed-field-value"><strong>24</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Rank</div><div class="sim-embed-field-value"><strong>#3</strong> of 48</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">XP</div><div class="sim-embed-field-value"><strong>12,480</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Next Level</div><div class="sim-embed-field-value">2,520 XP away</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-trophy"></i> BK BOT Leveling</div><span>${simNow()}</span></div></div>`;

        case 'leaderboard':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">🏆 Leaderboard — Baktiriya Server</div><div class="sim-embed-desc"><strong>#1</strong> &nbsp; amir &nbsp; — &nbsp; <strong>25,110 XP</strong> &nbsp; Lv.31\n<strong>#2</strong> &nbsp; yassine &nbsp; — &nbsp; <strong>18,940 XP</strong> &nbsp; Lv.27\n<strong>#3</strong> &nbsp; <span style="color:#5865f2">you</span> &nbsp; — &nbsp; <strong>12,480 XP</strong> &nbsp; Lv.24\n<strong>#4</strong> &nbsp; karim &nbsp; — &nbsp; <strong>9,720 XP</strong> &nbsp; Lv.21\n<strong>#5</strong> &nbsp; sara &nbsp; — &nbsp; <strong>7,350 XP</strong> &nbsp; Lv.18</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-trophy"></i> BK BOT Leveling</div><span>${simNow()}</span></div></div>`;

        case 'poll':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">📊 Poll Created</div><div class="sim-embed-desc"><strong>Should we enable anti-raid protection?</strong></div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Created By</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value">24 hours</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-chart-bar"></i> BK BOT Polls</div><span>${simNow()}</span></div></div><div class="sim-reactions"><span class="sim-reaction active">✅ 12</span><span class="sim-reaction">❌ 2</span><span class="sim-reaction">🤔 3</span></div>`;

        case 'giveaway':
            return `<div class="sim-embed" style="border-left-color:#eb459e">${author}<div class="sim-embed-title" style="color:#eb459e">🎉 Giveaway Started!</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Prize</div><div class="sim-embed-field-value"><strong>Nitro Classic (1 month)</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value"><strong>24 hours</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Winners</div><div class="sim-embed-field-value"><strong>1</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Host</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div></div><div class="sim-embed-desc">React with 🎉 to enter!</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-gift"></i> BK BOT Giveaways</div><span>Ends in 24h</span></div></div><div class="sim-reactions"><span class="sim-reaction active">🎉 23</span></div>`;

        case 'ticket':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">🎫 Ticket #1024 Opened</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Channel</div><div class="sim-embed-field-value"><strong>#ticket-1024</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Author</div><div class="sim-embed-field-value"><strong>@user</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Priority</div><div class="sim-embed-field-value">Normal</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Status</div><div class="sim-embed-field-value"><strong style="color:#57f287">Open</strong></div></div></div><div class="sim-embed-desc">A staff member has been notified.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-ticket"></i> BK BOT Tickets</div><span>${simNow()}</span></div></div>`;

        case 'close':
            return `<div class="sim-embed sim-embed-warn">${author}<div class="sim-embed-title">🔒 Ticket Closed</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Ticket</div><div class="sim-embed-field-value"><strong>#ticket-1024</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Closed By</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value">12 minutes</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Status</div><div class="sim-embed-field-value">Archived</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-ticket"></i> BK BOT Tickets</div><span>${simNow()}</span></div></div>`;

        case 'help':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">📖 BK BOT — All Commands</div><div class="sim-embed-desc">Here's everything I can do:</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">🔨 Moderation</div><div class="sim-embed-field-value"><code>/ban</code> <code>/kick</code> <code>/mute</code> <code>/warn</code> <code>/clear</code> <code>/massban</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">🛡️ Security</div><div class="sim-embed-field-value"><code>/security</code> <code>/status</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">📊 Info</div><div class="sim-embed-field-value"><code>/serverinfo</code> <code>/userinfo</code> <code>/level</code> <code>/leaderboard</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">🧰 Utility</div><div class="sim-embed-field-value"><code>/poll</code> <code>/giveaway</code> <code>/announce</code> <code>/remind</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">🎫 Tickets</div><div class="sim-embed-field-value"><code>/ticket</code> <code>/close</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">👋 Welcome</div><div class="sim-embed-field-value"><code>/welcome</code> <code>/setupstats</code></div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-terminal"></i> BK BOT</div><span>27+ commands</span></div></div>`;

        case 'announce':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">📢 Announcement Sent</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Channel</div><div class="sim-embed-field-value"><strong>#announcements</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Author</div><div class="sim-embed-field-value"><strong>@admin</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Content</div><div class="sim-embed-field-value">Server maintenance tonight at 10 PM UTC</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-bullhorn"></i> BK BOT</div><span>${simNow()}</span></div></div>`;

        case 'setupstats':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">📊 Live Stats Channels Created</div><div class="sim-embed-desc">Voice channels now update in real time:</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Members</div><div class="sim-embed-field-value">👥 Members: 1,284</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Online</div><div class="sim-embed-field-value">🟢 Online: 362</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Boosts</div><div class="sim-embed-field-value">💎 Boosts: 14</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Channels</div><div class="sim-embed-field-value">📺 Channels: 48</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-chart-line"></i> BK BOT Stats</div><span>${simNow()}</span></div></div>`;

        case 'welcome':
            return `<div class="sim-embed sim-embed-success" style="border-left-color:#57f287">${author}<div class="sim-embed-title" style="color:#57f287">👋 Welcome Message Configured</div><div class="sim-embed-desc">Preview:</div><div style="background:#111118;border-radius:8px;padding:12px;margin:6px 0;border:1px solid rgba(255,255,255,0.04)"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#57f287,#2ed573);display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#fff">👋</div><div><strong style="font-size:0.78rem;color:#fff">Welcome to Baktiriya Server, </strong><strong style="font-size:0.78rem;color:#5865f2">@user</strong><strong style="font-size:0.78rem;color:#fff">!</strong></div></div><div style="font-size:0.7rem;color:rgba(255,255,255,0.4)">Read #rules and grab your roles!</div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-hand-sparkles"></i> BK BOT Welcome</div><span>${simNow()}</span></div></div>`;

        case 'addcommand':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title">⚙️ Custom Command Created</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Trigger</div><div class="sim-embed-field-value"><code>!rules</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Response</div><div class="sim-embed-field-value">Read the rules in #rules channel!</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-code"></i> BK BOT Custom</div><span>${simNow()}</span></div></div>`;

        case 'commands':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">📋 Custom Commands</div><div class="sim-embed-desc"><code>!rules</code> — Read the rules in #rules channel!\n<code>!socials</code> — Follow us on social media!\n<code>!apply</code> — Fill out the staff application form</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-code"></i> BK BOT Custom</div><span>3 commands</span></div></div>`;

        case 'serverinfo':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">📋 Server Information</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Name</div><div class="sim-embed-field-value"><strong>Baktiriya Server</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Owner</div><div class="sim-embed-field-value"><strong>@amir</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Members</div><div class="sim-embed-field-value"><strong>1,284</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Online</div><div class="sim-embed-field-value"><strong>362</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Boosts</div><div class="sim-embed-field-value"><strong>14</strong> (Tier 2)</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Roles</div><div class="sim-embed-field-value"><strong>28</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Channels</div><div class="sim-embed-field-value"><strong>48</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Created</div><div class="sim-embed-field-value">Jan 15, 2023</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-circle-info"></i> BK BOT</div><span>${simNow()}</span></div></div>`;

        case 'userinfo':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">👤 User Information</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Username</div><div class="sim-embed-field-value"><strong>${t}</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">ID</div><div class="sim-embed-field-value"><code>1537980470782988439</code></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Joined</div><div class="sim-embed-field-value">Mar 12, 2024</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Account Age</div><div class="sim-embed-field-value">2 years, 5 months</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Roles</div><div class="sim-embed-field-value"><strong>3</strong> roles</div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Warnings</div><div class="sim-embed-field-value"><strong>0</strong> — Clean record</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-user"></i> BK BOT</div><span>${simNow()}</span></div></div>`;

        case 'status':
            return `<div class="sim-embed sim-embed-success">${author}<div class="sim-embed-title" style="color:#57f287">🟢 All Systems Operational</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Uptime</div><div class="sim-embed-field-value"><strong>99.98%</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Latency</div><div class="sim-embed-field-value"><strong>42ms</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Servers</div><div class="sim-embed-field-value"><strong>1</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Last Restart</div><div class="sim-embed-field-value">6 hours ago</div></div></div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-heartbeat"></i> BK BOT</div><span>${simNow()}</span></div></div>`;

        case 'remind':
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">⏰ Reminder Set</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Duration</div><div class="sim-embed-field-value"><strong>30 minutes</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Created By</div><div class="sim-embed-field-value"><strong>@user</strong></div></div><div class="sim-embed-field full"><div class="sim-embed-field-name">Message</div><div class="sim-embed-field-value">Check the oven!</div></div></div><div class="sim-embed-desc">I'll DM you in 30 minutes.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-clock"></i> BK BOT Utility</div><span>${simNow()}</span></div></div>`;

        default:
            return `<div class="sim-embed sim-embed-info">${author}<div class="sim-embed-title">❓ Unknown Command</div><div class="sim-embed-desc">I don't recognize <code>/${escSim(cmd || '')}</code>. Type <code>/help</code> to see all available commands.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-circle-question"></i> BK BOT</div><span>${simNow()}</span></div></div>`;
    }
}

function runCommand(raw) {
    simUserMsg(raw);
    const typing = simTyping();
    setTimeout(() => {
        typing.remove();
        const parts = raw.split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const target = parts.slice(1).join(' ');
        const result = buildRichResponse(cmd, target);
        const embedHTML = Array.isArray(result) ? result[0] : result;
        const extraHTML = Array.isArray(result) ? result[1] : '';
        simBotMsg(embedHTML, extraHTML);
    }, 600 + Math.random() * 400);
}

if (simForm && simInput && simLog) {
    simForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = simInput.value.trim().replace(/^\//, '');
        if (!raw) return;
        simInput.value = '';
        runCommand(raw);
    });

    // Chip click → fill input + run
    document.querySelectorAll('.sim-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cmd = chip.getAttribute('data-cmd');
            if (cmd) {
                simInput.value = cmd;
                runCommand(cmd);
                simInput.value = '';
            }
        });
    });

    // Cmdcat button click → fill input + run
    document.querySelectorAll('.cmdcat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.getAttribute('data-cmd');
            if (cmd) {
                simInput.value = cmd;
                runCommand(cmd);
                simInput.value = '';
                simLog.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });

    // Suggestion click
    simLog.addEventListener('click', (e) => {
        const sug = e.target.closest('.sim-suggestion');
        if (sug) {
            const cmd = sug.getAttribute('data-cmd');
            if (cmd) {
                simInput.value = cmd;
                runCommand(cmd);
                simInput.value = '';
            }
        }
        const reaction = e.target.closest('.sim-reaction');
        if (reaction) {
            reaction.classList.toggle('active');
            const count = parseInt(reaction.textContent.match(/\d+/)?.[0] || '0');
            const emoji = reaction.textContent.replace(/\d/g, '').trim();
            reaction.textContent = `${emoji} ${reaction.classList.contains('active') ? count + 1 : count}`;
        }
    });

    // Auto-demo on scroll into view
    const simObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    simBotMsg(`<div class="sim-embed sim-embed-success" style="border-left-color:#57f287"><div class="sim-embed-author"><div class="sim-embed-author-avatar" style="background:linear-gradient(135deg,#57f287,#2ed573)"><i class="fas fa-shield-halved"></i></div><span class="sim-embed-author-name">BK BOT</span></div><div class="sim-embed-title" style="color:#57f287">BK BOT is now protecting this server!</div><div class="sim-embed-fields"><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Nuke</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Active</strong></div></div><div class="sim-embed-field"><div class="sim-embed-field-name">Anti-Raid</div><div class="sim-embed-field-value"><strong style="color:#57f287">✅ Watching</strong></div></div></div><div class="sim-embed-desc">Type <code>/help</code> to see all commands, or click a suggestion above to try one now.</div><div class="sim-embed-footer"><div class="sim-embed-footer-left"><i class="fas fa-shield-halved"></i> BK BOT</div><span>${simNow()}</span></div></div>`);
                }, 500);
                setTimeout(() => {
                    runCommand('ban @raider');
                }, 2200);
                setTimeout(() => {
                    simSuggestion('Want to see the security dashboard? Try this ↓', 'security');
                }, 3400);
                simObserver.disconnect();
            }
        });
    }, { threshold: 0.2 });

    simObserver.observe(simLog);
}
