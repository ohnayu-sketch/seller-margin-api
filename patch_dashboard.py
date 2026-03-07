
import os
import re

file_path = 'seller-dashboard-v5.html'

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found.")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. DOM Fix - T3 Ledger Orphan Right Pane
content = content.replace('</div>\n</div>\n</div><div class="calc-right-pane" style="max-width:100%; flex:1;">',
                          '</div>\n<div class="calc-right-pane" style="max-width:100%; flex:1;">')

# 2. DOM Fix - T7 Setup Orphans
content = re.sub(r'</div>\s*</div>\s*</div>\s*<div class="panel-body" id="top5-list">',
                r'</div>\n<div class="panel-body" id="top5-list">', content)

# Close tags before </main>
# We look for the last logout button area and add one more </div> to encapsulate everything into #page-setup
# Previous count: 4 </div>s before </main>
# New count: 5 </div>s
content = re.sub(r'(현재 로그인: <strong id="current-user-display"[^>]*>.*?</strong></div>\s*<button[^>]*>.*?</button>\s*</div>\s*</div>\s*</div>\s*</div>\s*)(</div>\s*</main>)',
                r'\1</div>\n\2', content)

# 3. Security JS Injection
security_js = """
// ==================== [V6.0] 🚨 3단계 보안 시스템 (RBAC, 2FA, Timeout) ====================
const ADMIN_EMAILS = ['ohnayu@gmail.com', 'ohhhjs90@gmail.com'];
let sessionTimeoutTimer = null;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function resetSessionTimer() {
    if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
    sessionTimeoutTimer = setTimeout(() => {
        showToast('보안을 위해 30분간 활동이 없어 자동 로그아웃되었습니다.', true);
        setTimeout(signOut, 2000);
    }, SESSION_TIMEOUT_MS);
}

['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetSessionTimer, { passive: true });
});

function showPinModal() {
    const modal = document.getElementById('pin-modal');
    if (modal) {
        modal.style.display = 'flex';
        const pinInput = document.getElementById('pin-digit');
        if (pinInput) pinInput.focus();
        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.pointerEvents = 'none';
            wrapper.style.opacity = '0.3';
        }
    }
}

function verifyPin() {
    const entered = document.getElementById('pin-digit').value;
    const savedPin = localStorage.getItem('master-pin-config') || '0000';
    if (entered === savedPin) {
        document.getElementById('pin-modal').style.display = 'none';
        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.pointerEvents = 'auto';
            wrapper.style.opacity = '1';
        }
        showToast('인증되었습니다. 대시보드 액세스를 허용합니다.');
        resetSessionTimer();
    } else {
        showToast('PIN 번호가 틀렸습니다.', true);
        document.getElementById('pin-digit').value = '';
    }
}

const originalShowTab = window.showTab;
window.showTab = function(name) {
    if (name === 'setup') {
        const userEmail = (localStorage.getItem('auth-email') || '').toLowerCase();
        if (!ADMIN_EMAILS.includes(userEmail)) {
            showToast('⚠️ 접근 권한이 없습니다. 관리자만 접근 가능합니다.', true);
            if (localStorage.getItem('lastTab') === 'setup') {
                if (typeof originalShowTab === 'function') originalShowTab('intel');
            }
            return;
        }
    }
    if (typeof originalShowTab === 'function') {
        originalShowTab(name);
    }
};
// ==================== [V6.0] 보안 세션 종료 ====================
"""

content = content.replace('// 강제 초기 탭 할당 방어 로직 (V5)', security_js + '\n// 강제 초기 탭 할당 방어 로직 (V5)')

# 4. PIN Modal HTML Injection
pin_modal_html = """
<div id="pin-modal" class="v5-modal-overlay" style="display:none; z-index:9999;">
    <div class="v5-modal-content" style="max-width:320px; text-align:center; padding:30px; border:2px solid var(--accent); background:var(--surface1); box-shadow:0 10px 40px rgba(0,0,0,0.5);">
        <div style="font-size:40px; margin-bottom:16px;">🛡️</div>
        <h2 style="font-size:20px; font-weight:900; color:var(--text); margin-bottom:10px;">Security Lock</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">시스템 액세스를 위해<br>4자리 마스터 PIN을 입력하십시오.</p>
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:24px;">
            <input type="password" id="pin-digit" maxlength="4" placeholder="••••" style="width:140px; height:50px; font-size:28px; text-align:center; letter-spacing:10px; border:2px solid var(--border); border-radius:12px; background:var(--surface2); color:var(--accent);" autofocus onkeydown="if(event.key==='Enter') verifyPin()">
        </div>
        <button class="primary-btn" onclick="verifyPin()" style="width:100%; height:50px; font-weight:bold; font-size:16px; border-radius:12px;">🔒 시스템 해제</button>
        <div style="margin-top:20px; font-size:11px; color:var(--text-muted);">
            PIN을 잊으셨나요? <span style="color:var(--danger); cursor:pointer; text-decoration:underline;" onclick="signOut()">로그아웃 후 초기화</span>
        </div>
    </div>
</div>
"""

content = content.replace('</body>', pin_modal_html + '\n</body>')

# 5. Inject showPinModal call in onAuthSuccess
content = re.sub(r'// 🔐 PIN 이중 인증 체크 \(T7 보안 수칙\).*?return;\s+\}', 'showPinModal();', content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Dashboard successfully patched.")
