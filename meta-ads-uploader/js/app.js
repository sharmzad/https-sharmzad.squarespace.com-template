/* =========================================================================
   Meta Ads Bulk Uploader
   Backend-free. Talks directly to the Meta Marketing (Graph) API from the
   browser using a user-supplied access token. Nothing is sent anywhere else.
   ========================================================================= */

'use strict';

const $ = (id) => document.getElementById(id);

const State = {
  token: '',
  apiVersion: 'v23.0',
  actId: '',            // ad account id WITHOUT the act_ prefix
  pages: [],            // [{id,name,access_token,ig}]
  assets: [],           // [{id,file,kind:'image'|'video',url}]
  thumbFile: null,      // custom video thumbnail File
  publishing: false,
};

const CTA_OPTIONS = [
  'LEARN_MORE','SHOP_NOW','SIGN_UP','SUBSCRIBE','BOOK_TRAVEL','DOWNLOAD',
  'GET_OFFER','GET_QUOTE','CONTACT_US','APPLY_NOW','ORDER_NOW','SEE_MENU',
  'MESSAGE_PAGE','WHATSAPP_MESSAGE','DONATE_NOW','PLAY_GAME','WATCH_MORE',
  'GET_DIRECTIONS','CALL_NOW','NO_BUTTON'
];

/* ---------------------------------------------------------------- Graph API */

const G = (path) => `https://graph.facebook.com/${State.apiVersion}/${path}`;

// GET helper — returns parsed JSON or throws an Error with the FB message.
async function fbGet(path, params = {}) {
  const u = new URL(G(path));
  u.searchParams.set('access_token', State.token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'Graph API error');
  return j;
}

// POST helper — `params` are form-encoded; objects/arrays are JSON-stringified.
// Pass a File under a key to send multipart (used for media uploads).
async function fbPost(path, params = {}) {
  const hasFile = Object.values(params).some((v) => v instanceof File);
  let body;
  if (hasFile) {
    body = new FormData();
    body.append('access_token', State.token);
    for (const [k, v] of Object.entries(params)) {
      body.append(k, v instanceof File ? v : (typeof v === 'object' ? JSON.stringify(v) : v));
    }
  } else {
    body = new URLSearchParams();
    body.append('access_token', State.token);
    for (const [k, v] of Object.entries(params)) {
      body.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
  }
  const r = await fetch(G(path), { method: 'POST', body });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'Graph API error');
  return j;
}

const act = () => `act_${State.actId}`;

/* ------------------------------------------------------------------ Connect */

async function connect() {
  const btn = $('connectBtn');
  const msg = $('connMsg');
  State.token = $('token').value.trim();
  State.apiVersion = ($('apiVersion').value.trim() || 'v23.0').replace(/^([0-9])/, 'v$1');
  if (!State.token) return showMsg(msg, 'Paste an access token first.', 'err');

  btn.disabled = true; btn.textContent = 'Connecting…';
  try {
    const me = await fbGet('me', { fields: 'name' });
    const accts = await fbGet('me/adaccounts', {
      fields: 'name,account_id,account_status,currency,amount_spent', limit: 200,
    });
    const sel = $('adAccount');
    sel.innerHTML = '';
    (accts.data || []).forEach((a) => {
      const o = document.createElement('option');
      o.value = a.account_id;
      o.textContent = `${a.name} · ${a.currency} · ${a.account_id}`;
      sel.appendChild(o);
    });
    sel.disabled = false;

    if (!accts.data || !accts.data.length) {
      showMsg(msg, `Connected as ${me.name}, but no ad accounts are visible to this token.`, 'err');
    } else {
      State.actId = sel.value;
      showMsg(msg, `Connected as <b>${me.name}</b> · ${accts.data.length} ad account(s).`, 'ok');
      setBadge(true);
      if ($('rememberToken').checked) saveToken();
      await loadAccountData();
      enableStep('step-dest'); enableStep('step-creatives');
      enableStep('step-copy'); enableStep('step-publish');
      refreshSummary();
    }
  } catch (e) {
    showMsg(msg, 'Could not connect: ' + e.message, 'err');
    setBadge(false);
  } finally {
    btn.disabled = false; btn.textContent = 'Connect';
  }
}

