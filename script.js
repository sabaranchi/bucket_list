let bucketItems = JSON.parse(localStorage.getItem('bucketItems') || '[]');
let currentViewItems = [...bucketItems]; // ← 表示中のリストを保持

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbx_AN8APvBww5eymEhbl3Jq3h2n7M5gpnv0WoGw-2j1VyAu8Makal8hpsakvu9HYsH3ew/exec';
window.addEventListener('DOMContentLoaded', () => {
  showLoading('クラウドから読み込み中...');
  fetchFromCloud(data => {
    bucketItems = data;
    saveToLocal(); // ← ローカルにも保存
    renderItems();
    updateProgress();
    hideLoading();
  });
});

function saveToLocal() {
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
}

function syncToCloud(item) {
  const formData = new URLSearchParams();
  for (const key in item) {
    formData.append(key, item[key]);
  }

  fetch(SHEET_API_URL, {
    method: 'POST',
    body: formData // ← JSONではなくURLエンコード形式
  });
}

function updateCloud(item) {
  const formData = new URLSearchParams();
  for (const key in item) {
    formData.append(key, item[key]);
  }

  fetch(SHEET_API_URL, {
    method: 'POST', // ← PUTはプリフライトが発生するのでPOSTに統一
    body: formData
  });
}

function deleteFromCloud(id) {
  fetch(`${SHEET_API_URL}?action=delete&id=${id}`);
}

function fetchFromCloud(callback) {
  fetch(SHEET_API_URL)
    .then(res => res.json())
    .then(data => callback(data));
}


function addItem(item) {
  item.updatedAt = new Date().toISOString();
  bucketItems.push(item);
  saveToLocal();
  syncToCloud(item);
  renderItems();
  updateProgress();
}

function editItem(index, field, value) {
  bucketItems[index][field] = value.trim();
  bucketItems[index].updatedAt = new Date().toISOString(); // ← 更新日時
  saveToLocal();
  updateCloud(bucketItems[index]);
  renderItems();
}

function deleteItem(index) {
  if (!confirm('この項目を削除しますか？')) return;
  const id = bucketItems[index].id; // ← これが必要！
  bucketItems.splice(index, 1);
  saveToLocal();
  deleteFromCloud(id);
  renderItems();
  updateProgress();
}

function toggleDone(id, checked) {
  const item = bucketItems.find(i => i.id === id);
  if (item) {
    item.done = checked;
    item.completedAt = checked ? new Date().toISOString() : null; // ← 日付を記録 or 削除
    item.updatedAt = new Date().toISOString(); // ← 更新日時
  }
  saveToLocal();
  updateProgress();
  renderItems(currentViewItems); // ← 表示更新
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
  currentViewItems = [...items]; // ← 表示中のリストを保存

  const container = document.getElementById('bucket-container');
  container.innerHTML = '';

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'bucket-card';
    card.innerHTML = `
      <label>
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleDone('${item.id}', this.checked)">
        <span contenteditable="true" onblur="editItem(${index}, 'title', this.textContent)" class="${item.done ? 'done' : ''}">${item.title}</span>
      </label>
      <p><small>メモ: <span contenteditable="true" onblur="editItem(${index}, 'category', this.textContent)">${item.category}</span></small></p>
      ${item.completedAt ? `<p><small>達成日: ${new Date(item.completedAt).toLocaleDateString()}</small></p>` : ''}
      <button onclick="deleteItem(${index})">削除</button>
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