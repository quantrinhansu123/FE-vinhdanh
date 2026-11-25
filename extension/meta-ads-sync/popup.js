const status = document.getElementById('status');
chrome.runtime.sendMessage({ type: 'META_GET_STATUS' }).then(result => {
  status.textContent = result.pending
    ? `${result.pending} dòng đang chờ ở ${result.scopes} phạm vi tài khoản/ngày.`
    : 'Không có dữ liệu đang chờ.';
}).catch(() => { status.textContent = 'Không đọc được trạng thái extension.'; });

document.getElementById('sync').addEventListener('click', async () => {
  status.textContent = 'Đang đồng bộ…';
  const result = await chrome.runtime.sendMessage({ type: 'META_FLUSH_QUEUE' });
  status.textContent = result.message || (result.ok ? 'Đã đồng bộ.' : 'Chưa đồng bộ được.');
});
document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