// Load pages, campaigns for the currently selected ad account.
async function loadAccountData() {
  // Pages the user manages (with their page tokens + linked IG accounts).
  try {
    const pages = await fbGet('me/accounts', {
      fields: 'name,access_token,instagram_business_account{id,username}', limit: 200,
    });
    State.pages = pages.data || [];
  } catch { State.pages = []; }

  const pageSel = $('page');
  pageSel.innerHTML = '<option value="">—</option>';
  State.pages.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name; pageSel.appendChild(o);
  });
  syncIgForPage();

  await loadCampaigns();
}

function syncIgForPage() {
  const p = State.pages.find((x) => x.id === $('page').value);
  const ig = $('igAccount');
  ig.innerHTML = '';
  if (p && p.instagram_business_account) {
    const o = document.createElement('option');
    o.value = p.instagram_business_account.id;
    o.textContent = `@${p.instagram_business_account.username || p.instagram_business_account.id} (linked)`;
    ig.appendChild(o);
  }
  const none = document.createElement('option');
  none.value = ''; none.textContent = 'Use Facebook Page identity only';
  ig.appendChild(none);
}

async function loadCampaigns() {
  const sel = $('campaign');
  sel.innerHTML = '<option value="">Select a campaign…</option>';
  try {
    const c = await fbGet(`${act()}/campaigns`, {
      fields: 'name,objective,effective_status', limit: 500,
    });
    (c.data || []).forEach((x) => {
      const o = document.createElement('option');
      o.value = x.id;
      o.textContent = `${x.name} · ${x.objective || ''} ${x.effective_status === 'ACTIVE' ? '🟢' : '⚪'}`;
      sel.appendChild(o);
    });
  } catch (e) { /* leave empty */ }
}

async function loadAdSets(campaignId) {
  const sel = $('adset');
  sel.innerHTML = '<option value="">Select an ad set…</option>';
  $('cloneAdsetBtn').disabled = true;
  if (!campaignId) return;
  try {
    const a = await fbGet(`${campaignId}/adsets`, { fields: 'name,effective_status', limit: 500 });
    (a.data || []).forEach((x) => {
      const o = document.createElement('option');
      o.value = x.id;
      o.textContent = `${x.name} ${x.effective_status === 'ACTIVE' ? '🟢' : '⚪'}`;
      sel.appendChild(o);
    });
  } catch (e) { /* leave empty */ }
}

// Clone the selected ad set (one click) and select the new copy.
async function cloneAdSet() {
  const src = $('adset').value;
  if (!src) return;
  const btn = $('cloneAdsetBtn');
  btn.disabled = true; btn.textContent = '…';
  try {
    const copy = await fbPost(`${src}/copies`, {
      deep_copy: false,
      status_option: 'PAUSED',
      rename_options: { rename_suffix: ' (copy)' },
    });
    const newId = copy.copied_adset_id || copy.id;
    await loadAdSets($('campaign').value);
    if (newId) {
      // The freshly cloned set may not carry a friendly label yet; add/select it.
      let opt = [...$('adset').options].find((o) => o.value === newId);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = newId; opt.textContent = 'Cloned ad set (copy)';
        $('adset').appendChild(opt);
      }
      $('adset').value = newId;
    }
    toast(`Ad set cloned → ${newId}`);
  } catch (e) {
    alert('Clone failed: ' + e.message);
  } finally {
    btn.textContent = 'Clone'; btn.disabled = !$('adset').value;
  }
}

/* ------------------------------------------------------------------- Assets */

