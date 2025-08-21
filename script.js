let bucketItems = JSON.parse(localStorage.getItem('bucketItems') || '[]');
let currentViewItems = [...bucketItems];

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwgIl52a0HtHfDy3E1CqI35-KjvSl6hJCZ74MuBAtix77pFtIF373msT8iijGMDAvfqxA/exec'; // 最新 URL に置き換え

// ---------- Cloud 送信 ----------
function sendToCloud(item, action='add') {
  fetch(`${SHEET_API_URL}?action=${action}${action==='delete' ? '&id='+item.id : ''}`, {
    method: 'POST',
    body: JSON.stringify(item),
    headers: { 'Content-Type': 'application/json' },
    mode: 'no-cors' // レスポンスは無視
  }).catch(err => console.error('Cloud error:', err));
}

// ---------- Cloud Fetch ----------
function fetchFromCloud() {
  showLoading('クラウドから読み込み中...');
  fetch(SHEET_API_URL, { method: 'GET', mode: 'no-cors' })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) throw new Error('クラウドデータ形式が不正です');
      bucketItems = data;
      saveToLocal();
      renderItems();
      updateProgress();
      hideLoading();
    })
    .catch(err => {
      console.error('Cloud fetch error:', err);
      hideLoading();
    });
}

// ---------- Local Storage ----------
function saveToLocal() {
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
}

// ---------- CRUD ----------
function addItem(item) {
  item.updatedAt = new Date().toISOString();
  bucketItems.push(item);
  saveToLocal();
  sendToCloud(item, 'add');
  renderItems(bucketItems);
}

function editItem(id, field, value) {
  const item = bucketItems.find(i => i.id === id);
  if (!item) return;
  item[field] = value.trim();
  item.updatedAt = new Date().toISOString();
  saveToLocal();
  sendToCloud(item, 'update');
  renderItems(bucketItems);
}

function deleteItem(id) {
  bucketItems = bucketItems.filter(i => i.id !== id);
  saveToLocal();
  sendToCloud({ id }, 'delete');
  renderItems(bucketItems);
}

function toggleDone(id, checked) {
  const item = bucketItems.find(i => i.id === id);
  if (!item) return;
  item.done = checked;
  item.completedAt = checked ? new Date().toISOString() : null;
  item.updatedAt = new Date().toISOString();
  saveToLocal();
  sendToCloud(item, 'update');
  updateProgress();
  renderItems(currentViewItems);
}

// ---------- Progress ----------
function updateProgress() {
  const total = bucketItems.length;
  const doneCount = bucketItems.filter(i => i.done).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  document.getElementById('progress-text').textContent = `${doneCount} / ${total}（${percent}%)`;
  const fill = document.getElementById('progress-fill');
  fill.style.width = `${percent}%`;
  fill.style.backgroundColor = percent < 40 ? 'red' : percent < 80 ? 'orange' : 'green';
}

// ---------- Rendering ----------
function renderItems(items = bucketItems) {
  currentViewItems = [...items];
  const container = document.getElementById('bucket-container');
  container.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bucket-card';
    card.innerHTML = `
      <label>
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleDone('${item.id}', this.checked)">
        <span contenteditable="true" onblur="editItem('${item.id}', 'title', this.textContent)" class="${item.done ? 'done' : ''}">${item.title}</span>
      </label>
      <p><small>メモ: <span contenteditable="true" onblur="editItem('${item.id}', 'category', this.textContent)">${item.category}</span></small></p>
      ${item.completedAt ? `<p><small>達成日: ${new Date(item.completedAt).toLocaleDateString()}</small></p>` : ''}
      <button onclick="deleteItem('${item.id}')">削除</button>
    `;
    container.appendChild(card);
  });
}

// ---------- Sorting & Filtering ----------
function applyFilter(type) {
  let filtered = [];
  if (type === 'learned') filtered = bucketItems.filter(i => i.done);
  else if (type === 'unlearned') filtered = bucketItems.filter(i => !i.done);
  else filtered = bucketItems;
  renderItems(filtered);
}

function shuffle() {
  const shuffled = [...currentViewItems].sort(() => Math.random() - 0.5);
  renderItems(shuffled);
}

function sort_oldest() {
  const sorted = [...currentViewItems].sort((a, b) => (new Date(a.completedAt || 0) - new Date(b.completedAt || 0)));
  renderItems(sorted);
}

function sort_newest() {
  const sorted = [...currentViewItems].sort((a, b) => (new Date(b.completedAt || 0) - new Date(a.completedAt || 0)));
  renderItems(sorted);
}

function sortItems(type) {
  let sorted = [...bucketItems];
  if (type === 'done') sorted.sort((a, b) => b.done - a.done);
  else if (type === 'category') sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  else if (type === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
  renderItems(sorted);
}

// ---------- Add Section ----------
function showSection(name) {
  document.getElementById('add-section').style.display = name === 'add' ? 'block' : 'none';
}

// ---------- Backup ----------
function exportBackup() {
  const dataStr = JSON.stringify(bucketItems, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bucket_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  showLoading('インポート中...');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('形式が不正です');
      bucketItems = imported;
      saveToLocal();
      renderItems();
      updateProgress();
      imported.forEach(item => sendToCloud(item, 'add'));
      hideLoading();
      alert('インポートとクラウド同期が完了しました！');
    } catch (err) {
      hideLoading();
      alert('インポートに失敗しました：' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- Loading ----------
function showLoading(message = '読み込み中...') {
  const loading = document.getElementById('loading');
  loading.textContent = message;
  loading.style.display = 'block';
}
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ---------- Event Listeners ----------
document.getElementById('add-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const title = document.getElementById('new-title').value.trim();
  const category = document.getElementById('new-category').value.trim();
  if (!title) return;
  const id = 'item-' + Date.now();
  addItem({ id, title, category, done: false });
  this.reset();
});

// ---------- Initialization ----------
window.addEventListener('DOMContentLoaded', () => {
  fetchFromCloud();  // 追加：クラウドデータを取得して初期表示
  renderItems();
  updateProgress();
});
