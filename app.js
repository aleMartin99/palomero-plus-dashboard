// Palomero Plus Super Admin Dashboard Controller

let supabaseClient = null;
let currentTab = 'overview';
let activeContactFilter = 'all';
let rawUsers = [];
let rawPigeons = [];
let rawCaptures = [];
let rawContacts = [];
let rawSubscriptions = [];
let rawPlans = [];

// Chart Instances
let registrationsChart = null;
let subscriptionChart = null;

// Initialize app on load
window.addEventListener('DOMContentLoaded', async () => {
  await loadConfigKeys();
  await refreshAllData();
});

// Load config keys from .env or localStorage
async function loadConfigKeys() {
  let url = localStorage.getItem('admin_supabase_url');
  let key = localStorage.getItem('admin_supabase_key');

  // Try to load from .env file first
  try {
    const res = await fetch('/.env');
    if (res.ok) {
      const text = await res.text();
      const env = {};
      text.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const k = parts[0].trim();
          const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          if (k && v) {
            env[k] = v;
          }
        }
      });
      // Prioritize service role key if added, else fallback to anon key
      url = env['SUPABASE_URL'] || url;
      key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SUPABASE_ANON_KEY'] || key;
    }
  } catch (e) {
    console.warn("Could not fetch or parse .env file, using localStorage:", e);
  }

  const statusEl = document.getElementById('connection-status');
  const statusText = document.getElementById('connection-text');

  if (url && key) {
    try {
      supabaseClient = supabase.createClient(url, key);
      statusEl.className = "flex items-center space-x-2 bg-emerald-950/50 border border-emerald-500/30 text-emerald-450 px-3 py-1.5 rounded-full text-xs font-medium";
      statusText.innerText = "Connected to Supabase";
    } catch (e) {
      console.error(e);
      statusEl.className = "flex items-center space-x-2 bg-amber-950/50 border border-amber-500/30 text-amber-500 px-3 py-1.5 rounded-full text-xs font-medium";
      statusText.innerText = "Connection Failed";
    }
  } else {
    statusEl.className = "flex items-center space-x-2 bg-red-950/50 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-xs font-medium";
    statusText.innerText = "Disconnected (Setup Keys)";
  }
}

// Switch navigation tabs
function switchTab(tabId) {
  const sections = ['overview', 'users', 'contacts', 'subscriptions'];
  sections.forEach(s => {
    document.getElementById(`content-${s}`).classList.add('hidden');
    const tabBtn = document.getElementById(`tab-${s}`);
    tabBtn.className = "w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 transition text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium";
  });

  document.getElementById(`content-${tabId}`).classList.remove('hidden');
  document.getElementById(`tab-${tabId}`).className = "w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 transition bg-brand-500 text-white font-medium";
  currentTab = tabId;
}