function addFiles(fileList) {
  [...fileList].forEach((file) => {
    const kind = file.type.startsWith('video') ? 'video' : 'image';
    if (!file.type.startsWith('video') && !file.type.startsWith('image')) return;
    State.assets.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
  });
  renderAssets();
  refreshSummary();
}

function renderAssets() {
  const grid = $('assetGrid');
  grid.innerHTML = '';
  State.assets.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'asset';
    const media = a.kind === 'video'
      ? `<video src="${a.url}" muted></video>`
      : `<img src="${a.url}" alt="">`;
    el.innerHTML = `
      ${media}
      <span class="nm">${a.file.name}</span>
      <span class="tag ${a.kind === 'video' ? 'vid' : ''}">${a.kind}</span>
      <button class="rm" title="Remove" data-id="${a.id}">×</button>`;
    grid.appendChild(el);
  });
  grid.querySelectorAll('.rm').forEach((b) =>
    b.addEventListener('click', () => {
      State.assets = State.assets.filter((x) => x.id !== b.dataset.id);
      renderAssets(); refreshSummary();
    })
  );
}

/* -------------------------------------------------------- Media → Graph API */

// Upload an image, return its hash.
async function uploadImage(file) {
  const res = await fbPost(`${act()}/adimages`, { filename: file });
  const imgs = res.images || {};
  const first = Object.values(imgs)[0];
  if (!first || !first.hash) throw new Error('Image upload returned no hash');
  return first.hash;
}

// Upload a video, wait until it finishes processing, return {id, thumbUrl}.
async function uploadVideo(file, log) {
  const res = await fbPost(`${act()}/advideos`, { source: file, name: file.name });
  const id = res.id;
  if (!id) throw new Error('Video upload returned no id');
  log(`waiting for Meta to process video ${id}…`, 'work');
  const deadline = Date.now() + 5 * 60 * 1000; // 5 min cap
  while (Date.now() < deadline) {
    await sleep(4000);
    const s = await fbGet(id, { fields: 'status,thumbnails' });
    const phase = s.status && s.status.video_status;
    if (phase === 'ready') {
      let thumbUrl = null;
      const t = s.thumbnails && s.thumbnails.data && s.thumbnails.data[0];
      if (t) thumbUrl = t.uri;
      return { id, thumbUrl };
    }
    if (phase === 'error') throw new Error('Meta failed to process the video');
  }
  throw new Error('Video still processing after 5 min — try again later');
}

/* ----------------------------------------------------------- Build & publish */

function lines(id) {
  return $(id).value.split('\n').map((s) => s.trim()).filter(Boolean);
}

function adName(template, file, n, adsetName) {
  const date = new Date().toISOString().slice(0, 10);
  return template
    .replaceAll('{date}', date)
    .replaceAll('{n}', String(n))
    .replaceAll('{file}', file.replace(/\.[^.]+$/, ''))
    .replaceAll('{adset}', adsetName || '');
}

