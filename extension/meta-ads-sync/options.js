const choices = new Set(['https://fe-vinhdanh.vercel.app', 'http://localhost:3000']);
const originField = document.getElementById('origin');
const status = document.getElementById('status');

chrome.storage.local.get('metaCampaignSyncSettings').then(result => {
  originField.value = result.metaCampaignSyncSettings?.crmOrigin || 'https://fe-vinhdanh.vercel.app';
});

document.getElementById('save').addEventListener('click', async () => {
  const origin = originField.value.trim().replace(/\/$/, '');
  if (!choices.has(origin)) {
    status.textContent = 'Chỉ hỗ trợ FE-vinhdanh production hoặc localhost:3000.';
    return;
  }
  await chrome.storage.local.set({ metaCampaignSyncSettings: { crmOrigin: origin } });
  status.textContent = 'Đã lưu địa chỉ FE-vinhdanh.';
});
