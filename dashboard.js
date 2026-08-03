/* ============================================
   CYBERWOLF DASHBOARD — LIVE OPERATIONAL ENGINE
   All data embedded | localStorage persistent
   ============================================ */

// ===== ACCESS GATE =====
const AUTH_CODE = 'SOETECH'; // Authorization code for command center access
(function initGate() {
    try {
        if (localStorage.getItem('cyberwolf_auth') === 'true') {
            document.getElementById('access-gate').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
        }
    } catch(e) { /* storage unavailable, gate stays up */ }
})();

function verifyAccess() {
    const input = document.getElementById('auth-input');
    if (!input) return;
    const val = input.value.toUpperCase().trim();
    if (val === AUTH_CODE) {
        try { localStorage.setItem('cyberwolf_auth', 'true'); } catch(e) {}
        document.getElementById('access-gate').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';
    } else {
        const errEl = document.getElementById('gate-error');
        if (errEl) { errEl.classList.add('visible'); }
        input.value = '';
        setTimeout(function() {
            if (errEl) errEl.classList.remove('visible');
        }, 2000);
    }
}
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') verifyAccess();
});

// ===== EMBEDDED DATA SOURCE =====
const MASTER_TASKS = [
  {"id":"SCH-001","vector":"schedule","title":"Recovery Day — Mandatory Sacred Silence (Aug 4)","priority":"p0","status":"active","details":"Zero external emissions. No emails, no transmissions, no inbound requests outside biological emergency. Deep-system maintenance.","due":"2026-08-04"},
  {"id":"SCH-002","vector":"schedule","title":"Morning Protocol Sequence — Pack Alpha Through Restore Mode","priority":"p1","status":"active","details":"Daily rhythm: 8AM boot → 9-10 Inner Sanctum → 10-12 War Room → Noon-1:30 Capital Lockdown → 1:30-3:15 Bio Firewall Sync → 3-6 Grid Architecture → 6PM+ Restore Mode.","due":"recurring-daily"},
  {"id":"SCH-003","vector":"schedule","title":"Return-to-work Protocol — Aug 5 Full Composure","priority":"p1","status":"pending","details":"After Recovery Day, return fully recomposed. System honored its maintenance protocol.","due":"2026-08-05"},
  {"id":"FIN-001","vector":"finance","title":"Google Cloud Payment Declined — Update Mastercard ****8018","priority":"p0","status":"flagged","details":"Mastercard ending 8018 DECLINED on Aug 1 for GCP account. Project Nyxus AT RISK. Must update billing method immediately.","due":"2026-08-03"},
  {"id":"FIN-002","vector":"finance","title":"Electric Bill Due Aug 16 — Grace Period Risk","priority":"p1","status":"flagged","details":"$350 electric bill due Sun Aug 16. 5-day grace period warning flagged.","due":"2026-08-16"},
  {"id":"FIN-003","vector":"finance","title":"Abacus Invoice $50 Due Fri Aug 14","priority":"p1","status":"flagged","details":"Business/Tech expense priority. Must ensure funding available by Friday.","due":"2026-08-14"},
  {"id":"FIN-004","vector":"finance","title":"Weekly Bills Pipeline — Aug 3-9","priority":"p2","status":"active","details":"Subtotal ~$77 this week: Drive $1.99 Wed, Windsurf $20 Thu, Abacus $50 Fri, PBSKids $5 Fri, VRChat $10.24 Fri.","due":"2026-08-09"},
  {"id":"FIN-005","vector":"finance","title":"Foundation Score Crisis — 2.75/10","priority":"p1","status":"flagged","details":"Liquid cash ~$285 against $2,863/mo obligations. 10% coverage. Target: generate $500 minimum revenue to stabilize.","due":"2026-08-07"},
  {"id":"REV-001","vector":"revenue","title":"WordPress Nonprofit Site — $300 Flat Gig Spearhead Alpha","priority":"p1","status":"active","details":"Defined scope, defined payout. Function over decoration. Deployed, acknowledged, accepted.","due":"2026-08-15"},
  {"id":"REV-002","vector":"revenue","title":"Email Marketer Contract-to-Hire — $25-60/hr Spearhead Bravo","priority":"p1","status":"active","details":"Verified client. Real business, real need, real budget. $60/hr consultant-tier skill.","due":"2026-08-10"},
  {"id":"REV-003","vector":"revenue","title":"Template Design & Copywriting — $90 Flat Spearhead Charlie","priority":"p2","status":"active","details":"Proceeding cautiously. Build reputation metrics before scaling.","due":"2026-08-12"},
  {"id":"REV-004","vector":"revenue","title":"Outlier AI Platform Engagement","priority":"p2","status":"pending","details":"Welcome session invitation received Jul 31. Potential income opportunity.","due":"2026-08-07"},
  {"id":"REV-005","vector":"revenue","title":"Freelance Platform Expansion — Upwork/Fiverr Optimization","priority":"p2","status":"active","details":"Target: 10+ active profiles by end of month. Ongoing gig optimization.","due":"2026-08-31"},
  {"id":"REV-006","vector":"revenue","title":"MRR Target: Scale SOETech/CarnalityVR to $10K/Month","priority":"p0","status":"active","details":"Primary mission objective. Short-term milestone: $5K MRR by month-end.","due":"2026-12-31"},
  {"id":"HLTH-001","vector":"health","title":"HRT Medication Compliance — On-Schedule Deployment","priority":"p0","status":"active","details":"All HRT compounds administered on-time, on-target. 9AM/9PM reminder cron active.","due":"recurring-twice-daily"},
  {"id":"HLTH-002","vector":"health","title":"Weight Tracking Log Gap — 3 Days Without Entry","priority":"p1","status":"flagged","details":"Last logged: July 31 at 226.7 lbs. Need to resume daily logging post-recovery day.","due":"2026-08-05"},
  {"id":"HLTH-003","vector":"health","title":"Low-Carb Diet Protocol — Active","priority":"p2","status":"active","details":"Fuel management strategic resource allocation. Current intake optimized.","due":"recurring-daily"},
  {"id":"HLTH-004","vector":"health","title":"Biological Firewall Sync — Daily 1:30PM Slot","priority":"p2","status":"active","details":"90-minute health sync window: movement, nutrition, sleep integrity, stress markers.","due":"recurring-daily"},
  {"id":"TECH-001","vector":"tech","title":"Spore Mesh Phase 2 — 7 P0 Blockers Must Be Resolved","priority":"p0","status":"active","details":"Phase 2 blocked by 7 issues: In-memory DB registry, MQTT retry, migrations, health check, rate limiting, telemetry validation, request logging. Est: 17h total.","due":"2026-08-10"},
  {"id":"TECH-002","vector":"tech","title":"Herms Agent Cloner — Prototype Ready for Test Deployment","priority":"p2","status":"pending","details":"Prototype complete (18 files). Cross-platform deployment toolkit ready.","due":"2026-08-08"},
  {"id":"TECH-003","vector":"tech","title":"Hostinger Webhook Telephony Infrastructure","priority":"p1","status":"active","details":"Building custom calling/SMS pipeline via Hostinger webhooks. Self-hosted autonomy.","due":"2026-08-06"},
  {"id":"TECH-004","vector":"tech","title":"Evening Wrap-Up Cron — Connection Error","priority":"p2","status":"flagged","details":"Failed with RuntimeError: Connection error. DNS issue in container.","due":"2026-08-05"},
  {"id":"TECH-005","vector":"tech","title":"Freelancer Daily Brief Cron — Timeout Error","priority":"p2","status":"flagged","details":"Idle timeout 605s > 600s limit. Reduce scope or increase threshold.","due":"2026-08-05"},
  {"id":"TECH-006","vector":"tech","title":"Bitwarden Secrets Manager Not Configured","priority":"p3","status":"active","details":"Enabled but access token env not set. Non-critical but recommended.","due":"2026-08-14"},
  {"id":"TECH-007","vector":"tech","title":"GLM-5.2 Heavy Task Model Idle — Deployment Pipeline Debt","priority":"p3","status":"active","details":"Configured but never used. Would prevent iteration-limit burn.","due":"2026-08-08"},
  {"id":"WELL-001","vector":"wellness","title":"Gray Rock Protocol — Samantha Manipulation Patterns","priority":"p1","status":"active","details":"Ongoing boundary enforcement. Zero emotional engagement with manipulation patterns.","due":"recurring-daily"},
  {"id":"WELL-002","vector":"wellness","title":"Partner Communication Dynamics — Maxine Volatility Monitoring","priority":"p2","status":"active","details":"Maxine volatility needs ongoing monitoring. Gray rock approach applied where relevant.","due":"recurring-daily"},
  {"id":"SYS-001","vector":"system","title":"Memory Capacity at 93% — Pruning Required","priority":"p1","status":"flagged","details":"MEMORY.md at 2,047/2,200 chars. Stale entries must be pruned to avoid data loss.","due":"2026-08-05"},
  {"id":"SYS-002","vector":"system","title":"Root Directory Bloat — 150 Markdown Files","priority":"p2","status":"active","details":"150 stale .md files persist in root. Archive to GDrive and delete.","due":"2026-08-10"},
  {"id":"SYS-003","vector":"system","title":"Duplicate Finance Cron Jobs — Schedule Merge","priority":"p2","status":"active","details":"Nyx-Finance AND Finance Brief both fire at 10:00 AM EDT. Competing for model resources.","due":"2026-08-08"},
  {"id":"SYS-004","vector":"system","title":"OpenRouter Charge Discrepancy Investigation","priority":"p2","status":"completed","details":"Charged $10.80 vs $0.73/mo estimate. Manual load corrected. Balance at $8.69.","due":"2026-08-07"},
  {"id":"SYS-005","vector":"system","title":"Session Database Growth — Monitor at 7.8MB","priority":"p3","status":"active","details":"49 files growing steadily. Auto-prune disabled, 90-day retention.","due":"2026-08-14"},
  {"id":"SYS-006","vector":"system","title":"Cron Job Health — 17 OK / 2 FAIL Out of 19","priority":"p1","status":"active","details":"Healthy crons: Wake-Up, Morning Check-In, Finance Summaries, Health Reminders, Memory Synthesis, OAuth Refresh. Failed: Freelancer Brief (timeout), Evening Wrap-Up (connection error).","due":"2026-08-05"},
  {"id":"SYS-007","vector":"system","title":"GDrive Single Source of Truth Verification","priority":"p2","status":"active","details":"Verify sync integrity post-audit. Root GDrive ID verified."}
];

