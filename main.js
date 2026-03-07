// ==UserScript==
// @name         Focus Engine | Pandemonium
// @namespace    https://github.com/ishaansucksatlife/Focus-Engine-Pandemonium
// @version      2.0
// @description  A high‑end site blocker that locks your browser into focus mode or whitelist‑only mode. Designed for deep concentration when you absolutely cannot afford distractions.
// @author       ishaansucksatlife
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @run-at       document-start
// @license      GPL-3.0
// @supportURL   https://github.com/ishaansucksatlife/Focus-Engine-Pandemonium/issues
// @homepageURL  https://github.com/ishaansucksatlife/Focus-Engine-Pandemonium
// @source       https://github.com/ishaansucksatlife/Focus-Engine-Pandemonium
// ==/UserScript==
 
(function() {
    'use strict';
 
    // ==================== CONFIGURATION ====================
    const CONFIG = {
        VERSION: '34.0',
        KEY_PREFIX: 'pndm_v34_',
        VOID_ICON: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%23000\' stroke=\'%230ff\' stroke-width=\'2\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'5\' fill=\'%230ff\'/%3E%3C/svg%3E',
        TIMER_UPDATE_INTERVAL: 1000,
        STORAGE_KEYS: ['bl', 'wl', 'deep', 'startTime']
    };
 
    // ==================== PERSISTENCE (ERROR‑PROOF) ====================
    const DB = {
        get: (key, defaultValue) => {
            try {
                const fullKey = CONFIG.KEY_PREFIX + key;
                const value = GM_getValue(fullKey, defaultValue);
                if (key === 'bl' || key === 'wl') return Array.isArray(value) ? value : [];
                if (key === 'deep') return typeof value === 'boolean' ? value : false;
                if (key === 'startTime') return (value === null || typeof value === 'number') ? value : null;
                return value;
            } catch {
                return defaultValue;
            }
        },
        set: (key, value) => {
            try {
                const fullKey = CONFIG.KEY_PREFIX + key;
                if ((key === 'bl' || key === 'wl') && !Array.isArray(value)) value = [];
                GM_setValue(fullKey, value);
                return true;
            } catch {
                return false;
            }
        },
        migrate: () => {
            try {
                GM_listValues().forEach(key => {
                    if (/^pndm_v(29|30|31|32|33)_/.test(key)) GM_deleteValue(key);
                });
            } catch {}
        }
    };
 
    // ==================== STATE ====================
    let pndm = {
        bl: DB.get('bl', []),
        wl: DB.get('wl', []),
        deep: DB.get('deep', false),
        startTime: DB.get('startTime', null)
    };
    let originalTitle = '';
    let shadow = null;
    let engineHost = null;
    let isInitialized = false;
    let animationFrame = null;
    let guiVisible = false;
 
    // ==================== HELPER FUNCTIONS ====================
    const getCurrentHost = () => window.location.hostname.toLowerCase().replace(/^www\./, '');
 
    const isMatched = (arr) => {
        const host = getCurrentHost();
        return arr.some(kw => kw && typeof kw === 'string' && host.includes(kw.toLowerCase().trim()));
    };
 
    const isBlocked = () => pndm.deep ? !isMatched(pndm.wl) : isMatched(pndm.bl);
 
    const getFlowTime = () => {
        if (!pndm.startTime || pndm.startTime > Date.now()) return "00:00:00";
        const diff = Date.now() - pndm.startTime;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
 
    const getHostStatus = () => {
        const host = getCurrentHost();
        if (pndm.deep) return pndm.wl.includes(host) ? 'sanctuary' : 'void';
        return pndm.bl.includes(host) ? 'blackhole' : 'normal';
    };
 
    const isHostInCurrentList = () => {
        const host = getCurrentHost();
        return pndm.deep ? pndm.wl.includes(host) : pndm.bl.includes(host);
    };
 
    const safeQS = (el, sel) => { try { return el ? el.querySelector(sel) : null; } catch { return null; } };
    const safeAdd = (el, ev, fn) => { if (el && typeof el.addEventListener === 'function') el.addEventListener(ev, fn); };
 
    // ==================== SHADOW DOM SETUP ====================
    const setupShadowDOM = () => {
        if (isInitialized) return;
        try {
            engineHost = document.createElement('div');
            engineHost.id = 'pndm-engine-host';
            engineHost.style.cssText = "position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647; pointer-events:none;";
            (document.documentElement || document.body || document).appendChild(engineHost);
            shadow = engineHost.attachShadow({ mode: 'closed' });
            isInitialized = true;
        } catch {
            setTimeout(() => {
                if (!isInitialized && document.body) {
                    engineHost = document.createElement('div');
                    engineHost.id = 'pndm-engine-host-fallback';
                    engineHost.style.cssText = "position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647;";
                    document.body.appendChild(engineHost);
                    shadow = engineHost.attachShadow({ mode: 'closed' });
                    isInitialized = true;
                }
            }, 0);
        }
    };
 
    // ==================== MASTER STYLESHEET ====================
    const createStyles = () => {
        const ss = new CSSStyleSheet();
        ss.replaceSync(`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;400;700;900&display=swap');
            * { font-family: 'Inter', sans-serif; box-sizing: border-box; margin:0; padding:0; }
 
            /* ----- VOID OVERLAY (REDESIGNED) ----- */
            #pndm-void-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: radial-gradient(circle at 30% 30%, #0a0a0a, #000000);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483640;
                pointer-events: auto;
                color: #fff;
                animation: fadeIn 0.4s ease-out;
                overflow: hidden;
            }
            #pndm-void-overlay::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: repeating-radial-gradient(circle at 20% 30%, rgba(0,255,255,0.02) 0px, transparent 2px);
                animation: drift 20s linear infinite;
                pointer-events: none;
            }
            @keyframes drift {
                0% { transform: translate(0, 0); }
                100% { transform: translate(10%, 10%); }
            }
            #pndm-void-overlay .watermark {
                position: absolute;
                bottom: 20px;
                right: 30px;
                font-size: 12vw;
                font-weight: 900;
                color: rgba(0,255,255,0.02);
                letter-spacing: 20px;
                text-transform: uppercase;
                pointer-events: none;
                white-space: nowrap;
                user-select: none;
            }
            .void-card {
                background: rgba(10,10,10,0.7);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(0,255,255,0.2);
                border-radius: 60px;
                padding: 60px 80px;
                text-align: center;
                box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 0 2px rgba(0,255,255,0.1) inset;
                animation: float 6s ease-in-out infinite;
                max-width: 90vw;
            }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
            .void-title {
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 12px;
                color: rgba(0,255,255,0.5);
                margin-bottom: 20px;
                text-transform: uppercase;
            }
            .void-message {
                font-size: clamp(32px, 8vw, 56px);
                font-weight: 200;
                line-height: 1.1;
                margin-bottom: 20px;
            }
            .void-timer {
                font-family: monospace;
                font-size: 24px;
                color: #0ff;
                background: rgba(0,255,255,0.1);
                display: inline-block;
                padding: 12px 30px;
                border-radius: 60px;
                border: 1px solid rgba(0,255,255,0.3);
                margin: 30px 0 20px;
                backdrop-filter: blur(5px);
            }
            .void-btn {
                background: transparent;
                border: 2px solid #0ff;
                color: #0ff;
                padding: 16px 48px;
                border-radius: 40px;
                font-weight: 700;
                font-size: 14px;
                letter-spacing: 3px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 20px;
            }
            .void-btn:hover {
                background: #0ff;
                color: #000;
                transform: scale(1.05);
                box-shadow: 0 0 30px #0ff;
            }
            .void-btn:active {
                transform: scale(0.98);
            }
            .void-hint {
                color: #444;
                font-size: 11px;
                margin-top: 30px;
                letter-spacing: 1px;
            }
 
            /* ----- GUI ----- */
            #pndm-gui-wrapper {
                position:fixed; top:0; left:0; width:100vw; height:100vh;
                background:rgba(0,0,0,0.85); backdrop-filter:blur(50px);
                display:none; align-items:center; justify-content:center;
                z-index:2147483646; pointer-events:auto; animation:fadeIn 0.2s;
            }
            #pndm-modal {
                width:min(900px,95vw); height:min(600px,90vh);
                background:rgba(15,15,15,0.98); border-radius:40px;
                border:1px solid rgba(255,255,255,0.08); display:flex; overflow:hidden;
                color:#fff; box-shadow:0 60px 120px #000;
            }
            #side { width:240px; background:rgba(0,0,0,0.4); border-right:1px solid rgba(255,255,255,0.05); padding:60px 0; display:flex; flex-direction:column; }
            .side-header { padding:0 45px 60px; font-weight:900; letter-spacing:6px; font-size:11px; color:#0ff; }
            .tab { padding:20px 45px; cursor:pointer; color:#555; font-weight:700; font-size:10px; letter-spacing:3px; border:none; background:none; text-align:left; transition:all 0.4s; text-transform:uppercase; outline:none; }
            .tab:hover { color:#0ff; background:linear-gradient(90deg,rgba(0,255,255,0.02) 0%,transparent); }
            .tab.active { color:#0ff; background:linear-gradient(90deg,rgba(0,255,255,0.08) 0%,transparent); border-right:4px solid #0ff; }
            .pane { display:none; flex:1; padding:40px; position:relative; flex-direction:column; overflow-y:auto; }
            .pane.active { display:flex; }
            .pane-title { font-size:28px; font-weight:900; letter-spacing:-1px; margin-bottom:5px; }
            .pane-subtitle { color:#666; font-size:12px; margin-bottom:20px; }
            .host-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-left:10px; }
            .badge-blackhole { background:rgba(255,59,48,0.2); color:#ff3b30; border:1px solid rgba(255,59,48,0.3); }
            .badge-sanctuary { background:rgba(0,255,255,0.2); color:#0ff; border:1px solid rgba(0,255,255,0.3); }
            .badge-normal { background:rgba(255,255,255,0.1); color:#888; border:1px solid rgba(255,255,255,0.1); }
            .badge-void { background:rgba(255,255,255,0.05); color:#444; border:1px solid rgba(255,255,255,0.05); }
            .switch { position:relative; display:inline-block; width:52px; height:28px; }
            .switch input { opacity:0; width:0; height:0; }
            .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:rgba(255,255,255,0.15); transition:.3s; border-radius:34px; border:1px solid rgba(255,255,255,0.1); }
            .slider:before { position:absolute; content:""; height:20px; width:20px; left:4px; bottom:3px; background-color:white; transition:.3s; border-radius:50%; }
            input:checked + .slider { background-color:#0ff; }
            input:checked + .slider:before { transform:translateX(24px); background-color:#000; }
            .input-box { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:16px; color:#fff; border-radius:15px; width:100%; outline:none; font-size:14px; transition:all 0.3s; margin-bottom:20px; }
            .input-box:focus { border-color:#0ff; background:rgba(0,255,255,0.05); box-shadow:0 0 0 3px rgba(0,255,255,0.1); }
            .list-container { margin-top:10px; overflow-y:auto; flex:1; border-radius:16px; background:rgba(0,0,0,0.2); padding:10px; }
            .list-item { display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid rgba(255,255,255,0.03); color:#aaa; font-size:13px; transition:background 0.2s; border-radius:8px; }
            .list-item:hover { background:rgba(255,255,255,0.03); }
            .rmv-btn { color:#ff3b30; cursor:pointer; font-weight:bold; font-size:18px; opacity:0.5; transition:0.2s; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
            .rmv-btn:hover { opacity:1; background:rgba(255,59,48,0.15); }
            .action-btn { width:100%; padding:18px; border-radius:16px; border:1px solid; font-weight:800; font-size:11px; cursor:pointer; text-transform:uppercase; transition:all 0.3s; letter-spacing:1.5px; margin-bottom:12px; overflow:hidden; }
            .btn-reload { background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:#fff; }
            .btn-reload:hover { background:rgba(255,255,255,0.1); transform:translateY(-1px); }
            .btn-primary { border-color:#0ff; background:transparent; color:#0ff; }
            .btn-primary:hover { background:#0ff; color:#000; transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,255,255,0.2); }
            .btn-success { border-color:#00ff00; background:transparent; color:#00ff00; }
            .btn-success:hover { background:#00ff00; color:#000; transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,255,0,0.2); }
            .btn-danger { border-color:#ff3b30; background:transparent; color:#ff3b30; }
            .btn-danger:hover { background:#ff3b30; color:#000; transform:translateY(-2px); box-shadow:0 10px 30px rgba(255,59,48,0.2); }
            .btn-group { display:flex; gap:10px; margin-top:20px; }
            .btn-group .action-btn { margin-bottom:0; flex:1; }
            #led { width:12px; height:12px; border-radius:50%; box-shadow:0 0 20px; position:fixed; bottom:40px; right:40px; z-index:2147483648; animation:pulse 2s infinite; display:block; pointer-events:none; }
            #led.deep-active { background:#00ff00; box-shadow:0 0 20px #00ff00; }
            #led.normal { background:#0ff; box-shadow:0 0 20px #0ff; }
            @keyframes pulse { 0% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } 100% { opacity:1; transform:scale(1); } }
            .close-x { position:absolute; top:20px; right:20px; background:none; border:none; color:#666; font-size:28px; cursor:pointer; transition:0.2s; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; z-index:10; }
            .close-x:hover { color:#fff; background:rgba(255,255,255,0.1); }
            .host-info { background:rgba(0,255,255,0.03); padding:20px; border-radius:20px; border:1px solid rgba(0,255,255,0.1); margin-bottom:25px; transition:all 0.3s; }
            .host-url { font-family:monospace; font-size:14px; color:#0ff; word-break:break-all; margin-bottom:10px; }
            .status-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 16px; border-radius:30px; font-size:12px; font-weight:600; text-transform:uppercase; transition:all 0.3s; }
            .timer-display { background:rgba(0,255,255,0.02); padding:30px; border-radius:24px; border:1px solid rgba(0,255,255,0.08); text-align:center; }
            .timer-value { font-size:48px; font-weight:200; letter-spacing:-2px; font-family:monospace; color:#0ff; }
            .timer-label { color:#0ff; font-weight:900; font-size:10px; letter-spacing:2px; margin-bottom:5px; }
            .empty-state { text-align:center; color:#444; padding:40px 20px; font-size:12px; letter-spacing:1px; }
            .toast-message { position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(0,255,255,0.9); color:#000; padding:12px 24px; border-radius:40px; font-size:12px; font-weight:700; letter-spacing:1px; z-index:2147483649; animation:slideUp 0.3s; box-shadow:0 10px 30px rgba(0,255,255,0.3); }
            @keyframes slideUp { from { opacity:0; transform:translate(-50%,20px); } to { opacity:1; transform:translate(-50%,0); } }
        `);
        return ss;
    };
 
    // ==================== TOAST ====================
    const showToast = (msg, isErr = false) => {
        if (!shadow) return;
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = msg;
        toast.style.background = isErr ? 'rgba(255,59,48,0.9)' : 'rgba(0,255,255,0.9)';
        shadow.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'fadeIn 0.3s reverse';
                setTimeout(() => toast.remove(), 200);
            }
        }, 2000);
    };
 
    // ==================== MUTUAL EXCLUSIVITY ====================
    const addKeywordExclusive = (keyword, targetList) => {
        keyword = keyword.toLowerCase().trim();
        if (!keyword) return false;
        const other = targetList === 'bl' ? 'wl' : 'bl';
        if (pndm[targetList].includes(keyword)) {
            showToast(`⚠️ Already in ${targetList === 'bl' ? 'Blackhole' : 'Sanctuary'}`, true);
            return false;
        }
        if (pndm[other].includes(keyword)) {
            pndm[other] = pndm[other].filter(k => k !== keyword);
            showToast(`⚠️ Moved from ${other === 'bl' ? 'Blackhole' : 'Sanctuary'}`);
        }
        pndm[targetList] = [...pndm[targetList], keyword];
        return true;
    };
 
    const removeKeyword = (keyword, list) => {
        if (!pndm[list].includes(keyword)) return false;
        pndm[list] = pndm[list].filter(k => k !== keyword);
        return true;
    };
 
    // ==================== GUI CREATION (FULL) ====================
    const createGUI = () => {
        if (!shadow) return;
        try {
            while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
 
            const host = getCurrentHost();
            const status = getHostStatus();
            const inList = isHostInCurrentList();
 
            const wrapper = document.createElement('div');
            wrapper.id = 'pndm-gui-wrapper';
            wrapper.innerHTML = `
                <div id="pndm-modal">
                    <div id="side">
                        <div class="side-header">PANDEMONIUM</div>
                        <button class="tab active" data-t="dash">FLOW_STATE</button>
                        <button class="tab" data-t="bl">BLACKHOLE <span style="color:#0ff; margin-left:5px;">${pndm.bl.length}</span></button>
                        <button class="tab" data-t="wl">SANCTUARY <span style="color:#0ff; margin-left:5px;">${pndm.wl.length}</span></button>
                    </div>
                    <div id="main-content" style="flex:1; display:flex;">
                        <!-- Dashboard -->
                        <div id="pane-dash" class="pane active">
                            <button class="close-x" id="close-gui">×</button>
                            <h2 class="pane-title">Flow State</h2>
                            <div class="pane-subtitle">Current session metrics</div>
                            <div class="host-info" id="host-info-panel">
                                <div class="host-url">${host}</div>
                                <div id="status-chip" class="status-chip ${status === 'blackhole' ? 'badge-blackhole' : status === 'sanctuary' ? 'badge-sanctuary' : status === 'void' ? 'badge-void' : 'badge-normal'}">
                                    <span>●</span><span id="status-text">${status.toUpperCase()}</span>
                                </div>
                            </div>
                            <div style="margin-bottom:25px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.05);">
                                    <div><div style="font-weight:700; margin-bottom:5px;">Deep Focus Mode</div><div style="color:#666; font-size:12px;">Lock session to Sanctuary only</div></div>
                                    <label class="switch"><input type="checkbox" id="deep-tog" ${pndm.deep ? 'checked' : ''}><span class="slider"></span></label>
                                </div>
                            </div>
                            <div class="timer-display"><div class="timer-label">SESSION CHRONO</div><div class="timer-value" id="gui-timer">${getFlowTime()}</div></div>
                            <div class="btn-group">
                                <button id="reload-btn" class="action-btn btn-reload">⟳ RELOAD</button>
                                <button id="toggle-host-btn" class="action-btn ${inList ? 'btn-danger' : 'btn-primary'}">${inList ? '⚡ RELEASE' : '🌀 ABSORB'}</button>
                            </div>
                        </div>
                        <!-- Blackhole -->
                        <div id="pane-bl" class="pane">
                            <h2 class="pane-title">Blackhole</h2>
                            <div class="pane-subtitle">Sites to consume <span style="color:#0ff;">${pndm.bl.length}</span></div>
                            <input type="text" id="bl-in" class="input-box" placeholder="Add keyword... (press Enter)" autocomplete="off">
                            <div class="btn-group" style="margin-bottom:15px;">
                                <button id="bl-add-current" class="action-btn btn-primary">➕ ADD CURRENT SITE</button>
                                <button id="bl-remove-current" class="action-btn btn-danger" ${!pndm.bl.includes(host) ? 'disabled style="opacity:0.3; pointer-events:none;"' : ''}>✖️ REMOVE CURRENT</button>
                            </div>
                            <div id="bl-list" class="list-container"></div>
                            ${pndm.bl.length ? '<button id="clear-bl" class="action-btn btn-danger" style="margin-top:15px;">🗑️ CLEAR ALL</button>' : ''}
                        </div>
                        <!-- Sanctuary -->
                        <div id="pane-wl" class="pane">
                            <h2 class="pane-title">Sanctuary</h2>
                            <div class="pane-subtitle">Protected sites <span style="color:#0ff;">${pndm.wl.length}</span></div>
                            <input type="text" id="wl-in" class="input-box" placeholder="Add keyword... (press Enter)" autocomplete="off">
                            <div class="btn-group" style="margin-bottom:15px;">
                                <button id="wl-add-current" class="action-btn btn-success">➕ ADD CURRENT SITE</button>
                                <button id="wl-remove-current" class="action-btn btn-danger" ${!pndm.wl.includes(host) ? 'disabled style="opacity:0.3; pointer-events:none;"' : ''}>✖️ REMOVE CURRENT</button>
                            </div>
                            <div id="wl-list" class="list-container"></div>
                            ${pndm.wl.length ? '<button id="clear-wl" class="action-btn btn-danger" style="margin-top:15px;">🗑️ CLEAR ALL</button>' : ''}
                        </div>
                    </div>
                </div>
                <div id="led" class="${pndm.deep ? 'deep-active' : 'normal'}" title="${pndm.deep ? 'Deep Focus Active' : 'Normal Mode'}"></div>
            `;
 
            shadow.adoptedStyleSheets = [createStyles()];
            shadow.appendChild(wrapper);
 
            // --- Event listeners ---
            safeAdd(safeQS(shadow, '#close-gui'), 'click', toggleGUI);
            safeAdd(safeQS(shadow, '#reload-btn'), 'click', () => { showToast('⟳ Reloading...'); setTimeout(() => location.reload(), 100); });
 
            const toggleBtn = safeQS(shadow, '#toggle-host-btn');
            if (toggleBtn) safeAdd(toggleBtn, 'click', () => {
                const h = getCurrentHost();
                const list = pndm.deep ? 'wl' : 'bl';
                const display = pndm.deep ? 'Sanctuary' : 'Blackhole';
                if (pndm[list].includes(h)) {
                    pndm[list] = pndm[list].filter(x => x !== h);
                    showToast(`⚡ Released from ${display}`);
                } else if (addKeywordExclusive(h, list)) {
                    showToast(`🌀 Absorbed into ${display}`);
                }
                save(); enforceVoid(); updateDynamicUI(); renderLists();
            });
 
            const deepTog = safeQS(shadow, '#deep-tog');
            if (deepTog) safeAdd(deepTog, 'change', (e) => {
                pndm.deep = e.target.checked;
                save(); enforceVoid(); updateDynamicUI();
                showToast(pndm.deep ? '🔮 Deep Focus ACTIVE' : '🌐 Deep Focus inactive');
            });
 
            // Blackhole buttons
            const blAdd = safeQS(shadow, '#bl-add-current');
            if (blAdd) safeAdd(blAdd, 'click', () => {
                const h = getCurrentHost();
                if (addKeywordExclusive(h, 'bl')) {
                    save(); enforceVoid(); updateDynamicUI(); renderLists();
                    showToast(`🌀 Added "${h}" to Blackhole`);
                }
            });
            const blRemove = safeQS(shadow, '#bl-remove-current');
            if (blRemove) safeAdd(blRemove, 'click', () => {
                const h = getCurrentHost();
                if (removeKeyword(h, 'bl')) {
                    save(); enforceVoid(); updateDynamicUI(); renderLists();
                    showToast(`✖️ Removed "${h}" from Blackhole`);
                }
            });
 
            // Sanctuary buttons
            const wlAdd = safeQS(shadow, '#wl-add-current');
            if (wlAdd) safeAdd(wlAdd, 'click', () => {
                const h = getCurrentHost();
                if (addKeywordExclusive(h, 'wl')) {
                    save(); enforceVoid(); updateDynamicUI(); renderLists();
                    showToast(`✨ Added "${h}" to Sanctuary`);
                }
            });
            const wlRemove = safeQS(shadow, '#wl-remove-current');
            if (wlRemove) safeAdd(wlRemove, 'click', () => {
                const h = getCurrentHost();
                if (removeKeyword(h, 'wl')) {
                    save(); enforceVoid(); updateDynamicUI(); renderLists();
                    showToast(`✖️ Removed "${h}" from Sanctuary`);
                }
            });
 
            // Clear buttons
            const clearBl = safeQS(shadow, '#clear-bl');
            if (clearBl) safeAdd(clearBl, 'click', () => { pndm.bl = []; save(); renderLists(); updateDynamicUI(); showToast('🗑️ Blackhole cleared'); });
            const clearWl = safeQS(shadow, '#clear-wl');
            if (clearWl) safeAdd(clearWl, 'click', () => { pndm.wl = []; save(); renderLists(); updateDynamicUI(); showToast('🗑️ Sanctuary cleared'); });
 
            // Tab switching
            shadow.querySelectorAll('.tab').forEach(tab => safeAdd(tab, 'click', () => {
                shadow.querySelectorAll('.tab, .pane').forEach(el => el.classList.remove('active'));
                tab.classList.add('active');
                const pane = shadow.getElementById(`pane-${tab.dataset.t}`);
                if (pane) pane.classList.add('active');
            }));
 
            // Input handlers
            const setupInput = (id, list, display) => {
                const inp = safeQS(shadow, id);
                if (inp) safeAdd(inp, 'keydown', (e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        const val = e.target.value.trim().toLowerCase();
                        if (addKeywordExclusive(val, list)) {
                            e.target.value = '';
                            save(); renderLists(); updateDynamicUI();
                            showToast(`✨ Added "${val}" to ${display}`);
                        }
                    }
                });
            };
            setupInput('#bl-in', 'bl', 'Blackhole');
            setupInput('#wl-in', 'wl', 'Sanctuary');
 
            renderLists();
            updateDynamicUI();
        } catch (e) { console.error('[Pandemonium] GUI error:', e); }
    };
 
    // ==================== RENDER LISTS ====================
    const renderLists = () => {
        if (!shadow) return;
        const render = (items, containerId, listName) => {
            const container = safeQS(shadow, containerId);
            if (!container) return;
            if (!items.length) { container.innerHTML = '<div class="empty-state">✨ No keywords added yet</div>'; return; }
            container.innerHTML = items.map(item => `<div class="list-item"><span style="word-break:break-word;">${escapeHTML(item)}</span><span class="rmv-btn" data-value="${escapeHTML(item)}" data-list="${listName}">×</span></div>`).join('');
            container.querySelectorAll('.rmv-btn').forEach(btn => safeAdd(btn, 'click', (e) => {
                e.stopPropagation();
                const val = btn.dataset.value, list = btn.dataset.list;
                if (val && list && pndm[list]) {
                    pndm[list] = pndm[list].filter(k => k !== val);
                    save(); renderLists(); updateDynamicUI();
                    showToast(`✖️ Removed "${val}" from ${list === 'bl' ? 'Blackhole' : 'Sanctuary'}`);
                }
            }));
        };
        render(pndm.bl, '#bl-list', 'bl');
        render(pndm.wl, '#wl-list', 'wl');
    };
 
    const escapeHTML = (str) => String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m]);
 
    // ==================== DYNAMIC UI UPDATE ====================
    const updateDynamicUI = () => {
        if (!shadow || !guiVisible) return;
        try {
            const host = getCurrentHost();
            const status = getHostStatus();
            const inList = isHostInCurrentList();
 
            const statusChip = safeQS(shadow, '#status-chip');
            const statusText = safeQS(shadow, '#status-text');
            if (statusChip && statusText) {
                statusChip.className = `status-chip ${
                    status === 'blackhole' ? 'badge-blackhole' : status === 'sanctuary' ? 'badge-sanctuary' : status === 'void' ? 'badge-void' : 'badge-normal'
                }`;
                statusText.textContent = status.toUpperCase();
            }
 
            const toggleBtn = safeQS(shadow, '#toggle-host-btn');
            if (toggleBtn) {
                toggleBtn.textContent = inList ? '⚡ RELEASE' : '🌀 ABSORB';
                toggleBtn.className = `action-btn ${inList ? 'btn-danger' : 'btn-primary'}`;
            }
 
            const deepTog = safeQS(shadow, '#deep-tog');
            if (deepTog) deepTog.checked = pndm.deep;
 
            // Tab counters
            const blTab = Array.from(shadow.querySelectorAll('.tab')).find(t => t.dataset.t === 'bl');
            const wlTab = Array.from(shadow.querySelectorAll('.tab')).find(t => t.dataset.t === 'wl');
            if (blTab) {
                let span = blTab.querySelector('span');
                if (!span) { span = document.createElement('span'); blTab.appendChild(span); }
                span.textContent = pndm.bl.length;
                span.style.cssText = "color:#0ff; margin-left:5px;";
            }
            if (wlTab) {
                let span = wlTab.querySelector('span');
                if (!span) { span = document.createElement('span'); wlTab.appendChild(span); }
                span.textContent = pndm.wl.length;
                span.style.cssText = "color:#0ff; margin-left:5px;";
            }
 
            // LED
            const led = safeQS(shadow, '#led');
            if (led) {
                led.className = pndm.deep ? 'deep-active' : 'normal';
                led.title = pndm.deep ? 'Deep Focus Active' : 'Normal Mode';
            }
 
            // Enable/disable remove buttons
            const blRemove = safeQS(shadow, '#bl-remove-current');
            if (blRemove) {
                if (pndm.bl.includes(host)) { blRemove.disabled = false; blRemove.style.opacity = ''; blRemove.style.pointerEvents = ''; }
                else { blRemove.disabled = true; blRemove.style.opacity = '0.3'; blRemove.style.pointerEvents = 'none'; }
            }
            const wlRemove = safeQS(shadow, '#wl-remove-current');
            if (wlRemove) {
                if (pndm.wl.includes(host)) { wlRemove.disabled = false; wlRemove.style.opacity = ''; wlRemove.style.pointerEvents = ''; }
                else { wlRemove.disabled = true; wlRemove.style.opacity = '0.3'; wlRemove.style.pointerEvents = 'none'; }
            }
        } catch (e) { console.error('[Pandemonium] UI update error:', e); }
    };
 
    // ==================== GUI TOGGLE ====================
    const toggleGUI = () => {
        if (!shadow) return;
        try {
            const wrapper = safeQS(shadow, '#pndm-gui-wrapper');
            if (!wrapper) { createGUI(); setTimeout(() => { const w = safeQS(shadow, '#pndm-gui-wrapper'); if (w) { w.style.display = 'flex'; guiVisible = true; updateDynamicUI(); renderLists(); } }, 50); return; }
            guiVisible = wrapper.style.display !== 'flex';
            wrapper.style.display = guiVisible ? 'flex' : 'none';
            if (guiVisible) { updateDynamicUI(); renderLists(); }
        } catch (e) { console.error('[Pandemonium] Toggle error:', e); }
    };
 
    // ==================== SYNC GUI (TIMER) ====================
    const syncGUI = () => {
        if (!shadow) return;
        if (guiVisible) {
            const t = safeQS(shadow, '#gui-timer');
            if (t) t.textContent = getFlowTime();
        }
        const vt = safeQS(shadow, '#v-time');
        if (vt) vt.textContent = getFlowTime();
    };
 
    // ==================== VOID OVERLAY ====================
    const ensureVoidOverlay = () => {
        if (!shadow) return;
        let overlay = safeQS(shadow, '#pndm-void-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pndm-void-overlay';
            overlay.innerHTML = `
                <div class="watermark">PANDEMONIUM</div>
                <div class="void-card">
                    <div class="void-title">FOCUS ENGINE</div>
                    <div class="void-message">Void Protocol Active</div>
                    <div class="void-timer" id="v-time">${getFlowTime()}</div>
                    <button class="void-btn" id="v-open">OPEN SANCTUARY</button>
                    <div class="void-hint">Alt+S to open panel</div>
                </div>
            `;
            shadow.appendChild(overlay);
            safeAdd(safeQS(shadow, '#v-open'), 'click', (e) => { e.stopPropagation(); toggleGUI(); });
        }
        const timerSpan = safeQS(shadow, '#v-time');
        if (timerSpan) timerSpan.textContent = getFlowTime();
    };
 
    // ==================== VOID ENFORCEMENT ====================
    const enforceVoid = () => {
        if (!isInitialized) return;
        try {
            const blocked = isBlocked();
            if (blocked) {
                if (!pndm.startTime) { pndm.startTime = Date.now(); DB.set('startTime', pndm.startTime); }
                // Nuke page content
                if (document.body) {
                    Array.from(document.body.children).forEach(child => {
                        if (child !== engineHost && child.id !== 'pndm-engine-host-fallback') child.remove();
                    });
                    document.body.style.cssText = 'background:#020202!important; overflow:hidden!important; margin:0!important; padding:0!important; height:100vh!important; width:100vw!important;';
                }
                document.title = `⏳ ${getFlowTime()} | Pandemonium`;
                try {
                    let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                    if (!link.parentNode) { link.rel = 'icon'; document.head.appendChild(link); }
                    link.href = CONFIG.VOID_ICON;
                } catch {}
 
                if (shadow) ensureVoidOverlay();
            } else {
                if (shadow) {
                    const ov = safeQS(shadow, '#pndm-void-overlay');
                    if (ov) ov.remove();
                }
                if (pndm.startTime) { pndm.startTime = null; DB.set('startTime', null); document.title = originalTitle; }
                if (document.body) document.body.style.cssText = '';
            }
        } catch (e) { console.error('[Pandemonium] Enforcement error:', e); }
    };
 
    // ==================== SAVE STATE ====================
    const save = () => {
        try {
            DB.set('bl', pndm.bl);
            DB.set('wl', pndm.wl);
            DB.set('deep', pndm.deep);
            DB.set('startTime', pndm.startTime);
        } catch {}
    };
 
    // ==================== INITIALIZATION ====================
    const init = () => {
        try {
            originalTitle = document.title;
            DB.migrate();
            setupShadowDOM();
            if (isInitialized) createGUI();
            const loop = () => { enforceVoid(); animationFrame = requestAnimationFrame(loop); };
            loop();
            setInterval(syncGUI, CONFIG.TIMER_UPDATE_INTERVAL);
            window.addEventListener('keydown', (e) => {
                if (e.altKey && e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault(); e.stopPropagation(); toggleGUI();
                }
            }, true);
            console.log('[Pandemonium] v34.0 ready');
        } catch (e) { console.error('[Pandemonium] Init error:', e); }
    };
 
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
 
    window.addEventListener('beforeunload', () => { if (animationFrame) cancelAnimationFrame(animationFrame); });
})();
