import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBackup} from '../sync-core.mjs';
import {CloudLibrary} from '../nube.mjs';
const backup={decks:[{id:'d',name:'Renal'}],cards:[{id:'c',deckId:'d',front:'Pregunta',back:'Respuesta',frontImg:'data:image/png;base64,AA==',draft:false}],review:{turn:5,due:{c:12}}};
test('migración conserva contenido, imagen y repetición, y convierte referencias',()=>{
 let n=0,x=normalizeBackup(backup,()=>`uuid-${++n}`);
 assert.equal(x.subjects.length,1);assert.equal(x.folders[0].subjectId,x.subjects[0].id);assert.equal(x.decks[0].folderId,x.folders[0].id);assert.equal(x.cards[0].deckId,x.decks[0].id);assert.equal(x.cards[0].frontImg,backup.cards[0].frontImg);assert.equal(x.review.due[x.cards[0].id],7);
});
test('rechaza referencias incompletas y duplicadas',()=>{
 assert.throws(()=>normalizeBackup({...backup,cards:[{...backup.cards[0],deckId:'ausente'}]},()=>crypto.randomUUID()));
 assert.throws(()=>normalizeBackup({...backup,cards:[backup.cards[0],backup.cards[0]]},()=>crypto.randomUUID()));
});
function fake(){
 const db=Object.fromEntries(['subjects','folders','decks','cards','card_progress'].map(x=>[x,[]]));let tick=0;
 return {db,from(table){let filters=[],action='read',body; const q={select(){return q},eq(k,v){filters.push(x=>x[k]===v);return q},order(){return q},range(a,b){q.slice=[a,b];return q},insert(x){action='insert';body=x;return q},update(x){action='update';body=x;return q},delete(){action='delete';return q},then(ok,no){try{let list=db[table], rows=list.filter(x=>filters.every(f=>f(x)));if(action==='insert'){let r={...body,updated_at:String(++tick)};list.push(r);rows=[r]}if(action==='update'){rows.forEach(x=>Object.assign(x,body,{updated_at:String(++tick)}))}if(action==='delete'){db[table]=list.filter(x=>!rows.includes(x))}if(q.slice)rows=rows.slice(q.slice[0],q.slice[1]+1);return Promise.resolve({data:structuredClone(rows),error:null}).then(ok,no)}catch(e){return Promise.reject(e).then(ok,no)}}};return q},storage:{from(){return {upload:async()=>({data:{},error:null})}}}};
}
test('sincroniza cambios por objeto y detecta un conflicto remoto',async()=>{
 let client=fake(),cloud=new CloudLibrary(client,'w','user');let state=await cloud.load();
 state.subjects=[{id:'s',name:'Materia'}];state.folders=[{id:'f',subjectId:'s',name:'Carpeta'}];state.decks=[{id:'d',folderId:'f',name:'Mazo'}];state.cards=[{id:'c',deckId:'d',front:'A',back:'B',frontImg:'',backImg:'',draft:false}];state.review={turn:0,due:{c:5}};
 await cloud.save(state);assert.equal(client.db.cards.length,1);assert.equal(client.db.card_progress[0].next_after,5);
 state.cards[0].back='Editada';await cloud.save(state);assert.equal(client.db.cards[0].back.text,'Editada');
 client.db.cards[0].updated_at='cambiado';state.cards[0].front='Otro cambio';await assert.rejects(cloud.save(state),/Otra sesión/);
});
test('evita borrar una carpeta compartida mediante cascada',async()=>{
 let client=fake(),cloud=new CloudLibrary(client,'w','user');let state=await cloud.load();state.subjects=[{id:'s',name:'Materia'}];await cloud.save(state);state.subjects=[];await assert.rejects(cloud.save(state),/eliminación/);assert.equal(client.db.subjects.length,1);
});
