// ===== Enhanced password lock with 6-hour session =====
(function(){
  const PASSWORD = 'ETM2025!';
  const screen = document.getElementById('lock-screen');
  if (!screen) return;

  const btn = document.getElementById('lock-btn');
  const input = document.getElementById('lock-pass');
  const msg = document.getElementById('lock-msg');
  const LS_KEY = 'etmAdminAuth';

  const encode = (t)=> btoa(unescape(encodeURIComponent(t)));
  const decode = (t)=> decodeURIComponent(escape(atob(t)));

  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const data = JSON.parse(decode(stored));
      if (Date.now() < data.expiry) {
        screen.remove();
        return;
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }
  } catch { /* ignore */ }

  btn.addEventListener('click', check);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') check(); });

  function check(){
    if (input.value === PASSWORD){
      const expiry = Date.now() + 6*60*60*1000;
      const data = encode(JSON.stringify({ expiry }));
      localStorage.setItem(LS_KEY, data);
      sessionStorage.setItem('etmAdminUnlocked','true');
      screen.classList.add('fade');
      setTimeout(()=>screen.remove(),300);
    } else {
      msg.textContent = 'Incorrect password. Try again.';
      input.value = '';
      input.focus();
    }
  }

  window.etmLogout = function(){
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem('etmAdminUnlocked');
    location.reload();
  };
})();

// ===== Flash Offers Admin =====
const LS_KEY = 'ETM_FLASH_OFFERS';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const tableBody = $('#offers-tbody');
const form = $('#offer-form');
const btnNew = $('#btn-new');
const btnImport = $('#btn-import');
const fileImport = $('#file-import');
const btnExport = $('#btn-export');
const btnSave = $('#btn-save');
const btnPublish = $('#btn-publish');
const btnCancel = $('#btn-cancel');
const btnDelete = $('#btn-delete');
const formTitle = $('#form-title');

let offers = [];

(async function init(){
  const cached = localStorage.getItem(LS_KEY);
  if (cached) {
    try { offers = JSON.parse(cached); }
    catch { offers = []; }
  }

  if (!offers?.length) {
    try {
      const res = await fetch('../flash-offers.json', {cache:'no-store'});
      if (res.ok) {
        offers = await res.json();
      }
    } catch (e) {
      console.warn('No flash-offers.json found or cannot fetch; starting empty.');
      offers = [];
    }
  }

  renderTable();
  resetForm();
})();

function renderTable(){
  tableBody.innerHTML = '';
  if (!offers.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '7');
    td.className = 'muted';
    td.textContent = 'No offers yet. Click ';
    const strong = document.createElement('strong');
    strong.textContent = '+ New Offer';
    td.appendChild(strong);
    td.appendChild(document.createTextNode(' to create one.'));
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }
  offers.forEach((o, i) => {
    const tr = document.createElement('tr');

    // Column 1: Index
    const td1 = document.createElement('td');
    td1.textContent = i + 1;
    tr.appendChild(td1);

    // Column 2: Badge
    const td2 = document.createElement('td');
    if (o.badge) {
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = o.badge;
      td2.appendChild(span);
    }
    tr.appendChild(td2);

    // Column 3: Title
    const td3 = document.createElement('td');
    td3.textContent = o.title || '';
    tr.appendChild(td3);

    // Column 4: Description
    const td4 = document.createElement('td');
    td4.textContent = o.desc || '';
    tr.appendChild(td4);

    // Column 5: Link
    const td5 = document.createElement('td');
    const link = document.createElement('a');
    link.href = o.link || '#';
    link.target = '_blank';
    link.textContent = o.link || '';
    td5.appendChild(link);
    tr.appendChild(td5);

    // Column 6: Deadline
    const td6 = document.createElement('td');
    td6.textContent = o.deadline || '';
    tr.appendChild(td6);

    // Column 7: Edit button
    const td7 = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.setAttribute('data-edit', i);
    btn.textContent = 'Edit';
    btn.addEventListener('click', () => loadIntoForm(i));
    td7.appendChild(btn);
    tr.appendChild(td7);

    tableBody.appendChild(tr);
  });
}

