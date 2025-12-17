import { supabase } from './supabase.js';

// DOM Elements
const loginSection = document.getElementById('login-section');
const bottlesSection = document.getElementById('bottles-section');
const loadingState = document.getElementById('loading-state');
const magicLinkForm = document.getElementById('magic-link-form');
const loginEmailInput = document.getElementById('login-email');
const magicLinkMessage = document.getElementById('magic-link-message');
const sendMagicLinkBtn = document.getElementById('send-magic-link-btn');
const userEmailSpan = document.getElementById('user-email');
const signOutBtn = document.getElementById('sign-out-btn');
const bottlesList = document.getElementById('bottles-list');
const emptyState = document.getElementById('empty-state');

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format date for delivery display
function formatDeliveryDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusConfig = {
        pending: { class: 'status-pending', label: 'Pending' },
        delivered: { class: 'status-delivered', label: 'Delivered' },
        failed: { class: 'status-failed', label: 'Failed' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return `<span class="status-badge ${config.class}">${config.label}</span>`;
}

// Truncate message for preview
function truncateMessage(message, maxLength = 50) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
}

// Render a single bottle card
function renderBottleCard(bottle) {
    const card = document.createElement('div');
    card.className = 'bottle-card';
    card.dataset.bottleId = bottle.id;
    
    const preview = truncateMessage(bottle.message);
    const fullMessage = bottle.message.replace(/\n/g, '<br>');
    
    card.innerHTML = `
        <div class="bottle-card-header" onclick="toggleBottle('${bottle.id}')">
            <div class="bottle-card-icon">
                <svg viewBox="0 0 64 64" width="32" height="32">
                    <path fill="${bottle.bottle_color}" d="M26 6h12v6c0 1.2.5 2.3 1.3 3.1l3.2 3.2c1.7 1.7 2.7 4 2.7 6.4V52c0 3.3-2.7 6-6 6H25c-3.3 0-6-2.7-6-6V28.7c0-2.4 1-4.7 2.7-6.4l3.2-3.2c.8-.8 1.3-1.9 1.3-3.1V6z"/>
                </svg>
            </div>
            <div class="bottle-card-info">
                <div class="bottle-card-recipient">To: ${bottle.recipient_email}</div>
                <div class="bottle-card-meta">
                    <span class="bottle-card-date">Delivers: ${formatDeliveryDate(bottle.delivery_date)}</span>
                    ${getStatusBadge(bottle.status)}
                </div>
                <div class="bottle-card-preview">${preview}</div>
            </div>
            <div class="bottle-card-expand">
                <svg viewBox="0 0 24 24" width="20" height="20" class="expand-icon">
                    <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                </svg>
            </div>
        </div>
        <div class="bottle-card-content" id="content-${bottle.id}">
            <div class="bottle-message ${bottle.theme}">
                ${fullMessage}
            </div>
            <div class="bottle-card-footer">
                <span>Sent: ${formatDate(bottle.created_at)}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Toggle bottle card expansion
window.toggleBottle = function(bottleId) {
    const card = document.querySelector(`[data-bottle-id="${bottleId}"]`);
    if (card) {
        card.classList.toggle('expanded');
    }
};

// Render all bottles
function renderBottles(bottles) {
    bottlesList.innerHTML = '';
    
    if (!bottles || bottles.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    bottles.forEach(bottle => {
        bottlesList.appendChild(renderBottleCard(bottle));
    });
}

// Fetch user's bottles
async function fetchBottles(userEmail) {
    const { data: bottles, error } = await supabase
        .from('bottles')
        .select('*')
        .eq('sender_email', userEmail)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching bottles:', error);
        return [];
    }
    
    return bottles;
}

// Show authenticated state
async function showAuthenticatedState(session) {
    loginSection.style.display = 'none';
    loadingState.style.display = 'block';
    
    const userEmail = session.user.email;
    userEmailSpan.textContent = userEmail;
    
    const bottles = await fetchBottles(userEmail);
    
    loadingState.style.display = 'none';
    bottlesSection.style.display = 'block';
    
    renderBottles(bottles);
}

// Show login state
function showLoginState() {
    loginSection.style.display = 'block';
    bottlesSection.style.display = 'none';
    loadingState.style.display = 'none';
}

// Handle magic link form submission
magicLinkForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = loginEmailInput.value.trim();
    if (!email) return;
    
    sendMagicLinkBtn.disabled = true;
    sendMagicLinkBtn.textContent = 'Sending...';
    
    const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
            emailRedirectTo: 'https://bottled.to/my-bottles.html'
        }
    });
    
    sendMagicLinkBtn.disabled = false;
    sendMagicLinkBtn.textContent = 'Send Magic Link';
    
    if (error) {
        magicLinkMessage.textContent = 'Error sending magic link. Please try again.';
        magicLinkMessage.className = 'auth-message error';
        magicLinkMessage.style.display = 'block';
        console.error('Magic link error:', error);
        return;
    }
    
    magicLinkMessage.textContent = 'Check your email! Click the link to access your bottles.';
    magicLinkMessage.className = 'auth-message success';
    magicLinkMessage.style.display = 'block';
    loginEmailInput.value = '';
});

// Handle sign out
signOutBtn.addEventListener('click', async function() {
    await supabase.auth.signOut();
    showLoginState();
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        showAuthenticatedState(session);
    } else {
        showLoginState();
    }
});

// Initialize: check for existing session
async function init() {
    loadingState.style.display = 'block';
    loginSection.style.display = 'none';
    bottlesSection.style.display = 'none';
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        showAuthenticatedState(session);
    } else {
        showLoginState();
    }
}

init();
