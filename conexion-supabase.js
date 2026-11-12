// Acceso y sincronización con Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm';
import { CloudLibrary } from './nube.mjs';
const URL = 'https://jqhhwfnwvhdgjitzygsn.supabase.co';
const KEY = 'sb_publishable_O9lSAjTh0WxE0a_WG1ZtPw_WHMfBmca';
const client = createClient(URL, KEY);
const button = document.createElement('button');
button.className = 'ghost';
button.textContent = '☁ Conexión de prueba';
document.querySelector('.top .controls').prepend(button);
const escCloud = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy = false;
async function showCloud() {
  if (busy) return;
  busy = true;
  try {
    const {data:{session},error} = await client.auth.getSession();
    if (error) throw error;
    let spaces = [];
    if (session) {
      const result = await client.from('workspaces').select('id,name,invite_code').order('created_at');
      if (result.error) throw result.error;
      spaces = result.data;
    }
    modal(`<div class="modal-title"><h2>Conexión de prueba</h2><button class="x ghost" id="cloud-close">×</button></div>
      <p class="hint">Versión de prueba: iniciá sesión y abrí un espacio compartido. Conservá tu respaldo local mientras se completan las pruebas.</p>
      <p id="cloud-status" role="status"></p>
      ${session ? `<p>Sesión: <b>${escCloud(session.user.email)}</b></p>
        <label class="field">Tus espacios<select id="cloud-workspace"><option value="">Elegí un espacio</option>${spaces.map(s=>`<option value="${escCloud(s.id)}">${escCloud(s.name)}</option>`).join('')}</select></label>
        <p id="cloud-invite"></p><p id="cloud-counts"></p><button class="add" id="cloud-open">Abrir biblioteca compartida</button>
        <label class="field">Nombre de un espacio nuevo<input id="cloud-name" maxlength="80"></label>
        <button class="add" id="cloud-create">Crear espacio</button>
        <label class="field">Código de invitación<input id="cloud-code" autocomplete="off"></label>
        <button class="ghost" id="cloud-join">Unirse al espacio</button>
        <div class="modal-actions"><button class="ghost" id="cloud-logout">Cerrar sesión</button></div>` :
      `<label class="field">Correo electrónico<input id="cloud-email" type="email" autocomplete="username"></label>
       <label class="field">Contraseña<input id="cloud-password" type="password" autocomplete="current-password"></label>
       <div class="modal-actions"><button class="ghost" id="cloud-signup">Crear cuenta</button><button class="add" id="cloud-login">Ingresar</button></div>`}`);
    const $c = id => document.getElementById(id);
    const tell = value => { $c('cloud-status').textContent = value; };
    const act = (id, handler) => { if ($c(id)) $c(id).onclick = async e => { e.target.disabled=true; try { await handler(); } catch(error) { tell(error.message || 'No se pudo completar la operación.'); } finally { e.target.disabled=false; } }; };
    $c('cloud-close').onclick = closeModal;
    act('cloud-login', async () => { const {error} = await client.auth.signInWithPassword({email:$c('cloud-email').value.trim(),password:$c('cloud-password').value}); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-signup', async () => { const {data,error} = await client.auth.signUp({email:$c('cloud-email').value.trim(),password:$c('cloud-password').value}); if(error) throw error; if(data.session){busy=false;await showCloud();} else tell('Revisá tu correo para confirmar la cuenta antes de ingresar.'); });
    act('cloud-logout', async () => { if(activeLibrary) throw Error('Recargá la página antes de cerrar la sesión en la biblioteca de prueba.'); const {error} = await client.auth.signOut(); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-create', async () => { const name=$c('cloud-name').value.trim(); if(!name) throw Error('Escribí el nombre del espacio.'); const {error}=await client.rpc('create_workspace',{p_name:name}); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-join', async () => { const code=$c('cloud-code').value.trim(); if(!code) throw Error('Ingresá el código de invitación.'); const {error}=await client.rpc('join_workspace',{p_invite_code:code}); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-open', async () => { const selected=spaces.find(s=>s.id===$c('cloud-workspace').value); if(!selected) throw Error('Elegí un espacio.'); await openShared(selected,session); });
    if($c('cloud-workspace')) $c('cloud-workspace').onchange = async e => {
      const selected=spaces.find(s=>s.id===e.target.value);
      $c('cloud-invite').textContent=selected ? `Código de invitación: ${selected.invite_code}` : '';
      $c('cloud-counts').textContent='';
      if(!selected) return;
      try {
        const [decks,cards]=await Promise.all(['decks','cards'].map(table=>client.from(table).select('id',{count:'exact',head:true}).eq('workspace_id',selected.id)));
        if(decks.error || cards.error) throw decks.error || cards.error;
        $c('cloud-counts').textContent=`En Supabase: ${decks.count} mazos y ${cards.count} tarjetas.`;
      } catch(error) { tell(error.message || 'No se pudo consultar el espacio.'); }
    };
  } catch(error) { alert('No se pudo conectar: ' + (error.message || error)); }
  finally { busy=false; }
}
button.onclick=showCloud;

// La copia local original conserva su base de datos propia.
let activeLibrary=null, queueTimer=null, inFlight=false, generation=0, synced=0, pendingKey='';
const rememberedWorkspaceKey = userId => 'flash-last-workspace-'+userId;
const localSave=save;
let cloudStatus=document.createElement('span');cloudStatus.className='status';cloudStatus.style.margin='0 8px';button.after(cloudStatus);
function status(message){cloudStatus.textContent=message;button.title=message}
async function persist(){await localSave();if(activeLibrary){localStorage.setItem(pendingKey,'1');generation++;status('Cambios pendientes');clearTimeout(queueTimer);queueTimer=setTimeout(flush,800)}}
save=persist;
async function flush(){
 if(!activeLibrary||inFlight)return;
 inFlight=true;
 try {while(synced<generation){let n=generation,copy=structuredClone(state);await activeLibrary.save(copy);synced=n;}localStorage.removeItem(pendingKey);status('Sincronizado');}
 catch(e){status('Error al sincronizar: '+(e.message||e));console.error('Sincronización:',e)}
 finally {inFlight=false;if(synced<generation && !cloudStatus.textContent.startsWith('Error'))queueTimer=setTimeout(flush,500)}
}
async function recoverLocal(dbName){
 const request=indexedDB.open(dbName,1);
 const db=await new Promise((ok,no)=>{request.onupgradeneeded=()=>request.result.createObjectStore('app');request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)});
 const old=await new Promise((ok,no)=>{let q=db.transaction('app').objectStore('app').get('state');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});db.close();
 if(!old)throw Error('No se encontró la copia local pendiente.');
 modal(`<div class="modal-title"><h2>Recuperar cambios pendientes</h2><button class="x ghost" id="recover-close">×</button></div><p class="hint">Copiá este respaldo y guardalo en un archivo. La última sincronización no se completó, por lo que no se reemplazarán tus cambios automáticamente.</p><textarea class="field" id="recover-text" style="width:100%;min-height:180px"></textarea>`);
 document.getElementById('recover-text').value='FLASH_INFINITO_V2\n'+JSON.stringify(old);document.getElementById('recover-close').onclick=closeModal;
}
async function openShared(space,session){
 await window.flashAppReady;
 if(activeLibrary)throw Error('Recargá la página para cambiar de espacio.');
 let dbName='flash-cloud-'+session.user.id+'-'+space.id;
 pendingKey='flash-pending-'+session.user.id+'-'+space.id;
 if(localStorage.getItem(pendingKey)){await recoverLocal(dbName);return}
 status('Descargando biblioteca…');
 const library=new CloudLibrary(client,space.id,session.user.id);
 try {
  let remote=await library.load();
  DB=dbName;state=remote;activeLibrary=library;
  closeModal();await localSave();localStorage.setItem(rememberedWorkspaceKey(session.user.id),space.id);render();status('Sincronizado · '+space.name);
  button.textContent='☁ Biblioteca compartida';button.onclick=sharedMenu;
 } catch(e){status('No se pudo abrir la biblioteca');throw e}
}
function sharedMenu(){
 modal(`<div class="modal-title"><h2>Biblioteca compartida</h2><button class="x ghost" id="shared-close">×</button></div><p id="shared-status"></p><p class="hint">El contenido se comparte con el otro integrante. Tu progreso es individual.</p><button class="ghost" id="shared-signout">Cerrar sesión</button> <button class="ghost" id="shared-retry">Reintentar sincronización</button> <button class="ghost" id="shared-refresh">Actualizar desde la nube</button><hr><p>Para importar desde la aplicación original, pegá el respaldo copiado desde Guardado. Se admite únicamente en un espacio vacío.</p><textarea id="shared-backup" placeholder="FLASH_INFINITO_V2…" style="width:100%;min-height:120px"></textarea><div class="modal-actions"><button class="add" id="shared-import">Importar respaldo</button></div>`);
 document.getElementById('shared-status').textContent=cloudStatus.textContent;
 document.getElementById('shared-close').onclick=closeModal;
 document.getElementById('shared-signout').onclick=async e=>{e.target.disabled=true;try{
  if(inFlight||synced<generation||localStorage.getItem(pendingKey))throw Error('Hay cambios sin sincronizar. Reintentá antes de cerrar sesión.');
  const userId=activeLibrary.user;const {error}=await client.auth.signOut();if(error)throw error;
  localStorage.removeItem(rememberedWorkspaceKey(userId));location.reload();
 }catch(err){alert('No se pudo cerrar sesión: '+(err.message||err));e.target.disabled=false}};
 document.getElementById('shared-retry').onclick=()=>{status('Reintentando…');flush()};
 document.getElementById('shared-refresh').onclick=async e=>{e.target.disabled=true;try{
  if(inFlight||synced<generation)throw Error('Hay cambios pendientes. Esperá a que se sincronicen antes de actualizar.');
  const n=generation,library=new CloudLibrary(client,activeLibrary.workspace,activeLibrary.user),remote=await library.load();
  if(n!==generation)throw Error('La biblioteca cambió durante la actualización. Intentá de nuevo.');
  state=remote;activeLibrary=library;await localSave();closeModal();render();status('Actualizado desde la nube');
 }catch(err){alert('No se pudo actualizar: '+(err.message||err))}finally{e.target.disabled=false}};
 document.getElementById('shared-import').onclick=async e=>{e.target.disabled=true;try{
  if(inFlight||synced<generation||state.subjects.length||state.folders.length||state.decks.length||state.cards.length)throw Error('La importación requiere un espacio vacío y sin cambios pendientes.');
  let next=activeLibrary.prepareBackup(document.getElementById('shared-backup').value);
  if(!confirm(`Se importarán ${next.decks.length} mazos y ${next.cards.length} tarjetas, incluidas sus imágenes. Conservá el respaldo original. ¿Continuar?`))return;
  state=next;closeModal();await save();render();toast('Importación iniciada; esperá a que indique Sincronizado');
 }catch(err){alert('No se pudo importar: '+(err.message||err))}finally{e.target.disabled=false}};
}
window.addEventListener('beforeunload', e=>{if(activeLibrary&&(inFlight||synced<generation)){e.preventDefault();e.returnValue=''}});

const localDeleteDeck=deleteDeck,localDeleteFolder=deleteFolder,localBackupModal=backupModal;
deleteDeck=(...args)=>activeLibrary?toast('Todavía no se pueden eliminar mazos compartidos'):localDeleteDeck(...args);
deleteFolder=(...args)=>activeLibrary?toast('Todavía no se pueden eliminar carpetas compartidas'):localDeleteFolder(...args);
document.getElementById('backup').onclick=()=>{
 if(!activeLibrary)return localBackupModal();
 modal(`<div class="modal-title"><h2>Respaldo de esta biblioteca</h2><button class="x ghost" id="backup-cloud-close">×</button></div><p>Copiá este texto y guardalo en un archivo.</p><textarea id="backup-cloud-text" style="width:100%;min-height:180px"></textarea><button class="add" id="backup-cloud-copy">Copiar</button>`);
 let field=document.getElementById('backup-cloud-text');field.value='FLASH_INFINITO_V2\n'+JSON.stringify(state);
 document.getElementById('backup-cloud-close').onclick=closeModal;
 document.getElementById('backup-cloud-copy').onclick=async()=>{try{await navigator.clipboard.writeText(field.value);toast('Respaldo copiado')}catch{field.select();toast('Copiá el texto seleccionado')}};
};


// Recordar únicamente el espacio de la cuenta autenticada; no guardar códigos de invitación.
async function reopenLastWorkspace(){
 try {
  await window.flashAppReady;
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session)return;
  const workspaceId=localStorage.getItem(rememberedWorkspaceKey(session.user.id));
  if(!workspaceId)return;
  const result=await client.from('workspaces').select('id,name').eq('id',workspaceId).maybeSingle();
  if(result.error)throw result.error;
  if(!result.data){localStorage.removeItem(rememberedWorkspaceKey(session.user.id));status('El espacio ya no está disponible');return;}
  await openShared(result.data,session);
 }catch(error){status('No se pudo abrir el espacio: '+(error.message||error));}
}
reopenLastWorkspace();
