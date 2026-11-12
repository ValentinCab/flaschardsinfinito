import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../conexion-supabase.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('async function reopenLastWorkspace(){'),source.indexOf('\nreopenLastWorkspace();'));
function setup({session={user:{id:'usuario'}},workspace='espacio',data={id:'espacio',name:'Mazo'},pending=false,error=null}={}){
 const calls=[], storage=new Map(workspace?[['flash-last-workspace-usuario',workspace]]:[]);let status='';
 const localStorage={getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)};
 const client={auth:{getSession:async()=>({data:{session},error})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data,error:null})})};
 const ctx={client,localStorage,window:{flashAppReady:Promise.resolve()},rememberedWorkspaceKey:id=>'flash-last-workspace-'+id,status:x=>{status=x},openShared:async(s,u)=>{calls.push({s,u,pending})}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);return {ctx,calls,storage,status:()=>status};
}
test('reabre el espacio recordado de la cuenta conectada',async()=>{const x=setup();await x.ctx.reopenLastWorkspace();assert.equal(x.calls.length,1);assert.equal(x.calls[0].s.id,'espacio')});
test('no abre sin sesión ni comparte la selección entre usuarios',async()=>{for(const opts of [{session:null},{workspace:null},{session:{user:{id:'otra'}}}]){const x=setup(opts);await x.ctx.reopenLastWorkspace();assert.equal(x.calls.length,0)}});
test('si el acceso ya no existe limpia la selección',async()=>{const x=setup({data:null});await x.ctx.reopenLastWorkspace();assert.equal(x.calls.length,0);assert.equal(x.storage.size,0);assert.match(x.status(),/no está disponible/)});
test('si falla la conexión no borra la selección',async()=>{const x=setup({error:Error('sin conexión')});await x.ctx.reopenLastWorkspace();assert.equal(x.storage.size,1);assert.match(x.status(),/sin conexión/)});
test('la reapertura utiliza el mismo control de cambios pendientes que la apertura manual',()=>{assert.match(source,/if\(localStorage\.getItem\(pendingKey\)\)\{await recoverLocal\(dbName\);return\}/);assert.match(fn,/await openShared\(result\.data,session\)/)});
