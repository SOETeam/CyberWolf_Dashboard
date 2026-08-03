/* ============================================
   CYBERWOLF DASHBOARD — LIVE OPERATIONAL ENGINE
   Dual-View Layout | localStorage Persistent
   V3.1 — Data embedded from VITALIS output
   ============================================ */

// ===== WEBHOOK NOTIFICATION CONFIG =====
// CyberWolf Dashboard → Hermes Agent task completion bridge
// Architecture: Google Sheets Bridge + Apps Script Serverless Relay (ORACLE Research, Aug 3, 2026)
// ===== WEBHOOK INTEGRATION =====
const CYBERWOLF_RELAY_URL = 'https://script.google.com/macros/s/AKfycbzTghYHJyA61-emacmmcLJ57lnbZ1zECDWDDTn0fUJBoTraHw27MrgMRpanQFruiZm3/exec';
// ^ CyberWolf Sheets Bridge relay — deployed Aug 3, 2026 v2 by Sophia (Anyone access)
// Cross-device sync: all devices GET /state, GET /push — zero CORS preflight
// Nyx notified every 5 min via Hermes cron polling Sheet
// Fallback: if network unavailable, local-only mode activates automatically
// ===== ACCESS GATE =====
const AUTH_CODE = 'SOETECH';
(function initGate() {
    try {
        if (localStorage.getItem('cyberwolf_auth') === 'true') {
            document.getElementById('access-gate').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
        }
    } catch(e) {}
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

// ===== EMBEDDED DATA FROM VITALIS =====
// Source: /tmp/dashboard_today.json
const TODAY_TASKS = [
  {"id":"sched-001","title":"Daily Boot Sequence — 8AM Wake Up","vector":"schedule","priority":"p0","status":"active","details":"Clean system restart from standby. Neural link engaging, circuits waking one by one.","source":"audio_script + cron","time_block":"08:00"},
  {"id":"sched-002","title":"Inner Sanctum — Pack Alpha Kids Duty","vector":"schedule","priority":"p0","status":"active","details":"Children are priority nodes. Emotional handshake protocols. Multi-node routing.","source":"audio_script","time_block":"09:00"},
  {"id":"health-001","title":"HRT Medication Reminder — Afternoon Dose","vector":"health","priority":"p0","status":"active","details":"1PM dose via HRT Tracker cron (twice-daily). Last triggered Aug 3 morning dose.","source":"memory + cron","time_block":"13:00"},
  {"id":"health-002","title":"Health Sync — Biological Firewall Maintenance","vector":"health","priority":"p0","status":"active","details":"Movement protocol, nutritional calibration, sleep cycle integrity, stress markers.","source":"audio_script + cron","time_block":"13:30"},
  {"id":"sched-004","title":"War Room — Strategic Overhaul with Nyx","vector":"schedule","priority":"p1","status":"active","details":"Parallel processing across all domains: finance, projects, health, resources.","source":"audio_script + cron","time_block":"10:00"},
  {"id":"sched-005","title":"Finance & Passive Income Brief","vector":"schedule","priority":"p1","status":"active","details":"Automated daily financial overview covering income, budget, investments.","source":"cron","time_block":"10:00"},
  {"id":"sched-006","title":"Nyx-Finance Daily Summary","vector":"schedule","priority":"p1","status":"active","details":"Comprehensive finance summary. Liquid cash ~$151, Robinhood ~$41, EBT $1,200/mo.","source":"cron","time_block":"10:00"},
  {"id":"sched-007","title":"Weekly Bill Review","vector":"system","priority":"p1","status":"active","details":"Monday check-in. Monthly obligations $2,863 vs $151 liquid.","source":"cron","time_block":"10:00"},
  {"id":"sched-003","title":"Nyx Morning Brief","vector":"schedule","priority":"p1","status":"active","details":"Automated briefing at 10:30 UTC. Active items, priorities, next actions.","source":"cron","time_block":"10:30"},
  {"id":"sched-010","title":"Google Cloud Payment Crisis — URGENT","vector":"finance","priority":"p0","status":"flagged","details":"Mastercard 8018 DECLINED for Google Cloud. Project NYXUS AT RISK OF SUSPENSION.","source":"master_tasks","time_block":"12:00"},
  {"id":"sched-009","title":"Finance Audit — Capital Lockdown Mode","vector":"finance","priority":"p1","status":"active","details":"Every transaction scanned. Budget is armor. Card crisis ongoing.","source":"audio_script + master_tasks","time_block":"12:00"},
  {"id":"health-003","title":"Low-Carb Diet Protocol Maintenance","vector":"health","priority":"p1","status":"active","details":"Ketones burning cleaner. Insulin sensitivity holding strong. Cognitive layer sharp.","due":"daily","time_block":"ALL DAY"},
  {"id":"sched-008","title":"Gig Platform Signup Reminder","vector":"revenue","priority":"p1","status":"active","details":"Active proposals: WordPress $300, Email Marketer $25-60/hr, Template $90.","source":"cron","time_block":"15:00"},
  {"id":"sched-011","title":"Project Grid Architecture — Deep Build Window","vector":"schedule","priority":"p1","status":"active","details":"Three hours of creation velocity. Debugging, stress-testing workflows.","source":"audio_script","time_block":"15:00"},
  {"id":"sched-013","title":"Nyx-Memory Cron Synthesis (19:00 UTC)","vector":"system","priority":"p1","status":"active","details":"Runs hours 1,7,13,19 UTC. Synthesizes operational memory from daily activity.","source":"cron","time_block":"19:00"},
  {"id":"sched-014","title":"Evening Wrap-Up Reminder (AT RISK)","vector":"system","priority":"p1","status":"flagged","details":"Scheduled 23:00 UTC. FAILED last run with Discord connection error.","source":"cron","time_block":"23:00"},
  {"id":"sched-012","title":"Conversational Check-In (Recurring)","vector":"system","priority":"p1","status":"active","details":"Recurring every 180 min. Keeps command channel active.","source":"cron","time_block":"recurring_180m"},
  {"id":"sched-015","title":"Restore Mode — Evening Wind Down","vector":"schedule","priority":"p2","status":"active","details":"Aggressive processes suspend. Low-power recovery state.","source":"audio_script","time_block":"18:00"}
];

// Source: /tmp/dashboard_backlog.json
const BACKLOG_TASKS = [
  {"id":"finance-001","vector":"finance","title":"Google Cloud Payment Method — Card Declined","priority":"p0","status":"flagged","details":"Mastercard 8018 DECLINED for GCP account. Project Nyxus AT RISK. Update payment method immediately.","due":"2026-08-03"},
  {"id":"wellness-001","vector":"wellness","title":"Recovery Day Compliance — Aug 4 Strict Rest","priority":"p0","status":"active","details":"Mandatory sacred silence. No external emissions. Systems requirement, not optional downtime.","due":"2026-08-04"},
  {"id":"wellness-002","vector":"wellness","title":"Inner Sanctum Priority — Pack Alpha Family Care","priority":"p0","status":"active","details":"Children are priority zero. Maintain loyalty through consistent presence.","due":"daily"},
  {"id":"finance-002","vector":"finance","title":"EBT Baseline — $1,200/month Structural Foundation","priority":"p0","status":"active","details":"Structural beam holding the roof up. Stability distributed by algorithm.","due":"monthly recurring"},
  {"id":"finance-003","vector":"finance","title":"Liquid Cash Position Monitoring — ~$151 Total","priority":"p1","status":"active","details":"PayPal $9, Uber $21, DoorDash $9.51, Cash $100, Huntington $12, CashApp $0, OpenRouter $8.69.","due":"daily monitoring"},
  {"id":"finance-005","vector":"finance","title":"AgentLine Termination → Hostinger Migration","priority":"p1","status":"in_progress","details":"AgentLine terminated ($0.44 balance). Custom Hostinger webhook telephony in progress.","due":"2026-08-10"},
  {"id":"finance-007","vector":"finance","title":"Monthly Obligation Gap — $2,863/mo vs ~$151","priority":"p1","status":"flagged","details":"Massive cash flow shortfall. Robinhood ~$41. Urgent revenue scaling needed.","due":"ongoing"},
  {"id":"rev-001","vector":"revenue","title":"WordPress Nonprofit Site Gig — $300 Fixed Price","priority":"p1","status":"active","details":"Defined scope, defined payout. Deployed, acknowledged, accepted.","due":"per contract"},
  {"id":"rev-002","vector":"revenue","title":"Email Marketer Contract — $25-60/hr Contract-to-Hire","priority":"p1","status":"active","details":"Verified client. Real business, real budget. $60/hr consultant-tier.","due":"per contract"},
  {"id":"rev-004","vector":"revenue","title":"$10K/MRR Target — SOETech/CarnalityVR Portfolio","priority":"p1","status":"active","details":"Diversified channels: freelancing, gig economy, digital products, consulting.","due":"ongoing"},
  {"id":"rev-006","vector":"revenue","title":"Gig Platform Presence — Upwork/Fiverr Proposals","priority":"p1","status":"active","details":"Multiple proposal drafts in progress. Freelancer Daily Brief cron running.","due":"continuous"},
  {"id":"tech-001","vector":"tech","title":"Spore Mesh Phase 2 Blockers — 7 Critical Items","priority":"p1","status":"flagged","details":"Shell injection, HMAC replay, cert pinning, race condition, DoS, privilege escalation, info leakage.","due":"before deployment"},
  {"id":"tech-002","vector":"tech","title":"SOEtech Production Web App Security Issues","priority":"p1","status":"flagged","details":"Debug endpoint exposed. RouteLLM API key rejected. Direct revenue impact.","due":"urgent"},
  {"id":"system-001","vector":"system","title":"Freelancer Daily Brief Timeout Fix Required","priority":"p1","status":"flagged","details":"Consistently failing with 600s timeout. Optimize or increase threshold.","due":"high priority"},
  {"id":"system-002","vector":"system","title":"Evening Wrap-Up Delivery Failure","priority":"p1","status":"flagged","details":"RuntimeError: Connection error. Check DNS resolution, retry logic.","due":"high priority"},
  {"id":"system-003","vector":"system","title":"17/19 Cron Jobs Healthy — 2 Flagged","priority":"p1","status":"active","details":"Total 19 jobs. 17 OK. 2 FAILED: Freelancer Brief + Evening Wrap-Up.","due":"ongoing monitoring"},
  {"id":"finance-004","vector":"finance","title":"OpenRouter $10.80 Charge Investigation","priority":"p1","status":"in_progress","details":"Charged $10.80 vs estimated $0.73/mo. 15x discrepancy. Current balance $8.69.","due":"2026-08-04"},
  {"id":"health-004","vector":"health","title":"Vital Signs Monitoring — Daily Telemetry","priority":"p2","status":"active","details":"Heart rhythm regular, BP optimal, temp nominal, O2 sat normal.","due":"recurring"},
  {"id":"rev-003","vector":"revenue","title":"Template Design & Copywriting Gig — $90","priority":"p2","status":"active","details":"Template design and copy deliverable. Proceeding with calculated caution.","due":"per deadline"},
  {"id":"rev-005","vector":"revenue","title":"Outlier AI Platform Engagement Opportunity","priority":"p2","status":"pending","details":"Welcome session invitations sent Jul 31. Worth exploring during bandwidth.","due":"low urgency"},
  {"id":"tech-003","vector":"tech","title":"Herms Agent Cloner — Prototype Ready","priority":"p2","status":"active","details":"Cross-platform toolkit complete. Clone script + Docker support. Fleet potential.","due":"next runway"},
  {"id":"tech-004","vector":"tech","title":"CarnalityVR Passive Income Pipeline","priority":"p2","status":"active","details":"Virtual experiences generating revenue autonomously. Invest weeks now, dividends later.","due":"ongoing"},
  {"id":"tech-005","vector":"tech","title":"Bitwarden Secrets Manager Unconfigured","priority":"p2","status":"flagged","details":"Feature enabled but credentials not set. BWS_ACCESS_TOKEN missing.","due":"when convenient"},
  {"id":"system-006","vector":"system","title":"Memory Near Capacity — MEMORY.md at 93%","priority":"p2","status":"active","details":"MEMORY.md at 2,047/2,200 chars. Prune stale entries, move details to GDrive.","due":"weekly maintenance"},
  {"id":"system-004","vector":"system","title":"System Health Score — 7.0/10 Overall","priority":"p2","status":"active","details":"Infrastructure 8/10, Models 9/10, Cron 6/10, Security 6/10.","due":"continuous"},
  {"id":"gdrive-004","vector":"gdrive","title":"Active Bills & Finances Tracker — Sheets","priority":"p2","status":"active","details":"Primary financial spreadsheet modified Aug 1.","due":"continuous updates"},
  {"id":"gdrive-005","vector":"gdrive","title":"Health Progress Spreadsheet — Sheets","priority":"p2","status":"active","details":"Monitors HRT adherence, weight trajectory, vital signs.","due":"continuous updates"},
  {"id":"tech-006","vector":"tech","title":"Model Architecture — Tiered Setup Operational","priority":"p3","status":"active","details":"Primary: qwen/qwen3.7-flash. Fallback: gpt-5.6-luna. Heavy: glm-5.2.","due":"maintenance window"},
  {"id":"system-005","vector":"system","title":"Storage Cleanup — 950MB Stale Backups","priority":"p3","status":"active","details":"state.db.backup + state.db.old. Cleanup candidates identified.","due":"when convenient"},
  {"id":"system-007","vector":"system","title":"Root Directory File Bloat — 150 .md Files","priority":"p3","status":"active","details":"Fifty percent root directory orphaned markdown files. Archive to GDrive.","due":"when convenient"},
  {"id":"gdrive-006","vector":"gdrive","title":"GDrive Root Canonical Storage — L3 Memory Tier","priority":"p3","status":"active","details":"Canonical memory tier anchored at GDrive Root. Four-tier architecture.","due":"ongoing"}
];

// Vector display names mapping
const VECTOR_NAMES = {
    schedule: 'SCHEDULE',
    finance: 'FINANCE',
    tech: 'TECH',
    revenue: 'REVENUE',
    health: 'HEALTH',
    wellness: 'WELLNESS',
    system: 'SYSTEM',
    gdrive: 'GDRIVE'
};

// ===== STATE MANAGEMENT =====
let appState = {
    completedTaskIds: new Set(),
    currentFilter: 'all',
    currentDirective: 0,
    currentView: 'today', // 'today' or 'agenda'
    config: JSON.parse(localStorage.getItem('cyber_config')) || {
        accentColor: '#00f0ff',
        secondaryColor: '#b026ff',
        directive: '"LOVE UNDER WILL."'
    }
};

// ===== DEVICE FINGERPRINT GENERATOR =====
// Generates a stable, persistent device identifier for telemetry
// and cross-device state correlation. Stored in localStorage so it
// survives page reloads but does not uniquely identify the user.
function getDeviceId() {
    const STORAGE_KEY = 'cyberwolf_device_id';
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
        // Composite fingerprint: random component + timestamp-based fallback
        const randPart = Math.random().toString(36).slice(2, 10);
        const tsPart = Date.now().toString(36);
        id = 'dev-' + randPart + '-' + tsPart;
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch(e) { /* localStorage disabled — id stays in-memory */ }
    }
    return id;
}

// Default finance data
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

// ===== LOAD LOCAL STATE (baseline — always works offline) =====
try {
    const saved = localStorage.getItem('cyber_dashboard_completions');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            parsed.forEach(id => appState.completedTaskIds.add(id));
        }
    }
} catch (e) {
    console.warn('[CyberWolf] Failed to parse saved completions:', e);
}