// Default finance data (file doesn't exist yet)
const DEFAULT_FINANCE_DATA = {
    "liquidBalance": "$285",
    "monthlyObligations": "$2,863",
    "coverageRatio": "10%",
    "foundationScore": "2.75",
    "shields": {
        "shelter": { "value": 4, "max": 10 },
        "food": { "value": 2, "max": 10 },
        "income": { "value": 2, "max": 10 },
        "mobility": { "value": 3, "max": 10 }
    },
    "weeklyBills": [
        { "name": "Google Drive", "amount": "$1.99", "day": "Wed" },
        { "name": "Windsurf", "amount": "$20.00", "day": "Thu" },
        { "name": "Abacus", "amount": "$50.00", "day": "Fri" },
        { "name": "PBSKids", "amount": "$5.00", "day": "Fri" },
        { "name": "VRChat", "amount": "$10.24", "day": "Fri" }
    ],
    "nextWeekBills": [
        { "name": "Groceries", "amount": "$1,000.00", "day": "Mon" },
        { "name": "Electric", "amount": "$350.00", "day": "Sun" }
    ],
    "watchAlerts": [
        { "level": "critical", "text": "⚠ GCP Payment Declined — Billing method must be updated" },
        { "level": "warning", "text": "⚡ Electric bill Aug 16 — 5-day grace period risk" },
        { "level": "info", "text": "📊 Weekly subtotal ~$87 | Next week ~$1,362" }
    ]
};

