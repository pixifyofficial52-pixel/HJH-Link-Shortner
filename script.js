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

// ✅ Base64 encode function for Firebase paths (removes invalid characters)
function encodeFirebasePath(str) {
    // Convert to Base64 and then replace invalid characters
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// ✅ Decode function (if needed)
function decodeFirebasePath(encoded) {
    return decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
}

// Test connection on load
window.addEventListener('load', async () => {
    console.log('🔍 Testing Firebase connection...');
    try {
        const testRef = database.ref('test_connection');
        await testRef.set({ timestamp: Date.now(), status: 'ok' });
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

// Generate random short code
function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get device ID
function getDeviceId() {
    let deviceId = localStorage.getItem('hj_device_id');
    if (!deviceId) {
        deviceId = generateShortCode() + generateShortCode();
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

// Check if short code exists
async function checkCodeExists(shortCode) {
    const snapshot = await database.ref(`urls/${shortCode}`).get();
    return snapshot.exists();
}

// Main shorten function
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
    
    try {
        new URL(urlToShorten);
    } catch {
        showToast('Error', 'Invalid URL', 'error');
        return;
    }
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    
    // Check if code already exists
    const exists = await checkCodeExists(shortCode);
    if (exists) {
        showToast('Error', `Code "${shortCode}" is already taken`, 'error');
        return;
    }
    
    const hasPassword = document.getElementById('passwordToggle').checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = document.getElementById('socialToggle').checked;
    const socialIcon = document.getElementById('socialIcon')?.value || 'youtube';
    const socialTitle = hasSocialGate ? document.getElementById('socialTitle')?.value : null;
    const socialUrl = hasSocialGate ? document.getElementById('socialUrl')?.value : null;
    const socialDesc = hasSocialGate ? document.getElementById('socialDesc')?.value : null;
    const socialButton = hasSocialGate ? document.getElementById('socialButton')?.value : null;
    const animation = document.querySelector('input[name="animation"]:checked')?.value || 'ring';
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    const expiryDate = document.getElementById('expiresAt')?.value || null;
    
    if (hasPassword && !password) {
        showToast('Error', 'Please enter a password', 'error');
        return;
    }
    
    if (hasSocialGate && (!socialTitle || !socialUrl)) {
        showToast('Error', 'Please fill social gate details', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        const createdAt = new Date().toISOString();
        
        // ✅ Encode domain for Firebase path (removes dots)
        const encodedDomain = encodeFirebasePath(domain);
        
        const linkData = {
            long_url: urlToShorten,
            domain: domain,
            created_at: createdAt,
            device_id: deviceId,
            clicks: 0
        };
        
        // Add optional fields only if they exist
        if (password) linkData.password = password;
        if (socialTitle) linkData.social_gate_title = socialTitle;
        if (socialUrl) linkData.social_gate_url = socialUrl;
        if (socialIcon) linkData.social_gate_icon = socialIcon;
        if (socialDesc) linkData.social_gate_description = socialDesc;
        if (socialButton) linkData.social_gate_button_text = socialButton;
        if (animation) linkData.animation_type = animation;
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;
        if (expiryDate) linkData.expires_at = expiryDate;
        
        console.log('📝 Saving to Firebase:', { shortCode, encodedDomain, linkData });
        
        // Save to main URLs path
        await database.ref(`urls/${shortCode}`).set(linkData);
        
        // ✅ Save to domains path using encoded domain
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        
        // Save to localStorage recent
        const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
        recent.unshift({ 
            code: shortCode, 
            longUrl: urlToShorten, 
            shortUrl: shortUrl, 
            date: createdAt 
        });
        localStorage.setItem('hj_recent_links', JSON.stringify(recent.slice(0, 10)));
        
        // Generate QR Code
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
        
        document.getElementById('result').classList.remove('hindden');
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
        if (document.getElementById('socialDesc')) document.getElementById('socialDesc').value = '';
        
        // Refresh lists
        loadRecentLinks();
        loadAnalyticsList();
        
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

// Load recent links from localStorage
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
                <button onclick="viewAnalytics('${link.code}')" class="btn-icon"><i class="fas fa-chart-line"></i></button>
            </div>
        </div>
    `).join('');
}

// Load analytics list from Firebase
async function loadAnalyticsList() {
    const domain = window.location.hostname;
    const encodedDomain = encodeFirebasePath(domain);
    const container = document.getElementById('analyticsList');
    if (!container) return;
    
    try {
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        snapshot.forEach(child => {
            links.push({ code: child.key, ...child.val() });
        });
        
        if (links.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-chart-simple"></i><p>No links found</p></div>';
            return;
        }
        
        container.innerHTML = links.map(link => `
            <div class="recent-item">
                <div>
                    <div class="recent-code"><i class="fas fa-link"></i> /${link.code}</div>
                    <div class="recent-url">${link.long_url?.substring(0, 50) || 'N/A'}...</div>
                    <div style="font-size: 0.6rem; color: #444;">Clicks: ${link.clicks || 0}</div>
                </div>
                <button onclick="viewAnalytics('${link.code}')" class="btn-primary" style="width: auto; padding: 8px 16px;">View Stats</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading analytics:', error);
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-exclamation-triangle"></i><p>Error loading links</p></div>';
    }
}

// View analytics for a specific link
window.viewAnalytics = async (code) => {
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
        const analytics = [];
        snapshot.forEach(child => {
            analytics.push({ id: child.key, ...child.val() });
        });
        analytics.reverse();
        
        const linkSnapshot = await database.ref(`urls/${code}`).get();
        const linkData = linkSnapshot.val();
        
        const analyticsCodeDiv = document.getElementById('analyticsCode');
        if (analyticsCodeDiv) {
            analyticsCodeDiv.innerHTML = `<div class="card-header"><i class="fas fa-chart-line"></i><h3>Analytics for /${code}</h3></div>`;
        }
        
        const totalClicks = analytics.length;
        const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
        const cameras = analytics.filter(a => a.captured_image).length;
        const locations = analytics.filter(a => a.latitude).length;
        
        const statsGrid = document.getElementById('statsGrid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label">Unique Visitors</div></div>
                <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label">Intel Photos</div></div>
                <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label">Locations</div></div>
            `;
        }
        
        const visitorsList = document.getElementById('visitorsList');
        if (visitorsList) {
            visitorsList.innerHTML = analytics.map(v => `
                <div class="visitor-item">
                    <div class="visitor-header">
                        <span><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="visitor-details">
                        <span><i class="fas fa-mobile-alt"></i> ${v.device_type || 'Unknown'}</span>
                        <span><i class="fab fa-chrome"></i> ${v.browser || 'Unknown'}</span>
                        <span><i class="fab fa-windows"></i> ${v.os || 'Unknown'}</span>
                        ${v.city ? `<span><i class="fas fa-location-dot"></i> ${v.city}, ${v.country}</span>` : ''}
                        ${v.captured_image ? `<span><i class="fas fa-camera"></i> Photo Captured</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        const analyticsDetail = document.getElementById('analyticsDetail');
        if (analyticsDetail) analyticsDetail.classList.remove('hidden');
        
        // Switch to analytics tab
        const analyticsTabBtn = document.querySelector('[data-tab="analytics"]');
        if (analyticsTabBtn) analyticsTabBtn.click();
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Error', 'Failed to load analytics', 'error');
    }
};

// Copy to clipboard
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
        if (tab === 'analytics') await loadAnalyticsList();
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
    // Set first icon as active by default
    if (icon.dataset.icon === 'youtube') {
        icon.classList.add('active');
    }
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
loadAnalyticsList();

// Modal functions for redirect page
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
            
            // Enter key support
            passwordInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') onUnlock();
            });
        } else {
            resolve(null);
        }
    });
};

console.log('🔥 HJ-HACKER Script Loaded! (Base64 Path Version)');
