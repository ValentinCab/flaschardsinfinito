// Pure transformations shared by migration and tests.
export function normalizeBackup(value, uuid) {
  if (!value || !Array.isArray(value.decks) || !Array.isArray(value.cards)) throw Error('El respaldo no contiene mazos y tarjetas válidos.');
  const src=structuredClone(value), maps={subjects:new Map(),folders:new Map(),decks:new Map(),cards:new Map()};
  if (!Array.isArray(src.subjects) || !Array.isArray(src.folders)) {
    src.subjects=[{id:'legacy-subject',name:'FISIOLOGÍA'}];
    src.folders=[{id:'legacy-folder',name:'Segundo parcial',subjectId:'legacy-subject'}];
    src.decks.forEach(d=>d.folderId='legacy-folder');
  }
  const arrays=['subjects','folders','decks','cards'];
  for (const table of arrays) for (const item of src[table]) {
    if (!item || typeof item.id !== 'string' || !item.id || maps[table].has(item.id)) throw Error('Hay identificadores vacíos o repetidos en '+table+'.');
    maps[table].set(item.id,uuid());
  }
  for (const t of ['subjects','folders','decks']) for (const item of src[t]) if(typeof item.name!=='string' || !item.name.trim() || item.name.trim().length>120) throw Error('Hay nombres vacíos o demasiado largos en '+t+'.');
  for (const c of src.cards) for (const k of ['front','back','frontImg','backImg']) if(c[k]!=null && typeof c[k]!=='string') throw Error('Contenido inválido en una tarjeta.');
  const ref=(table,key)=>{let v=maps[table].get(key);if(!v) throw Error('El respaldo contiene referencias incompletas en '+table+'.');return v};
  src.subjects=src.subjects.map(s=>({...s,id:ref('subjects',s.id)}));
  src.folders=src.folders.map(f=>({...f,id:ref('folders',f.id),subjectId:ref('subjects',f.subjectId)}));
  src.decks=src.decks.map(d=>({...d,id:ref('decks',d.id),folderId:ref('folders',d.folderId)}));
  const due={}; const oldDue=src.review?.due||{}; const turn=Number(src.review?.turn)||0;
  src.cards=src.cards.map(c=>{let old=c.id,id=ref('cards',old); due[id]=Math.max(0,(Number(oldDue[old])||0)-turn); return {...c,id,deckId:ref('decks',c.deckId)}});
  src.review={turn:0,due}; src.activeDeck='all';src.activeSubject=src.subjects[0]?.id||'';src.studySelection=src.decks.map(d=>d.id);src.current=null;src.flipped=false;src.migratedFisioV2=true;src.selectionModalV1=true;src.importedRenalV1=true;
  return src;
}
export function diffMaps(before, after) {
 const add=[],change=[],remove=[];
 for(const [id,row] of after) {if(!before.has(id)) add.push(row);else if(JSON.stringify(before.get(id))!==JSON.stringify(row)) change.push(row);}
 for(const [id,row] of before) if(!after.has(id)) remove.push(row);
 return {add,change,remove};
}