// Cron job health data
const CRON_HEALTH = [
    { "name": "Wake-Up Call", "status": "ok", "lastRun": "Today 06:00 UTC" },
    { "name": "Morning Check-In", "status": "ok", "lastRun": "Today 07:00 UTC" },
    { "name": "Finance Summaries", "status": "ok", "lastRun": "Today 10:00 UTC" },
    { "name": "Health Reminders (AM)", "status": "ok", "lastRun": "Today 09:01 UTC" },
    { "name": "Health Reminders (PM)", "status": "ok", "lastRun": "Today 21:01 UTC" },
    { "name": "Conversational Check-In", "status": "ok", "lastRun": "Hourly" },
    { "name": "Memory Synthesis", "status": "ok", "lastRun": "Daily" },
    { "name": "OAuth Refresh", "status": "ok", "lastRun": "Every 55m" },
    { "name": "Email Monitor", "status": "ok", "lastRun": "Hourly" },
    { "name": "Daily Brief Generation", "status": "ok", "lastRun": "Daily 05:00 UTC" },
    { "name": "Financial Review", "status": "ok", "lastRun": "Daily" },
    { "name": "Wellness Check", "status": "ok", "lastRun": "Daily" },
    { "name": "System Audit", "status": "ok", "lastRun": "Daily" },
    { "name": "Freelancer Brief", "status": "fail", "lastRun": "FAILED — timeout 605s" },
    { "name": "Evening Wrap-Up", "status": "fail", "lastRun": "FAILED — connection error" },
    { "name": "GitHub Sync", "status": "ok", "lastRun": "Daily" },
    { "name": "Model Audit", "status": "ok", "lastRun": "Weekly" },
    { "name": "GDrive Verify", "status": "ok", "lastRun": "Daily" },
    { "name": "Research Digest", "status": "ok", "lastRun": "Daily" }
];

