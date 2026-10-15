/* Personal inbox. Reading a message never changes chores or the garden wallet. */
(function(){
'use strict';
window.createHomeNotifications=function(api){
 const esc=api.escape,icon=api.icon,cacheKey=(api.preview?'hc.preview.v5':'hc')+'.notifications.'+api.room;
 let thanks={},receipts={},outbox={},readsRef=null,readsReady=api.preview,writing=false,retryTimer,toastTimer,dialog=null,focusBefore=null,mounted=false,lastPerson=null,limit=40;
 const announced=new Set();let openingUnread=new Set();
 try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'{}');receipts=cached.receipts||{};outbox=cached.outbox||{};}catch(e){}
 const persist=()=>{try{localStorage.setItem(cacheKey,JSON.stringify({receipts,outbox}));}catch(e){}};
 const action=(name,label,cls='',attrs='')=>'<button type="button" data-family-notification="'+name+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
 const isRead=(id,person=api.getMe())=>!!receipts[person]?.[id];
 function inbox(){const me=api.getMe();return Object.entries(thanks).filter(([,t])=>t&&t.to===me).map(([id,t])=>({...t,id})).sort((a,b)=>(Number(b.at)||Date.parse(b.day+'T12:00:00')||0)-(Number(a.at)||Date.parse(a.day+'T12:00:00')||0)||b.id.localeCompare(a.id));}
 const unread=()=>inbox().filter(t=>!isRead(t.id));
 function bell(cls=''){return action('open',icon('bell')+'<span class="family-notification-count" hidden></span>','family-notification-bell '+cls,'aria-label="Уведомления" aria-haspopup="dialog"');}
 function paintBells(){const n=unread().length;api.root.querySelectorAll('.family-notification-bell').forEach(el=>{const badge=el.querySelector('.family-notification-count');badge.hidden=!n;badge.textContent=n>99?'99+':String(n);el.classList.toggle('has-unread',n>0);el.setAttribute('aria-label',n?'Уведомления: '+n+' непрочитанных':'Уведомления, новых нет');});}
 function ensureBell(){if(api.root.querySelector('.g2-hud'))return;const settings=api.root.querySelector('.hd > .page-settings');if(settings){const actions=document.createElement('div');actions.className='page-actions';settings.before(actions);actions.append(settings);actions.insertAdjacentHTML('afterbegin',bell());}}
 function flushReads(){
  if(api.preview||!readsRef||writing||!api.connected())return;
  const patch={};for(const [person,ids] of Object.entries(outbox))for(const id of Object.keys(ids))patch[person+'/'+id]=true;
  if(!Object.keys(patch).length)return;
  writing=true;
  readsRef.update(patch).then(()=>{for(const path of Object.keys(patch)){const [person,id]=path.split('/');if(outbox[person])delete outbox[person][id];}writing=false;persist();flushReads();}).catch(()=>{writing=false;clearTimeout(retryTimer);retryTimer=setTimeout(flushReads,5000);});
 }
 function markRead(ids){const me=api.getMe();receipts[me]=receipts[me]||{};outbox[me]=outbox[me]||{};let changed=false;for(const id of ids){if(isRead(id))continue;receipts[me][id]=true;if(!api.preview)outbox[me][id]=true;changed=true;}if(changed){persist();paintBells();flushReads();}}
 function timeLabel(t){if(Number(t.at)>0)return new Date(Number(t.at)).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});const date=new Date(t.day+'T12:00:00');return Number.isNaN(date.getTime())?'Спасибо за заботу о доме':'За дело '+date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});}
 function content(){const all=inbox(),person=api.person(api.getMe());return '<div class="family-inbox-heading"><span class="family-inbox-symbol">'+icon('bell')+'</span><div><h2 id="family-inbox-title">Уведомления</h2><p>'+esc(person?.name||'Семья')+' · ваши сообщения</p></div>'+action('close',icon('x'),'family-inbox-close','aria-label="Закрыть уведомления"')+'</div>'+(all.length?'<p class="family-inbox-intro">Здесь близкие говорят вам спасибо.</p><ol class="family-inbox-list">'+all.slice(0,limit).map(t=>{const sender=api.person(t.from)?.name||'Близкий человек',fresh=openingUnread.has(t.id)||!isRead(t.id);return '<li class="family-inbox-item'+(fresh?' is-new':'')+'"><span class="family-inbox-heart">'+icon('heart')+'</span><div><div class="family-inbox-message"><b>'+esc(sender)+'</b><span>Спасибо за заботу!</span>'+(fresh?'<small class="family-inbox-new">Новое</small>':'')+'</div><p>За «'+esc(t.title||'домашнее дело')+'»</p><time'+(Number(t.at)>0?' datetime="'+new Date(Number(t.at)).toISOString()+'"':'')+'>'+esc(timeLabel(t))+'</time></div></li>';}).join('')+'</ol>'+(all.length>limit?action('more','Показать ещё','family-inbox-more'):''):'<div class="family-inbox-empty">'+icon('heart-handshake')+'<h3>Забота не остаётся незамеченной</h3><p>Когда вам скажут «Спасибо» за дело, уведомление появится здесь.</p></div>');}
 function renderPanel(){if(!dialog?.open)return;const scroll=dialog.scrollTop,focused=document.activeElement?.dataset.familyNotification;dialog.innerHTML=content();dialog.scrollTop=scroll;if(focused)dialog.querySelector('[data-family-notification="'+focused+'"]')?.focus({preventScroll:true});}
 function hideToast(){clearTimeout(toastTimer);document.getElementById('family-notification-toast')?.remove();}
 function announce(){
  if(!mounted||!readsReady||!api.isReady()||document.hidden||dialog?.open)return;
  const items=unread().filter(t=>!announced.has(api.getMe()+'/'+t.id));if(!items.length)return;
  // Keep notifications available while another dialog is open, without covering it.
  if(document.querySelector('dialog[open]'))return;
  items.forEach(t=>announced.add(api.getMe()+'/'+t.id));hideToast();
  const latest=items[0],sender=api.person(latest.from)?.name||'Близкий человек';
  const toast=document.createElement('aside');toast.id='family-notification-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  toast.innerHTML='<span class="family-toast-icon">'+icon('heart')+'</span><div><b>'+esc(items.length===1?sender+': спасибо!':'Новых благодарностей: '+items.length)+'</b><p>'+esc(items.length===1?'За «'+latest.title+'»':'Откройте уведомления, чтобы их прочитать')+'</p></div>'+action('open','Открыть','family-toast-open')+action('dismiss',icon('x'),'family-toast-dismiss','aria-label="Скрыть уведомление"');
  document.body.append(toast);toastTimer=setTimeout(hideToast,9000);
 }
 function close(){if(!dialog)return;dialog.close();dialog.remove();dialog=null;openingUnread.clear();const target=focusBefore?.isConnected?focusBefore:api.root.querySelector('.family-notification-bell');target?.focus({preventScroll:true});}
 function open(){
  if(dialog?.open)return;focusBefore=document.activeElement;hideToast();limit=40;openingUnread=new Set(unread().map(t=>t.id));
  dialog=document.createElement('dialog');dialog.id='family-notifications';dialog.className='family-inbox';dialog.setAttribute('aria-labelledby','family-inbox-title');dialog.innerHTML=content();
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  document.body.append(dialog);dialog.showModal();markRead(inbox().map(t=>t.id));
 }
 function sync(){if(!mounted)return;const me=api.getMe();if(lastPerson!==me){close();hideToast();lastPerson=me;}ensureBell();paintBells();if(dialog?.open){const newIds=unread().map(t=>t.id);newIds.forEach(id=>openingUnread.add(id));renderPanel();markRead(newIds);}announce();}
 function connect(db){
  if(api.preview)return;readsRef=db.ref('rooms/'+api.room+'/notificationReads');
  readsRef.on('value',snap=>{for(const [person,ids] of Object.entries(snap.val()||{})){receipts[person]=receipts[person]||{};for(const [id,value] of Object.entries(ids||{}))if(value)receipts[person][id]=true;}readsReady=true;persist();paintBells();if(!unread().length)hideToast();announce();},()=>{readsReady=true;announce();});
  db.ref('.info/connected').on('value',snap=>{if(snap.val()){clearTimeout(retryTimer);retryTimer=setTimeout(flushReads,0);}});
 }
 document.addEventListener('click',e=>{const el=e.target.closest('[data-family-notification]');if(!el||(!api.root.contains(el)&&!el.closest('#family-notifications,#family-notification-toast')))return;const a=el.dataset.familyNotification;if(a==='open')open();else if(a==='close')close();else if(a==='dismiss')hideToast();else if(a==='more'){limit+=40;renderPanel();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){announce();flushReads();}});
 // A garden dialog can delay the toast; show it after that dialog is dismissed.
 document.addEventListener('close',()=>queueMicrotask(announce),true);
 return {bell,connect,receive(value){thanks=value||{};sync();},mount(){mounted=true;sync();flushReads();}};
};
})();