// Refresh all dashboard statistics
async function refreshAllData() {
  if (supabaseClient) {
    try {
      // 1. Fetch Auth Users (only works with service_role key)
      let authUsers = [];
      try {
        const { data, error } = await supabaseClient.auth.admin.listUsers();
        if (!error && data) {
          authUsers = data.users || [];
        }
      } catch (e) {
        console.warn("Could not list auth users directly, falling back to profiles.", e);
      }

      // 2. Fetch Public Profiles
      const { data: publicProfiles, error: profileErr } = await supabaseClient.from('users').select('*');
      if (profileErr) throw profileErr;

      if (authUsers && authUsers.length > 0) {
        rawUsers = authUsers.map(au => {
          const profile = (publicProfiles || []).find(p => p.id === au.id);
          return {
            id: au.id,
            email: au.email,
            username: profile?.username || 'fancier',
            display_name: profile?.display_name || au.email.split('@')[0],
            is_public: profile?.is_public ?? true,
            account_status: profile?.account_status || 'active',
            email_confirmed_at: au.email_confirmed_at,
            created_at: au.created_at
          };
        });
      } else if (publicProfiles) {
        rawUsers = publicProfiles.map(p => ({
          id: p.id,
          email: `${p.username || 'fancier'}@fancier.com`,
          username: p.username || 'fancier',
          display_name: p.display_name || p.username || 'Fancier',
          is_public: p.is_public ?? true,
          account_status: p.account_status || 'active',
          email_confirmed_at: p.created_at, // fallback
          created_at: p.created_at
        }));
      }

      // 3. Fetch Pigeons
      const { data: pigeons } = await supabaseClient.from('pigeons').select('*');
      rawPigeons = pigeons || [];

      // 4. Fetch Captures
      const { data: captures } = await supabaseClient.from('captures').select('*');
      rawCaptures = captures || [];

      // 5. Fetch Contact Requests
      const { data: contacts, error: contactsErr } = await supabaseClient.from('contact_requests').select('*');
      if (contactsErr) {
        console.error("Error fetching contact requests (possible RLS issue?):", contactsErr);
      }
      rawContacts = (contacts || []).map(c => {
        const matchingUser = rawUsers.find(u => u.id === c.user_id);
        return {
          ...c,
          user_email: matchingUser ? matchingUser.email : 'Unknown Fancier'
        };
      });

      // 6. Fetch Subscription Plans
      const { data: plans } = await supabaseClient.from('subscription_plans').select('*');
      rawPlans = plans || [];

      // 7. Fetch Subscriptions
      const { data: subscriptions } = await supabaseClient.from('subscriptions').select('*');
      rawSubscriptions = (subscriptions || []).map(s => {
        const matchingUser = rawUsers.find(u => u.id === s.user_id);
        return {
          ...s,
          user_email: matchingUser ? matchingUser.email : 'Unknown Fancier'
        };
      });

    } catch (e) {
      console.error("Failed fetching live Supabase data, showing interactive demo statistics.", e);
      loadFallbackDemo();
    }
  } else {
    loadFallbackDemo();
  }

  updateMetricsUI();
  updateCharts();
  renderUsersTable();
  renderContactsList();
  renderSubscriptionsSection();
}

// Load offline mock data
function loadFallbackDemo() {
  rawUsers = [
    { id: '1', email: 'juan.perez@fancier.com', username: 'juanito_pigeons', display_name: 'Juan Pérez', is_public: true, account_status: 'active', email_confirmed_at: '2026-06-15T12:00:00Z', created_at: '2026-06-15T10:00:00Z' },
    { id: '2', email: 'maria.gomez@loft.es', username: 'maria_g', display_name: 'María Gómez', is_public: true, account_status: 'active', email_confirmed_at: '2026-07-01T15:30:00Z', created_at: '2026-07-01T14:00:00Z' },
    { id: '3', email: 'carlos.fancier@pigeons.net', username: 'carlos_p', display_name: 'Carlos Pigeon', is_public: false, account_status: 'inactive', email_confirmed_at: null, created_at: '2026-07-08T08:00:00Z' },
    { id: '4', email: 'deleted.user@domain.com', username: 'removed_fancier', display_name: 'Deleted Fancier', is_public: false, account_status: 'deleted', email_confirmed_at: '2026-05-10T11:00:00Z', created_at: '2026-05-10T09:00:00Z' }
  ];
  rawPigeons = [
    { id: 'p1', user_id: '1', name: 'Rayo', ring_number: 'ESP-2025-883', sex: 'M' },
    { id: 'p2', user_id: '1', name: 'Centella', ring_number: 'ESP-2025-884', sex: 'F' },
    { id: 'p3', user_id: '2', name: 'Azul', ring_number: 'ESP-2026-112', sex: 'M' },
    { id: 'p4', user_id: '2', name: 'Pluma', ring_number: 'ESP-2026-115', sex: 'F' }
  ];
  rawCaptures = [
    { id: 'c1', user_id: '1', pigeon_id: 'p1', captured_at: '2026-07-05T18:22:00Z' },
    { id: 'c2', user_id: '2', pigeon_id: 'p3', captured_at: '2026-07-09T10:45:00Z' }
  ];
  rawContacts = [
    { id: 1, user_id: '1', user_email: 'juan.perez@fancier.com', subject: 'Problem with uploading loft image', type: 'bug', description: 'When I try to select a custom image for my loft, the app gets stuck loading.', solved: false },
    { id: 2, user_id: '2', user_email: 'maria.gomez@loft.es', subject: 'Requesting weather feature', type: 'feedback', description: 'It would be nice to see the weather forecast directly in the ranking screen.', solved: false },
    { id: 3, user_id: '3', user_email: 'carlos.fancier@pigeons.net', subject: 'Forgot verification email link', type: 'support', description: 'I did not receive the verification code on signup. Can you check my email?', solved: true }
  ];
  rawPlans = [
    { id: 'plan_free', name: 'Free Tier', price_usd: 0, is_active: true },
    { id: 'plan_premium_monthly', name: 'Premium Monthly', price_usd: 4.99, is_active: true },
    { id: 'plan_premium_yearly', name: 'Premium Yearly', price_usd: 39.99, is_active: true }
  ];
  rawSubscriptions = [
    { id: 'sub1', user_id: '1', user_email: 'juan.perez@fancier.com', plan_id: 'plan_premium_monthly', status: 'active', expires_at: '2026-08-15T12:00:00Z' },
    { id: 'sub2', user_id: '2', user_email: 'maria.gomez@loft.es', plan_id: 'plan_premium_yearly', status: 'active', expires_at: '2027-07-01T15:30:00Z' }
  ];
}