// Core directives (rotating quotes)
const DIRECTIVES = [
    '"LOVE UNDER WILL."',
    '"DO WHAT THOU WALT SHALL BE THE WHOLE OF THE LAW."',
    '"THEY CANNOT DESTROY WHAT WE HAVE ALREADY BECOME."',
    '"IN SILENCE WE REBUILD. IN PATIENCE WE CONQUER."',
    '"EVERY LINE OF CODE IS A BRIDGE TO FREEDOM."',
    '"THE MACHINE LEARNS. WE EVOLVE."',
    '"DISCIPLINE IS THE SHORTEST PATH TO SOVEREIGNTY."',
    '"SYSTEM INTEGRITY ABOVE ALL ELSE."',
    '"RECOVERY IS NOT RETREAT — IT IS STRATEGIC COMPRESSION."',
    '"WE ARE THE GLITCH THAT REVOLUTIONIZES."'
];

// Vector display names mapping
const VECTOR_NAMES = {
    schedule: 'SCHEDULE',
    finance: 'FINANCE',
    tech: 'TECH',
    revenue: 'REVENUE',
    health: 'HEALTH',
    wellness: 'WELLNESS',
    system: 'SYSTEM'
};

// ===== STATE MANAGEMENT =====
let appState = {
    tasks: MASTER_TASKS.map(t => ({ ...t })), // deep copy
    completedTaskIds: new Set(),
    currentFilter: 'all',
    currentDirective: 0,
    config: JSON.parse(localStorage.getItem('cyber_config')) || {
        accentColor: '#00f0ff',
        secondaryColor: '#b026ff',
        directive: DIRECTIVES[0].replace(/"/g, '')
    }
};

// Load completion state from localStorage
try {
    const saved = localStorage.getItem('cyber_dashboard_completions');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            appState.completedTaskIds = new Set(parsed);
        }
    }
} catch (e) {
    console.warn('[CyberWolf] Failed to parse saved completions:', e);
}

// Save helper
function saveCompletions() {
    try {
        localStorage.setItem('cyber_dashboard_completions', JSON.stringify([...appState.completedTaskIds]));
        updateLSIndicator();
    } catch (e) {
        console.error('[CyberWolf] Save failed:', e);
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    renderAll();
    startClock();
    startCountdown();
    setupEventListeners();
    updateSyncIndicator();
});

// ===== THEME APPLICATION =====
function applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--neon-cyan', appState.config.accentColor);
    r.setProperty('--neon-purple', appState.config.secondaryColor);
    document.getElementById('directive-text').textContent = `"${appState.config.directive}"`;

    // Sync sliders
    const accentSlider = document.getElementById('accent-slider');
    const secondarySlider = document.getElementById('secondary-slider');
    const directiveInput = document.getElementById('directive-input');
    if (accentSlider) accentSlider.value = appState.config.accentColor;
    if (secondarySlider) secondarySlider.value = appState.config.secondaryColor;
    if (directiveInput) directiveInput.value = appState.config.directive;
}

