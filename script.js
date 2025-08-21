let bucketItems = JSON.parse(localStorage.getItem('bucketItems') || '[]'); 
let currentViewItems = [...bucketItems];

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzZ4OAe_zMDT8pP1NFwq6osUj_9gDq2zH3HUYrA4VYIehDo2ZwEKbs60OGDz9ZQZmDR2A/exec'; // 最新 URL に置き換え

function sendToCloud(item, method = "POST") {
  return fetch(SHEET_API_URL, {
    method: method,
    body: JSON.stringify(item),
    headers: { 'Content-Type': 'application/json' },
    mode: 'no-cors' // ← これで CORS に対応
  })
  .then(res => res.json())
  .catch(err => console.error('Cloud error:', err));
}

function fetchFromCloud(callback) {
  fetch(SHEET_API_URL, { mode: 'no-cors' })
    .then(res => res.json())
    .then(data => callback(data))
    .catch(err => console.error('Cloud fetch error:', err));
}

function deleteFromCloud(id) {
  return fetch(`${SHEET_API_URL}?id=${id}`, { method: 'DELETE', mode: 'cors' })
    .then(res => res.json())
    .catch(err => console.error('Cloud delete error:', err));
}

window.addEventListener('DOMContentLoaded', () => {
  showLoading('クラウドから読み込み中...');
  fetchFromCloud(data => {
    bucketItems = data;
    saveToLocal();
    renderItems();
    updateProgress();
    hideLoading();
  });
});

function saveToLocal() {
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
}

function syncToCloud(item) {
  return sendToCloud(item, "POST");
}

function updateCloud(item) {
  return sendToCloud(item, "PUT");
}

// 例：追加
function addItem(item) {
  item.updatedAt = new Date().toISOString();
  bucketItems.push(item);
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
  sendToCloud(item, 'POST'); // 確実に追加
  renderItems(bucketItems);
}

// 例：削除
function deleteItem(id) {
  bucketItems = bucketItems.filter(i => i.id !== id);
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
  fetch(`${SHEET_API_URL}?id=${id}`, { method: 'DELETE', mode: 'no-cors' });
  renderItems(bucketItems);
}

// 例：更新
function editItem(id, field, value) {
  const item = bucketItems.find(i => i.id === id);
  if (!item) return;
  item[field] = value.trim();
  item.updatedAt = new Date().toISOString();
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
  sendToCloud(item, 'PUT'); // 更新
  renderItems(bucketItems);
}

function toggleDone(id, checked) {
  const item = bucketItems.find(i => i.id === id);
  if (item) {
    item.done = checked;
    item.completedAt = checked ? new Date().toISOString() : null;
    item.updatedAt = new Date().toISOString();
    saveToLocal();
    updateCloud(item);
  }
  updateProgress();
  renderItems(currentViewItems);
}

function updateProgress() {
  const total = bucketItems.length;
  const doneCount = bucketItems.filter(i => i.done).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  document.getElementById('progress-text').textContent = `${doneCount} / ${total}（${percent}%)`;
  const fill = document.getElementById('progress-fill');
  fill.style.width = `${percent}%`;
  fill.style.backgroundColor = percent < 40 ? 'red' : percent < 80 ? 'orange' : 'green';
}

function applyFilter(type) {
  let filtered = [];

  if (type === 'learned') {
    filtered = bucketItems.filter(i => i.done);
  } else if (type === 'unlearned') {
    filtered = bucketItems.filter(i => !i.done);
  } else {
    filtered = bucketItems;
  }

  renderItems(filtered);
}

function shuffle() {
  const shuffled = [...currentViewItems].sort(() => Math.random() - 0.5);
  renderItems(shuffled);
}

function sort_oldest() {
  const sorted = [...currentViewItems].sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
    const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
    return dateA - dateB;
  });
  renderItems(sorted);
}

function sort_newest() {
  const sorted = [...currentViewItems].sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
    const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
    return dateB - dateA;
  });
  renderItems(sorted);
}

function renderItems(items = bucketItems) {
  currentViewItems = [...items]; // ← 表示中リストを保存
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

document.getElementById('add-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const title = document.getElementById('new-title').value.trim();
  const category = document.getElementById('new-category').value.trim();
  const id = 'item-' + Date.now();

  if (!title) return;

  addItem({ id, title, category, done: false });
  this.reset();
});

function sortItems(type) {
  let sorted = [...bucketItems];
  if (type === 'done') {
    sorted.sort((a, b) => b.done - a.done);
  } else if (type === 'category') {
    sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  } else if (type === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
  renderItems(sorted);
}

function showSection(name) {
  document.getElementById('add-section').style.display = name === 'add' ? 'block' : 'none';
}

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

      imported.forEach(item => syncToCloud(item)); // クラウドに送信
      autoSync(); // ← インポート後にクラウドと整合

      alert('インポートとクラウド同期が完了しました！');
    } catch (err) {
      alert('インポートに失敗しました：' + err.message);
    }
  };
  reader.readAsText(file);
}

function showLoading(message = '読み込み中...') {
  const loading = document.getElementById('loading');
  loading.textContent = message;
  loading.style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

function autoSync() {
  showLoading('クラウドと差分同期中...');

  fetchFromCloud(cloudData => {
    const cloudMap = Object.fromEntries(cloudData.map(item => [item.id, item]));
    const localMap = Object.fromEntries(bucketItems.map(item => [item.id, item]));

    const merged = [];

    const allIds = new Set([...Object.keys(cloudMap), ...Object.keys(localMap)]);
    allIds.forEach(id => {
      const local = localMap[id];
      const cloud = cloudMap[id];

      if (!local) {
        // ローカルにない → クラウドから追加
        merged.push(cloud);
      } else if (!cloud) {
        // クラウドにない → ローカルから追加
        merged.push(local);
        syncToCloud(local);
      } else {
        // 両方ある → 更新日時で比較
        const localDate = new Date(local.updatedAt || 0);
        const cloudDate = new Date(cloud.updatedAt || 0);
        if (localDate > cloudDate) {
          merged.push(local);
          updateCloud(local);
        } else {
          merged.push(cloud);
        }
      }
    });

    bucketItems = merged;
    saveToLocal();
    renderItems();
    updateProgress();
    hideLoading();
    console.log('差分同期が完了しました');
  });
}
