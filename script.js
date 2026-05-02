// Supabase Configuration - YOUR CREDENTIALS
const SUPABASE_URL = "https://mxllockxgmkojcduhcfd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bGxvY2t4Z21rb2pjZHVoY2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2OTc5MTcsImV4cCI6MjA5MzI3MzkxN30.GDxGx10lyOf3YkMNytCaltjGf_lQ3LkpNEnzcPQtrsM";

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const longUrlInput = document.getElementById('longUrl');
const customCodeInput = document.getElementById('customCode');
const shortenBtn = document.getElementById('shortenBtn');
const passwordToggle = document.getElementById('passwordToggle');
const passwordInput = document.getElementById('password');
const resultDiv = document.getElementById('result');
const shortLinkSpan = document.getElementById('shortLink');
const copyBtn = document.getElementById('copyBtn');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const recentLinksDiv = document.getElementById('recentLinks');
const qrCodeDiv = document.getElementById('qrCode');

// Generate random short code
function generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get device ID from localStorage
function getDeviceId() {
    let deviceId = localStorage.getItem('hj_device_id');
    if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('hj_device_id', deviceId);
    }
    return deviceId;
}

// Save to recent links
function saveToRecent(link) {
    let recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    recent = [link, ...recent.filter(l => l.code !== link.code)].slice(0, 10);
    localStorage.setItem('hj_recent_links', JSON.stringify(recent));
    displayRecentLinks();
}

// Display recent links
function displayRecentLinks() {
    const recent = JSON.parse(localStorage.getItem('hj_recent_links') || '[]');
    if (recent.length === 0) {
        recentLinksDiv.innerHTML = '<p style="color: #666; text-align: center;">No recent links</p>';
        return;
    }
    
    recentLinksDiv.innerHTML = recent.map(link => `
        <div class="recent-item">
            <div class="recent-info">
                <div class="recent-code">/${link.code}</div>
                <div class="recent-url">${link.longUrl.substring(0, 50)}${link.longUrl.length > 50 ? '...' : ''}</div>
            </div>
            <div class="recent-actions">
                <button onclick="copyToClipboard('${link.shortUrl}')">Copy</button>
                <button onclick="window.open('${link.shortUrl}', '_blank')">Visit</button>
            </div>
        </div>
    `).join('');
}

// Copy to clipboard
window.copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        alert('Link copied!');
    } catch (err) {
        console.error('Failed to copy:', err);
    }
};

// Show error message
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Show loading
function showLoading(show) {
    if (show) {
        loadingDiv.classList.remove('hidden');
        shortenBtn.disabled = true;
    } else {
        loadingDiv.classList.add('hidden');
        shortenBtn.disabled = false;
    }
}

// Create QR Code
function createQRCode(url) {
    qrCodeDiv.innerHTML = '';
    new QRCode(qrCodeDiv, {
        text: url,
        width: 128,
        height: 128,
        colorDark: "#00ff41",
        colorLight: "#000000",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Shorten URL function
async function shortenUrl() {
    const longUrl = longUrlInput.value.trim();
    if (!longUrl) {
        showError('Please enter a URL');
        return;
    }
    
    // Validate URL
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http://') && !urlToShorten.startsWith('https://')) {
        urlToShorten = 'https://' + urlToShorten;
    }
    
    try {
        new URL(urlToShorten);
    } catch {
        showError('Please enter a valid URL');
        return;
    }
    
    const customCode = customCodeInput.value.trim();
    const shortCode = customCode || generateShortCode();
    const hasPassword = passwordToggle.checked;
    const password = hasPassword ? passwordInput.value : null;
    
    if (hasPassword && !password) {
        showError('Please enter a password');
        return;
    }
    
    showLoading(true);
    
    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        
        // Insert into Supabase
        const { data, error } = await supabase
            .from('urls')
            .insert([{
                domain: domain,
                short_code: shortCode,
                long_url: urlToShorten,
                password: password,
                device_id: deviceId,
                clicks: 0,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) {
            if (error.code === '23505') {
                showError(`Code "${shortCode}" is already taken. Please try another.`);
            } else if (error.message.includes('relation "urls" does not exist')) {
                showError('Database not setup. Please run the SQL setup first.');
            } else {
                showError(error.message);
            }
            showLoading(false);
            return;
        }
        
        const shortUrl = `${window.location.origin}/${shortCode}`;
        shortLinkSpan.textContent = shortUrl;
        
        // Save to recent
        saveToRecent({
            code: shortCode,
            longUrl: urlToShorten,
            shortUrl: shortUrl,
            hasPassword: hasPassword,
            date: new Date().toISOString()
        });
        
        // Create QR Code
        createQRCode(shortUrl);
        
        // Show result
        resultDiv.classList.remove('hidden');
        
        // Clear inputs
        longUrlInput.value = '';
        customCodeInput.value = '';
        passwordInput.value = '';
        passwordToggle.checked = false;
        passwordInput.classList.add('hidden');
        passwordInput.disabled = true;
        
    } catch (err) {
        console.error('Error:', err);
        showError('An unexpected error occurred');
    } finally {
        showLoading(false);
    }
}

// Copy button handler
copyBtn.addEventListener('click', () => {
    const link = shortLinkSpan.textContent;
    if (link) {
        copyToClipboard(link);
    }
});

// Password toggle handler
passwordToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        passwordInput.classList.remove('hidden');
        passwordInput.disabled = false;
    } else {
        passwordInput.classList.add('hidden');
        passwordInput.disabled = true;
        passwordInput.value = '';
    }
});

// Enter key handler
longUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        shortenUrl();
    }
});

customCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        shortenUrl();
    }
});

// Load recent links on page load
displayRecentLinks();

// Shorten button click
shortenBtn.addEventListener('click', shortenUrl);

console.log('🔥 HJ-HACKER URL Shortener Ready!');