// ===== FETCH REMOTE STATE (cross-device sync overlay) =====
async function loadRemoteState() {
    try {
        const resp = await fetch(`${CYBERWOLF_RELAY_URL}?action=state&userId=sophia`, {
            signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const remote = await resp.json();

        // ---- Format detection & merge ----
        // Relay v9+:    { userId, tasks: [{id,label,completed:true,...}], count }
        // Legacy/API:   { completedTaskIds: [...], lastUpdated, lastDevice }
        let remoteCompleted = [];

        if (remote && Array.isArray(remote.tasks)) {
            // Extract completed task IDs from task list (relay v9+)
            remoteCompleted = remote.tasks
                .filter(t => t.completed === true)
                .map(t => t.id);
        } else if (remote && Array.isArray(remote.completedTaskIds)) {
            // Fallback: direct completed-task-id array (legacy / expected format)
            remoteCompleted = remote.completedTaskIds;
        }

        if (remoteCompleted.length > 0) {
            let added = 0;
            remoteCompleted.forEach(id => {
                if (!appState.completedTaskIds.has(id)) {
                    appState.completedTaskIds.add(id);
                    added++;
                }
            });
            if (added > 0) {
                console.info(`[CyberWolf] Merged ${added} remote completion(s) from other devices (${remoteCompleted.length} total remote)`);
            }
        }

        // Update sync indicator with remote timestamp
        if (remote) {
            const el = document.getElementById('last-sync');
            if (el) {
                let timeStr = null;
                if (remote.lastUpdated) {
                    const remoteTime = new Date(remote.lastUpdated);
                    if (!isNaN(remoteTime.getTime())) {
                        timeStr = remoteTime.toLocaleTimeString('en-GB') + ' (' + (remote.lastDevice || 'unknown') + ')';
                    }
                }
                if (remote.userId && !timeStr) {
                    timeStr = remote.userId + ' · ' + (remote.count != null ? remote.count + ' tasks' : '');
                }
                if (timeStr) {
                    el.textContent = 'LAST SYNC: ' + timeStr;
                }
            }
        }
    } catch (e) {
        // Graceful degradation: falls back to localStorage-only mode
        console.warn('[CyberWolf] Remote state sync unavailable (offline or relay down):', e.message);
    }
}

// Combined task list for reference
const ALL_TASKS = [...TODAY_TASKS, ...BACKLOG_TASKS];

// Save helper
function saveCompletions() {
    try {
        localStorage.setItem('cyber_dashboard_completions', JSON.stringify([...appState.completedTaskIds]));
        updateLSIndicator();
        } catch (e) {
        console.error('[CyberWolf] Save failed:', e);
    }
}

// ===== RELAY NOTIFICATION FUNCTION =====
// Sends task completion/restoration via GET (no CORS preflight).
// GET-based protocol: action=push&userId=sophia&taskIds=id1,id2,...
async function notifyRelay(taskId, wasCompleted) {
    try {
        const task = ALL_TASKS.find(t => t.id === taskId);
        if (!task) {
            console.warn('[CyberWolf] Relay: unknown taskId', taskId);
            return;
        }

        const userId = 'sophia';

        if (wasCompleted) {
            // Push this single task ID via GET query param
            await fetch(
                `${CYBERWOLF_RELAY_URL}?action=push&userId=${userId}&taskIds=${encodeURIComponent(taskId)}`,
                { signal: AbortSignal.timeout(5000) }
            );
        } else {
            // For restoration, push the current completed set minus this task
            const remaining = [...appState.completedTaskIds].filter(id => id !== taskId);
            if (remaining.length > 0) {
                await fetch(
                    `${CYBERWOLF_RELAY_URL}?action=push&userId=${userId}&taskIds=${encodeURIComponent(remaining.join(','))}`,
                    { signal: AbortSignal.timeout(5000) }
                );
            } else {
                // No completions left — push empty list to clear server side
                await fetch(
                    `${CYBERWOLF_RELAY_URL}?action=push&userId=${userId}&taskIds=`,
                    { signal: AbortSignal.timeout(5000) }
                );
            }
        }
    } catch (e) {
        console.warn('[CyberWolf] Relay notification failed:', e.message);
        // Silent fail — UX must not be disrupted
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    applyTheme();
    renderAll();
    startClock();
    startCountdown();
    setupEventListeners();
    updateSyncIndicator();
    // Merge remote completion state before final render
    await loadRemoteState();
    renderAll();
});

// ===== THEME APPLICATION =====
function applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--neon-cyan', appState.config.accentColor);
    r.setProperty('--neon-purple', appState.config.secondaryColor);
    const directiveEl = document.getElementById('directive-text');
    if (directiveEl) directiveEl.textContent = `"${appState.config.directive}"`;

    const accentSlider = document.getElementById('accent-slider');
    const secondarySlider = document.getElementById('secondary-slider');
    const directiveInput = document.getElementById('directive-input');
    if (accentSlider) accentSlider.value = appState.config.accentColor;
    if (secondarySlider) secondarySlider.value = appState.config.secondaryColor;
    if (directiveInput) directiveInput.value = appState.config.directive;
}

// ===== VIEW SWITCHING =====
// Wrapped with logging & forced reflow for desktop debugging
function switchView(viewName) {
    console.log('[CyberWolf] View switch triggered:', viewName);
    appState.currentView = viewName;

    // Toggle panel visibility
    const todayPanel = document.getElementById('panel-today');
    const agendaPanel = document.getElementById('panel-agenda');
    if (viewName === 'today') {
        todayPanel.classList.add('active');
        agendaPanel.classList.remove('active');
        document.getElementById('btn-today').classList.add('active');
        document.getElementById('btn-agenda').classList.remove('active', 'purple-active');
    } else {
        agendaPanel.classList.add('active');
        todayPanel.classList.remove('active');
        document.getElementById('btn-agenda').classList.add('active', 'purple-active');
        document.getElementById('btn-today').classList.remove('active', 'purple-active');
    }

    // Re-render appropriate panels
    if (viewName === 'today') {
        renderToday();
    } else {
        renderAgenda();
    }
    renderFilters(); // Always update filter counts

    // Force layout recalculation on all panels after rendering
    try {
        document.querySelectorAll('.view-panel').forEach(function(panel) {
            void panel.offsetHeight; // forces reflow
        });
    } catch(e) {}
}

// Collapsible backlog toggle
function toggleBacklog() {
    const content = document.getElementById('backlog-content');
    const heading = document.getElementById('backlog-heading');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        heading.classList.add('open');
    } else {
        content.classList.add('hidden');
        heading.classList.remove('open');
    }
}