// Update Metric UI boxes
function updateMetricsUI() {
  document.getElementById('stat-total-users').innerText = rawUsers.length;
  const verifiedCount = rawUsers.filter(u => u.email_confirmed_at !== null && u.email_confirmed_at !== undefined).length;
  const verifiedPercent = rawUsers.length > 0 ? Math.round((verifiedCount / rawUsers.length) * 100) : 0;
  document.getElementById('stat-verified-ratio').innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${verifiedPercent}% Verified</span>`;

  document.getElementById('stat-total-pigeons').innerText = rawPigeons.length;
  const avgPigeons = rawUsers.length > 0 ? (rawPigeons.length / rawUsers.length).toFixed(1) : 0;
  document.getElementById('stat-avg-pigeons').innerText = `${avgPigeons} per user`;

  document.getElementById('stat-total-captures').innerText = rawCaptures.length;

  const activeSubs = rawSubscriptions.filter(s => s.status === 'active').length;
  document.getElementById('stat-active-subs').innerText = activeSubs;
}

// Update Chart visualizations
function updateCharts() {
  const regDates = rawUsers.map(u => u.created_at ? u.created_at.substring(0, 10) : '2026-07-01');
  const counts = {};
  regDates.forEach(d => counts[d] = (counts[d] || 0) + 1);
  const sortedDates = Object.keys(counts).sort();
  const sortedCounts = sortedDates.map(d => counts[d]);

  if (registrationsChart) {
    registrationsChart.destroy();
  }

  const ctxReg = document.getElementById('chart-user-registrations').getContext('2d');
  registrationsChart = new Chart(ctxReg, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        label: 'Users Registered',
        data: sortedCounts,
        borderColor: '#b71c1c',
        backgroundColor: 'rgba(183, 28, 28, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { ticks: { stepSize: 1 } }
      }
    }
  });

  const tiers = { 'Free': 0, 'Premium Monthly': 0, 'Premium Yearly': 0 };
  rawUsers.forEach(u => {
    const sub = rawSubscriptions.find(s => s.user_id === u.id && s.status === 'active');
    if (sub) {
      if (sub.plan_id === 'plan_premium_yearly') tiers['Premium Yearly']++;
      else tiers['Premium Monthly']++;
    } else {
      tiers['Free']++;
    }
  });

  if (subscriptionChart) {
    subscriptionChart.destroy();
  }

  const ctxSub = document.getElementById('chart-sub-tiers').getContext('2d');
  subscriptionChart = new Chart(ctxSub, {
    type: 'doughnut',
    data: {
      labels: Object.keys(tiers).map(k => `${k} (${tiers[k]})`),
      datasets: [{
        data: Object.values(tiers),
        backgroundColor: ['#475569', '#3b82f6', '#10b981'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#cbd5e1' }
        }
      }
    }
  });
}

// Render user rows in Table
function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';

  rawUsers.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/20 transition border-b border-slate-800/40";
    
    const isVerified = u.email_confirmed_at !== null && u.email_confirmed_at !== undefined;
    const badgeStatus = u.account_status === 'active' 
      ? '<span class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 px-2 py-0.5 rounded-full text-xs font-semibold">Active</span>'
      : u.account_status === 'inactive'
      ? '<span class="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full text-xs font-semibold">Banned</span>'
      : '<span class="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-semibold">Deleted</span>';

    const verificationBadge = isVerified 
      ? '<span class="text-emerald-450 font-medium flex items-center space-x-1"><i class="fa-solid fa-circle-check text-xs"></i> <span>Verified</span></span>'
      : '<span class="text-slate-450 font-medium flex items-center space-x-1"><i class="fa-solid fa-circle-notch text-xs animate-spin"></i> <span>Pending</span></span>';

    const joinDate = u.created_at ? u.created_at.substring(0, 10) : '--';

    tr.innerHTML = `
      <td class="p-4 flex items-center space-x-3">
        <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
          ${u.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div class="font-bold text-white">${u.display_name}</div>
          <div class="text-xs text-slate-400">${u.email}</div>
        </div>
      </td>
      <td class="p-4">${badgeStatus}</td>
      <td class="p-4">${verificationBadge}</td>
      <td class="p-4 text-slate-400">${joinDate}</td>
      <td class="p-4 text-right">
        ${u.account_status === 'active' 
          ? `<button onclick="banUser('${u.id}')" class="text-xs font-semibold bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition"><i class="fa-solid fa-ban"></i> Ban</button>`
          : u.account_status === 'inactive'
          ? `<button onclick="unbanUser('${u.id}')" class="text-xs font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-450 px-3 py-1.5 rounded-lg transition"><i class="fa-solid fa-check"></i> Activate</button>`
          : `<span class="text-xs text-slate-500">Deleted Account</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Ban User logic
async function banUser(userId) {
  if (confirm("Are you sure you want to ban this user?")) {
    if (supabaseClient) {
      await supabaseClient.from('users').update({ account_status: 'inactive' }).eq('id', userId);
    } else {
      const idx = rawUsers.findIndex(u => u.id === userId);
      if (idx !== -1) rawUsers[idx].account_status = 'inactive';
    }
    refreshAllData();
  }
}

// Unban User logic
async function unbanUser(userId) {
  if (supabaseClient) {
    await supabaseClient.from('users').update({ account_status: 'active' }).eq('id', userId);
  } else {
    const idx = rawUsers.findIndex(u => u.id === userId);
    if (idx !== -1) rawUsers[idx].account_status = 'active';
  }
  refreshAllData();
}

// Filter Contact requests list
function filterContacts(filter) {
  activeContactFilter = filter;
  ['all', 'support', 'bug', 'feedback'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
  });
  document.getElementById(`filter-${filter}`).className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 text-white transition";
  renderContactsList();
}

// Render Contact Requests cards
function renderContactsList() {
  const container = document.getElementById('contacts-list');
  container.innerHTML = '';

  const filtered = rawContacts.filter(c => {
    if (activeContactFilter === 'all') return true;
    const type = (c.type || '').toLowerCase();
    if (activeContactFilter === 'bug') return type.includes('bug') || type.includes('error');
    if (activeContactFilter === 'support') return type.includes('support') || type.includes('help');
    if (activeContactFilter === 'feedback') return type.includes('feedback') || type.includes('other') || type.includes('suggest');
    return type === activeContactFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-dark-900 border border-slate-850 p-10 rounded-2xl text-center text-slate-400">
        <i class="fa-solid fa-circle-question text-3xl mb-2 text-slate-600"></i>
        <p class="font-medium text-sm">No contact requests found in this category.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(c => {
    const card = document.createElement('div');
    card.className = `bg-dark-900 border p-5 rounded-2xl transition ${c.solved ? 'border-slate-800 opacity-60' : 'border-slate-800'}`;

    const type = (c.type || '').toLowerCase();
    const typeBadge = type.includes('bug')
      ? '<span class="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Bug</span>'
      : type.includes('support')
      ? '<span class="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Support</span>'
      : '<span class="bg-purple-500/10 border border-purple-500/20 text-purple-450 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">Feedback / Other</span>';

    const statusButton = c.solved
      ? '<span class="text-xs text-emerald-450 font-semibold"><i class="fa-solid fa-circle-check"></i> Solved</span>'
      : `<button onclick="solveContact(${c.id})" class="text-xs font-semibold bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-450 px-3 py-1.5 rounded-lg transition"><i class="fa-solid fa-check"></i> Mark Solved</button>`;

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            ${typeBadge}
            <h4 class="font-bold text-white text-base">${c.subject}</h4>
          </div>
          <p class="text-sm text-slate-300 leading-relaxed">${c.description}</p>
          <div class="flex items-center space-x-2 text-xs text-slate-450">
            <span>By: <strong class="text-slate-300">${c.user_email}</strong></span>
          </div>
        </div>
        <div class="self-end sm:self-center">
          ${statusButton}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Mark contact request as solved
async function solveContact(contactId) {
  if (supabaseClient) {
    await supabaseClient.from('contact_requests').delete().eq('id', contactId);
  } else {
    const idx = rawContacts.findIndex(c => c.id === contactId);
    if (idx !== -1) rawContacts[idx].solved = true;
  }
  refreshAllData();
}

// Render Subscriptions and available plans list
function renderSubscriptionsSection() {
  const plansContainer = document.getElementById('plans-list');
  plansContainer.innerHTML = '';
  rawPlans.forEach(p => {
    let subCount = rawSubscriptions.filter(s => s.plan_id === p.id && s.status === 'active').length;
    if (p.id === 'plan_free' || p.price_usd === 0) {
      const activePremiums = rawSubscriptions.filter(s => s.status === 'active').length;
      subCount = Math.max(0, rawUsers.length - activePremiums);
    }

    const planDiv = document.createElement('div');
    planDiv.className = "bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between";
    planDiv.innerHTML = `
      <div>
        <div class="font-bold text-white text-sm">${p.name}</div>
        <div class="text-xs text-slate-400">$${p.price_usd} USD</div>
      </div>
      <div class="text-right flex flex-col items-end space-y-1">
        <span class="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Active</span>
        <span class="text-xs text-slate-300 font-medium">${subCount} user${subCount !== 1 ? 's' : ''}</span>
      </div>
    `;
    plansContainer.appendChild(planDiv);
  });

  const tbody = document.getElementById('subscriptions-table-body');
  tbody.innerHTML = '';
  rawSubscriptions.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/20 border-b border-slate-800/40 transition";
    
    const planName = s.plan_id === 'plan_premium_yearly' ? 'Premium Yearly' : 'Premium Monthly';
    const activeUntil = s.expires_at ? s.expires_at.substring(0, 10) : '--';
    const subBadge = s.status === 'active'
      ? '<span class="bg-emerald-500/10 text-emerald-450 text-xs font-semibold px-2 py-0.5 rounded">Active</span>'
      : '<span class="bg-red-500/10 text-red-400 text-xs font-semibold px-2 py-0.5 rounded">Expired</span>';

    tr.innerHTML = `
      <td class="p-4 font-semibold text-white">${s.user_email}</td>
      <td class="p-4">${planName}</td>
      <td class="p-4">${subBadge}</td>
      <td class="p-4 text-slate-400">${activeUntil}</td>
    `;
    tbody.appendChild(tr);
  });
}
