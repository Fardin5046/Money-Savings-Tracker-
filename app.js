// Money Saver App
(function(){
  const $ = (sel) => document.querySelector(sel);
  const fmt = (n, cur) => {
    const sym = {BDT:'৳', INR:'₹', USD:'$', EUR:'€'}[cur] || '';
    return sym + new Intl.NumberFormat(undefined, {maximumFractionDigits: 2}).format(n);
  };

  const state = {
    entries: [], // {id, type:'save'|'spend', amount, note, dateISO}
    currency: 'BDT',
    theme: 'dark'
  };

  // ----- Storage -----
  const STORAGE_KEY = 'money_saver_state_v1';
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const data = JSON.parse(raw);
        state.entries = Array.isArray(data.entries) ? data.entries : [];
        state.currency = data.currency || 'BDT';
        state.theme = data.theme || 'dark';
      }
    }catch(e){ console.error('load failed', e); }
  }
  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      entries: state.entries,
      currency: state.currency,
      theme: state.theme
    }));
    updateUI();
  }

  // ----- Calculations -----
  function totals(){
    let saved = 0, spent = 0;
    for(const e of state.entries){
      if(e.type === 'save') saved += e.amount;
      else spent += e.amount;
    }
    return {saved, spent, balance: saved - spent};
  }

  // ----- UI Bindings -----
  const balanceEl = $('#balance');
  const totalSavedEl = $('#totalSaved');
  const totalSpentEl = $('#totalSpent');
  const lastUpdatedEl = $('#lastUpdated');
  const historyList = $('#historyList');
  const currencySel = $('#currency');
  const searchInput = $('#search');
  const filterTypeSel = $('#filterType');
  const sortSel = $('#sort');

  function updateUI(){
    const {saved, spent, balance} = totals();
    balanceEl.textContent = fmt(balance, state.currency);
    totalSavedEl.textContent = fmt(saved, state.currency);
    totalSpentEl.textContent = fmt(spent, state.currency);

    // last updated
    if(state.entries.length){
      const latest = state.entries.reduce((a,b)=> a.dateISO > b.dateISO ? a : b);
      const d = new Date(latest.dateISO);
      lastUpdatedEl.textContent = `Updated ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    } else {
      lastUpdatedEl.textContent = '';
    }

    // controls
    currencySel.value = state.currency;
    document.documentElement.classList.toggle('light', state.theme === 'light');
    document.body.classList.toggle('light', state.theme === 'light');

    // history render
    renderHistory();
  }

  function renderHistory(){
    const q = searchInput.value.trim().toLowerCase();
    const typeFilter = filterTypeSel.value;
    const sort = sortSel.value;
    let items = [...state.entries];

    if(typeFilter !== 'all'){
      items = items.filter(e => e.type === typeFilter);
    }
    if(q){
      items = items.filter(e => (e.note||'').toLowerCase().includes(q));
    }
    items.sort((a,b)=>{
      if(sort === 'newest') return b.dateISO.localeCompare(a.dateISO) || b.id - a.id;
      if(sort === 'oldest') return a.dateISO.localeCompare(b.dateISO) || a.id - b.id;
      if(sort === 'amountHigh') return b.amount - a.amount;
      if(sort === 'amountLow') return a.amount - b.amount;
      return 0;
    });

    historyList.innerHTML = '';
    for(const e of items){
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="badge ${e.type}">${e.type === 'save' ? 'Saved' : 'Spent'}</span>
        <div>
          <div class="item-amt">${fmt(e.amount, state.currency)}</div>
          <div class="item-note">${e.note ? e.note.replace(/[<>&]/g, s=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[s])) : '<em>No note</em>'}</div>
          <div class="item-date">${new Date(e.dateISO).toLocaleDateString()}</div>
        </div>
        <div class="item-actions">
          <button class="btn text" data-action="edit" aria-label="Edit">✏️</button>
          <button class="btn text danger-text" data-action="delete" aria-label="Delete">🗑️</button>
        </div>
      `;
      li.dataset.id = e.id;
      historyList.appendChild(li);
    }
  }

  // ----- Forms -----
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  $('#saveDate').value = todayISO();
  $('#spendDate').value = todayISO();

  $('#saveForm').addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const amount = parseFloat($('#saveAmount').value);
    if(!(amount > 0)) return alert('Enter a valid amount');
    const note = $('#saveNote').value.trim();
    const dateISO = ($('#saveDate').value || todayISO()) + 'T12:00:00.000Z';
    state.entries.push({ id: Date.now()+Math.random(), type:'save', amount, note, dateISO });
    $('#saveAmount').value=''; $('#saveNote').value='';
    save();
  });

  $('#spendForm').addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const amount = parseFloat($('#spendAmount').value);
    if(!(amount > 0)) return alert('Enter a valid amount');
    const note = $('#spendNote').value.trim();
    const dateISO = ($('#spendDate').value || todayISO()) + 'T12:00:00.000Z';
    state.entries.push({ id: Date.now()+Math.random(), type:'spend', amount, note, dateISO });
    $('#spendAmount').value=''; $('#spendNote').value='';
    save();
  });

  // history actions
  historyList.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const li = btn.closest('.history-item');
    const id = Number(li.dataset.id);
    const entry = state.entries.find(x=>x.id===id);
    if(!entry) return;

    if(btn.dataset.action === 'delete'){
      if(confirm('Delete this entry?')){
        state.entries = state.entries.filter(x=>x.id!==id);
        save();
      }
    }
    if(btn.dataset.action === 'edit'){
      const newAmt = prompt('Amount:', entry.amount);
      if(newAmt === null) return;
      const a = parseFloat(newAmt);
      if(!(a>0)) return alert('Invalid amount');
      const newNote = prompt('Note (optional):', entry.note||'');
      entry.amount = a;
      entry.note = (newNote??'').trim();
      save();
    }
  });

  // filters
  [searchInput, filterTypeSel, sortSel].forEach(el=> el.addEventListener('input', renderHistory));

  // currency
  currencySel.addEventListener('change', ()=>{
    state.currency = currencySel.value;
    save();
  });

  // export
  $('#exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([ JSON.stringify({ ...state, now: new Date().toISOString() }, null, 2) ], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'money-saver-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // import
  $('#importFile').addEventListener('change', (ev)=>{
    const file = ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(Array.isArray(data.entries)){
          state.entries = data.entries;
          if(data.currency) state.currency = data.currency;
          if(data.theme) state.theme = data.theme;
          save();
          alert('Data imported successfully.');
        } else {
          alert('Invalid file format.');
        }
      } catch(err){
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  });

  // clear all
  $('#clearAll').addEventListener('click', ()=>{
    if(!state.entries.length) return;
    if(confirm('This will remove all entries. Continue?')){
      state.entries = [];
      save();
    }
  });

  // theme toggle
  const themeToggle = $('#themeToggle');
  themeToggle.addEventListener('click', ()=>{
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    save();
  });

  // ----- PWA Install -----
  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-flex';
  });
  installBtn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return alert('Install prompt not available. You can use your browser menu to add to Home Screen.');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.textContent = outcome === 'accepted' ? 'Installed' : 'Install';
  });

  // ----- Service Worker -----
  if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('sw.js');
    });
  }

  // Init
  load();
  updateUI();
})();