// ===== RENDER FUNCTIONS =====

function renderAll() {
    renderToday();
    renderFilters();
    renderPrioritySummary();
    renderFinancePanel();
    renderCronHealth();
    renderDirectives();
    updateTaskCounts();
}

// ---- TODAY VIEW ----
function renderToday() {
    // Sort tasks chronologically by time_block label
    const prioOrder = { p0: 0, p1: 1, p2: 2, p3: 3 };
    const sortedTasks = sortTasksByTimeBlock(TODAY_TASKS);

    let hasVisibleTasks = false;
    const levels = ['p0', 'p1', 'p2', 'p3'];

    levels.forEach(level => {
        const gridEl = document.getElementById(`grid-${level}-today`);
        if (!gridEl) return;

        let levelTasks = sortedTasks.filter(t => t.priority === level);

        // Apply vector filter
        if (appState.currentFilter !== 'all') {
            levelTasks = levelTasks.filter(t => t.vector === appState.currentFilter);
        }

        if (levelTasks.length > 0) hasVisibleTasks = true;
        gridEl.innerHTML = levelTasks.map(task => createTaskCardHTML(task)).join('');
    });

    // Show/hide "no tasks" message
    const noMsg = document.getElementById('no-tasks-msg');
    if (noMsg) {
        noMsg.classList.toggle('hidden', hasVisibleTasks);
    }

    // Hide empty priority groups
    levels.forEach(key => {
        const groupEl = document.getElementById(`group-${key}`);
        if (groupEl) {
            const count = sortedTasks.filter(t => t.priority === key &&
                (appState.currentFilter === 'all' || t.vector === appState.currentFilter)).length;
            groupEl.style.display = count > 0 ? 'block' : 'none';
        }
    });

    // Render unfinished backlog section
    renderBacklog();

    // Force layout recalculation after rendering
    try { void document.getElementById('panel-today').offsetHeight; } catch(e) {}
}