async function publish() {
  if (State.publishing) return;
  const adsetId = $('adset').value;
  const pageId = $('page').value;
  const link = $('link').value.trim();
  if (!pageId) return alert('Select a Facebook Page.');
  if (!adsetId) return alert('Select (or clone) an ad set.');
  if (!link) return alert('Enter a destination URL.');
  if (!State.assets.length) return alert('Add at least one creative.');

  const primary = lines('primaryTexts');
  const heads = lines('headlines');
  const descs = lines('descriptions');
  const igId = $('igAccount').value || null;
  const ctaType = $('cta').value;
  const status = document.querySelector('input[name="status"]:checked').value;
  const enhance = $('enhancements').checked;
  const nameTpl = $('nameTemplate').value || '{date} · {file} · #{n}';
  const adsetLabel = ($('adset').selectedOptions[0] || {}).textContent || '';

  // Pre-upload the custom thumbnail once (shared across all videos).
  let sharedThumbHash = null;

  State.publishing = true;
  const btn = $('publishBtn');
  btn.disabled = true; btn.textContent = 'Publishing…';
  $('progressWrap').classList.remove('hidden');
  $('log').classList.remove('hidden');
  $('clearLogBtn').hidden = false;
  $('log').innerHTML = '';

  const total = State.assets.length;
  let done = 0, ok = 0, fail = 0;
  const setProg = () => { $('progressBar').style.width = `${(done / total) * 100}%`; };

  for (let i = 0; i < State.assets.length; i++) {
    const a = State.assets[i];
    const rowLog = makeLogger(a.file.name);
    try {
      const message = primary.length ? primary[i % primary.length] : '';
      const title = heads.length ? heads[i % heads.length] : '';
      const desc = descs.length ? descs[i % descs.length] : '';
      const cta = ctaType && ctaType !== 'NO_BUTTON'
        ? { type: ctaType, value: { link } } : undefined;

      let storySpec;
      if (a.kind === 'image') {
        rowLog('uploading image…', 'work');
        const hash = await uploadImage(a.file);
        storySpec = {
          page_id: pageId,
          link_data: {
            image_hash: hash, link, message,
            name: title || undefined,
            description: desc || undefined,
            call_to_action: cta,
          },
        };
      } else {
        rowLog('uploading video…', 'work');
        if (State.thumbFile && !sharedThumbHash) sharedThumbHash = await uploadImage(State.thumbFile);
        const { id: videoId, thumbUrl } = await uploadVideo(a.file, rowLog);
        const vd = {
          video_id: videoId, message,
          title: title || undefined,
          link_description: desc || undefined,
          call_to_action: cta || { type: 'LEARN_MORE', value: { link } },
        };
        if (sharedThumbHash) vd.image_hash = sharedThumbHash;
        else if (thumbUrl) vd.image_url = thumbUrl;
        storySpec = { page_id: pageId, video_data: vd };
      }
      if (igId) storySpec.instagram_actor_id = igId;

      rowLog('creating creative…', 'work');
      const creativeParams = {
        name: `Creative · ${a.file.name}`,
        object_story_spec: storySpec,
        degrees_of_freedom_spec: {
          creative_features_spec: {
            standard_enhancements: { enroll_status: enhance ? 'OPT_IN' : 'OPT_OUT' },
          },
        },
      };
      const creative = await fbPost(`${act()}/adcreatives`, creativeParams);

      rowLog('creating ad…', 'work');
      const ad = await fbPost(`${act()}/ads`, {
        name: adName(nameTpl, a.file.name, i + 1, adsetLabel),
        adset_id: adsetId,
        creative: { creative_id: creative.id },
        status,
      });
      ok++;
      rowLog(`✓ Ad created (${ad.id}) — ${status}`, 'ok', true);
    } catch (e) {
      fail++;
      rowLog('✗ ' + e.message, 'err', true);
    } finally {
      done++; setProg();
    }
  }

  btn.disabled = false; btn.textContent = 'Publish ads';
  State.publishing = false;
  logLine(`Done — ${ok} created, ${fail} failed of ${total}.`, ok && !fail ? 'ok' : (fail ? 'err' : 'info'));
}

/* -------------------------------------------------------------------- Logging */

function makeLogger(label) {
  const row = document.createElement('div');
  row.className = 'log-row work';
  row.innerHTML = `<span class="ico">●</span><span class="txt"><b>${label}</b><span class="sub"></span></span>`;
  $('log').appendChild(row);
  $('log').scrollTop = $('log').scrollHeight;
  const sub = row.querySelector('.sub');
  return (text, cls, done) => {
    row.className = `log-row ${cls}`;
    row.querySelector('.ico').textContent = cls === 'ok' ? '✓' : cls === 'err' ? '✗' : '●';
    sub.textContent = text;
    if (done) sub.style.color = cls === 'err' ? '#f3b4b4' : '#9af2bd';
    $('log').scrollTop = $('log').scrollHeight;
  };
}

