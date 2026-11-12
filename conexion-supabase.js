// Vista de prueba: autenticación y acceso a un espacio. La biblioteca local no se sincroniza aún.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm';
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
      <p class="hint">Esta pantalla prueba el acceso a Supabase. La sincronización y la importación todavía no están activadas. Conservá tu respaldo local.</p>
      <p id="cloud-status" role="status"></p>
      ${session ? `<p>Sesión: <b>${escCloud(session.user.email)}</b></p>
        <label class="field">Tus espacios<select id="cloud-workspace"><option value="">Elegí un espacio</option>${spaces.map(s=>`<option value="${escCloud(s.id)}">${escCloud(s.name)}</option>`).join('')}</select></label>
        <p id="cloud-invite"></p><p id="cloud-counts"></p>
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
    act('cloud-logout', async () => { const {error} = await client.auth.signOut(); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-create', async () => { const name=$c('cloud-name').value.trim(); if(!name) throw Error('Escribí el nombre del espacio.'); const {error}=await client.rpc('create_workspace',{p_name:name}); if(error) throw error; busy=false; await showCloud(); });
    act('cloud-join', async () => { const code=$c('cloud-code').value.trim(); if(!code) throw Error('Ingresá el código de invitación.'); const {error}=await client.rpc('join_workspace',{p_invite_code:code}); if(error) throw error; busy=false; await showCloud(); });
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
