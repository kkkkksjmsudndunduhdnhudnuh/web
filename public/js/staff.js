/* Mitarbeiterbereich: login, tabs and all dashboard features. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=str=>{ const d=document.createElement('div'); d.textContent=str ?? ''; return d.innerHTML; };
  const fmtDay=iso=>{ const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}`; };
  const fmtStamp=iso=>{ try{ return new Date(iso).toLocaleString('de-AT',{dateStyle:'medium',timeStyle:'short'}); }catch{ return iso; } };
  const isEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim());
  const STATUS_LABEL={offen:'Offen', bestaetigt:'Bestätigt', abgelehnt:'Abgelehnt', erledigt:'Erledigt'};
  const DAYS=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  async function api(path, {method='GET', body}={}){
    const res=await fetch(path,{method, headers: body!==undefined?{'Content-Type':'application/json'}:{}, body: body!==undefined?JSON.stringify(body):undefined});
    const data=await res.json().catch(()=>({}));
    if(res.status===401 && path!=='/api/login'){ showDashboard(false); }
    if(!res.ok) throw new Error(data.error || `Serverfehler (${res.status})`);
    return data;
  }
  function msg(el, text, error=false){
    el.textContent=text; el.classList.toggle('error', error);
    if(text && !error){ clearTimeout(el._t); el._t=setTimeout(()=>{ el.textContent=''; }, 4000); }
  }

  let me=null, status={mail:false};

  /* ---------- Login / session ---------- */
  const loginView=$('loginView'), dashboardView=$('dashboardView');
  function showDashboard(show, user){
    me=show?user:null;
    loginView.style.display=show?'none':'';
    dashboardView.classList.toggle('show', show);
    if(!show) return;
    $('whoami').textContent=user.username+(user.rolle==='admin'?' (Admin)':'');
    $('pwWarn').hidden=!user.mustChange;
    const admin=user.rolle==='admin';
    $('userPanel').hidden=!admin;
    ADMIN_TABS.forEach(name=>{
      const t=$('tab-'+name);
      t.disabled=!admin; t.classList.toggle('locked',!admin);
      t.title=admin?'':'Nur für Administrator:innen';
    });
    selectTab('termine');
    loadStatus(); loadTermine(); loadHours(); loadFeiertage();
    if(admin){ loadSperrzeiten(); loadHinweis(); loadMitarbeiter(); loadUsers(); }
    if(user.mustChange) selectTab('konto');
  }
  api('/api/session').then(s=>showDashboard(s.loggedIn, s.user)).catch(()=>showDashboard(false));

  $('loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const m=$('loginMsg'); m.classList.remove('show');
    try{
      const r=await api('/api/login',{method:'POST', body:{username:$('lUser').value.trim(), password:$('lPass').value}});
      e.target.reset(); showDashboard(true, r.user);
    }catch(err){ m.textContent=err.message||'Anmeldung fehlgeschlagen.'; m.classList.add('show'); }
  });
  $('logoutBtn').addEventListener('click', async ()=>{
    try{ await api('/api/logout',{method:'POST'}); }catch{}
    showDashboard(false);
  });

  async function loadStatus(){
    const warn=$('dbWarn');
    try{
      status=await api('/api/status');
      $('retentionNote').textContent=`Anfragen werden ${status.retentionDays} Tage nach dem Termin automatisch gelöscht.`
        +(status.mail?' Neue Anfragen werden per E-Mail gemeldet.':' E-Mail-Versand ist nicht eingerichtet.');
      if(status.ok){ warn.hidden=true; }
      else{
        warn.textContent=status.storage==='redis'
          ? 'Datenbank nicht erreichbar – Änderungen werden nicht gespeichert. Fehler: '+(status.error||'unbekannt')
          : 'Keine Datenbank verbunden – Änderungen werden nicht gespeichert. Gefundene Datenbank-Variablen: '
            +(status.envVars&&status.envVars.length?status.envVars.join(', '):'keine');
        warn.hidden=false;
      }
      renderTermine();
    }catch{}
  }

  /* ---------- Tabs ---------- */
  const ADMIN_TABS=['zeiten','hinweis','team'];
  const tabs=[...document.querySelectorAll('.tabs [role="tab"]')];
  function selectTab(name, focus){
    tabs.forEach(t=>{
      const on=t.id==='tab-'+name;
      t.setAttribute('aria-selected', String(on)); t.tabIndex=on?0:-1;
      $(t.getAttribute('aria-controls')).hidden=!on;
      if(on && focus) t.focus();
    });
  }
  tabs.forEach(t=>{
    t.addEventListener('click',()=>selectTab(t.id.slice(4)));
    t.addEventListener('keydown',e=>{
      const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
      if(!d) return;
      e.preventDefault();
      const usable=tabs.filter(x=>!x.disabled), i=usable.indexOf(t);
      selectTab(usable[(i+d+usable.length)%usable.length].id.slice(4), true);
    });
  });

  /* ---------- Termine ---------- */
  let termine=[], view='liste', weekOffset=0, hours=null, feiertage=[];
  const termineList=$('termineList');

  async function loadTermine(){
    try{ termine=await api('/api/termine'); renderTermine(); }
    catch(err){ termineList.innerHTML=`<p class="empty-note">Anfragen konnten nicht geladen werden: ${esc(err.message)}</p>`; }
  }
  function filtered(){
    const q=$('tSuche').value.trim().toLowerCase(), st=$('tFilter').value;
    return termine.filter(t=>(!st||t.status===st) &&
      (!q || [t.name,t.kontakt,t.anliegen,t.alter].some(v=>String(v||'').toLowerCase().includes(q))));
  }
  const sortKey=t=>(t.datum||'9999')+(t.zeit||'');

  function renderTermine(){
    const items=filtered().sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
    termineList.hidden=view!=='liste';
    $('weekView').hidden=view!=='woche';
    if(view==='woche') return renderWeek(items);
    if(!termine.length){ termineList.innerHTML='<p class="empty-note">Noch keine Terminanfragen.</p>'; return; }
    if(!items.length){ termineList.innerHTML='<p class="empty-note">Keine Anfragen passend zur Suche.</p>'; return; }
    termineList.innerHTML='';
    items.forEach(t=>{
      const st=STATUS_LABEL[t.status]?t.status:'offen';
      const card=document.createElement('div');
      card.className='termin-card '+st; card.id='t-'+t.id;
      const canMail=isEmail(t.kontakt);
      card.innerHTML=`
        <div class="termin-head">
          <div><strong>${esc(t.name)}</strong><div class="termin-meta">Eingegangen am ${esc(fmtStamp(t.createdAt))}</div></div>
          <span class="status-pill ${st}">${STATUS_LABEL[st]}</span>
        </div>
        <div class="termin-body">
          <div><span>Termin:</span> ${t.datum&&t.zeit?`${DAYS[new Date(t.datum+'T12:00').getDay()]}, ${fmtDay(t.datum)}, ${esc(t.zeit)} Uhr`:esc(t.wann||'–')}</div>
          <div><span>Alter des Kindes:</span> ${t.alter?esc(t.alter):'–'}</div>
          <div><span>Anliegen:</span> ${t.anliegen?esc(t.anliegen):'–'}</div>
          <div><span>Kontakt:</span> ${esc(t.kontakt)}</div>
        </div>
        <div class="termin-actions">
          ${st!=='bestaetigt'?`<button class="btn-sm ok" type="button" data-status="bestaetigt">Bestätigen</button>`:''}
          ${st!=='abgelehnt'?`<button class="btn-sm del" type="button" data-status="abgelehnt">Ablehnen</button>`:''}
          ${st!=='erledigt'?`<button class="btn-sm" type="button" data-status="erledigt">Erledigt</button>`:`<button class="btn-sm" type="button" data-status="offen">Wieder öffnen</button>`}
          <button class="btn-sm del" type="button" data-delete>Löschen</button>
          ${canMail?`<label class="check notify" title="${status.mail?'':'E-Mail-Versand ist nicht eingerichtet'}"><input type="checkbox" data-notify ${status.mail?'checked':'disabled'}> Patient:in per E-Mail informieren</label>`:''}
        </div>`;
      card.dataset.id=t.id;
      termineList.appendChild(card);
    });
  }

  termineList.addEventListener('click', async e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const card=btn.closest('.termin-card'), id=card.dataset.id;
    try{
      if(btn.hasAttribute('data-delete')){
        if(!confirm('Diese Terminanfrage wirklich löschen?')) return;
        await api('/api/termine/'+id,{method:'DELETE'});
        msg($('terminMsg'),'Anfrage gelöscht.');
      }else{
        const s=btn.dataset.status, notify=card.querySelector('[data-notify]');
        const r=await api('/api/termine/'+id,{method:'PATCH', body:{status:s, benachrichtigen:!!(notify&&notify.checked)}});
        const mailText={sent:' Die E-Mail an die Patientin/den Patienten wurde gesendet.', failed:' Die E-Mail konnte nicht gesendet werden.',
          'no-email':' Keine E-Mail-Adresse hinterlegt – bitte telefonisch informieren.', 'not-configured':' E-Mail-Versand ist nicht eingerichtet.'}[r.mail]||'';
        msg($('terminMsg'), `Status: ${STATUS_LABEL[s]}.`+mailText, r.mail==='failed');
      }
      loadTermine();
    }catch(err){ msg($('terminMsg'), err.message, true); }
  });

  $('tSuche').addEventListener('input', renderTermine);
  $('tFilter').addEventListener('change', renderTermine);
  document.querySelectorAll('.segmented button').forEach(b=>b.addEventListener('click',()=>{
    view=b.dataset.view;
    document.querySelectorAll('.segmented button').forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    renderTermine();
  }));

  // Week view (Mon–Sat, plus Sunday when something is booked on it)
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function renderWeek(items){
    const now=new Date(); const monday=new Date(now.getFullYear(), now.getMonth(), now.getDate()-((now.getDay()+6)%7)+weekOffset*7);
    const days=[...Array(7)].map((_,i)=>new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+i));
    const show=days.filter((d,i)=>i<6 || items.some(t=>t.datum===iso(d)));
    $('wLabel').textContent=`${fmtDay(iso(days[0]))} – ${fmtDay(iso(days[6]))}`;
    const grid=$('weekGrid'); grid.style.gridTemplateColumns=`repeat(${show.length},minmax(0,1fr))`; grid.innerHTML='';
    const today=iso(new Date());
    show.forEach(d=>{
      const key=iso(d), col=document.createElement('div');
      const closure=feiertage.find(f=>f.datum<=key && key<=(f.bis||f.datum));
      const open=hours && (hours[d.getDay()]||[]).length;
      col.className='week-day'+(key===today?' today':'')+(closure||!open?' closed':'');
      col.innerHTML=`<h3>${DAYS[d.getDay()].slice(0,2)} ${fmtDay(key).slice(0,6)}</h3>`
        +(closure?`<div class="week-note">${esc(closure.name)}</div>`:(!open?'<div class="week-note">geschlossen</div>':''));
      items.filter(t=>t.datum===key).forEach(t=>{
        const b=document.createElement('button');
        b.type='button'; b.className='week-item '+t.status; b.dataset.id=t.id;
        b.innerHTML=`<b>${esc(t.zeit)}</b> ${esc(t.name)}`;
        col.appendChild(b);
      });
      grid.appendChild(col);
    });
  }
  $('weekGrid').addEventListener('click', e=>{
    const b=e.target.closest('.week-item'); if(!b) return;
    document.querySelector('.segmented [data-view="liste"]').click();
    const card=$('t-'+b.dataset.id);
    if(card){ card.scrollIntoView({behavior:'smooth', block:'center'}); card.classList.remove('flash'); card.offsetWidth; card.classList.add('flash'); }
  });
  $('wPrev').addEventListener('click',()=>{ weekOffset--; renderTermine(); });
  $('wNext').addEventListener('click',()=>{ weekOffset++; renderTermine(); });
  $('wToday').addEventListener('click',()=>{ weekOffset=0; renderTermine(); });

  // CSV for Excel (semicolon, UTF-8 BOM); cells starting with = + - @ are quoted with ' to stop formula injection
  $('csvBtn').addEventListener('click',()=>{
    const cell=v=>{ let s=String(v??''); if(/^[=+\-@]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
    const rows=[['Datum','Uhrzeit','Name','Alter','Anliegen','Kontakt','Status','Eingegangen']]
      .concat(filtered().sort((a,b)=>sortKey(a).localeCompare(sortKey(b))).map(t=>[
        t.datum?fmtDay(t.datum):'', t.zeit||'', t.name, t.alter, t.anliegen, t.kontakt, STATUS_LABEL[t.status]||t.status, fmtStamp(t.createdAt)]));
    const blob=new Blob(['﻿'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`terminanfragen-${iso(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });

  /* ---------- Öffnungszeiten ---------- */
  const ORDER=[1,2,3,4,5,6,0];
  async function loadHours(){
    try{ hours=await api('/api/oeffnungszeiten'); }catch{ return; }
    const ed=$('hoursEditor'); ed.innerHTML='';
    ORDER.forEach(d=>{
      const row=document.createElement('div'); row.className='hours-row'; row.dataset.day=d;
      const r=hours[d]||[];
      row.innerHTML=`<span>${DAYS[d]}</span>`+[0,1].map(i=>`<div class="hours-range">
        <input type="time" step="900" aria-label="${DAYS[d]} Zeitraum ${i+1} von" value="${r[i]?r[i][0]:''}">
        <span aria-hidden="true">–</span>
        <input type="time" step="900" aria-label="${DAYS[d]} Zeitraum ${i+1} bis" value="${r[i]?r[i][1]:''}"></div>`).join('');
      ed.appendChild(row);
    });
    if(view==='woche') renderTermine();
  }
  $('hoursForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const out={};
    for(const row of document.querySelectorAll('.hours-row')){
      const v=[...row.querySelectorAll('input')].map(i=>i.value);
      out[row.dataset.day]=[[v[0],v[1]],[v[2],v[3]]].filter(([a,b])=>a||b);
    }
    try{ hours=await api('/api/oeffnungszeiten',{method:'PUT', body:out}); msg($('hoursMsg'),'Öffnungszeiten gespeichert – die Startseite zeigt sie ab sofort an.'); }
    catch(err){ msg($('hoursMsg'), err.message, true); }
  });

  /* ---------- Schließtage & Sperrzeiten ---------- */
  function listItems(ul, items, render, empty){
    ul.innerHTML='';
    if(!items.length){ ul.innerHTML=`<li class="empty-note" style="border:0; padding:.4rem 0">${empty}</li>`; return; }
    items.forEach(it=>{
      const li=document.createElement('li');
      li.innerHTML=render(it)+`<button class="btn-sm del" type="button" data-id="${esc(it.id)}">Entfernen</button>`;
      ul.appendChild(li);
    });
  }
  async function loadFeiertage(){
    try{ feiertage=await api('/api/feiertage'); }catch{ return; }
    listItems($('feiertagList'), feiertage, f=>`<span><span class="fdate">${fmtDay(f.datum)}${f.bis?' – '+fmtDay(f.bis):''}</span> &nbsp; ${esc(f.name)}</span>`, 'Noch keine Schließzeiten hinterlegt.');
    if(view==='woche') renderTermine();
  }
  $('feiertagForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/feiertage',{method:'POST', body:{datum:$('fDatum').value, bis:$('fBis').value||undefined, name:$('fName').value.trim()}});
      e.target.reset(); msg($('feiertagMsg'),'Schließzeit gespeichert.'); loadFeiertage();
    }catch(err){ msg($('feiertagMsg'), err.message, true); }
  });
  $('feiertagList').addEventListener('click', async e=>{
    const b=e.target.closest('button[data-id]'); if(!b || !confirm('Diese Schließzeit entfernen?')) return;
    try{ await api('/api/feiertage/'+b.dataset.id,{method:'DELETE'}); loadFeiertage(); }catch(err){ msg($('feiertagMsg'), err.message, true); }
  });

  async function loadSperrzeiten(){
    let items; try{ items=await api('/api/sperrzeiten'); }catch{ return; }
    listItems($('sperrList'), items, s=>`<span><span class="fdate">${fmtDay(s.datum)}${s.von?`, ${s.von}–${s.bis}`:', ganzer Tag'}</span> &nbsp; ${esc(s.grund||'')}</span>`, 'Keine gesperrten Zeiten.');
  }
  $('sperrForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/sperrzeiten',{method:'POST', body:{datum:$('sDatum').value, von:$('sVon').value, bis:$('sBis').value, grund:$('sGrund').value.trim()}});
      e.target.reset(); msg($('sperrMsg'),'Zeit gesperrt – sie ist online nicht mehr buchbar.'); loadSperrzeiten();
    }catch(err){ msg($('sperrMsg'), err.message, true); }
  });
  $('sperrList').addEventListener('click', async e=>{
    const b=e.target.closest('button[data-id]'); if(!b || !confirm('Diese Sperre aufheben?')) return;
    try{ await api('/api/sperrzeiten/'+b.dataset.id,{method:'DELETE'}); loadSperrzeiten(); }catch(err){ msg($('sperrMsg'), err.message, true); }
  });

  /* ---------- Hinweis ---------- */
  function preview(){
    const p=$('hPreview');
    p.className='notice-preview'+($('hStil').value==='wichtig'?' wichtig':'');
    p.querySelector('span').textContent=$('hText').value.trim();
  }
  async function loadHinweis(){
    try{
      const h=await api('/api/hinweis/bearbeiten');
      $('hText').value=h.text||''; $('hStil').value=h.stil||'info'; $('hAktiv').checked=!!h.aktiv; preview();
    }catch{}
  }
  ['hText','hStil'].forEach(id=>$(id).addEventListener('input', preview));
  $('hinweisForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      const h=await api('/api/hinweis',{method:'PUT', body:{text:$('hText').value, stil:$('hStil').value, aktiv:$('hAktiv').checked}});
      $('hAktiv').checked=h.aktiv;
      msg($('hinweisMsg'), h.aktiv?'Gespeichert – der Hinweis ist jetzt auf der Website sichtbar.':'Gespeichert – der Hinweis ist ausgeblendet.');
    }catch(err){ msg($('hinweisMsg'), err.message, true); }
  });

  /* ---------- Team ---------- */
  let team=[], editId=null, photo='';
  const mForm=$('mitarbeiterForm');
  function resetTeamForm(){
    editId=null; photo=''; mForm.reset();
    $('mBildName').textContent='Kein Foto ausgewählt';
    $('mSubmit').textContent='Mitarbeiter:in hinzufügen';
    $('mCancel').hidden=true; $('mBildRemoveWrap').hidden=true;
  }
  $('mCancel').addEventListener('click', resetTeamForm);
  $('mBild').addEventListener('change',()=>{
    const file=$('mBild').files[0];
    if(!file){ photo=''; $('mBildName').textContent='Kein Foto ausgewählt'; return; }
    $('mBildName').textContent='Wird verarbeitet …';
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const max=480, k=Math.min(1, max/Math.max(img.width,img.height));
      const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      photo=c.toDataURL('image/jpeg',.82); $('mBildName').textContent=file.name; URL.revokeObjectURL(url);
    };
    img.onerror=()=>{ photo=''; $('mBildName').textContent='Bild konnte nicht gelesen werden.'; };
    img.src=url;
  });
  async function loadMitarbeiter(){
    try{ team=await api('/api/mitarbeiter'); }catch{ return; }
    const ul=$('mitarbeiterList'); ul.innerHTML='';
    if(!team.length){ ul.innerHTML='<li class="empty-note" style="border:0; padding:.4rem 0">Noch keine Mitarbeiter:innen hinterlegt.</li>'; return; }
    team.forEach((m,i)=>{
      const li=document.createElement('li'); li.className='mitarbeiter-item'; li.dataset.id=m.id;
      li.innerHTML=`<div class="mitarbeiter-photo">${m.bild?'<img alt="">':''}</div>
        <div class="mitarbeiter-info"><strong></strong><div class="mitarbeiter-rolle"></div>${m.sprachen&&m.sprachen.length?'<div class="mitarbeiter-sprachen"></div>':''}</div>
        <div class="item-actions">
          <button class="btn-sm" type="button" data-move="-1" aria-label="Nach oben" ${i===0?'disabled':''}>↑</button>
          <button class="btn-sm" type="button" data-move="1" aria-label="Nach unten" ${i===team.length-1?'disabled':''}>↓</button>
          <button class="btn-sm ok" type="button" data-edit>Bearbeiten</button>
          <button class="btn-sm del" type="button" data-remove>Entfernen</button>
        </div>`;
      if(m.bild) li.querySelector('img').src=m.bild;
      li.querySelector('strong').textContent=m.name;
      li.querySelector('.mitarbeiter-rolle').textContent=m.rolle;
      if(m.sprachen&&m.sprachen.length) li.querySelector('.mitarbeiter-sprachen').textContent=m.sprachen.join(', ');
      ul.appendChild(li);
    });
  }
  $('mitarbeiterList').addEventListener('click', async e=>{
    const b=e.target.closest('button'); if(!b) return;
    const id=b.closest('li').dataset.id, i=team.findIndex(m=>m.id===id), m=team[i];
    try{
      if(b.dataset.move){
        const ids=team.map(x=>x.id), j=i+Number(b.dataset.move);
        [ids[i],ids[j]]=[ids[j],ids[i]];
        await api('/api/mitarbeiter/reihenfolge',{method:'POST', body:{ids}});
        loadMitarbeiter();
      }else if(b.hasAttribute('data-edit')){
        editId=id; photo='';
        $('mName').value=m.name; $('mRolle').value=m.rolle; $('mSprachen').value=(m.sprachen||[]).join(', ');
        $('mBildName').textContent=m.bild?'Aktuelles Foto bleibt erhalten':'Kein Foto ausgewählt';
        $('mBildRemoveWrap').hidden=!m.bild; $('mBildRemove').checked=false;
        $('mSubmit').textContent='Änderungen speichern'; $('mCancel').hidden=false;
        mForm.scrollIntoView({behavior:'smooth', block:'center'}); $('mName').focus({preventScroll:true});
      }else if(b.hasAttribute('data-remove')){
        if(!confirm(`${m.name} wirklich von der Team-Seite entfernen?`)) return;
        await api('/api/mitarbeiter/'+id,{method:'DELETE'});
        if(editId===id) resetTeamForm();
        loadMitarbeiter();
      }
    }catch(err){ msg($('mitarbeiterMsg'), err.message, true); }
  });
  mForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const body={name:$('mName').value.trim(), rolle:$('mRolle').value.trim(),
      sprachen:$('mSprachen').value.split(',').map(s=>s.trim()).filter(Boolean)};
    if(!body.name||!body.rolle) return msg($('mitarbeiterMsg'),'Bitte Name und Rolle angeben.', true);
    try{
      if(editId){
        if(photo) body.bild=photo; else if($('mBildRemove').checked) body.bild=null;
        await api('/api/mitarbeiter/'+editId,{method:'PUT', body});
        msg($('mitarbeiterMsg'),'Änderungen gespeichert.');
      }else{
        body.bild=photo;
        await api('/api/mitarbeiter',{method:'POST', body});
        msg($('mitarbeiterMsg'),'Mitarbeiter:in hinzugefügt.');
      }
      resetTeamForm(); loadMitarbeiter();
    }catch(err){ msg($('mitarbeiterMsg'), err.message, true); }
  });

  /* ---------- Konto ---------- */
  $('pwForm').addEventListener('submit', async e=>{
    e.preventDefault();
    if($('pwNeu').value!==$('pwNeu2').value) return msg($('pwMsg'),'Die neuen Passwörter stimmen nicht überein.', true);
    try{
      await api('/api/passwort',{method:'POST', body:{alt:$('pwAlt').value, neu:$('pwNeu').value}});
      e.target.reset(); $('pwWarn').hidden=true; if(me) me.mustChange=false;
      msg($('pwMsg'),'Passwort geändert.');
    }catch(err){ msg($('pwMsg'), err.message, true); }
  });

  async function loadUsers(){
    let list; try{ list=await api('/api/benutzer'); }catch{ return; }
    const ul=$('userList'); ul.innerHTML='';
    list.forEach(u=>{
      const li=document.createElement('li'); li.dataset.id=u.id;
      li.innerHTML=`<span><strong></strong><span class="role-pill">${u.rolle==='admin'?'Admin':'Mitarbeiter:in'}${u.mustChange?' · vorläufiges Passwort':''}</span></span>
        <span class="item-actions"><button class="btn-sm" type="button" data-reset>Passwort zurücksetzen</button>
        ${u.id!==me.id?'<button class="btn-sm del" type="button" data-remove>Löschen</button>':''}</span>`;
      li.querySelector('strong').textContent=u.username;
      ul.appendChild(li);
    });
  }
  $('userList').addEventListener('click', async e=>{
    const b=e.target.closest('button'); if(!b) return;
    const li=b.closest('li'), id=li.dataset.id, name=li.querySelector('strong').textContent;
    try{
      if(b.hasAttribute('data-reset')){
        const pw=prompt(`Neues vorläufiges Passwort für ${name} (mind. 10 Zeichen):`);
        if(!pw) return;
        await api(`/api/benutzer/${id}/passwort`,{method:'POST', body:{passwort:pw}});
        msg($('userMsg'), id===me.id?'Ihr Passwort wurde geändert.':`Passwort für ${name} zurückgesetzt – beim nächsten Login muss es geändert werden.`);
      }else if(b.hasAttribute('data-remove')){
        if(!confirm(`Konto „${name}“ wirklich löschen?`)) return;
        await api('/api/benutzer/'+id,{method:'DELETE'});
        msg($('userMsg'),'Konto gelöscht.');
      }
      loadUsers();
    }catch(err){ msg($('userMsg'), err.message, true); }
  });
  $('userForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/benutzer',{method:'POST', body:{username:$('uName').value, passwort:$('uPass').value, rolle:$('uRolle').value}});
      e.target.reset(); msg($('userMsg'),'Konto angelegt. Geben Sie Benutzername und vorläufiges Passwort persönlich weiter.'); loadUsers();
    }catch(err){ msg($('userMsg'), err.message, true); }
  });
})();