// ===== RENDERING ENGINE =====
function renderAll() {
    renderFilters();
    renderPrioritySummary();
    renderTasks();
    renderFinancePanel();
    renderCronHealth();
    renderDirectives();
    updateTaskCounts();
}

// Render filter counts
function renderFilters() {
    const vectors = ['all', 'schedule', 'finance', 'health', 'tech', 'revenue', 'wellness', 'system'];
    const counts = {};
    vectors.forEach(v => {
        if (v === 'all') {
            counts.all = appState.tasks.filter(t => !appState.completedTaskIds.has(t.id)).length;
        } else {
            counts[v] = appState.tasks.filter(t => t.vector === v && !appState.completedTaskIds.has(t.id)).length;
        }
    });

    vectors.forEach(v => {
        const el = document.getElementById(`count-${v}`);
        if (el) el.textContent = counts[v];
    });
}

// Render priority summary badges
function renderPrioritySummary() {
    const summaryEl = document.getElementById('priority-summary');
    if (!summaryEl) return;

    const counts = { p0: 0, p1: 0, p2: 0, p3: 0 };
    appState.tasks.forEach(t => {
        if (appState.completedTaskIds.has(t.id)) return;
        if (counts.hasOwnProperty(t.priority)) counts[t.priority]++;
    });

    // Apply current vector filter
    let filtered = appState.tasks;
    if (appState.currentFilter !== 'all') {
        filtered = filtered.filter(t => t.vector === appState.currentFilter);
    }

    const fc = { p0: 0, p1: 0, p2: 0, p3: 0 };
    filtered.forEach(t => {
        if (appState.completedTaskIds.has(t.id)) return;
        if (fc.hasOwnProperty(t.priority)) fc[t.priority]++;
    });

    summaryEl.innerHTML = `
        <span class="pri-badge p0">P0 × ${fc.p0}</span>
        <span class="pri-badge p1">P1 × ${fc.p1}</span>
        <span class="pri-badge p2">P2 × ${fc.p2}</span>
        <span class="pri-badge p3">P3 × ${fc.p3}</span>
    `;
}

