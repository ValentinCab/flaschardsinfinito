import {normalizeBackup} from './sync-core.mjs';
const tables=['subjects','folders','decks','cards'];
const check=({data,error})=>{if(error) throw error;return data};
const map=(xs)=>new Map(xs.map(x=>[x.id,x]));
const clone=x=>structuredClone(x);
async function all(client,table,query) {
  let out=[],start=0;
  while(true){let rows=check(await query(client.from(table).select('*')).range(start,start+499));out.push(...rows);if(rows.length<500)return out;start+=rows.length;}
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
async function imageData(blob){return await new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(blob)})}
export class CloudLibrary {
 constructor(client,workspace,user){this.client=client;this.workspace=workspace;this.user=user;this.remote={};this.local={};this.images=new Map();this.progress=new Map()}
 async load(){
  for(const t of tables) this.remote[t]=map(await all(this.client,t,q=>q.eq('workspace_id',this.workspace).order('id')));
  let ids=[...this.remote.cards.keys()], progress=[];
  // A user can only read their own progress, but filter explicitly too.
  if(ids.length) { let allowed=new Set(ids); progress=(await all(this.client,'card_progress',q=>q.eq('user_id',this.user).order('card_id'))).filter(p=>allowed.has(p.card_id)); }
  this.progress=map(progress.map(x=>({...x,id:x.card_id})));
  const convert=async side=>{if(!side?.imagePath)return '';let p=side.imagePath;if(!p.startsWith(this.workspace+'/'))throw Error('Una imagen referencia otro espacio.');if(!this.images.has(p)){let blob=check(await this.client.storage.from('flashcards-images').download(p));this.images.set(p,await imageData(blob))}return this.images.get(p)};
  const cards=[];
  for(const c of this.remote.cards.values())cards.push({id:c.id,deckId:c.deck_id,front:c.front?.text||'',back:c.back?.text||'',frontImg:await convert(c.front),backImg:await convert(c.back),draft:c.is_draft});
  let state={subjects:[...this.remote.subjects.values()].map(x=>({id:x.id,name:x.name})),folders:[...this.remote.folders.values()].map(x=>({id:x.id,name:x.name,subjectId:x.subject_id})),decks:[...this.remote.decks.values()].map(x=>({id:x.id,name:x.name,folderId:x.folder_id})),cards,theme:'dark',activeDeck:'all',activeSubject:'',studySelection:[],review:{turn:0,due:{}},reviewDirection:'front',current:null,flipped:false,migratedFisioV2:true,selectionModalV1:true,importedRenalV1:true};
  state.activeSubject=state.subjects[0]?.id||'';state.studySelection=state.decks.map(x=>x.id);
  for(const [id,p] of this.progress) state.review.due[id]=p.next_after||0;
  this.remember(state);return state;
 }
 remember(state){for(const t of tables)this.local[t]=map(clone(state[t]));this.progressLocal=this.progressFrom(state)}
 progressFrom(state){let m=new Map(),turn=Number(state.review?.turn)||0;for(const c of state.cards){const n=state.review?.due?.[c.id];if(n!==undefined)m.set(c.id,Math.max(0,(Number(n)||0)-turn))}return m}
 async upload(data){if(!data)return null;if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(data))throw Error('Formato de imagen no compatible. Usá PNG, JPG, WebP o GIF.');let blob=await (await fetch(data)).blob();let path=this.workspace+'/'+crypto.randomUUID();check(await this.client.storage.from('flashcards-images').upload(path,blob,{contentType:blob.type,upsert:false}));this.images.set(path,data);return path}
 async row(t,item,old){let row={id:item.id,workspace_id:this.workspace};if(t==='subjects')return {...row,name:item.name};if(t==='folders')return {...row,name:item.name,subject_id:item.subjectId};if(t==='decks')return {...row,name:item.name,folder_id:item.folderId};
  const oldRemote=this.remote.cards.get(item.id);const side=async k=>({text:item[k]||'',formula:'',imagePath:old && old[k+'Img']===item[k+'Img'] ? (oldRemote?.[k]?.imagePath||null) : await this.upload(item[k+'Img'])});
  return {...row,deck_id:item.deckId,front:await side('front'),back:await side('back'),is_draft:!!item.draft};
 }
 async save(state){
  let next={}; for(const t of tables)next[t]=map(clone(state[t]));
  for(const t of ['subjects','folders','decks']) for(const id of this.local[t].keys()) if(!next[t].has(id)) throw Error('La eliminación de carpetas y mazos compartidos aún no está disponible.');
  // Delete children first; each update/delete is conditional on the server revision.
  for(const t of [...tables].reverse())for(const [id,old] of [...this.local[t]])if(!next[t].has(id)){
    const remote=this.remote[t].get(id);if(!remote)continue;
    let result=check(await this.client.from(t).delete().eq('id',id).eq('workspace_id',this.workspace).eq('updated_at',remote.updated_at).select('id'));
    if(result.length!==1)throw Error('Hay un cambio simultáneo o una eliminación en otra sesión. Exportá tu respaldo local antes de recargar.');
    this.local[t].delete(id);this.remote[t].delete(id);if(t==='cards'){this.progress.delete(id);this.progressLocal.delete(id)}
  }
  for(const t of tables)for(const [id,item] of next[t]){
    let old=this.local[t].get(id);if(old&&equal(old,item))continue;
    let row=await this.row(t,item,old),result;
    if(old){let r=this.remote[t].get(id);result=check(await this.client.from(t).update(row).eq('id',id).eq('workspace_id',this.workspace).eq('updated_at',r.updated_at).select());if(result.length!==1)throw Error('Otra sesión modificó este elemento. Exportá tu respaldo local antes de recargar.');}
    else result=check(await this.client.from(t).insert(row).select());
    this.remote[t].set(id,result[0]);this.local[t].set(id,clone(item));
  }
  let pnext=this.progressFrom(state);
  for(const [id,n] of pnext){if(this.progressLocal.get(id)===n)continue;let old=this.progress.get(id), row={card_id:id,user_id:this.user,next_after:n};let result;
    if(old){result=check(await this.client.from('card_progress').update(row).eq('card_id',id).eq('user_id',this.user).eq('updated_at',old.updated_at).select());if(result.length!==1)throw Error('Tu progreso cambió en otra sesión. Exportá tu respaldo local antes de recargar.');}
    else result=check(await this.client.from('card_progress').insert(row).select());
    this.progress.set(id,{...result[0],id});this.progressLocal.set(id,n);
  }
 }
 prepareBackup(raw){let value=JSON.parse(raw.trim().replace(/^FLASH_INFINITO_V2\s*/,''));return normalizeBackup(value,()=>crypto.randomUUID())}
}