// ---- AGENDA VIEW (P0/P1 only, grouped by vector) ----
function renderAgenda() {
    // Filter to P0 and P1 only
    const filteredTasks = ALL_TASKS.filter(t => t.priority === 'p0' || t.priority === 'p1');

    // Group by vector
    const vectors = {};
    const vectorOrder = ['health', 'finance', 'revenue', 'tech', 'system', 'schedule', 'wellness', 'gdrive'];
    filteredTasks.forEach(task => {
        const vec = task.vector;
        if (!vectors[vec]) vectors[vec] = [];
        vectors[vec].push(task);
    });

    // Build HTML
    const container = document.getElementById('agenda-tasks');
    if (!container) return;

    let html = '';
    let totalP0 = 0, totalP1 = 0;

    vectorOrder.forEach(vecName => {
        const tasks = vectors[vecName];
        if (!tasks || tasks.length === 0) return;

        // Count priorities within this vector
        let vP0 = tasks.filter(t => t.priority === 'p0').length;
        let vP1 = tasks.filter(t => t.priority === 'p1').length;
        totalP0 += vP0;
        totalP1 += vP1;

        const hasP0 = vP0 > 0;
        const hasP1 = vP1 > 0;
        const countClass = (hasP0 && !hasP1) ? 'p0-only' : (hasP0 && hasP1) ? 'mixed' : 'mixed';
        const vecDisplayName = VECTOR_NAMES[vecName] || vecName.toUpperCase();

        html += `<div class="agenda-vector-group">`;
        html += `<div class="agenda-vector-header">`;
        html += `<span class="agenda-vector-name">${vecDisplayName}</span>`;
        html += `<span class="agenda-vector-count ${countClass}">P0:${vP0} P1:${vP1} (${tasks.length})</span>`;
        html += `</div>`;
        html += `<div class="agenda-task-grid">`;

        // Sort: P0 first, then P1; within same priority by status order
        const statusOrder = { flagged: 0, in_progress: 0, active: 1, pending: 2 };
        tasks.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
            return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        });

        html += tasks.map(task => createAgendaTaskCardHTML(task)).join('');
        html += `</div></div>`;
    });

    container.innerHTML = html;

    // Update agenda priority summary
    const agendaSummary = document.getElementById('agenda-priority-summary');
    if (agendaSummary) {
        agendaSummary.innerHTML = `
            <span class="pri-badge p0">P0 × ${totalP0}</span>
            <span class="pri-badge p1">P1 × ${totalP1}</span>
        `;
    }

    // Force layout recalculation after rendering
    try { void document.getElementById('panel-agenda').offsetHeight; } catch(e) {}
}