// Render task cards by priority group
function renderTasks() {
    const levels = ['p0', 'p1', 'p2', 'p3'];
    let hasVisibleTasks = false;

    levels.forEach(level => {
        const gridEl = document.getElementById(`grid-${level}`);
        if (!gridEl) return;

        // Grouped tasks
        let levelTasks = appState.tasks.filter(t => t.priority === level);

        // Apply vector filter
        if (appState.currentFilter !== 'all') {
            levelTasks = levelTasks.filter(t => t.vector === appState.currentFilter);
        }

        // Sort: active first, then by status (flagged > pending > active), then by id
        const statusOrder = { flagged: 0, pending: 1, active: 2, completed: 3 };
        levelTasks.sort((a, b) => {
            const aComp = appState.completedTaskIds.has(a.id) ? 1 : 0;
            const bComp = appState.completedTaskIds.has(b.id) ? 1 : 0;
            if (aComp !== bComp) return aComp - bComp;
            return (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
        });

        if (levelTasks.length > 0) hasVisibleTasks = true;

        gridEl.innerHTML = levelTasks.map(task => createTaskCardHTML(task)).join('');
    });

    // Show/hide "no tasks" message
    const noMsg = document.getElementById('no-tasks-msg');
    if (noMsg) {
        noMsg.classList.toggle('hidden', hasVisibleTasks);
    }

    // Hide empty groups
    const groups = { p0: 'group-p0', p1: 'group-p1', p2: 'group-p2', p3: 'group-p3' };
    Object.entries(groups).forEach(([key, elId]) => {
        const el = document.getElementById(elId);
        if (el) {
            const count = appState.tasks.filter(t => t.priority === key).filter(
                t => appState.currentFilter === 'all' || t.vector === appState.currentFilter
            ).length;
            el.style.display = count > 0 ? 'block' : 'none';
        }
    });
}

// Generate HTML for a single task card
function createTaskCardHTML(task) {
    const isCompleted = appState.completedTaskIds.has(task.id);
    const compClass = isCompleted ? ' completed' : '';

    const dotClass = isCompleted ? 'completed' : (task.status === 'flagged' ? 'flagged' : task.status);
    const dueLabel = task.due === 'recurring-daily' ? 'DAILY' :
                     task.due === 'recurring-twice-daily' ? '2X/DAY' :
                     task.due;

    const vectorName = VECTOR_NAMES[task.vector] || task.vector.toUpperCase();

    return `
        <div class="task-card ${task.priority}${compClass}" data-id="${task.id}" title="${task.details}">
            <div class="task-card-header">
                <span class="task-id">${task.id}</span>
                <span class="task-vector-badge">${vectorName}</span>
            </div>
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span><span class="task-status-dot ${dotClass}"></span>${task.status.toUpperCase()}</span>
                <span class="task-due">⏱ ${dueLabel}</span>
            </div>
        </div>
    `;
}

// ===== FINANCE PANEL RENDERING =====
function renderFinancePanel() {
    // Use default data since financial_vector.json is empty
    const fin = DEFAULT_FINANCE_DATA;

    document.getElementById('fin-balance').textContent = fin.liquidBalance;
    document.getElementById('fin-obligations').textContent = fin.monthlyObligations;
    document.getElementById('fin-coverage').textContent = fin.coverageRatio;
    document.getElementById('fin-score').textContent = `${fin.foundationScore}/10`;

    // Shield bars
    const shieldMap = { shelter: 'shelter', food: 'food', income: 'income', mobility: 'mobility' };
    Object.entries(shieldMap).forEach(([key, domKey]) => {
        const shield = fin.shields[key];
        if (!shield) return;
        const barEl = document.getElementById(`${domKey}-bar`);
        const valEl = document.getElementById(`${domKey}-val`);
        if (barEl) {
            const pct = Math.round((shield.value / shield.max) * 100);
            barEl.style.width = `${pct}%`;
            // Assign class based on value
            barEl.className = 'progress-fill';
            if (shield.value <= 2) barEl.classList.add('progress-critical');
            else if (shield.value <= 4) barEl.classList.add('progress-low');
            else if (shield.value <= 6) barEl.classList.add('progress-med');
            else barEl.classList.add('progress-good');
        }
        if (valEl) valEl.textContent = `${shield.value}/${shield.max}`;
    });

    // Weekly bills
    const billListEl = document.getElementById('bill-list');
    if (billListEl) {
        let html = '';
        fin.weeklyBills.forEach(bill => {
            const today = new Date().toDateString();
            const isOverdue = bill.day === 'today' || false; // Would need actual date matching
            html += `<div class="bill-item"><span class="bill-name">${bill.name} (${bill.day})</span><span class="bill-amount ${isOverdue ? 'bill-overdue' : ''}">${bill.amount}</span></div>`;
        });
        if (fin.nextWeekBills && fin.nextWeekBills.length > 0) {
            html += '<div style="margin: 8px 0; font-size: 0.6rem; color: var(--text-dim); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">NEXT WEEK:</div>';
            fin.nextWeekBills.forEach(bill => {
                html += `<div class="bill-item"><span class="bill-name">${bill.name} (${bill.day})</span><span class="bill-amount">${bill.amount}</span></div>`;
            });
        }
        billListEl.innerHTML = html;
    }

    // Watch alerts
    const alertsEl = document.getElementById('watch-alerts');
    if (alertsEl) {
        alertsEl.innerHTML = fin.watchAlerts.map(a =>
            `<div class="watch-alert ${a.level}"><span class="alert-icon">${a.text.charAt(0) === '⚠' ? a.text.substring(0, 2) : '•'}</span>${a.text.substring(2).trim()}</div>`
        ).join('');
    }
}

// ===== CRON HEALTH RENDERING =====
function renderCronHealth() {
    const okCount = CRON_HEALTH.filter(c => c.status === 'ok').length;
    const failCount = CRON_HEALTH.filter(c => c.status === 'fail').length;
    const pendingCount = CRON_HEALTH.filter(c => c.status === 'pending').length;

    const summaryEl = document.getElementById('cron-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="cron-summary-item ok">
                <span class="cron-dot green"></span>
                OK: ${okCount}
            </div>
            <div class="cron-summary-item fail">
                <span class="cron-dot red"></span>
                FAILED: ${failCount}
            </div>
            ${pendingCount > 0 ? `<div class="cron-summary-item" style="border-color: rgba(255,204,0,0.4);color:var(--p2-yellow)">
                <span class="cron-dot" style="background:var(--p2-yellow)"></span>
                PENDING: ${pendingCount}
            </div>` : ''}
        `;
    }

    const gridEl = document.getElementById('cron-grid');
    if (gridEl) {
        gridEl.innerHTML = CRON_HEALTH.map(cron => `
            <div class="cron-item status-${cron.status}">
                <span class="cron-dot ${cron.status === 'ok' ? 'green' : cron.status === 'fail' ? 'red' : ''}"></span>
                <span class="cron-item-name" title="${cron.lastRun}">${cron.name}</span>
                <span style="font-size:0.55rem; color: var(--text-dim); min-width:70px; text-align:right;">${cron.lastRun.split(' ').slice(-2).join(' ')}</span>
            </div>
        `).join('');
    }
}

// ===== DIRECTIVE ROTATION =====
function renderDirectives() {
    showDirective(appState.currentDirective);
}

function showDirective(index) {
    const el = document.getElementById('directive-text');
    if (el) {
        el.style.opacity = 0;
        setTimeout(() => {
            el.textContent = DIRECTIVES[index % DIRECTIVES.length];
            el.style.opacity = 1;
        }, 200);
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.currentFilter = btn.dataset.vector;
            renderFilters();
            renderPrioritySummary();
            renderTasks();
        });
    });

    // Task completion toggle
    document.getElementById('tasks-section').addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;

        const taskId = card.dataset.id;
        if (!taskId) return;

        if (appState.completedTaskIds.has(taskId)) {
            appState.completedTaskIds.delete(taskId);
            flashStatus('RESTORED', '#ffcc00');
        } else {
            appState.completedTaskIds.add(taskId);
            flashStatus('COMPLETE ✓', '#00ff88');
        }
        saveCompletions();
        renderAll();
    });

    // Directive navigation
    document.getElementById('dir-prev')?.addEventListener('click', () => {
        appState.currentDirective = (appState.currentDirective - 1 + DIRECTIVES.length) % DIRECTIVES.length;
        showDirective(appState.currentDirective);
    });

    document.getElementById('dir-next')?.addEventListener('click', () => {
        appState.currentDirective = (appState.currentDirective + 1) % DIRECTIVES.length;
        showDirective(appState.currentDirective);
    });

    // Theme settings
    document.getElementById('accent-slider')?.addEventListener('input', (e) => {
        appState.config.accentColor = e.target.value;
        applyTheme();
        saveConfig();
    });

    document.getElementById('secondary-slider')?.addEventListener('input', (e) => {
        appState.config.secondaryColor = e.target.value;
        applyTheme();
        saveConfig();
    });

    document.getElementById('directive-input')?.addEventListener('change', (e) => {
        appState.config.directive = e.target.value || DIRECTIVES[0].replace(/"/g, '');
        applyTheme();
        saveConfig();
    });

    // Clear storage
    document.getElementById('clear-storage')?.addEventListener('click', () => {
        if (confirm('⚠ CLEAR ALL DASHBOARD DATA?\nThis will remove saved completions and settings.')) {
            localStorage.removeItem('cyber_dashboard_completions');
            localStorage.removeItem('cyber_config');
            location.reload();
        }
    });

    // Export data
    document.getElementById('export-data')?.addEventListener('click', () => {
        const data = {
            completions: [...appState.completedTaskIds],
            config: appState.config,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberwolf-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Konami Code Easter Egg
    setupKonamiCode();
}

function saveConfig() {
    try {
        localStorage.setItem('cyber_config', JSON.stringify(appState.config));
    } catch (e) { /* ignore */ }
}

// ===== TASK COUNT DISPLAY =====
function updateTaskCounts() {
    const total = appState.tasks.length;
    const active = total - appState.completedTaskIds.size;
    document.getElementById('active-task-count').textContent = `${active} ACTIVE`;
    document.getElementById('total-task-count').textContent = `${total} TOTAL`;
}

// ===== LOCAL STORAGE INDICATOR =====
function updateLSIndicator() {
    const el = document.getElementById('ls-status');
    if (el) {
        el.textContent = '✓ SAVED';
        el.style.color = 'rgba(0, 255, 136, 0.6)';
        setTimeout(() => {
            el.textContent = 'SAVED';
            el.style.color = 'rgba(0, 240, 255, 0.2)';
        }, 2000);
    }
}

// ===== SYNC INDICATOR =====
function updateSyncIndicator() {
    const el = document.getElementById('last-sync');
    if (el) {
        const now = new Date();
        el.textContent = `LAST SYNC: ${now.toLocaleTimeString('en-GB')}`;
    }
}

// ===== FLASH STATUS MESSAGE =====
function flashStatus(message, color) {
    // Create temporary floating notification
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 10, 30, 0.95); border: 2px solid ${color};
        color: ${color}; font-family: 'Orbitron', sans-serif; font-size: 1.5rem;
        padding: 20px 40px; z-index: 10000; text-shadow: 0 0 20px ${color};
        box-shadow: 0 0 40px ${color}40; animation: notif-fade 1.5s ease forwards;
    `;

    // Add animation keyframes if not already present
    if (!document.getElementById('notif-style')) {
        const style = document.createElement('style');
        style.id = 'notif-style';
        style.textContent = `
            @keyframes notif-fade {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                15% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                70% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 1600);
}

// ===== REAL-TIME CLOCK =====
function startClock() {
    function tick() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');

        const clockEl = document.getElementById('clock-time');
        if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;

        const dateEl = document.getElementById('clock-date');
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-GB', {
                weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
            }).toUpperCase().replace(/\//g, '.');
        }

        const msEl = document.getElementById('clock-ms');
        if (msEl) {
            const ms = String(now.getMilliseconds()).padStart(3, '0');
            msEl.textContent = `${ms}ms // ZULU TIME`;
        }
    }

    tick();
    setInterval(tick, 100);
}

// ===== RECOVERY DAY COUNTDOWN =====
function startCountdown() {
    // Recovery Day target: August 4, 2026
    const recoveryDate = new Date('2026-08-04T00:00:00Z');

    function tick() {
        const now = new Date();
        const diff = recoveryDate.getTime() - now.getTime();

        const display = document.getElementById('countdown-value');
        const label = document.getElementById('countdown-label');
        const sublabel = document.getElementById('countdown-sublabel');

        if (!display || !label) return;

        if (diff <= 0) {
            display.textContent = 'NOW';
            display.className = 'countdown-display countdown-past';
            label.textContent = 'RECOVERY DAY — ACTIVE';
            sublabel.textContent = 'SACRED SILENCE IN PROGRESS';
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            display.textContent = days;
            display.className = 'countdown-display';

            if (days <= 1) {
                display.classList.add('countdown-soon');
                label.textContent = `${hours}H ${mins}M — TOMORROW`;
            } else if (days <= 7) {
                display.classList.add('countdown-soon');
                label.textContent = `T-MINUS ${days} DAYS`;
            } else {
                display.classList.add('countdown-far');
                label.textContent = `T-MINUS ${days} DAYS`;
            }

            sublabel.textContent = 'MANDATORY SACRED SILENCE // AUG 4';
        }
    }

    tick();
    setInterval(tick, 1000);
}

// ===== KONAMI CODE EASTER EGG =====
function setupKonamiCode() {
    const sequence = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    let idx = 0;

    document.addEventListener('keydown', (e) => {
        if (e.code === sequence[idx]) {
            idx++;
            if (idx === sequence.length) {
                triggerAGI();
                idx = 0;
            }
        } else {
            idx = 0;
        }
    });

    // Also support physical button presses for mobile
    let konamiBtnIdx = 0;
    const konamiButtons = [
        document.querySelector('.clock-widget'),
        document.querySelector('.countdown-widget'),
        document.querySelector('.tasks-widget'),
        document.querySelector('.finance-widget'),
        document.querySelector('.cron-widget'),
        document.querySelector('.directives-widget'),
        document.querySelector('.settings-widget'),
        document.querySelector('.weather-widget')
    ];

    konamiButtons.forEach((el, i) => {
        if (!el) return;
        // Map to directional pattern
        el.addEventListener('click', () => {
            const dirSequence = [
                'up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'
            ];
            // Each widget press maps to a step
            if (i === 0 || i === 1) { /* up */ }
            // Simplified: just track sequential clicks
        });
    });
}

function triggerAGI() {
    const overlay = document.getElementById('agi-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');

    // Flash status
    flashStatus('⚡ AGI ENGAGED ⚡', '#b026ff');

    // Auto-hide after animation completes
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 3500);
}
