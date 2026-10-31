/* AS-02 questions 6–7: duration belongs to each selected source. */
const AS02_WATER_SOURCES = [
  ['1','บ่อน้ำตื้น'],['2','บ่อน้ำตื้นมีเครื่องสูบ/มือโยก'],['3','บ่อบาดาล'],
  ['4','น้ำผิวดิน (แม่น้ำ/คลอง/บึง)'],['5','ประปาหมู่บ้าน'],['6','ประปาภูเขา'],
  ['7','น้ำฝน'],['8.1','น้ำบรรจุขวด/ถัง (ผลิตในพื้นที่)'],
  ['8.2','น้ำบรรจุขวด/ถัง (ผลิตนอกพื้นที่)'],['9','น้ำจากแม่น้ำที่ปนเปื้อนฯ']
];
function waterSourceLabel(id,kind) {
  const name=AS02_WATER_SOURCES.find(s=>s[0]===id)?.[1]||id;
  return id==='9'&&kind==='drink'?name+' มาประกอบอาหาร':name;
}
function sourceYearsObject(value) {
  if(typeof value==='string'&&value.trim()) {try{value=JSON.parse(value);}catch(e){return null;}}
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}
function parseWaterSourceHistory(record,kind) {
  const structured=sourceYearsObject(record[kind+'_source_years']);
  if(structured) return {years:{...structured},extra:record[kind+'_sources_other']||''};
  const years={},extra=[];
  for(const raw of String(record[kind+'_sources']||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean)) {
    const duration=raw.match(/(?:\(|เป็นเวลา\s*)(\d+(?:\.\d+)?)\s*ปี\)?\s*$/);
    const label=duration?raw.slice(0,duration.index).trim():raw;
    const numbered=label.match(/^(8\.[12]|[1-9])(?:[.)]|\s)/);
    let id=numbered?.[1];
    if(!id)id=AS02_WATER_SOURCES.find(([key,name])=>label===name||label===waterSourceLabel(key,kind))?.[0];
    if(id)years[id]=duration?Number(duration[1]):null;else extra.push(raw);
  }
  return {years,extra:extra.join(', ')};
}
function restoreAS02WaterSources(record) {
  for(const kind of ['drink','use']) {
    const history=parseWaterSourceHistory(record,kind);
    for(const [id] of AS02_WATER_SOURCES) {
      const key=id.replace('.','-'),box=document.getElementById(`as02-${kind}-source-${key}`),input=document.getElementById(`as02-${kind}-years-${key}`);
      if(!box||!input)continue;
      box.checked=Object.prototype.hasOwnProperty.call(history.years,id);
      input.value=history.years[id]??'';input.disabled=!box.checked;
    }
    const other=document.getElementById(`as02-${kind}-other`);if(other)other.value=history.extra;
    const legacy=document.getElementById(`as02-${kind}-years`);if(legacy)legacy.value=record[kind+'_years']??'';
    const note=document.getElementById(`as02-${kind}-legacy-note`);
    if(note){note.hidden=!historyValuePresent(record[kind+'_years']);note.textContent=note.hidden?'':`ข้อมูลเดิมระบุระยะเวลารวม: ${record[kind+'_years']} — โปรดตรวจสอบจำนวนปีของแต่ละแหล่ง ระบบไม่กระจายปีรวมให้ทุกแหล่ง`;} 
    syncAS02WaterSource(kind);
  }
}
function collectAS02WaterSources(kind) {
  const years={};
  for(const [id] of AS02_WATER_SOURCES) {
    const key=id.replace('.','-'),box=document.getElementById(`as02-${kind}-source-${key}`),input=document.getElementById(`as02-${kind}-years-${key}`);
    if(box?.checked)years[id]=input?.value.trim()===''?null:Number(input.value);
  }
  const extra=document.getElementById(`as02-${kind}-other`)?.value.trim()||'';
  return {years,extra};
}
function formatWaterSources(record,kind) {
  const history=parseWaterSourceHistory(record,kind);
  return [...AS02_WATER_SOURCES.filter(([id])=>Object.prototype.hasOwnProperty.call(history.years,id)).map(([id])=>
    `${id}. ${waterSourceLabel(id,kind)} (${history.years[id]===null||history.years[id]===''?'ยังไม่ระบุปี':history.years[id]+' ปี'})`),history.extra].filter(Boolean).join(', ');
}
function syncAS02WaterSource(kind) {
  const history=collectAS02WaterSources(kind);
  for(const [id] of AS02_WATER_SOURCES){const key=id.replace('.','-'),box=document.getElementById(`as02-${kind}-source-${key}`),input=document.getElementById(`as02-${kind}-years-${key}`);if(input&&box)input.disabled=!box.checked;}
  const summary=document.getElementById(`as02-${kind}-sources`);
  if(summary)summary.value=formatWaterSources({[kind+'_source_years']:history.years,[kind+'_sources_other']:history.extra},kind);
}
