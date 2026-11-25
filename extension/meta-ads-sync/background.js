const QUEUE_KEY = 'metaCampaignSyncQueue';
const SETTINGS_KEY = 'metaCampaignSyncSettings';
const ALLOWED_ORIGINS = new Set(['https://fe-vinhdanh.vercel.app', 'http://localhost:3000']);
let flushing = false;
let openingTab = false;

async function settings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const origin = stored[SETTINGS_KEY]?.crmOrigin || 'https://fe-vinhdanh.vercel.app';
  return { crmOrigin: ALLOWED_ORIGINS.has(origin) ? origin : 'https://fe-vinhdanh.vercel.app' };
}

function rowKey(row) {
  return `${row.account_id}|${row.campaign_key}|${row.report_date}`;
}

async function updateBadge(text, color = '#2563eb') {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
}

async function queueCapture(payload) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || {};
  const scope = `${payload.account_id}|${payload.since}|${payload.until}`;
  const current = queue[scope] || {
    account_id: payload.account_id,
    since: payload.since,
    until: payload.until,
    account_name: payload.account_name || '',
    currency: payload.currency || null,
    rows: {},
    captured_at: new Date().toISOString()
  };
  current.account_name = payload.account_name || current.account_name;
  current.currency = payload.currency || current.currency;
  current.captured_at = new Date().toISOString();
  for (const row of payload.rows) current.rows[rowKey(row)] = row;
  queue[scope] = current;
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  const count = Object.values(queue).reduce((sum, item) => sum + Object.keys(item.rows).length, 0);
  await updateBadge(count ? String(Math.min(count, 999)) : '');
  return count;
}

function notifySource(tabId, status, detail = '') {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, { type: 'META_SYNC_STATUS', status, detail }).catch(() => {});
}

async function findCrmTab(origin) {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  return tabs.find(tab => tab.id != null) || null;
}

async function ensureCrmTab(origin) {
  let tab = await findCrmTab(origin);
  if (tab) return tab;
  if (!openingTab) {
    openingTab = true;
    try {
      tab = await chrome.tabs.create({ url: `${origin}/`, active: false });
    } finally {
      openingTab = false;
    }
  }
  return tab;
}

async function postInCrmPage(tabId, payload) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [payload],
    func: async (data) => {
      const response = await fetch(`${location.origin}/api/meta-campaign-import`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Meta-QC-Request': '1' },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, result };
    }
  });
  return results?.[0]?.result || { ok: false, status: 0, result: {} };
}

function chunks(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

async function flushQueue(sourceTabId = null) {
  if (flushing) return { ok: false, message: 'Đang đồng bộ.' };
  flushing = true;
  try {
    const { crmOrigin } = await settings();
    const crmTab = await ensureCrmTab(crmOrigin);
    if (!crmTab?.id) return { ok: false, message: 'Không mở được FE-vinhdanh.' };
    if (crmTab.status === 'loading') {
      notifySource(sourceTabId, 'waiting', 'Đang mở FE-vinhdanh để nhận dữ liệu.');
      return { ok: false, message: 'Đang mở FE-vinhdanh.' };
    }
    const stored = await chrome.storage.local.get(QUEUE_KEY);
    const queue = stored[QUEUE_KEY] || {};
    const scopes = Object.keys(queue);
    if (!scopes.length) return { ok: true, message: 'Không có dữ liệu đang chờ.' };

    for (const scope of scopes) {
      let item = queue[scope];
      let rows = Object.values(item.rows || {});
      for (const batch of chunks(rows, 1000)) {
        const dates = batch.map(row => row.report_date).sort();
        const payload = {
          account_id: item.account_id,
          account_name: item.account_name,
          currency: item.currency,
          since: dates[0],
          until: dates[dates.length - 1],
          rows: batch
        };
        let response;
        try {
          response = await postInCrmPage(crmTab.id, payload);
        } catch {
          notifySource(sourceTabId, 'waiting', 'Mở FE-vinhdanh rồi đăng nhập để ghi dữ liệu.');
          return { ok: false, message: 'Không kết nối được FE-vinhdanh.' };
        }
        if (!response.ok) {
          const message = response.status === 401
            ? 'Đăng nhập FE-vinhdanh và xác nhận quyền Meta Ads để tiếp tục.'
            : (response.result?.message || `API nhập dữ liệu trả mã ${response.status}.`);
          notifySource(sourceTabId, 'waiting', message);
          return { ok: false, message };
        }
        const saved = new Set(batch.map(rowKey));
        item.rows = Object.fromEntries(Object.entries(item.rows).filter(([key]) => !saved.has(key)));
        if (Object.keys(item.rows).length) queue[scope] = item;
        else delete queue[scope];
        await chrome.storage.local.set({ [QUEUE_KEY]: queue });
        rows = Object.values(item.rows || {});
        notifySource(sourceTabId, 'saved', `${response.result?.rows_saved || 0} dòng đã ghi vào FE-vinhdanh.`);
      }
    }

    const remaining = Object.values(queue).reduce((sum, item) => sum + Object.keys(item.rows || {}).length, 0);
    await updateBadge(remaining ? String(Math.min(remaining, 999)) : '', remaining ? '#2563eb' : '#15803d');
    return { ok: true, message: remaining ? `${remaining} dòng đang chờ.` : 'Đã đồng bộ.' };
  } finally {
    flushing = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'META_CAPTURE_ROWS') {
    (async () => {
      const count = await queueCapture(message.payload);
      notifySource(sender.tab?.id, 'captured', `Đã đọc ${message.payload.rows.length} dòng; hàng đợi có ${count}.`);
      const result = await flushQueue(sender.tab?.id);
      sendResponse(result);
    })().catch(() => sendResponse({ ok: false, message: 'Không lưu được hàng đợi đồng bộ.' }));
    return true;
  }
  if (message?.type === 'META_FLUSH_QUEUE') {
    flushQueue().then(sendResponse).catch(() => sendResponse({ ok: false, message: 'Đồng bộ thất bại.' }));
    return true;
  }
  if (message?.type === 'META_GET_STATUS') {
    chrome.storage.local.get(QUEUE_KEY).then(stored => {
      const queue = stored[QUEUE_KEY] || {};
      const items = Object.values(queue);
      sendResponse({ pending: items.reduce((sum, item) => sum + Object.keys(item.rows || {}).length, 0), scopes: items.length });
    }).catch(() => sendResponse({ pending: 0, scopes: 0 }));
    return true;
  }
  return undefined;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status !== 'complete' && !changeInfo.url) || !tab.url) return;
  settings().then(({ crmOrigin }) => {
    if (tab.url.startsWith(`${crmOrigin}/`)) flushQueue().catch(() => {});
  });
});
