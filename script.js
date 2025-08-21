let bucketItems = JSON.parse(localStorage.getItem('bucketItems') || '[]');
let currentViewItems = [...bucketItems]; // ← 表示中のリストを保持

window.addEventListener('DOMContentLoaded', () => {
  renderItems();
  updateProgress();
});

function saveToLocal() {
  localStorage.setItem('bucketItems', JSON.stringify(bucketItems));
}

function addItem(item) {
  bucketItems.push(item);
  saveToLocal();
  renderItems();
  updateProgress();
}

function editItem(index, field, value) {
  bucketItems[index][field] = value.trim();
  saveToLocal();
  renderItems();
}

function deleteItem(index) {
  if (!confirm('この項目を削除しますか？')) return;
  bucketItems.splice(index, 1);
  saveToLocal();
  renderItems();
  updateProgress();
}

function toggleDone(id, checked) {
  const item = bucketItems.find(i => i.id === id);
  if (item) {
    item.done = checked;
    item.completedAt = checked ? new Date().toISOString() : null; // ← 日付を記録 or 削除
  }
  saveToLocal();
  updateProgress();
  renderItems(currentViewItems); // ← 表示更新
}

function updateProgress() {
  const total = bucketItems.length;
  const doneCount = bucketItems.filter(i => i.done).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  document.getElementById('progress-text').textContent = `${percent}%`;
  document.getElementById('progress-fill').style.width = `${percent}%`;
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