function logLine(text, cls = 'info') {
  const row = document.createElement('div');
  row.className = `log-row ${cls}`;
  row.innerHTML = `<span class="ico">●</span><span class="txt">${text}</span>`;
  $('log').appendChild(row);
  $('log').scrollTop = $('log').scrollHeight;
}

/* ----------------------------------------------------------------- UI helpers */

function refreshSummary() {
  const imgs = State.assets.filter((a) => a.kind === 'image').length;
  const vids = State.assets.filter((a) => a.kind === 'video').length;
  const total = State.assets.length;
  const ready = total > 0 && $('adset') && $('adset').value && $('page').value && $('link').value.trim();
  $('summary').innerHTML = total
    ? `<span class="big">${total}</span> ad${total > 1 ? 's' : ''} ready to publish · <b>${imgs}</b> image${imgs !== 1 ? 's' : ''}, <b>${vids}</b> video${vids !== 1 ? 's' : ''}`
    : 'Add creatives and copy to see your batch.';
  $('publishBtn').disabled = !ready || State.publishing;
}

function showMsg(el, html, cls) {
  el.className = `msg ${cls}`; el.innerHTML = html; el.classList.remove('hidden');
}
function setBadge(on) {
  const b = $('connBadge');
  b.className = `badge ${on ? 'badge-on' : 'badge-off'}`;
  b.textContent = on ? 'Connected' : 'Not connected';
}
function enableStep(id) { $(id).classList.remove('disabled'); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function toast(t) { logVisible(); logLine(t, 'info'); }
function logVisible() { $('log').classList.remove('hidden'); }

function saveToken() {
  try { localStorage.setItem('mabu_token', State.token); localStorage.setItem('mabu_ver', State.apiVersion); } catch {}
}
function loadToken() {
  try {
    const t = localStorage.getItem('mabu_token');
    const v = localStorage.getItem('mabu_ver');
    if (v) $('apiVersion').value = v;
    if (t) { $('token').value = t; $('rememberToken').checked = true; }
  } catch {}
}

/* ----------------------------------------------------------------------- Init */

function init() {
  // CTA options
  const cta = $('cta');
  CTA_OPTIONS.forEach((c) => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    cta.appendChild(o);
  });

  loadToken();

  $('connectBtn').addEventListener('click', connect);
  $('adAccount').addEventListener('change', async (e) => {
    State.actId = e.target.value; await loadAccountData(); refreshSummary();
  });
  $('page').addEventListener('change', () => { syncIgForPage(); refreshSummary(); });
  $('campaign').addEventListener('change', (e) => loadAdSets(e.target.value));
  $('adset').addEventListener('change', () => { $('cloneAdsetBtn').disabled = !$('adset').value; refreshSummary(); });
  $('cloneAdsetBtn').addEventListener('click', cloneAdSet);
  $('link').addEventListener('input', refreshSummary);
  $('publishBtn').addEventListener('click', publish);
  $('clearLogBtn').addEventListener('click', () => { $('log').innerHTML = ''; $('progressBar').style.width = '0'; });

  // dropzone
  const dz = $('dropzone');
  $('browseBtn').addEventListener('click', (e) => { e.stopPropagation(); $('fileInput').click(); });
  dz.addEventListener('click', () => $('fileInput').click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') $('fileInput').click(); });
  $('fileInput').addEventListener('change', (e) => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  // custom thumbnail
  $('thumbBrowseBtn').addEventListener('click', () => $('thumbInput').click());
  $('thumbInput').addEventListener('change', (e) => {
    State.thumbFile = e.target.files[0] || null;
    $('thumbName').textContent = State.thumbFile ? `Using: ${State.thumbFile.name}` : 'No custom thumbnail — Meta auto-picks a frame.';
  });

  ['primaryTexts', 'headlines'].forEach((id) => $(id).addEventListener('input', refreshSummary));
}

document.addEventListener('DOMContentLoaded', init);
