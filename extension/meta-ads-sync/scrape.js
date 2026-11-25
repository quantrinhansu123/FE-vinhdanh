(() => {
  const PANEL_ID = 'fe-vinhdanh-meta-sync-status';
  const seen = new Set();
  let timer;

  const norm = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const visible = element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  };

  function panel() {
    let node = document.getElementById(PANEL_ID);
    if (node) return node;
    node = document.createElement('div');
    node.id = PANEL_ID;
    Object.assign(node.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '2147483647',
      maxWidth: '330px', padding: '10px 12px', borderRadius: '10px',
      color: '#10202b', background: '#effaf4', border: '1px solid #90c7a6',
      boxShadow: '0 6px 22px rgba(0,0,0,.18)', font: '12px/1.4 system-ui,sans-serif'
    });
    document.documentElement.appendChild(node);
    return node;
  }

  function status(message, bad = false) {
    const node = panel();
    node.textContent = `FE-vinhdanh Meta Sync · ${message}`;
    node.style.background = bad ? '#fff5f5' : '#effaf4';
    node.style.borderColor = bad ? '#e6a2a2' : '#90c7a6';
  }

  function tableHeaders(table) {
    return Array.from(table.querySelectorAll('[role="columnheader"]')).filter(visible).map(element => ({
      element,
      label: norm(element.innerText || element.getAttribute('aria-label')),
      rect: element.getBoundingClientRect()
    }));
  }

  function findRowContainer(table) {
    const firstLink = Array.from(table.querySelectorAll('a')).find(link => link.innerText.trim() && visible(link));
    if (!firstLink) return [];
    for (let node = firstLink.parentElement; node && node !== table; node = node.parentElement) {
      const children = Array.from(node.children);
      if (children.length < 2 || children.length > 2500) continue;
      const candidates = children.filter(child => Array.from(child.querySelectorAll('a')).some(a => a.innerText.trim() && visible(a)));
      const yPositions = new Set(candidates.map(child => Math.round(child.getBoundingClientRect().top)));
      if (candidates.length >= 2 && yPositions.size >= 2 && candidates.length >= children.length * 0.7) return candidates;
    }
    const width = table.getBoundingClientRect().width;
    for (let node = firstLink; node && node !== table; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= Math.min(width * 0.65, 500) && rect.height >= 24 && rect.height <= 180) return [node];
    }
    return [];
  }

  function cellsForRow(row, headers) {
    const cells = headers.map(() => []);
    const centers = headers.map(header => header.rect.left + header.rect.width / 2);
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const value = textNode.nodeValue?.replace(/\s+/g, ' ').trim();
      const parent = textNode.parentElement;
      if (!value || !parent || parent.closest('[aria-hidden="true"]') || !visible(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      const x = rect.left + rect.width / 2;
      let nearest = -1;
      let distance = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const nextDistance = Math.abs(centers[i] - x);
        if (nextDistance < distance) { distance = nextDistance; nearest = i; }
      }
      if (nearest >= 0) cells[nearest].push({ y: rect.top, x: rect.left, value });
    }
    return cells.map(parts => parts.sort((a, b) => a.y - b.y || a.x - b.x)
      .map(part => part.value).filter((value, index, all) => index === 0 || value !== all[index - 1])
      .join(' ').replace(/\s+/g, ' ').trim());
  }

  function metric(text, integer = false) {
    let value = (text || '').replace(/\u00a0/g, ' ').trim();
    if (!value || /^(?:--+|—|–|n\/a)$/i.test(value)) return 0;
    let scale = 1;
    const suffix = value.match(/\s*([kmb])\s*$/i)?.[1]?.toLowerCase();
    if (suffix) scale = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : 1e9;
    value = value.replace(/\s*[kmb]\s*$/i, '').replace(/[\s\p{L}\p{Sc}%₫]/gu, '');
    value = value.replace(/[^\d.,+-]/g, '');
    if (!value || value === '-' || value === '+') return null;
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? ',' : '.';
      const thousands = decimal === ',' ? '.' : ',';
      value = value.split(thousands).join('').replace(decimal, '.');
    } else if (comma >= 0 || dot >= 0) {
      const separator = comma >= 0 ? ',' : '.';
      const tail = value.length - value.lastIndexOf(separator) - 1;
      if (tail === 3 && value.split(separator).length > 1) value = value.split(separator).join('');
      else value = value.replace(separator, '.');
    }
    const parsed = Number(value) * scale;
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return integer ? Math.round(parsed) : Number(parsed.toFixed(4));
  }

  function parseDate(value) {
    const text = (value || '').trim();
    let match = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    match = text.match(/\b(\d{1,2})\s+(?:thang|thg|month)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
  }

  function selectedDatesFromUrl() {
    const url = new URL(location.href);
    const raw = url.searchParams.get('date') || '';
    return [...raw.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map(match => match[0]).sort();
  }

  function campaignId(row) {
    const keys = ['campaign_id', 'campaignId', 'selected_campaign_id', 'selected_campaign_ids'];
    for (const link of row.querySelectorAll('a[href]')) {
      try {
        const url = new URL(link.href, location.href);
        for (const key of keys) {
          const value = url.searchParams.get(key);
          if (value && /^\d+$/.test(value)) return value;
        }
      } catch { /* Ignore non-URL links. */ }
    }
    for (const element of [row, ...row.querySelectorAll('*')]) {
      for (const key of ['data-campaign-id', 'data-id']) {
        const value = element.getAttribute?.(key);
        if (value && /^\d+$/.test(value)) return value;
      }
    }
    return null;
  }

  function stableNameKey(name) {
    let hash = 2166136261;
    for (const char of norm(name)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return `name:${(hash >>> 0).toString(16)}`;
  }

  function accountInfo(accountId) {
    const choices = Array.from(document.querySelectorAll('[role="combobox"]'))
      .map(element => (element.innerText || element.getAttribute('aria-label') || '').trim())
      .filter(value => value && value.includes(accountId));
    const accountName = choices[0]?.replace(new RegExp(`\\s*\\(?${accountId}\\)?\\s*`), '').trim() || '';
    const currencyMatch = (document.body?.innerText || '').match(/\b(VND|USD|EUR|CAD|AUD|GBP|SGD|THB|IDR|MYR|PHP)\b|₫/i);
    const currency = currencyMatch?.[0]?.toUpperCase() === '₫' ? 'VND' : currencyMatch?.[0]?.toUpperCase() || null;
    return { accountName, currency };
  }

  function extract() {
    const accountId = new URL(location.href).searchParams.get('act')?.replace(/^act_/, '') || '';
    if (!/^\d+$/.test(accountId)) throw new Error('Không đọc được ID tài khoản từ URL Ads Manager.');
    const table = document.querySelector('[role="table"]');
    if (!table) throw new Error('Chưa thấy bảng chiến dịch; chờ Ads Manager tải xong.');
    const headers = tableHeaders(table);
    const index = expression => headers.findIndex(header => expression.test(header.label));
    const campaignIndex = index(/\b(campaign|chien dich)\b/);
    const spendIndex = index(/(amount spent|spent|so tien da chi tieu|chi tieu)/);
    const impressionsIndex = index(/(impressions|luot hien thi)/);
    const reachIndex = index(/(reach|nguoi tiep can|pham vi tiep can)/);
    const clicksIndex = index(/(clicks|luot nhap)/);
    const dateIndex = index(/^(day|date|ngay|report date|ngay bao cao)$/);
    if (campaignIndex < 0 || spendIndex < 0) {
      throw new Error('Bảng cần có cột Chiến dịch và Số tiền đã chi tiêu.');
    }
    const rows = findRowContainer(table);
    if (!rows.length) throw new Error('Chưa đọc được dòng chiến dịch trong bảng.');

    const urlDates = selectedDatesFromUrl();
    const account = accountInfo(accountId);
    const parsed = [];
    for (const row of rows) {
      const cells = cellsForRow(row, headers);
      const campaignName = (cells[campaignIndex] || '').replace(/\b(chinh sua|edit)\b/gi, '').trim();
      if (!campaignName || norm(campaignName) === 'chien dich') continue;
      const reportDate = dateIndex >= 0 ? parseDate(cells[dateIndex]) : (urlDates.length === 1 ? urlDates[0] : null);
      if (!reportDate) throw new Error('Cần chọn một ngày hoặc bật Phân tích theo thời gian: Ngày trong Ads Manager.');
      const spend = metric(cells[spendIndex]);
      if (spend === null) throw new Error('Không đọc được chi tiêu của một chiến dịch. Hãy mở cột Số tiền đã chi tiêu.');
      const id = campaignId(row);
      parsed.push({
        account_id: accountId,
        campaign_key: id || stableNameKey(campaignName),
        campaign_id: id,
        report_date: reportDate,
        account_name: account.accountName,
        campaign_name: campaignName.slice(0, 500),
        currency: account.currency,
        spend,
        impressions: impressionsIndex >= 0 ? metric(cells[impressionsIndex], true) : null,
        reach: reachIndex >= 0 ? metric(cells[reachIndex], true) : null,
        clicks: clicksIndex >= 0 ? metric(cells[clicksIndex], true) : null,
        cpc: null,
        cpm: null,
        ctr: null
      });
    }
    if (!parsed.length) throw new Error('Bảng chưa có chiến dịch để nhập.');
    const dates = parsed.map(row => row.report_date).sort();
    const since = dates[0];
    const until = dates[dates.length - 1];
    if (Date.parse(until) - Date.parse(since) > 30 * 86400000) {
      throw new Error('Mỗi lần nhập tối đa 31 ngày. Hãy rút ngắn khoảng ngày.');
    }
    return { account_id: accountId, account_name: account.accountName, currency: account.currency, since, until, rows: parsed };
  }

  async function scan() {
    if (!location.pathname.includes('/manage/campaigns')) return;
    try {
      const payload = extract();
      const signature = JSON.stringify(payload);
      if (seen.has(signature)) return;
      seen.add(signature);
      status(`Đã đọc ${payload.rows.length} dòng, đang đồng bộ…`);
      const response = await chrome.runtime.sendMessage({ type: 'META_CAPTURE_ROWS', payload });
      if (response?.ok) status(response.message || 'Đã gửi vào FE-vinhdanh.');
      else status(response?.message || 'Đang chờ FE-vinhdanh.', true);
    } catch (error) {
      status(error instanceof Error ? error.message : 'Chưa đọc được dữ liệu.', true);
    }
  }

  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 1400);
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.every(mutation => mutation.target?.parentElement?.closest?.(`#${PANEL_ID}`))) return;
    scheduleScan();
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener('scroll', scheduleScan, true);
  window.addEventListener('popstate', scheduleScan);
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'META_SYNC_STATUS') status(message.detail || message.status, message.status === 'waiting');
  });
  scheduleScan();
})();