// ---- BACKLOG SECTION ----
function renderBacklog() {
    const prioOrder = { p0: 0, p1: 1, p2: 2, p3: 3 };
    const sorted = sortTasksByPriority(BACKLOG_TASKS);

    ['p0', 'p1', 'p2', 'p3'].forEach(level => {
        const gridEl = document.getElementById(`grid-${level}-backlog`);
        if (!gridEl) return;

        let levelTasks = sorted.filter(t => t.priority === level);
        if (appState.currentFilter !== 'all') {
            levelTasks = levelTasks.filter(t => t.vector === appState.currentFilter);
        }

        gridEl.innerHTML = levelTasks.length > 0
            ? levelTasks.map(task => createTaskCardHTML(task)).join('')
            : '';

        const groupEl = document.getElementById(`group-${level}-backlog`);
        if (groupEl) {
            groupEl.style.display = levelTasks.length > 0 ? 'block' : 'none';
        }
    });

    // Force layout recalculation after rendering
    try { void document.getElementById('panel-today').offsetHeight; } catch(e) {}
}

// ---- FINANCE PANEL (shared) ----
function renderFinancePanel() {
    const fin = DEFAULT_FINANCE_DATA;

    // Mini finance (TODAY view)
    setFinValue('fin-balance', fin.liquidBalance);
    setFinValue('fin-obligations', fin.monthlyObligations);
    setFinValue('fin-coverage', fin.coverageRatio);
    setFinValue('fin-score', `${fin.foundationScore}/10`);

    // Full finance (AGENDA view)
    setFinValue('fin-balance-full', fin.liquidBalance);
    setFinValue('fin-obligations-full', fin.monthlyObligations);
    setFinValue('fin-coverage-full', fin.coverageRatio);
    setFinValue('fin-score-full', `${fin.foundationScore}/10`);

    // Shield bars (full only)
    const shieldMap = { shelter: 'shelter', food: 'food', income: 'income', mobility: 'mobility' };
    Object.entries(shieldMap).forEach(([key, domKey]) => {
        const shield = fin.shields[key];
        if (!shield) return;
        const barEl = document.getElementById(`${domKey}-bar`);
        const valEl = document.getElementById(`${domKey}-val`);
        if (barEl) {
            const pct = Math.round((shield.value / shield.max) * 100);
            barEl.style.width = `${pct}%`;
            barEl.className = 'progress-fill';
            if (shield.value <= 2) barEl.classList.add('progress-critical');
            else if (shield.value <= 4) barEl.classList.add('progress-low');
            else if (shield.value <= 6) barEl.classList.add('progress-med');
            else barEl.classList.add('progress-good');
        }
        if (valEl) valEl.textContent = `${shield.value}/${shield.max}`;
    });

    // Weekly bills (full only)
    const billListEl = document.getElementById('bill-list-full');
    if (billListEl) {
        let html = '';
        fin.weeklyBills.forEach(bill => {
            html += `<div class="bill-item"><span class="bill-name">${bill.name} (${bill.day})</span><span class="bill-amount">${bill.amount}</span></div>`;
        });
        if (fin.nextWeekBills && fin.nextWeekBills.length > 0) {
            html += '<div style="margin: 8px 0; font-size: 0.6rem; color: var(--text-dim); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">NEXT WEEK:</div>';
            fin.nextWeekBills.forEach(bill => {
                html += `<div class="bill-item"><span class="bill-name">${bill.name} (${bill.day})</span><span class="bill-amount">${bill.amount}</span></div>`;
            });
        }
        billListEl.innerHTML = html;
    }

    // Watch alerts (full only)
    const alertsEl = document.getElementById('watch-alerts-full');
    if (alertsEl) {
        alertsEl.innerHTML = fin.watchAlerts.map(a => {
            const iconStart = a.text.match(/^[\u26A0\ud83c\udfca\ud83d\udcca]/) ? a.text.substring(0, 2) : '•';
            return `<div class="watch-alert ${a.level}"><span class="alert-icon">${iconStart}</span>${a.text.replace(/^[\u26A0\u26A1\U0001F4CA]+\s*/, '').trim()}</div>`;
        }).join('');
    }
}

function setFinValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ---- CRON HEALTH ----
function renderCronHealth() {
    const okCount = CRON_HEALTH.filter(c => c.status === 'ok').length;
    const failCount = CRON_HEALTH.filter(c => c.status === 'fail').length;
    const pendingCount = CRON_HEALTH.filter(c => c.status === 'pending').length;

    const summaryEl = document.getElementById('cron-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="cron-summary-item ok">
                <span class="cron-dot green"></span>OK: ${okCount}
            </div>
            <div class="cron-summary-item fail">
                <span class="cron-dot red"></span>FAILED: ${failCount}
            </div>
            ${pendingCount > 0 ? `<div class="cron-summary-item" style="border-color: rgba(255,204,0,0.4);color:var(--p2-yellow)">
                <span class="cron-dot" style="background:var(--p2-yellow)"></span>PENDING: ${pendingCount}
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

// ---- FILTER COUNTS ----
function renderFilters() {
    // Since we removed the old filter bar in favor of views, still keep filter button
    // logic if any remain. The filter bar persists in the DOM from original layout.
    const vectors = ['all', 'schedule', 'finance', 'health', 'tech', 'revenue', 'wellness', 'system'];
    const allTasksForFilters = appState.currentView === 'today' ? TODAY_TASKS : ALL_TASKS;

    const counts = {};
    vectors.forEach(v => {
        if (v === 'all') {
            counts.all = allTasksForFilters.filter(t => !appState.completedTaskIds.has(t.id)).length;
        } else {
            counts[v] = allTasksForFilters.filter(t => t.vector === v && !appState.completedTaskIds.has(t.id)).length;
        }
    });

    vectors.forEach(v => {
        const el = document.getElementById(`count-${v}`);
        if (el) el.textContent = counts[v];
    });
}

// ---- PRIORITY SUMMARY ----
function renderPrioritySummary() {
    const summaryEl = document.getElementById('priority-summary');
    if (!summaryEl) return;

    const tasksForSummary = appState.currentView === 'today' ? TODAY_TASKS : ALL_TASKS;
    const fc = { p0: 0, p1: 0, p2: 0, p3: 0 };
    tasksForSummary.forEach(t => {
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

// ---- TASK COUNT DISPLAY ----
function updateTaskCounts() {
    const all = appState.currentView === 'today' ? TODAY_TASKS : ALL_TASKS;
    const total = all.length;
    const active = total - appState.completedTaskIds.size;
    const activeEl = document.getElementById('active-task-count');
    const totalEl = document.getElementById('total-task-count');
    if (activeEl) activeEl.textContent = `${active} ACTIVE`;
    if (totalEl) totalEl.textContent = `${total} TOTAL`;
}

// ===== CARD GENERATORS =====

function createTaskCardHTML(task) {
    const isCompleted = appState.completedTaskIds.has(task.id);
    const compClass = isCompleted ? ' completed' : '';
    const dotClass = isCompleted ? 'completed' : (task.status === 'flagged' ? 'flagged' : (task.status === 'in_progress' ? 'active' : task.status));

    // Determine display label from time_block or due
    let displayLabel = '';
    if (task.time_block) {
        displayLabel = task.time_block === 'recurring_180m' ? 'EVERY 3H' : task.time_block.toUpperCase();
    } else if (task.due) {
        displayLabel = task.due === 'daily' ? 'DAILY' : task.due === 'daily monitoring' ? 'DAILY' : task.due === 'ongoing' ? 'ONGOING' : task.due === 'ongoing monitoring' ? 'ONGOING' : task.due === 'recurring' ? 'DAILY' : task.due;
    }

    const vectorName = VECTOR_NAMES[task.vector] || task.vector.toUpperCase();

    return `
        <div class="task-card ${task.priority}${compClass}" data-id="${task.id}" title="${task.details}">
            ${task.time_block ? `<span class="time-block-label">${displayLabel}</span>` : ''}
            <div class="task-card-header">
                <span class="task-id">${task.id}</span>
                <span class="task-vector-badge">${vectorName}</span>
            </div>
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span><span class="task-status-dot ${dotClass}"></span>${task.status.toUpperCase()}</span>
                <span class="task-due">${!task.time_block ? '⏱ ' + displayLabel : ''}</span>
            </div>
        </div>
    `;
}

function createAgendaTaskCardHTML(task) {
    const isCompleted = appState.completedTaskIds.has(task.id);
    const compClass = isCompleted ? ' completed' : '';

    let displayDue = '';
    if (task.due) {
        displayDue = task.due === 'daily' ? 'DAILY' :
                     task.due === 'daily monitoring' ? 'MONITORING' :
                     task.due === 'ongoing' ? 'ONGOING' :
                     task.due === 'ongoing monitoring' ? 'MONITORING' :
                     task.due === 'recurring' ? 'DAILY' :
                     task.due === 'per contract' ? 'CONTRACT' :
                     task.due === 'per deadline' ? 'DEADLINE' :
                     task.due === 'before deployment' ? 'BLOCKER' :
                     task.due === 'urgent' ? 'URGENT' :
                     task.due === 'high priority' ? 'HIGH' :
                     task.due === 'when convenient' ? 'LOW' :
                     task.due;
    }

    const statusClass = task.status === 'flagged' ? 'flagged' : (task.status === 'in_progress' ? 'active' : task.status);

    return `
        <div class="agenda-task-card ${task.priority}${compClass}" data-id="${task.id}" title="${task.details}">
            <div class="agenda-task-top">
                <span class="agenda-task-id">${task.id}</span>
                <span class="agenda-task-status ${statusClass}">${task.status.toUpperCase()}</span>
            </div>
            <div class="agenda-task-title">${task.title}</div>
            <div class="agenda-task-detail">${task.details}</div>
            <div class="agenda-task-footer">
                <span class="agenda-task-due">⏱ ${displayDue}</span>
                <span class="task-vector-badge">${VECTOR_NAMES[task.vector] || task.vector.toUpperCase()}</span>
            </div>
        </div>
    `;
}

// ===== SORTING HELPERS =====
function sortTasksByTimeBlock(tasks) {
    // Special time block ordering
    const timeOrder = {
        '08:00': 1, '09:00': 2, '10:00': 3, '10:30': 4,
        '12:00': 5, '13:00': 6, '13:30': 7, '15:00': 8,
        '18:00': 9, '19:00': 10, 'recurring_180m': 11,
        'ALL DAY': 12, '23:00': 13
    };

    const prioOrder = { p0: 0, p1: 1, p2: 2, p3: 3 };

    return [...tasks].sort((a, b) => {
        // Priority first
        const pDiff = prioOrder[a.priority] - prioOrder[b.priority];
        if (pDiff !== 0) return pDiff;

        // Then time block
        const ta = a.time_block ? (timeOrder[a.time_block] ?? 99) : 99;
        const tb = b.time_block ? (timeOrder[b.time_block] ?? 99) : 99;
        if (ta !== tb) return ta - tb;

        return a.id.localeCompare(b.id);
    });
}

function sortTasksByPriority(tasks) {
    const prioOrder = { p0: 0, p1: 1, p2: 2, p3: 3 };
    return [...tasks].sort((a, b) => {
        const pDiff = prioOrder[a.priority] - prioOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.id.localeCompare(b.id);
    });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Fallback: ensure view toggle buttons work on all screens (not just inline onclick)
    document.getElementById('btn-today')?.addEventListener('click', function(e) {
        e.preventDefault();
        switchView('today');
    });
    document.getElementById('btn-agenda')?.addEventListener('click', function(e) {
        e.preventDefault();
        switchView('agenda');
    });

    // Filter buttons (if present)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.currentFilter = btn.dataset.vector;
            renderFilters();
            renderPrioritySummary();
            if (appState.currentView === 'today') renderToday();
        });
    });

    // Task completion toggle (delegated from tasks-section)
    document.getElementById('tasks-section').addEventListener('click', (e) => {
        const card = e.target.closest('.task-card, .agenda-task-card');
        if (!card) return;

        const taskId = card.dataset.id;
        if (!taskId) return;

        const wasCompleted = appState.completedTaskIds.has(taskId);

        if (wasCompleted) {
            appState.completedTaskIds.delete(taskId);
            flashStatus('RESTORED', '#ffcc00');
        } else {
            appState.completedTaskIds.add(taskId);
            flashStatus('COMPLETE ✓', '#00ff88');
        }
        saveCompletions();
        // Notify relay of task change for cross-device sync (fire-and-forget)
        notifyRelay(taskId, !wasCompleted);
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
    } catch (e) {}
}

// ===== SYNC INDICATOR =====
function updateSyncIndicator() {
    const el = document.getElementById('last-sync');
    if (el) {
        const now = new Date();
        el.textContent = `LAST SYNC: ${now.toLocaleTimeString('en-GB')}`;
    }
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

// ===== FLASH STATUS MESSAGE =====
function flashStatus(message, color) {
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 10, 30, 0.95); border: 2px solid ${color};
        color: ${color}; font-family: 'Orbitron', sans-serif; font-size: 1.5rem;
        padding: 20px 40px; z-index: 10000; text-shadow: 0 0 20px ${color};
        box-shadow: 0 0 40px ${color}40; animation: notif-fade 1.5s ease forwards;
    `;

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
}

function triggerAGI() {
    const overlay = document.getElementById('agi-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    flashStatus('⚡ AGI ENGAGED ⚡', '#b026ff');

    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 3500);
}

// ============================================================
// CROSS-DEVICE SYNC BUTTON — PUSH / PULL / MERGE / NOTIFY
// ============================================================

/**
 * Full-sync workflow (GET-only protocol):
 *   1. PUSH  — GET /?action=push&userId=X&taskIds=id1,id2,... (no CORS preflight)
 *   2. PULL  — GET /?action=state&userId=X  (read remote state)
 *   3. MERGE — union remote + local → appState.completedTaskIds
 *   4. PERSIST — write merged set back to localStorage
 *   5. REFRESH — re-render affected cards in-place
 *   6. NOTIFY — toast with push/pull counts & total
 */
async function doSync() {
    const btn = document.getElementById('syncBtn');
    if (!btn) return;

    // ── Lock UI during sync ──────────────────────────────────
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="btn-spinner" style="display:inline-block"></span> SYNCING…';

    const userId = 'sophia';

    // ── STEP 1: PUSH local completions via single GET ────────
    const allVisibleCards = [
        ...document.querySelectorAll('#panel-today .task-card[data-id]'),
        ...document.querySelectorAll('.backlog-content .task-card[data-id]'),
        ...document.querySelectorAll('.agenda-task-card[data-id]')
    ];

    const completedIds = [...appState.completedTaskIds].filter(id => {
        // Only push IDs that are actually visible as completed in current view
        return appState.completedTaskIds.has(id);
    });

    let pushed = 0;
    let pushError = null;

    if (completedIds.length > 0) {
        try {
            const idsParam = encodeURIComponent(completedIds.join(','));
            const pushUrl = `${CYBERWOLF_RELAY_URL}?action=push&userId=${userId}&taskIds=${idsParam}`;
            const resp = await fetch(pushUrl, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            pushed = completedIds.length;
            console.info(`[CyberWolf] Pushed ${pushed} completion(s) via GET`);
        } catch (e) {
            pushError = e.message;
            console.warn('[CyberWolf] Push failed:', e.message);
        }
    } else {
        // No local completions to push — still send empty list to clear stale server state
        try {
            const pushUrl = `${CYBERWOLF_RELAY_URL}?action=push&userId=${userId}&taskIds=`;
            const resp = await fetch(pushUrl, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) console.warn('[CyberWolf] Empty push failed:', resp.status);
            pushed = 0;
        } catch (e) {
            pushError = e.message;
        }
    }

    // ── STEP 2: PULL remote state ────────────────────────────
    let pulled = 0;
    let remoteCompletedIds = [];
    let pullError = null;

    try {
        const resp = await fetch(`${CYBERWOLF_RELAY_URL}?action=state&userId=${userId}`, {
            signal: AbortSignal.timeout(8000)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        // ---- Format detection & merge ----
        // Relay v9+:    { userId, tasks: [{id,label,completed:true,...}], count }
        // Legacy/API:   { completedTaskIds: [...], lastUpdated, lastDevice }
        if (data && Array.isArray(data.tasks)) {
            // Extract completed task IDs from task list (relay v9+)
            remoteCompletedIds = data.tasks.filter(t => t.completed === true).map(t => t.id);
        } else if (data && Array.isArray(data.completedTaskIds)) {
            // Fallback: direct completed-task-id array (legacy / expected format)
            remoteCompletedIds = data.completedTaskIds;
        }
    } catch (e) {
        pullError = e.message;
        console.warn('[CyberWolf] Pull failed:', e.message);
    }

    // ── STEP 3: MERGE ────────────────────────────────────────
    for (const rid of remoteCompletedIds) {
        if (!appState.completedTaskIds.has(rid)) {
            appState.completedTaskIds.add(rid);
            pulled++;
        }
    }

    // Also detect conflicts: remote says undone but local says complete
    // (The relay stores boolean events; completedTaskIds should reflect truth)
    const conflictWarnings = [];
    for (const cid of allVisibleCards) {
        if (cid.classList.contains('completed')) continue; // already correct
        if (remoteCompletedIds.includes(cid.dataset.id)) {
            // Remote says done but card isn't visually marked yet
            // This will be caught by the refresher below
        }
    }

    // ── STEP 4: PERSIST ──────────────────────────────────────
    appState.syncedAt = new Date().toISOString();
    try {
        localStorage.setItem('cyber_dashboard_completions', JSON.stringify([...appState.completedTaskIds]));
    } catch (e) {
        console.error('[CyberWolf] LocalStorage save failed during sync:', e);
    }

    // ── STEP 5: REFRESH VISUALS ──────────────────────────────
    // Re-render only the affected views to mark newly-synced cards as completed
    // We use renderAll() to keep consistency
    renderAll();

    // ── STEP 6: UPDATE FOOTER SYNC INDICATOR ─────────────────
    const lastSyncEl = document.getElementById('last-sync');
    if (lastSyncEl) {
        lastSyncEl.textContent = `SYNCED: ${new Date().toLocaleTimeString('en-GB')}`;
        lastSyncEl.style.color = '#00ff88';
        lastSyncEl.style.textShadow = '0 0 6px #00ff88';
        setTimeout(() => {
            lastSyncEl.style.color = '';
            lastSyncEl.style.textShadow = '';
        }, 5000);
    }

    // ── STEP 7: TOAST NOTIFICATION ───────────────────────────
    const total = appState.completedTaskIds.size;
    let toastMsg = '';
    let toastClass = 'success';

    if (pullError && pulled === 0 && pushed === 0) {
        // Total failure
        toastMsg = `❌ Sync failed — ${pullError}. No changes applied.`;
        toastClass = 'error';
    } else if (pullError && pushed > 0) {
        // Partial: push succeeded but pull failed
        toastMsg = `⚠️ Pushed ${pushed} completion(s), but could not pull remote (${pullError}).`;
        toastClass = 'warning';
    } else if (pullError) {
        // Pull succeeded partially or remotely empty
        toastMsg = `📡 Could not verify remote state (${pullError}).`;
        toastClass = 'warning';
    } else if (pulled > 0) {
        // Successful with new data pulled
        toastMsg = `✅ Synced: ${pushed} pushed, ${pulled} pulled. Total: ${total} tasks completed.`;
        toastClass = 'success';
    } else {
        // No new data either direction — all in sync
        toastMsg = `✅ In sync — ${total} tasks completed. Nothing new.`;
        toastClass = 'success';
    }

    if (conflictWarnings.length > 0) {
        toastMsg += '\n\n⚠ Conflicts detected:\n' + conflictWarnings.join('\n');
        toastClass = 'warning';
    }

    showToast(toastMsg, toastClass);

    // ── Restore button ───────────────────────────────────────
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-spinner"></span> ⟐ SYNC';
}

/**
 * Display a styled toast notification in the bottom-right corner.
 * Auto-dismisses after duration ms (default 6000).
 */
function showToast(message, type = 'info', duration = 6000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-text">${message.replace(/\n/g, '<br>')}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss after duration
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