function escapeHTML(s){
  return (s ?? '').toString().replace(/[&<>"']/g, m => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]
  ));
}

function resetForm(){
  formTitle.textContent = 'Add / Edit Offer';
  form.index.value = -1;
  form.badge.value = '';
  form.title.value = '';
  form.desc.value = '';
  form.link.value = '';
  form.deadlineLocal.value = '';
  form.deadlineISO.value = '';
  btnDelete.style.display = 'none';
}

function loadIntoForm(index){
  const o = offers[index];
  if (!o) return;
  formTitle.textContent = `Editing #${index+1}`;
  form.index.value = index;
  form.badge.value = o.badge || '';
  form.title.value = o.title || '';
  form.desc.value = o.desc || '';
  form.link.value = o.link || '';
  form.deadlineISO.value = o.deadline || '';

  const dt = toLocalDateTimeInput(o.deadline);
  form.deadlineLocal.value = dt || '';
  btnDelete.style.display = 'inline-block';
}

function toLocalDateTimeInput(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const two = n => n < 10 ? '0'+n : ''+n;
  const y = d.getFullYear();
  const m = two(d.getMonth()+1);
  const day = two(d.getDate());
  const h = two(d.getHours());
  const min = two(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

btnNew.addEventListener('click', () => resetForm());
btnCancel.addEventListener('click', () => resetForm());

btnDelete.addEventListener('click', () => {
  const idx = parseInt(form.index.value, 10);
  if (idx >= 0 && idx < offers.length) {
    if (confirm('Delete this offer?')) {
      offers.splice(idx, 1);
      persist();
      renderTable();
      resetForm();
    }
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = getFormData();
  if (!data.title || !data.desc || !data.link) {
    alert('Please fill Title, Description and Link.');
    return;
  }
  const idx = parseInt(form.index.value, 10);
  if (idx >= 0 && idx < offers.length) {
    offers[idx] = data;
  } else {
    offers.push(data);
  }
  persist();
  renderTable();
  resetForm();
});

btnSave.addEventListener('click', () => {
  persist();
  alert('Saved to browser (localStorage). Remember to Download JSON to publish!');
});

btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(offers, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flash-offers.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

btnPublish.addEventListener('click', async () => {
  const text = JSON.stringify(offers, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert('JSON copied to clipboard. Now replace flash-offers.json in Replit.');
  } catch {
    alert('Could not copy automatically. Use Download JSON instead.');
  }
});

btnImport.addEventListener('click', () => fileImport.click());
fileImport.addEventListener('change', async () => {
  const file = fileImport.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Invalid format: expected an array.');
    offers = imported;
    persist();
    renderTable();
    resetForm();
    alert('Imported successfully from JSON file.');
  } catch (e) {
    alert('Import failed: ' + e.message);
  } finally {
    fileImport.value = '';
  }
});

function getFormData(){
  const badge = form.badge.value.trim();
  const title = form.title.value.trim();
  const desc = form.desc.value.trim();
  const link = form.link.value.trim();
  let deadline = form.deadlineISO.value.trim();

  if (!deadline && form.deadlineLocal.value) {
    const local = new Date(form.deadlineLocal.value);
    if (!isNaN(local.getTime())) {
      const iso = toISOWithOffset(local);
      deadline = iso;
    }
  }

  return { badge, title, desc, link, deadline };
}

function toISOWithOffset(date){
  const pad = (n)=> (n<10?'0'+n:n);
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const mm = pad(Math.abs(tzOffsetMin) % 60);
  const year = date.getFullYear();
  const month = pad(date.getMonth()+1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hour}:${min}:${sec}${sign}${hh}:${mm}`;
}

function persist(){
  localStorage.setItem(LS_KEY, JSON.stringify(offers));
}
