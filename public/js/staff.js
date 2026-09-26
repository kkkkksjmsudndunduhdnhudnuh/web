/* Mitarbeiterbereich: login, tabs and all dashboard features. Texts come from
   i18n/staff.json (_dyn); German is the fallback. Everything re-renders on language change. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=str=>{ const d=document.createElement('div'); d.textContent=str ?? ''; return d.innerHTML; };
  const isEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim());
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const fmtDay=s=>{ const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`; };

  /* ---------- Texts ---------- */
  const DE={
    loading:'Wird geladen …', loadFailed:'Konnte nicht geladen werden: {err}', serverError:'Serverfehler ({status})',
    loginFailed:'Anmeldung fehlgeschlagen.', admin:'Admin', staffRole:'Mitarbeiter:in', adminOnly:'Nur für Administrator:innen',
    retention:'Anfragen werden {days} Tage nach dem Termin automatisch gelöscht.',
    mailOn:'Neue Anfragen werden per E-Mail gemeldet.', mailOff:'E-Mail-Versand ist nicht eingerichtet.',
    dbDown:'Datenbank nicht erreichbar – Änderungen werden nicht gespeichert. Fehler: {err}',
    dbMissing:'Keine Datenbank verbunden – Änderungen werden nicht gespeichert. Gefundene Datenbank-Variablen: {vars}',
    none:'keine', unknown:'unbekannt',
    st_offen:'Offen', st_bestaetigt:'Bestätigt', st_abgelehnt:'Abgelehnt', st_erledigt:'Erledigt',
    days:['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],
    daysShort:['So','Mo','Di','Mi','Do','Fr','Sa'],
    noRequests:'Noch keine Terminanfragen.', noMatches:'Keine Anfragen passend zur Suche.',
    received:'Eingegangen am {date}', lblTermin:'Termin:', lblAge:'Alter des Kindes:', lblTopic:'Anliegen:', lblContact:'Kontakt:',
    at:'{date}, {time} Uhr',
    confirm:'Bestätigen', decline:'Ablehnen', done:'Erledigt', reopen:'Wieder öffnen', delete:'Löschen',
    notify:'Patient:in per E-Mail informieren',
    askDelete:'Diese Terminanfrage wirklich löschen?', deleted:'Anfrage gelöscht.', statusSet:'Status: {status}.',
    mail_sent:'Die E-Mail an die Eltern wurde gesendet.', mail_failed:'Die E-Mail konnte nicht gesendet werden.',
    'mail_no-email':'Keine E-Mail-Adresse hinterlegt – bitte telefonisch informieren.', 'mail_not-configured':'E-Mail-Versand ist nicht eingerichtet.',
    closed:'geschlossen',
    csv:['Datum','Uhrzeit','Name','Alter','Anliegen','Kontakt','Status','Eingegangen'],
    rangeFrom:'{day}, Zeitraum {n}: von', rangeTo:'{day}, Zeitraum {n}: bis',
    hoursSaved:'Öffnungszeiten gespeichert – die Startseite zeigt sie ab sofort an.',
    remove:'Entfernen', noClosures:'Noch keine Schließzeiten hinterlegt.', closureSaved:'Schließzeit gespeichert.', askClosure:'Diese Schließzeit entfernen?',
    wholeDay:'ganzer Tag', noBlocks:'Keine gesperrten Zeiten.', blockSaved:'Zeit gesperrt – sie ist online nicht mehr buchbar.', askBlock:'Diese Sperre aufheben?',
    noticeOn:'Gespeichert – der Hinweis ist jetzt auf der Website sichtbar.', noticeOff:'Gespeichert – der Hinweis ist ausgeblendet.',
    noPhoto:'Kein Foto ausgewählt', processing:'Wird verarbeitet …', photoError:'Bild konnte nicht gelesen werden.', keepPhoto:'Aktuelles Foto bleibt erhalten',
    addMember:'Mitarbeiter:in hinzufügen', saveChanges:'Änderungen speichern', noMembers:'Noch keine Mitarbeiter:innen hinterlegt.',
    up:'Nach oben', down:'Nach unten', edit:'Bearbeiten', askMember:'{name} wirklich von der Team-Seite entfernen?',
    needNameRole:'Bitte Name und Rolle angeben.', changesSaved:'Änderungen gespeichert.', memberAdded:'Mitarbeiter:in hinzugefügt.',
    pwMismatch:'Die neuen Passwörter stimmen nicht überein.', pwChanged:'Passwort geändert.', tempPw:'vorläufiges Passwort',
    resetPw:'Passwort zurücksetzen', askNewPw:'Neues vorläufiges Passwort für {name} (mind. 10 Zeichen):',
    ownPwChanged:'Ihr Passwort wurde geändert.', pwReset:'Passwort für {name} zurückgesetzt – beim nächsten Login muss es geändert werden.',
    askAccount:'Konto „{name}“ wirklich löschen?', accountDeleted:'Konto gelöscht.',
    accountCreated:'Konto angelegt. Geben Sie Benutzername und vorläufiges Passwort persönlich weiter.',
    // Server messages (German) that the staff page shows translated
    err:{
      'Benutzername oder Passwort ist falsch.':'Benutzername oder Passwort ist falsch.',
      'Das aktuelle Passwort ist falsch.':'Das aktuelle Passwort ist falsch.',
      'Das Passwort muss mindestens 10 Zeichen lang sein.':'Das Passwort muss mindestens 10 Zeichen lang sein.',
      'Zu viele Anmeldeversuche. Bitte spaeter erneut versuchen.':'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
      'Nicht angemeldet.':'Nicht angemeldet.', 'Nur für Administrator:innen.':'Nur für Administrator:innen.',
      'Diesen Benutzernamen gibt es bereits.':'Diesen Benutzernamen gibt es bereits.'
    }
  };
  const LOCALE={de:'de-AT', en:'en-GB', es:'es-ES', fr:'fr-FR', tr:'tr-TR', ru:'ru-RU', ar:'ar'};
  let T=DE, lang='de';
  const t=(key,vars={})=>{
    const v=T[key] ?? DE[key] ?? key;
    return Array.isArray(v) ? v : String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k] ?? '');
  };
  const tErr=m=>(T.err && T.err[m]) || DE.err[m] || m;
  const fmtStamp=s=>{ try{ return new Date(s).toLocaleString(LOCALE[lang]||'de-AT',{dateStyle:'medium',timeStyle:'short'}); }catch{ return s; } };

  async function api(path, {method='GET', body}={}){
    const res=await fetch(path,{method, headers: body!==undefined?{'Content-Type':'application/json'}:{}, body: body!==undefined?JSON.stringify(body):undefined});
    const data=await res.json().catch(()=>({}));
    if(res.status===401 && path!=='/api/login'){ showDashboard(false); }
    if(!res.ok) throw new Error(data.error ? tErr(data.error) : t('serverError',{status:res.status}));
    return data;
  }
  function msg(el, text, error=false){
    el.textContent=text; el.classList.toggle('error', error);
    if(text && !error){ clearTimeout(el._t); el._t=setTimeout(()=>{ el.textContent=''; }, 4000); }
  }
  const emptyLi=text=>`<li class="empty-note" style="border:0; padding:.4rem 0">${esc(text)}</li>`;

  let me=null, status=null;

  /* ---------- Login / session ---------- */
  const loginView=$('loginView'), dashboardView=$('dashboardView');
  const ADMIN_TABS=['zeiten','hinweis','team'];
  function renderUser(){
    if(!me) return;
    const admin=me.rolle==='admin';
    $('whoami').textContent=me.username+(admin?` (${t('admin')})`:'');
    ADMIN_TABS.forEach(name=>{
      const tab=$('tab-'+name);
      tab.disabled=!admin; tab.classList.toggle('locked',!admin);
      tab.title=admin?'':t('adminOnly');
    });
  }
  function showDashboard(show, user){
    me=show?user:null;
    loginView.style.display=show?'none':'';
    dashboardView.classList.toggle('show', show);
    if(!show) return;
    const admin=user.rolle==='admin';
    $('pwWarn').hidden=!user.mustChange;
    $('userPanel').hidden=!admin;
    renderUser();
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
    }catch(err){ m.textContent=err.message||t('loginFailed'); m.classList.add('show'); }
  });
  $('logoutBtn').addEventListener('click', async ()=>{
    try{ await api('/api/logout',{method:'POST'}); }catch{}
    showDashboard(false);
  });

  async function loadStatus(){
    try{ status=await api('/api/status'); }catch{ return; }
    renderStatus(); renderTermine();
  }
  function renderStatus(){
    if(!status) return;
    $('retentionNote').textContent=t('retention',{days:status.retentionDays})+' '+t(status.mail?'mailOn':'mailOff');
    const warn=$('dbWarn');
    if(status.ok){ warn.hidden=true; return; }
    warn.textContent=status.storage==='redis'
      ? t('dbDown',{err:status.error||t('unknown')})
      : t('dbMissing',{vars:status.envVars&&status.envVars.length?status.envVars.join(', '):t('none')});
    warn.hidden=false;
  }

  /* ---------- Tabs ---------- */
  const tabs=[...document.querySelectorAll('.tabs [role="tab"]')];
  function selectTab(name, focus){
    tabs.forEach(tab=>{
      const on=tab.id==='tab-'+name;
      tab.setAttribute('aria-selected', String(on)); tab.tabIndex=on?0:-1;
      $(tab.getAttribute('aria-controls')).hidden=!on;
      if(on && focus) tab.focus();
    });
  }
  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>selectTab(tab.id.slice(4)));
    tab.addEventListener('keydown',e=>{
      const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
      if(!d) return;
      e.preventDefault();
      const usable=tabs.filter(x=>!x.disabled), i=usable.indexOf(tab);
      selectTab(usable[(i+d+usable.length)%usable.length].id.slice(4), true);
    });
  });

  /* ---------- Termine ---------- */
  let termine=null, termineError='', view='liste', weekOffset=0, hours=null, feiertage=[];
  const termineList=$('termineList');
  const statusLabel=s=>t('st_'+s);

  async function loadTermine(){
    try{ termine=await api('/api/termine'); termineError=''; }
    catch(err){ termineError=err.message; }
    renderTermine();
  }
  function filtered(){
    const q=$('tSuche').value.trim().toLowerCase(), st=$('tFilter').value;
    return (termine||[]).filter(x=>(!st||x.status===st) &&
      (!q || [x.name,x.kontakt,x.anliegen,x.alter].some(v=>String(v||'').toLowerCase().includes(q))));
  }
  const sortKey=x=>(x.datum||'9999')+(x.zeit||'');

  function renderTermine(){
    const items=filtered().sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
    termineList.hidden=view!=='liste';
    $('weekView').hidden=view!=='woche';
    if(view==='woche') return renderWeek(items);
    if(termineError){ termineList.innerHTML=`<p class="empty-note">${esc(t('loadFailed',{err:termineError}))}</p>`; return; }
    if(!termine){ termineList.innerHTML=`<p class="empty-note">${esc(t('loading'))}</p>`; return; }
    if(!termine.length){ termineList.innerHTML=`<p class="empty-note">${esc(t('noRequests'))}</p>`; return; }
    if(!items.length){ termineList.innerHTML=`<p class="empty-note">${esc(t('noMatches'))}</p>`; return; }
    termineList.innerHTML='';
    const mailOn=status&&status.mail;
    items.forEach(x=>{
      const st=['offen','bestaetigt','abgelehnt','erledigt'].includes(x.status)?x.status:'offen';
      const when=x.datum&&x.zeit
        ? t('at',{date:`${t('days')[new Date(x.datum+'T12:00').getDay()]}, ${fmtDay(x.datum)}`, time:x.zeit})
        : (x.wann||'–');
      const card=document.createElement('div');
      card.className='termin-card '+st; card.id='t-'+x.id; card.dataset.id=x.id;
      card.innerHTML=`
        <div class="termin-head">
          <div><strong>${esc(x.name)}</strong><div class="termin-meta">${esc(t('received',{date:fmtStamp(x.createdAt)}))}</div></div>
          <span class="status-pill ${st}">${esc(statusLabel(st))}</span>
        </div>
        <div class="termin-body">
          <div><span>${esc(t('lblTermin'))}</span> ${esc(when)}</div>
          <div><span>${esc(t('lblAge'))}</span> ${x.alter?esc(x.alter):'–'}</div>
          <div><span>${esc(t('lblTopic'))}</span> ${x.anliegen?esc(x.anliegen):'–'}</div>
          <div><span>${esc(t('lblContact'))}</span> ${esc(x.kontakt)}</div>
        </div>
        <div class="termin-actions">
          ${st!=='bestaetigt'?`<button class="btn-sm ok" type="button" data-status="bestaetigt">${esc(t('confirm'))}</button>`:''}
          ${st!=='abgelehnt'?`<button class="btn-sm del" type="button" data-status="abgelehnt">${esc(t('decline'))}</button>`:''}
          ${st!=='erledigt'?`<button class="btn-sm" type="button" data-status="erledigt">${esc(t('done'))}</button>`:`<button class="btn-sm" type="button" data-status="offen">${esc(t('reopen'))}</button>`}
          <button class="btn-sm del" type="button" data-delete>${esc(t('delete'))}</button>
          ${isEmail(x.kontakt)?`<label class="check notify" title="${mailOn?'':esc(t('mailOff'))}"><input type="checkbox" data-notify ${mailOn?'checked':'disabled'}> ${esc(t('notify'))}</label>`:''}
        </div>`;
      termineList.appendChild(card);
    });
  }

  termineList.addEventListener('click', async e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const card=btn.closest('.termin-card'), id=card.dataset.id;
    try{
      if(btn.hasAttribute('data-delete')){
        if(!confirm(t('askDelete'))) return;
        await api('/api/termine/'+id,{method:'DELETE'});
        msg($('terminMsg'),t('deleted'));
      }else{
        const s=btn.dataset.status, notify=card.querySelector('[data-notify]');
        const r=await api('/api/termine/'+id,{method:'PATCH', body:{status:s, benachrichtigen:!!(notify&&notify.checked)}});
        const mailText=['sent','failed','no-email','not-configured'].includes(r.mail)?' '+t('mail_'+r.mail):'';
        msg($('terminMsg'), t('statusSet',{status:statusLabel(s)})+mailText, r.mail==='failed');
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
  function renderWeek(items){
    const now=new Date(), monday=new Date(now.getFullYear(), now.getMonth(), now.getDate()-((now.getDay()+6)%7)+weekOffset*7);
    const days=[...Array(7)].map((_,i)=>new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+i));
    const show=days.filter((d,i)=>i<6 || items.some(x=>x.datum===iso(d)));
    $('wLabel').textContent=`${fmtDay(iso(days[0]))} – ${fmtDay(iso(days[6]))}`;
    const grid=$('weekGrid'); grid.style.gridTemplateColumns=`repeat(${show.length},minmax(0,1fr))`; grid.innerHTML='';
    const today=iso(new Date());
    show.forEach(d=>{
      const key=iso(d), col=document.createElement('div');
      const closure=feiertage.find(f=>f.datum<=key && key<=(f.bis||f.datum));
      const open=hours && (hours[d.getDay()]||[]).length;
      col.className='week-day'+(key===today?' today':'')+(closure||!open?' closed':'');
      col.innerHTML=`<h3>${esc(t('daysShort')[d.getDay()])} ${fmtDay(key).slice(0,6)}</h3>`
        +(closure?`<div class="week-note">${esc(closure.name)}</div>`:(!open?`<div class="week-note">${esc(t('closed'))}</div>`:''));
      items.filter(x=>x.datum===key).forEach(x=>{
        const b=document.createElement('button');
        b.type='button'; b.className='week-item '+x.status; b.dataset.id=x.id;
        b.innerHTML=`<b>${esc(x.zeit)}</b> ${esc(x.name)}`;
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

  // CSV for Excel (semicolon, UTF-8 BOM); cells starting with = + - @ get a ' so they are not run as formulas
  $('csvBtn').addEventListener('click',()=>{
    const cell=v=>{ let s=String(v??''); if(/^[=+\-@]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
    const rows=[t('csv')].concat(filtered().sort((a,b)=>sortKey(a).localeCompare(sortKey(b))).map(x=>[
      x.datum?fmtDay(x.datum):'', x.zeit||'', x.name, x.alter, x.anliegen, x.kontakt, statusLabel(x.status), fmtStamp(x.createdAt)]));
    const blob=new Blob(['﻿'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`terminanfragen-${iso(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });

  /* ---------- Öffnungszeiten ---------- */
  const ORDER=[1,2,3,4,5,6,0];
  async function loadHours(){
    try{ hours=await api('/api/oeffnungszeiten'); }catch{ return; }
    $('hoursEditor').innerHTML='';
    renderHours();
    if(view==='woche') renderTermine();
  }
  // Re-rendering for a language change keeps whatever is currently typed in.
  function renderHours(){
    if(!hours) return;
    const ed=$('hoursEditor');
    const typed=[...ed.querySelectorAll('.hours-row')].map(r=>[...r.querySelectorAll('input')].map(i=>i.value));
    ed.innerHTML='';
    ORDER.forEach((d,rowIndex)=>{
      const row=document.createElement('div'); row.className='hours-row'; row.dataset.day=d;
      const r=hours[d]||[], day=t('days')[d];
      const val=(i,j)=>typed.length?typed[rowIndex][i*2+j]:(r[i]?r[i][j]:'');
      row.innerHTML=`<span>${esc(day)}</span>`+[0,1].map(i=>`<div class="hours-range">
        <input type="time" step="900" aria-label="${esc(t('rangeFrom',{day,n:i+1}))}" value="${val(i,0)}">
        <span aria-hidden="true">–</span>
        <input type="time" step="900" aria-label="${esc(t('rangeTo',{day,n:i+1}))}" value="${val(i,1)}"></div>`).join('');
      ed.appendChild(row);
    });
  }
  $('hoursForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const out={};
    for(const row of document.querySelectorAll('.hours-row')){
      const v=[...row.querySelectorAll('input')].map(i=>i.value);
      out[row.dataset.day]=[[v[0],v[1]],[v[2],v[3]]].filter(([a,b])=>a||b);
    }
    try{ hours=await api('/api/oeffnungszeiten',{method:'PUT', body:out}); msg($('hoursMsg'),t('hoursSaved')); }
    catch(err){ msg($('hoursMsg'), err.message, true); }
  });

  /* ---------- Schließtage & Sperrzeiten ---------- */
  let sperrzeiten=null;
  function listItems(ul, items, render, empty){
    ul.innerHTML='';
    if(!items.length){ ul.innerHTML=emptyLi(empty); return; }
    items.forEach(it=>{
      const li=document.createElement('li');
      li.innerHTML=render(it)+`<button class="btn-sm del" type="button" data-id="${esc(it.id)}">${esc(t('remove'))}</button>`;
      ul.appendChild(li);
    });
  }
  async function loadFeiertage(){
    try{ feiertage=await api('/api/feiertage'); }catch{ return; }
    renderFeiertage();
    if(view==='woche') renderTermine();
  }
  const renderFeiertage=()=>listItems($('feiertagList'), feiertage,
    f=>`<span><span class="fdate">${fmtDay(f.datum)}${f.bis?' – '+fmtDay(f.bis):''}</span> &nbsp; ${esc(f.name)}</span>`, t('noClosures'));
  $('feiertagForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/feiertage',{method:'POST', body:{datum:$('fDatum').value, bis:$('fBis').value||undefined, name:$('fName').value.trim()}});
      e.target.reset(); msg($('feiertagMsg'),t('closureSaved')); loadFeiertage();
    }catch(err){ msg($('feiertagMsg'), err.message, true); }
  });
  $('feiertagList').addEventListener('click', async e=>{
    const b=e.target.closest('button[data-id]'); if(!b || !confirm(t('askClosure'))) return;
    try{ await api('/api/feiertage/'+b.dataset.id,{method:'DELETE'}); loadFeiertage(); }catch(err){ msg($('feiertagMsg'), err.message, true); }
  });

  async function loadSperrzeiten(){
    try{ sperrzeiten=await api('/api/sperrzeiten'); }catch{ return; }
    renderSperrzeiten();
  }
  const renderSperrzeiten=()=>sperrzeiten && listItems($('sperrList'), sperrzeiten,
    s=>`<span><span class="fdate">${fmtDay(s.datum)}, ${s.von?`${s.von}–${s.bis}`:esc(t('wholeDay'))}</span> &nbsp; ${esc(s.grund||'')}</span>`, t('noBlocks'));
  $('sperrForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/sperrzeiten',{method:'POST', body:{datum:$('sDatum').value, von:$('sVon').value, bis:$('sBis').value, grund:$('sGrund').value.trim()}});
      e.target.reset(); msg($('sperrMsg'),t('blockSaved')); loadSperrzeiten();
    }catch(err){ msg($('sperrMsg'), err.message, true); }
  });
  $('sperrList').addEventListener('click', async e=>{
    const b=e.target.closest('button[data-id]'); if(!b || !confirm(t('askBlock'))) return;
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
      msg($('hinweisMsg'), t(h.aktiv?'noticeOn':'noticeOff'));
    }catch(err){ msg($('hinweisMsg'), err.message, true); }
  });

  /* ---------- Team ---------- */
  let team=null, editId=null, photo='', photoState='none', photoName='';
  const mForm=$('mitarbeiterForm');
  function renderTeamForm(){
    $('mBildName').textContent=photoState==='file'?photoName:t({busy:'processing',error:'photoError',keep:'keepPhoto'}[photoState]||'noPhoto');
    $('mSubmit').textContent=t(editId?'saveChanges':'addMember');
  }
  function resetTeamForm(){
    editId=null; photo=''; photoState='none'; mForm.reset();
    $('mCancel').hidden=true; $('mBildRemoveWrap').hidden=true;
    renderTeamForm();
  }
  $('mCancel').addEventListener('click', resetTeamForm);
  $('mBild').addEventListener('change',()=>{
    const file=$('mBild').files[0];
    if(!file){ photo=''; photoState=editId?'keep':'none'; return renderTeamForm(); }
    photoState='busy'; renderTeamForm();
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const max=480, k=Math.min(1, max/Math.max(img.width,img.height));
      const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      photo=c.toDataURL('image/jpeg',.82); photoName=file.name; photoState='file'; renderTeamForm(); URL.revokeObjectURL(url);
    };
    img.onerror=()=>{ photo=''; photoState='error'; renderTeamForm(); };
    img.src=url;
  });
  async function loadMitarbeiter(){
    try{ team=await api('/api/mitarbeiter'); }catch{ return; }
    renderTeam();
  }
  function renderTeam(){
    if(!team) return;
    const ul=$('mitarbeiterList'); ul.innerHTML='';
    if(!team.length){ ul.innerHTML=emptyLi(t('noMembers')); return; }
    team.forEach((m,i)=>{
      const li=document.createElement('li'); li.className='mitarbeiter-item'; li.dataset.id=m.id;
      li.innerHTML=`<div class="mitarbeiter-photo">${m.bild?'<img alt="">':''}</div>
        <div class="mitarbeiter-info"><strong></strong><div class="mitarbeiter-rolle"></div>${m.sprachen&&m.sprachen.length?'<div class="mitarbeiter-sprachen"></div>':''}</div>
        <div class="item-actions">
          <button class="btn-sm" type="button" data-move="-1" aria-label="${esc(t('up'))}" ${i===0?'disabled':''}>↑</button>
          <button class="btn-sm" type="button" data-move="1" aria-label="${esc(t('down'))}" ${i===team.length-1?'disabled':''}>↓</button>
          <button class="btn-sm ok" type="button" data-edit>${esc(t('edit'))}</button>
          <button class="btn-sm del" type="button" data-remove>${esc(t('remove'))}</button>
        </div>`;
      if(m.bild) li.querySelector('img').src=m.bild;
      li.querySelector('strong').textContent=(m.namen&&m.namen[lang])||m.name;
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
        editId=id; photo=''; photoState=m.bild?'keep':'none';
        $('mName').value=m.name; $('mRolle').value=m.rolle; $('mSprachen').value=(m.sprachen||[]).join(', ');
        $('mNameRu').value=(m.namen&&m.namen.ru)||''; $('mNameAr').value=(m.namen&&m.namen.ar)||'';
        $('mBildRemoveWrap').hidden=!m.bild; $('mBildRemove').checked=false; $('mCancel').hidden=false;
        renderTeamForm();
        mForm.scrollIntoView({behavior:'smooth', block:'center'}); $('mName').focus({preventScroll:true});
      }else if(b.hasAttribute('data-remove')){
        if(!confirm(t('askMember',{name:m.name}))) return;
        await api('/api/mitarbeiter/'+id,{method:'DELETE'});
        if(editId===id) resetTeamForm();
        loadMitarbeiter();
      }
    }catch(err){ msg($('mitarbeiterMsg'), err.message, true); }
  });
  mForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const body={name:$('mName').value.trim(), rolle:$('mRolle').value.trim(),
      sprachen:$('mSprachen').value.split(',').map(s=>s.trim()).filter(Boolean),
      namen:{ru:$('mNameRu').value.trim(), ar:$('mNameAr').value.trim()}};
    if(!body.name||!body.rolle) return msg($('mitarbeiterMsg'),t('needNameRole'), true);
    try{
      if(editId){
        if(photo) body.bild=photo; else if($('mBildRemove').checked) body.bild=null;
        await api('/api/mitarbeiter/'+editId,{method:'PUT', body});
        msg($('mitarbeiterMsg'),t('changesSaved'));
      }else{
        body.bild=photo;
        await api('/api/mitarbeiter',{method:'POST', body});
        msg($('mitarbeiterMsg'),t('memberAdded'));
      }
      resetTeamForm(); loadMitarbeiter();
    }catch(err){ msg($('mitarbeiterMsg'), err.message, true); }
  });

  /* ---------- Konto ---------- */
  $('pwForm').addEventListener('submit', async e=>{
    e.preventDefault();
    if($('pwNeu').value!==$('pwNeu2').value) return msg($('pwMsg'),t('pwMismatch'), true);
    try{
      await api('/api/passwort',{method:'POST', body:{alt:$('pwAlt').value, neu:$('pwNeu').value}});
      e.target.reset(); $('pwWarn').hidden=true; if(me) me.mustChange=false;
      msg($('pwMsg'),t('pwChanged'));
    }catch(err){ msg($('pwMsg'), err.message, true); }
  });

  let users=null;
  async function loadUsers(){
    try{ users=await api('/api/benutzer'); }catch{ return; }
    renderUsers();
  }
  function renderUsers(){
    if(!users) return;
    const ul=$('userList'); ul.innerHTML='';
    users.forEach(u=>{
      const li=document.createElement('li'); li.dataset.id=u.id; li.dataset.name=u.username;
      li.innerHTML=`<span><strong></strong><span class="role-pill">${esc(t(u.rolle==='admin'?'admin':'staffRole'))}${u.mustChange?' · '+esc(t('tempPw')):''}</span></span>
        <span class="item-actions"><button class="btn-sm" type="button" data-reset>${esc(t('resetPw'))}</button>
        ${me && u.id!==me.id?`<button class="btn-sm del" type="button" data-remove>${esc(t('delete'))}</button>`:''}</span>`;
      li.querySelector('strong').textContent=u.username;
      ul.appendChild(li);
    });
  }
  $('userList').addEventListener('click', async e=>{
    const b=e.target.closest('button'); if(!b) return;
    const li=b.closest('li'), id=li.dataset.id, name=li.dataset.name;
    try{
      if(b.hasAttribute('data-reset')){
        const pw=prompt(t('askNewPw',{name}));
        if(!pw) return;
        await api(`/api/benutzer/${id}/passwort`,{method:'POST', body:{passwort:pw}});
        msg($('userMsg'), id===me.id?t('ownPwChanged'):t('pwReset',{name}));
      }else if(b.hasAttribute('data-remove')){
        if(!confirm(t('askAccount',{name}))) return;
        await api('/api/benutzer/'+id,{method:'DELETE'});
        msg($('userMsg'),t('accountDeleted'));
      }
      loadUsers();
    }catch(err){ msg($('userMsg'), err.message, true); }
  });
  $('userForm').addEventListener('submit', async e=>{
    e.preventDefault();
    try{
      await api('/api/benutzer',{method:'POST', body:{username:$('uName').value, passwort:$('uPass').value, rolle:$('uRolle').value}});
      e.target.reset(); msg($('userMsg'),t('accountCreated')); loadUsers();
    }catch(err){ msg($('userMsg'), err.message, true); }
  });

  /* ---------- Language ---------- */
  addEventListener('i18n:change', e=>{
    lang=(e.detail&&e.detail.lang)||'de';
    const dyn=e.detail&&e.detail.dyn;
    T=dyn ? {...DE, ...dyn, err:{...DE.err, ...(dyn.err||{})}} : DE;
    renderUser(); renderStatus(); renderTermine(); renderHours(); renderFeiertage(); renderSperrzeiten();
    renderTeam(); renderTeamForm(); renderUsers();
  });
  renderTeamForm();
})();
