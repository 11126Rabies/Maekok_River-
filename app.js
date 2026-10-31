/**
 * ระบบข้อมูลแหล่งแม่น้ำกก อ.แม่อาย
 * ข้อมูลแหล่งน้ำและระบบคัดกรองสารหนูจาก Google Sheets หลังเข้าสู่ระบบส่วนกลาง
 * พื้นที่ ต.ท่าตอน และ ต.แม่นาวาง อ.แม่อาย จ.เชียงใหม่
 */

// ลิงก์ Google Apps Script Web App URL เริ่มต้น (สามารถกดปุ่มฝังลิงก์ลงไฟล์ app.js ถาวรได้จากหน้าตั้งค่า)
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz-v4XWwtZtgslTkOPey4lhIarPZOLiPci1_VsdqBGbdXYpp28dv_wHNYnZTlUb3oTt/exec';

const STORAGE_KEY_GAS_URL = 'MAEAI_ONLINE_GAS_URL_V1';

let state = {
  wells: [],
  respondents: [],
  envAs02: [],
  waterLabs: [],
  knowledgeDocs: [],
  currentUser: null,
  gasUrl: '',
  gasUnlocked: false,
  map: null,
  baseLayers: {},
  weatherRadarLayer: null,
  markersLayer: null,
  linksLayer: null,
  pickingMode: null,
  currentWellAttachments: []
};

// ==================== UI HELPERS FOR SCROLLING, "OTHER" DROPDOWNS & CHECKBOXES ====================
function scrollToModalSection(modalBodyId, sectionId) {
  const bodyEl = document.getElementById(modalBodyId);
  const secEl = document.getElementById(sectionId);
  if (bodyEl && secEl) {
    const topPos = secEl.offsetTop - bodyEl.offsetTop - 10;
    bodyEl.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
  }
}

function toggleOtherInput(selectEl, wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  if (selectEl.value === 'OTHER') {
    wrap.style.display = 'block';
    const inp = wrap.querySelector('input');
    if (inp) inp.focus();
  } else {
    wrap.style.display = 'none';
  }
}

function getSelectOrOther(selectId, otherInputId) {
  const sel = document.getElementById(selectId);
  const oth = document.getElementById(otherInputId);
  if (!sel) return '';
  if (sel.value === 'OTHER') {
    return (oth && oth.value.trim()) ? oth.value.trim() : 'อื่นๆ';
  }
  return sel.value;
}

function setSelectOrOther(selectId, otherWrapId, otherInputId, value, defaultVal = '') {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(otherWrapId);
  const oth = document.getElementById(otherInputId);
  if (!sel) return;
  const valStr = String(value || defaultVal).trim();
  const hasOption = Array.from(sel.options).some(opt => opt.value === valStr && opt.value !== 'OTHER');
  if (hasOption) {
    sel.value = valStr;
    if (wrap) wrap.style.display = 'none';
    if (oth) oth.value = '';
  } else if (valStr !== '') {
    const hasOtherOpt = Array.from(sel.options).some(opt => opt.value === 'OTHER');
    if (hasOtherOpt) {
      sel.value = 'OTHER';
      if (wrap) wrap.style.display = 'block';
      if (oth) oth.value = valStr;
    } else {
      sel.selectedIndex = 0;
    }
  } else {
    sel.selectedIndex = 0;
    if (wrap) wrap.style.display = 'none';
    if (oth) oth.value = '';
  }
}

function syncAs01Checkboxes(chkClass, targetInputId, flagSelectId = null) {
  const checkedVals = Array.from(document.querySelectorAll('.' + chkClass + ':checked')).map(c => c.value);
  const targetInput = document.getElementById(targetInputId);
  if (targetInput) {
    const predefined=Array.from(document.querySelectorAll('.'+chkClass)).map(c=>c.value);
    const extra=targetInput.value.split(',').map(s=>s.trim()).filter(s=>s&&!predefined.includes(s));
    targetInput.value = [...checkedVals,...extra].join(', ');
  }
  if (flagSelectId) {
    const flagSel = document.getElementById(flagSelectId);
    if (flagSel) {
      if (checkedVals.length > 0) {
        flagSel.value = Array.from(flagSel.options).find(o => /^(ใช่|มี|2[).] ?มี)/.test(o.value))?.value || 'ใช่';
      }
    }
  }
}

function populateCheckboxesFromString(chkClass, strVal) {
  const s = String(strVal || '');
  document.querySelectorAll('.' + chkClass).forEach(chk => {
    const cleanVal = chk.value.replace(/^\d+[\)\.]\s*/, '').trim();
    chk.checked = s.includes(chk.value) || (cleanVal.length > 2 && s.includes(cleanVal));
  });
}

// ค่าน้ำหนักแบบฟอร์ม Env-As-01 ส่วนที่ 4 (11 ข้อ คะแนนเต็ม 30.5)
const ENV_WEIGHTS = {
  q1: 5.0,
  q2: 5.0,
  q3: 5.0,
  q4: 1.5,
  q5: 1.5,
  q6: 1.0,
  q7: 1.0,
  q8: 4.0,
  q9: 4.0,
  q10: 1.0,
  q11: 1.5
};

// ==================== UTM ZONE 47N <-> WGS84 LAT/LNG CONVERTER ====================
function utm47NToLatLng(easting, northing) {
  const a = 6378137.0;
  const f = 1.0 / 298.257223563;
  const k0 = 0.9996;
  const lon0 = 99.0 * Math.PI / 180.0;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1.0 - e2);
  const e1 = (1.0 - Math.sqrt(1.0 - e2)) / (1.0 + Math.sqrt(1.0 - e2));

  const x = easting - 500000.0;
  const y = northing;

  const M = y / k0;
  const mu = M / (a * (1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0 - 5.0 * e2 * e2 * e2 / 256.0));

  const phi1 = mu + (3.0 * e1 / 2.0 - 27.0 * Math.pow(e1, 3) / 32.0) * Math.sin(2.0 * mu)
                  + (21.0 * e1 * e1 / 16.0 - 55.0 * Math.pow(e1, 4) / 32.0) * Math.sin(4.0 * mu)
                  + (151.0 * Math.pow(e1, 3) / 96.0) * Math.sin(6.0 * mu)
                  + (1097.0 * Math.pow(e1, 4) / 512.0) * Math.sin(8.0 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const N1 = a / Math.sqrt(1.0 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = ep2 * cosPhi1 * cosPhi1;
  const R1 = a * (1.0 - e2) / Math.pow(1.0 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * k0);

  const latRad = phi1 - (N1 * tanPhi1 / R1) * (D * D / 2.0
                - (5.0 + 3.0 * T1 + 10.0 * C1 - 4.0 * C1 * C1 - 9.0 * ep2) * Math.pow(D, 4) / 24.0
                + (61.0 + 90.0 * T1 + 298.0 * C1 + 45.0 * T1 * T1 - 252.0 * ep2 - 3.0 * C1 * C1) * Math.pow(D, 6) / 720.0);

  const lonRad = lon0 + (D - (1.0 + 2.0 * T1 + C1) * Math.pow(D, 3) / 6.0
                + (5.0 - 2.0 * C1 + 28.0 * T1 - 3.0 * C1 * C1 + 8.0 * ep2 + 24.0 * T1 * T1) * Math.pow(D, 5) / 120.0) / cosPhi1;

  return {
    lat: Number((latRad * 180.0 / Math.PI).toFixed(6)),
    lng: Number((lonRad * 180.0 / Math.PI).toFixed(6))
  };
}

function convertModalUtmToLatLng() {
  const utmE = parseFloat(document.getElementById('well-utm-e').value);
  const utmN = parseFloat(document.getElementById('well-utm-n').value);
  if (!isNaN(utmE) && !isNaN(utmN) && utmE > 100000 && utmN > 1000000) {
    const res = utm47NToLatLng(utmE, utmN);
    document.getElementById('well-lat').value = res.lat;
    document.getElementById('well-lng').value = res.lng;
  }
}

// ==================== INITIALIZATION & DATA SANITIZATION ====================
window.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  checkSavedSession();
});

function inferHealthCenterByTambonMoo(tambon, moo) {
  const t = String(tambon || 'ท่าตอน').trim();
  const m = Number(moo) || 0;
  if (t === 'แม่นาวาง') return 'รพ.สต.บ้านแม่เมืองน้อย';
  if ([4, 6, 7, 8].includes(m)) return 'รพ.สต.บ้านท่ามะแกง';
  if ([5, 11, 12, 13].includes(m)) return 'รพ.สต.บ้านเมืองงาม';
  return 'รพ.สต.บ้านท่าตอน';
}

function extractNumericYears(val, fallbackVal) {
  if (val !== undefined && val !== null && String(val).trim() !== '') {
    const m = String(val).match(/(\d+(\.\d+)?)/);
    if (m) return Number(m[1]);
  }
  if (fallbackVal !== undefined && fallbackVal !== null && String(fallbackVal).trim() !== '') {
    const m2 = String(fallbackVal).match(/(\d+(\.\d+)?)/);
    if (m2) return Number(m2[1]);
  }
  return '';
}

function validGasUrl(url) {
 return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(url||'').trim());
}
function persistGasUrlEverywhere(url) {
 if(!validGasUrl(url))throw Error('ใช้ลิงก์ Google Apps Script ที่ลงท้าย /exec เท่านั้น');
 state.gasUrl=url.trim();
 try{localStorage.setItem(STORAGE_KEY_GAS_URL,state.gasUrl);}catch(e){}
 applyRestoredGasUrl(state.gasUrl);
}
function applyRestoredGasUrl(url) {
 if(!validGasUrl(url))return;
 state.gasUrl=url.trim();state.gasUnlocked=false;
 for(const id of ['gas-url-input','login-gas-url']){const input=document.getElementById(id);if(input){input.value=state.gasUrl;if(id==='gas-url-input')input.readOnly=true;}}
 updateSyncBadge(false);
}
function setLoginMessage(message) {
 const el=document.getElementById('login-error');if(el){el.textContent=message;el.style.display=message?'block':'none';}
}
function clearSessionData() {
 state.sessionEpoch=(state.sessionEpoch||0)+1;
 for(const request of state.activeCloudRequests||[])request.abort();
 state.cloudToken=null;state.currentUser=null;state.dataLoaded=false;state.cloudVerified=false;
 state.pendingWrites=[];state.cloudFlushPromise=null;state.currentWellAttachments=[];state.detailedScreening=null;state.pickingMode=null;state.dashboardVillageSelection=null;
 for(const key of ['wells','respondents','envAs02','waterLabs','knowledgeDocs'])state[key]=[];
 document.getElementById('app-container').style.display='none';
 document.getElementById('login-screen').style.display='flex';
 document.querySelectorAll('.modal-backdrop').forEach(el=>{el.style.display='none';});
 document.querySelectorAll('form').forEach(el=>el.reset());
 document.querySelectorAll('input,textarea').forEach(el=>{if(!['checkbox','radio','button','submit'].includes(el.type)&&!['gas-url-input','login-gas-url'].includes(el.id))el.value='';});
 state.map?.closePopup();state.markersLayer?.clearLayers();state.linksLayer?.clearLayers();
 // Re-render all dynamic tables and option lists with empty arrays, including hidden tabs.
 refreshAllViews();renderWellFilesPreview();populateAs02RespondentDropdown();
 for(const id of ['source-record-modal','review-record-modal','dashboard-village-modal'])document.getElementById(id)?.remove();
 for(const id of ['well-gallery-body','well-gallery-content','current-user-display','knowledge-preview-body','kb-viewer-body','q2-modal-person-info'])setHtml(id,'');
 const personSelect=document.getElementById('q2-modal-resp-select');if(personSelect)personSelect.innerHTML='<option value="">-- เลือกรายชื่อหลังเข้าสู่ระบบ --</option>';
 const download=document.getElementById('kb-viewer-download');if(download){download.href='#';download.removeAttribute('download');}
 for(const [id,markup] of state.cleanModalTitles||[])setHtml(id,markup);
 updatePendingNotice();
}

function checkSavedSession() {
 clearSessionData();setLoginMessage('');
}

async function handleLogin(e) {
 e?.preventDefault();if(state.loginBusy)return;
 const username=document.getElementById('login-username').value.trim();
 const password=document.getElementById('login-password').value;
 if(!username||!password){setLoginMessage('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');return;}
 state.loginBusy=true;
 const button=document.querySelector('#login-form button[type="submit"]');if(button)button.disabled=true;
 try{
  setLoginMessage('');
  if(state.cloudProbe&&!state.cloudProbeComplete)await state.cloudProbe;
  if(!state.cloudCapabilities)await probeCloudConnection();
  if(!state.cloudCapabilities)throw Error(state.connectionError||'เชื่อมต่อส่วนกลางไม่ได้ กรุณาตรวจลิงก์และอินเทอร์เน็ต');
  await loginToCentral(username,password);
 }catch(e){setLoginMessage(e.message);}
 finally{state.loginBusy=false;if(button)button.disabled=false;document.getElementById('login-password').value='';}
}

function handleLogout() {
 if(pendingCloudWrites().length&&!confirm('มีรายการที่ Google Sheets ยังไม่ยืนยัน '+pendingCloudWrites().length+' รายการ ออกจากระบบและละทิ้งรายการรอส่งหรือไม่? หากต้องการเก็บไว้ กดยกเลิกแล้วกดส่งรายการรอส่งหรือดาวน์โหลดสำรองก่อน'))return;
 const token=state.cloudToken;
 clearSessionData();setLoginMessage('');
 if(token)cloudRequest({action:'logout',token}).catch(()=>{});
}

function enterApplication() {
 if(!state.cloudToken||!state.currentUser||!state.dataLoaded)return false;
 document.getElementById('login-screen').style.display='none';
 document.getElementById('app-container').style.display='block';
 setText('current-user-display',state.currentUser.displayName||state.currentUser.username);
 refreshAllViews();updatePendingNotice();
 if(!state.map&&typeof L!=='undefined'){
  try{initMap();renderMapMarkers();fetchLocalWeather();}catch(e){console.warn('Map unavailable');}
 }
 return true;
}

// ==================== NAVIGATION TABS ====================
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  const btn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  if (tabId === 'tab-map') {
    if (!state.map && typeof L !== 'undefined') initMap();
    if (state.map) {
      setTimeout(() => {
        state.map.invalidateSize();
        renderMapMarkers();
        if (!state.mapInitialViewFitted && state.markersLayer.getLayers().length) {
          zoomToAllMarkers();
          state.mapInitialViewFitted = true;
        }
      }, 150);
    } else {
      const canvas = document.getElementById('map-canvas');
      if (canvas) canvas.innerHTML = '<div style="padding:24px;color:#b91c1c;">ยังโหลดส่วนแผนที่ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ</div>';
    }
  }
}

function switchScreeningSubTab(mode) {
  const sub1 = document.getElementById('subview-as01');
  const sub2 = document.getElementById('subview-as02');
  const sub3 = document.getElementById('subview-2q');
  const btn1 = document.getElementById('btn-subtab-as01');
  const btn2 = document.getElementById('btn-subtab-as02');
  const btn3 = document.getElementById('btn-subtab-2q');

  if (sub1) sub1.style.display = mode === 'as01' ? 'block' : 'none';
  if (sub2) sub2.style.display = mode === 'as02' ? 'block' : 'none';
  if (sub3) sub3.style.display = mode === '2q' ? 'block' : 'none';

  if (btn1) btn1.className = mode === 'as01' ? 'btn btn-primary' : 'btn btn-outline';
  if (btn2) btn2.className = mode === 'as02' ? 'btn btn-primary' : 'btn btn-outline';
  if (btn3) btn3.className = mode === '2q' ? 'btn btn-primary' : 'btn btn-outline';
}

function filterRespondentsByBreakdown(tambon, hc, moo, tabMode) {
  switchTab('tab-respondents');
  const tabSel = document.getElementById('resp-filter-tab');
  const tamSel = document.getElementById('resp-filter-tambon');
  const hcSel = document.getElementById('resp-filter-hc');
  const searchInp = document.getElementById('resp-search');

  if (tabSel) tabSel.value = tabMode || 'ALL';
  if (tamSel) tamSel.value = tambon || 'ALL';
  if (hcSel) hcSel.value = hc || 'ALL';
  if (searchInp) searchInp.value = moo ? `ม.${moo}` : '';
  renderRespondentsTable();
}

function format2QBadge(status) {
  const s = String(status || 'ยังไม่คัดกรอง');
  if (s.includes('พบความเสี่ยง') || s.includes('Positive')) {
    return `<span class="badge-2q-pos"><i class="fa-solid fa-triangle-exclamation"></i> พบความเสี่ยง 2Q</span>`;
  }
  if (s.includes('ปกติ')) {
    return `<span class="badge-2q-neg"><i class="fa-solid fa-circle-check"></i> ปกติ (ไม่เสี่ยง)</span>`;
  }
  return `<span class="badge-2q-none"><i class="fa-regular fa-clock"></i> รอคัดกรอง 2Q</span>`;
}

function filterWellsFromDashboard(mode) {
  switchTab('tab-wells');
  const typeSel = document.getElementById('well-filter-type');
  const distSel = document.getElementById('well-filter-dist');
  if (mode === 'SAMPLE' && typeSel) {
    typeSel.value = 'SAMPLE_ONLY';
    distSel.value = 'ALL';
  } else if (mode === 'NEAR100' && distSel) {
    typeSel.value = 'ALL';
    distSel.value = 'ไม่เกิน 100 เมตร';
  }
  renderWellsTable();
}

function filterByRiskFromKpi(riskLevel) {
  switchTab('tab-respondents');
  const riskSelect = document.getElementById('resp-filter-risk');
  if (riskSelect) {
    riskSelect.value = riskLevel === 'ปานกลาง-มาก' ? 'ปานกลาง' : riskLevel;
    renderRespondentsTable();
  }
}

// ==================== MAP & WEATHER RADAR (LEAFLET) ====================
function initMap() {
  if (state.map) return;
  if (typeof L === 'undefined') return;
  state.map = L.map('map-canvas', {
    center: [20.0560, 99.4150],
    zoom: 13
  });

  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
  });
  const esriLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
  });
  const satelliteHybrid = L.layerGroup([esriSat, esriLabels]);

  const topoLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });

  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });

  state.baseLayers = {
    satellite: satelliteHybrid,
    terrain: topoLayer,
    street: streetLayer
  };

  state.baseLayers.satellite.addTo(state.map);

  state.linksLayer = L.layerGroup().addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);

  state.map.on('click', (e) => {
    if (!state.pickingMode) return;
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));

    if (state.pickingMode === 'well') {
      document.getElementById('well-lat').value = lat;
      document.getElementById('well-lng').value = lng;
      document.getElementById('well-modal').style.display = 'flex';
    } else if (state.pickingMode === 'respondent') {
      document.getElementById('resp-lat').value = lat;
      document.getElementById('resp-lng').value = lng;
      document.getElementById('respondent-modal').style.display = 'flex';
    }

    state.pickingMode = null;
    document.getElementById('map-Pick-hint').style.display = 'none';
  });
  renderMapMarkers();
}

function setBaseMap(mode) {
  if (!state.map) return;
  Object.values(state.baseLayers).forEach(layer => state.map.removeLayer(layer));
  if (state.baseLayers[mode]) {
    state.baseLayers[mode].addTo(state.map);
  }

  document.getElementById('btn-layer-sat').classList.toggle('active', mode === 'satellite');
  document.getElementById('btn-layer-terrain').classList.toggle('active', mode === 'terrain');
  document.getElementById('btn-layer-street').classList.toggle('active', mode === 'street');
}

async function toggleWeatherRadar(enabled) {
  if (!state.map) return;
  if (!enabled) {
    if (state.weatherRadarLayer) {
      state.map.removeLayer(state.weatherRadarLayer);
      state.weatherRadarLayer = null;
    }
    return;
  }

  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const data = await res.json();
    if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
      const latest = data.radar.past[data.radar.past.length - 1];
      const tileUrl = `${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
      if (state.weatherRadarLayer) state.map.removeLayer(state.weatherRadarLayer);
      state.weatherRadarLayer = L.tileLayer(tileUrl, {
        opacity: 0.65,
        zIndex: 400,
        attribution: 'Weather Radar &copy; RainViewer'
      }).addTo(state.map);
    }
  } catch (err) {
    console.warn('RainViewer radar load warning:', err);
  }
}

async function fetchLocalWeather() {
  const boxBody = document.getElementById('weather-box-body');
  if (!boxBody) return;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=20.055&longitude=99.400&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m&timezone=Asia%2FBangkok';
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current;
    boxBody.innerHTML = `
      <div class="weather-metrics">
        <div class="weather-metric-item">🌡️ อุณหภูมิ: <b>${cur.temperature_2m} °C</b></div>
        <div class="weather-metric-item">💧 ความชื้น: <b>${cur.relative_humidity_2m} %</b></div>
        <div class="weather-metric-item">🌧️ ปริมาณฝน: <b>${cur.precipitation} มม.</b></div>
        <div class="weather-metric-item">💨 ลม: <b>${cur.wind_speed_10m} กม./ชม.</b></div>
      </div>
      <div style="margin-top:6px; font-size:11px; color:#0369a1;">
        พิกัดอ้างอิง: ลุ่มน้ำกก ต.ท่าตอน - ต.แม่นาวาง อ.แม่อาย จ.เชียงใหม่
      </div>
    `;
  } catch (err) {
    boxBody.innerHTML = `<span>พร้อมแสดงชั้นข้อมูลภูมิประเทศและดาวเทียม (เชื่อมต่ออินเทอร์เน็ตเพื่อดูเรดาร์อากาศสด)</span>`;
  }
}

function renderMapMarkers() {
  if (!state.map || !state.markersLayer || !state.linksLayer) return;
  state.markersLayer.clearLayers();
  state.linksLayer.clearLayers();

  const showWells = document.getElementById('chk-show-wells').checked;
  const showPeople = document.getElementById('chk-show-people').checked;
  const showLinks = document.getElementById('chk-show-links').checked;

  const tambonFilter = document.getElementById('map-filter-tambon').value;
  const wellTypeFilter = document.getElementById('map-filter-welltype') ? document.getElementById('map-filter-welltype').value : 'ALL';
  const distFilter = document.getElementById('map-filter-dist') ? document.getElementById('map-filter-dist').value : 'ALL';
  const wellFilter = document.getElementById('map-filter-well').value;
  const riskFilter = document.getElementById('map-filter-risk').value;

  const wellMap = {};
  state.wells.forEach(w => { wellMap[w.well_id] = w; });

  if (showWells) {
    state.wells.forEach(well => {
      if (tambonFilter !== 'ALL' && well.tambon !== tambonFilter) return;
      if (wellFilter !== 'ALL' && well.well_id !== wellFilter) return;
      if (wellTypeFilter === 'SAMPLE_ONLY' && !well.sample_code) return;
      if (wellTypeFilter !== 'ALL' && wellTypeFilter !== 'SAMPLE_ONLY' && well.well_type !== wellTypeFilter) return;
      if (distFilter !== 'ALL' && well.distance_band !== distFilter) return;

      const lat = parseFloat(well.latitude);
      const lng = parseFloat(well.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const linkedUsers = state.respondents.filter(r => r.well_id === well.well_id);
      let bg = '#0284c7';
      if (well.sample_code) {
        bg = '#e11d48';
      } else if (well.well_type === 'บ่อน้ำตื้น' || Number(well.distance_river_m) <= 100) {
        bg = '#eab308';
      }

      const wellIcon = L.divIcon({
        className: 'custom-well-icon',
        html: `<div style="background:${bg}; color:#fff; width:28px; height:28px; border-radius:6px; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">
                 ${well.sample_code ? well.sample_code : '<i class="fa-solid fa-faucet-drip"></i>'}
               </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const userNamesHtml = linkedUsers.slice(0, 5).map(u => `<li>${u.full_name} (${u.code || '-'}) - คะแนน ${u.total_score}</li>`).join('');
      const moreCount = linkedUsers.length > 5 ? `<li>...และอีก ${linkedUsers.length - 5} ราย</li>` : '';
      const attCount = Array.isArray(well.attachments) ? well.attachments.length : 0;

      const popupHtml = `
        <div style="min-width:265px; font-family:'Sarabun',sans-serif;">
          <div style="font-weight:700; font-size:14px; color:#0f766e; margin-bottom:4px;">
            🚰 [${well.well_id}] ${well.well_name}
          </div>
          <div style="font-size:12.5px; line-height:1.45;">
            <b>ประเภท:</b> ${well.well_type} ${well.sample_code ? `<span style="background:#ffe4e6;color:#be123c;padding:1px 6px;border-radius:4px;font-weight:700;">ส่งตรวจ ${well.sample_code}</span>` : ''}<br/>
            <b>ที่ตั้ง:</b> บ้านเลขที่ ${well.house_no || '-'} หมู่ ${well.moo} ต.${well.tambon}<br/>
            <b>พิกัด UTM:</b> E ${well.utm_e || '-'}, N ${well.utm_n || '-'}<br/>
            <b>พิกัด Lat/Lng:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
            <b>ห่างแม่น้ำกก:</b> <b>${well.distance_river_m} เมตร</b> (${well.distance_band})<br/>
            <b>การใช้น้ำ:</b> ${well.usage_type || '-'} (${well.user_count || 1} คน)<br/>
            <b>รพ.สต.:</b> ${well.health_center || '-'}<br/>
            <b>รูปภาพ/เอกสารแนบ:</b> <b>${attCount} / 5 ไฟล์</b>
          </div>
          <hr style="margin:6px 0; border:none; border-top:1px solid #e2e8f0;"/>
          <div style="font-size:12px;">
            <b>👥 กลุ่มเป้าหมายที่เชื่อมโยงกับบ่อนี้ (${linkedUsers.length} ราย):</b>
            <ul style="padding-left:16px; margin:4px 0;">${userNamesHtml || '<li>ยังไม่มีรายชื่อผูกตรง</li>'}${moreCount}</ul>
          </div>
          <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
            ${wellGoogleMapsLink(lat,lng)}
            <button onclick="openWellModal('${well.well_id}')" style="padding:4px 8px; background:#0f766e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">แก้ไข/เพิ่มรูป</button>
            <button onclick="openWellGalleryModal('${well.well_id}')" style="padding:4px 8px; background:#0369a1; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">📷 รูปภาพ (${attCount})</button>
            <button onclick="filterPeopleByWell('${well.well_id}')" style="padding:4px 8px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">ดูผู้ใช้น้ำ</button>
          </div>
        </div>
      `;

      L.marker([lat, lng], { icon: wellIcon })
        .bindPopup(popupHtml)
        .addTo(state.markersLayer);
    });
  }

  const filteredPeople = state.respondents.filter(r => {
    if (tambonFilter !== 'ALL' && r.tambon !== tambonFilter) return false;
    if (wellFilter !== 'ALL' && r.well_id !== wellFilter) return false;
    if (riskFilter !== 'ALL' && r.risk_level !== riskFilter) return false;
    return true;
  });

  filteredPeople.forEach(person => {
    const lat = parseFloat(person.latitude);
    const lng = parseFloat(person.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const linkedWell = wellMap[person.well_id];

    if (showLinks && linkedWell) {
      const wLat = parseFloat(linkedWell.latitude);
      const wLng = parseFloat(linkedWell.longitude);
      if (!isNaN(wLat) && !isNaN(wLng)) {
        L.polyline([[lat, lng], [wLat, wLng]], {
          color: person.risk_level === 'มาก' ? '#ef4444' : (person.risk_level === 'ปานกลาง' ? '#f97316' : '#38bdf8'),
          weight: 1.5,
          dashArray: '4, 4',
          opacity: 0.7
        }).addTo(state.linksLayer);
      }
    }

    if (showPeople) {
      let fillColor = '#22c55e';
      if (person.risk_level === 'ปานกลาง') fillColor = '#f97316';
      if (person.risk_level === 'มาก') fillColor = '#dc2626';

      const marker = L.circleMarker([lat, lng], {
        radius: person.risk_level === 'มาก' ? 9 : 6.5,
        fillColor: fillColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.92
      });

      const popupHtml = `
        <div style="min-width:250px; font-family:'Sarabun',sans-serif;">
          <div style="font-weight:700; font-size:14px; color:#0f172a;">
            👤 ${person.full_name} <span style="color:#0284c7;">(${person.code || '-'})</span>
          </div>
          <div style="font-size:12.5px; margin-top:4px; line-height:1.45;">
            <b>แท็บข้อมูล:</b> ${person.is_urine_target ? '<span style="color:#15803d;font-weight:700;">รายชื่อเก็บปัสสาวะ (รายชื่อขั้น 2)</span>' : '<span style="color:#0369a1;font-weight:700;">การตอบกลับ (ขั้นแรก)</span>'}<br/>
            <b>อายุ/เพศ:</b> ${person.age || '-'} ปี (${person.gender})<br/>
            <b>ที่อยู่:</b> บ้านเลขที่ ${person.house_no || '-'} หมู่ ${person.moo} ต.${person.tambon}<br/>
            <b>รพ.สต.:</b> ${person.health_center || '-'}<br/>
            <b>ระยะเวลาที่สัมผัส:</b> <b>${person.exposure_years !== '' && person.exposure_years !== undefined ? person.exposure_years + ' ปี' : '-'}</b><br/>
            <b>ผลคัดกรอง 2Q:</b> ${format2QBadge(person.status_2q)}<br/>
            <b>แหล่งน้ำที่เชื่อมโยง:</b> <span style="color:#0f766e; font-weight:600;">[${person.well_id}] ${linkedWell ? linkedWell.well_name : ''}</span>
          </div>
          <div style="margin-top:6px; padding:6px 8px; background:#f1f5f9; border-radius:6px; font-size:12.5px;">
            คะแนนความเสี่ยง: <b>${person.total_score}</b> คะแนน &rarr; 
            <b style="color:${fillColor}">ระดับ${person.risk_level}</b>
          </div>
          <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
            <button onclick="openRespondentModal('${person.id}')" style="padding:4px 8px; background:#16a34a; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
              แก้ไข Env-As-01
            </button>
            <button onclick="open2QModal('${person.id}')" style="padding:4px 8px; background:#7c3aed; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
              🧠 คัดกรอง 2Q
            </button>
            <button onclick="openEnvAs02ForRespondent('${person.id}')" style="padding:4px 8px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
              Env-As-02
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml).addTo(state.markersLayer);
    }
  });
}

function zoomToAllMarkers() {
  if (!state.map) return;
  const coords = [];
  state.wells.forEach(w => {
    if (w.latitude && w.longitude) coords.push([parseFloat(w.latitude), parseFloat(w.longitude)]);
  });
  if (coords.length > 0) {
    state.map.fitBounds(coords, { padding: [35, 35] });
  }
}

function locateUserOnMap() {
  if (!navigator.geolocation) {
    alert('เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.map.setView([latitude, longitude], 16);
      L.popup()
        .setLatLng([latitude, longitude])
        .setContent(`<b>📍 พิกัดปัจจุบันของคุณ</b><br/>Lat: ${latitude.toFixed(6)}<br/>Lng: ${longitude.toFixed(6)}`)
        .openOn(state.map);
    },
    () => alert('ไม่สามารถดึงพิกัด GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้งของเบราว์เซอร์')
  );
}

function pickLocationOnMap(targetType) {
  state.pickingMode = targetType;
  if (targetType === 'well') {
    document.getElementById('well-modal').style.display = 'none';
  } else {
    document.getElementById('respondent-modal').style.display = 'none';
  }
  switchTab('tab-map');
  document.getElementById('map-Pick-hint').style.display = 'inline-block';
}

// ==================== REFRESH ALL UI VIEWS & DASHBOARDS ====================
function refreshAllViews() {
  refreshFiscalYearOptions();
  updateKpiCards();
  renderExecutiveDashboard();
  renderScreeningDashboardAndTables();
  populateWellDropdowns();
  renderWellsTable();
  renderWaterLabDashboardAndTable();
  renderRespondentsTable();
  renderKnowledgeDocs();
  renderPivotSummary();
  renderMapMarkers();
}

function renderDashboard() {
  renderExecutiveDashboard();
}

// ==================== SCREENING TAB (ENV-AS-01, ENV-AS-02 & 2Q DASHBOARD + CRUD) ====================
function recalcModalAs01_2Q() {
  const q1 = document.getElementById('resp-q2-1')?.value || 'ไม่ใช่';
  const q2 = document.getElementById('resp-q2-2')?.value || 'ไม่ใช่';
  const stEl = document.getElementById('resp-status-2q');
  if (!stEl) return;
  if (q1 === 'ใช่' || q2 === 'ใช่') {
    stEl.value = 'พบความเสี่ยง (Positive 2Q)';
  } else if (stEl.value === 'พบความเสี่ยง (Positive 2Q)') {
    stEl.value = 'ปกติ (ไม่พบความเสี่ยง)';
  }
}

function recalcModalAs02_2Q() {
  const q1 = document.getElementById('as02-q2-1')?.value || 'ไม่ใช่';
  const q2 = document.getElementById('as02-q2-2')?.value || 'ไม่ใช่';
  const stEl = document.getElementById('as02-status-2q');
  if (!stEl) return;
  if (q1 === 'ใช่' || q2 === 'ใช่') {
    stEl.value = 'พบความเสี่ยง (Positive 2Q)';
  } else if (stEl.value === 'พบความเสี่ยง (Positive 2Q)') {
    stEl.value = 'ปกติ (ไม่พบความเสี่ยง)';
  }
}

function open2QModal(respId = null) {
  const modal = document.getElementById('modal-2q');
  const sel = document.getElementById('q2-modal-resp-select');
  if (!modal || !sel) return;

  sel.innerHTML = `<option value="">-- เลือกรายชื่อผู้รับการคัดกรอง (จากทั้งหมด ${state.respondents.length} ราย) --</option>` +
    state.respondents.map(r =>
      `<option value="${r.id}">[${r.code}] ${r.full_name} (ม.${r.moo} ต.${r.tambon} - ${r.health_center}) [${r.status_2q || 'รอคัดกรอง'}]</option>`
    ).join('');

  document.getElementById('form-2q').reset();
  document.getElementById('q2-modal-date').value = bangkokToday();
  document.getElementById('q2-modal-assessor').value = state.currentUser ? state.currentUser.displayName : 'เจ้าหน้าที่สาธารณสุข อ.แม่อาย';

  const targetId = respId || (state.respondents[0] ? state.respondents[0].id : '');
  if (targetId) {
    sel.value = targetId;
    onSelect2QRespondent(targetId);
  }
  modal.style.display = 'flex';
}

function close2QModal() {
  const modal = document.getElementById('modal-2q');
  if (modal) modal.style.display = 'none';
}

function onSelect2QRespondent(respId) {
  const r = state.respondents.find(x => x.id === respId);
  const infoEl = document.getElementById('q2-modal-person-info');
  if (!r) {
    if (infoEl) infoEl.innerHTML = 'กรุณาเลือกรายชื่อผู้รับการคัดกรอง';
    return;
  }

  if (infoEl) {
    infoEl.innerHTML = `
      <div><b>ชื่อ-สกุล:</b> ${r.full_name} <span style="color:#7c3aed;font-weight:700;">(${r.code})</span> | <b>อายุ:</b> ${r.age || '-'} ปี</div>
      <div><b>ที่อยู่:</b> บ้านเลขที่ ${r.house_no || '-'} หมู่ที่ ${r.moo} ต.${r.tambon} | <b>รพ.สต.:</b> ${r.health_center || '-'}</div>
      <div><b>ระยะเวลาสัมผัส:</b> ${r.exposure_years !== '' && r.exposure_years !== undefined ? r.exposure_years + ' ปี' : '-'} | <b>ความเสี่ยงสารหนู:</b> ระดับ${r.risk_level} (${r.total_score} คะแนน)</div>
    `;
  }

  const r1Yes = document.querySelector('input[name="q2_r1"][value="ใช่"]');
  const r1No = document.querySelector('input[name="q2_r1"][value="ไม่ใช่"]');
  const r2Yes = document.querySelector('input[name="q2_r2"][value="ใช่"]');
  const r2No = document.querySelector('input[name="q2_r2"][value="ไม่ใช่"]');

  if (r.q2_1 === 'ใช่') { if (r1Yes) r1Yes.checked = true; } else { if (r1No) r1No.checked = true; }
  if (r.q2_2 === 'ใช่') { if (r2Yes) r2Yes.checked = true; } else { if (r2No) r2No.checked = true; }

  if (r.date_2q) document.getElementById('q2-modal-date').value = r.date_2q;
  if (r.assessor_2q) document.getElementById('q2-modal-assessor').value = r.assessor_2q;
  document.getElementById('q2-modal-note').value = r.note_2q || '';

  evaluate2QModalLive();
}

function evaluate2QModalLive() {
  const q1 = document.querySelector('input[name="q2_r1"]:checked')?.value || 'ไม่ใช่';
  const q2 = document.querySelector('input[name="q2_r2"]:checked')?.value || 'ไม่ใช่';
  const box = document.getElementById('q2-live-result-box');
  const badge = document.getElementById('q2-live-badge');
  const advice = document.getElementById('q2-live-advice');

  if (!box || !badge || !advice) return;
  if (q1 === 'ใช่' || q2 === 'ใช่') {
    box.style.background = '#fef2f2';
    box.style.borderColor = '#f87171';
    badge.className = 'risk-badge risk-high';
    badge.textContent = 'พบความเสี่ยงโรคซึมเศร้า (Positive 2Q)';
    advice.style.color = '#991b1b';
    advice.textContent = 'คำแนะนำ: ตอบ "ใช่" อย่างน้อย 1 ข้อ แนะนำให้ประเมินต่อด้วยแบบประเมินโรคซึมเศร้า 9 คำถาม (9Q) และให้คำปรึกษาทางสุขภาพจิต';
  } else {
    box.style.background = '#f0fdf4';
    box.style.borderColor = '#86efac';
    badge.className = 'risk-badge risk-low';
    badge.textContent = 'ปกติ (ไม่พบความเสี่ยงโรคซึมเศร้า)';
    advice.style.color = '#15803d';
    advice.textContent = 'คำแนะนำ: ตอบ "ไม่ใช่" ทั้ง 2 ข้อ สุขภาพจิตปกติ แนะนำให้ความรู้การดูแลสุขภาพและเฝ้าระวังต่อเนื่อง';
  }
}

async function handleSave2QModal(e) {
  e.preventDefault();
  const respId = document.getElementById('q2-modal-resp-select').value;
  if (!respId) {
    alert('กรุณาเลือกรายชื่อผู้รับการคัดกรองก่อนครับ');
    return;
  }

  const q1 = document.querySelector('input[name="q2_r1"]:checked')?.value || 'ไม่ใช่';
  const q2 = document.querySelector('input[name="q2_r2"]:checked')?.value || 'ไม่ใช่';
  const status2q = (q1 === 'ใช่' || q2 === 'ใช่') ? 'พบความเสี่ยง (Positive 2Q)' : 'ปกติ (ไม่พบความเสี่ยง)';
  const date2q = document.getElementById('q2-modal-date').value;
  const assessor2q = document.getElementById('q2-modal-assessor').value.trim();
  const note2q = document.getElementById('q2-modal-note').value.trim();

  const idx = state.respondents.findIndex(r => r.id === respId);
  if (idx >= 0) {
    state.respondents[idx].q2_1 = q1;
    state.respondents[idx].q2_2 = q2;
    state.respondents[idx].status_2q = status2q;
    state.respondents[idx].date_2q = date2q;
    state.respondents[idx].assessor_2q = assessor2q;
    state.respondents[idx].note_2q = note2q;

    const rRef = state.respondents[idx];
    const as02Idx = state.envAs02.findIndex(x => x.respondent_id === rRef.id);
    if (as02Idx >= 0) {
      state.envAs02[as02Idx].q2_1 = q1;
      state.envAs02[as02Idx].q2_2 = q2;
      state.envAs02[as02Idx].status_2q = status2q;
    }

    saveLocalData();
    close2QModal();
    await postToGoogleSheets({ action: 'saveRespondent', data: state.respondents[idx] });
  }
}

function populateAs02RespondentDropdown() {
  const sel = document.getElementById('as02-fill-from-resp');
  if (!sel) return;
  sel.innerHTML = `<option value="">-- เลือกเพื่อดึงข้อมูลส่วนบุคคลจาก Env-As-01 (${state.respondents.length} ราย) อัตโนมัติ --</option>` +
    state.respondents.map(r => `<option value="${r.id}">[${r.code}] ${r.full_name} (ม.${r.moo} ต.${r.tambon} - คะแนน ${r.total_score})</option>`).join('');
}

function autofillAs02FromRespondent(respId) {
  const r = state.respondents.find(x => x.id === respId);
  if (!r) return;
  document.getElementById('as02-name').value = r.full_name || '';
  document.getElementById('as02-age').value = r.age || '';
  setSelectOrOther('as02-gender', 'as02-gender-other-wrap', 'as02-gender-other', r.gender ?? '');
  document.getElementById('as02-cid').value = r.cid || '';
  document.getElementById('as02-house').value = r.house_no || '';
  document.getElementById('as02-moo').value = r.moo || '';
  setSelectOrOther('as02-tambon', 'as02-tambon-other-wrap', 'as02-tambon-other', r.tambon || 'ท่าตอน');
  setSelectOrOther('as02-marital', 'as02-marital-other-wrap', 'as02-marital-other', r.marital_status ?? '');
  setSelectOrOther('as02-edu', 'as02-edu-other-wrap', 'as02-edu-other', r.education ?? '');
  document.getElementById('as02-years').value = r.years_in_area || '';
  if (document.getElementById('as02-exposure-years')) {
    document.getElementById('as02-exposure-years').value = r.exposure_years !== undefined ? r.exposure_years : '';
  }
  document.getElementById('as02-well-id').value = r.well_id || '';
  document.getElementById('as02-within-1km').value = r.q6 == null ? '' : r.q6 ? '1.ใช่' : '2.ไม่ใช่';
  if (document.getElementById('as02-job-flag')) document.getElementById('as02-job-flag').value = r.risk_job_flag ?? '';
  document.getElementById('as02-job-type').value = r.risk_job_type || '';
  populateCheckboxesFromString('as02-occ-chk', r.risk_job_type);
  document.getElementById('as02-job-detail').value = `${r.job_detail || ''} ${r.job_duration ? '(' + r.job_duration + ')' : ''}`.trim();
  document.getElementById('as02-diseases').value = r.diseases ?? '';
  document.getElementById('as02-eat-river-veg').value = r.q11 == null ? '' : r.q11 ? '1.ใช่' : '2.ไม่ใช่';
  document.getElementById('as02-flood-5y').value = r.q10 == null ? '' : r.q10 ? '1.เคย' : '2.ไม่เคย';
  if (document.getElementById('as02-q2-1')) document.getElementById('as02-q2-1').value = r.q2_1 || '';
  if (document.getElementById('as02-q2-2')) document.getElementById('as02-q2-2').value = r.q2_2 || '';
  if (document.getElementById('as02-status-2q')) document.getElementById('as02-status-2q').value = r.status_2q || 'ยังไม่คัดกรอง';
}

function openEnvAs02ForRespondent(respId) {
  openEnvAs02Modal(null);
  document.getElementById('as02-fill-from-resp').value = respId;
  autofillAs02FromRespondent(respId);
}

function openDetailedEnvAs02(id = null) {
  populateWellDropdowns();
  populateAs02RespondentDropdown();
  const modal = document.getElementById('env-as02-modal');
  const title = document.getElementById('as02-modal-title');
  document.getElementById('env-as02-form').reset();
  document.querySelectorAll('#env-as02-form .other-input-wrap').forEach(w => { w.style.display = 'none'; });
  document.querySelectorAll('.as02-occ-chk, .as02-drk-chk, .as02-use-chk').forEach(c => { c.checked = false; });

  if (id) {
    const item = state.envAs02.find(x => x.id === id);
    if (!item) return;
    title.innerHTML = `<i class="fa-solid fa-vial-circle-check"></i> แก้ไขแบบฟอร์ม Env-As-02 (${item.form_no || item.code || item.id}: ${item.full_name})`;
    document.getElementById('as02-id').value = item.id;
    document.getElementById('as02-form-no').value = item.form_no ?? '';
    document.getElementById('as02-date').value = item.interview_date ?? '';
    document.getElementById('as02-well-id').value = item.well_id ?? '';
    document.getElementById('as02-name').value = item.full_name ?? '';
    document.getElementById('as02-age').value = item.age ?? '';
    document.getElementById('as02-phone').value = item.phone ?? '';
    document.getElementById('as02-cid').value = item.cid ?? '';
    setSelectOrOther('as02-gender', 'as02-gender-other-wrap', 'as02-gender-other', item.gender ?? '');
    document.getElementById('as02-weight').value = item.weight_kg ?? '';
    document.getElementById('as02-height').value = item.height_cm ?? '';
    document.getElementById('as02-house').value = item.house_no ?? '';
    document.getElementById('as02-moo').value = item.moo ?? '';
    setSelectOrOther('as02-tambon', 'as02-tambon-other-wrap', 'as02-tambon-other', item.tambon ?? '');
    setSelectOrOther('as02-marital', 'as02-marital-other-wrap', 'as02-marital-other', item.marital_status ?? '');
    setSelectOrOther('as02-edu', 'as02-edu-other-wrap', 'as02-edu-other', item.education ?? '');
    document.getElementById('as02-years').value = item.years_in_area ?? '';
    if (document.getElementById('as02-exposure-years')) {
      document.getElementById('as02-exposure-years').value = item.exposure_years !== undefined ? item.exposure_years : (item.years_in_area ?? '');
    }
    document.getElementById('as02-hours-home').value = item.hours_at_home ?? '';
    document.getElementById('as02-out-district').value = item.work_out_district ?? '';
    document.getElementById('as02-out-days').value = item.work_out_days ?? '';
    document.getElementById('as02-within-1km').value = item.within_1km_river ?? '';
    if (document.getElementById('as02-job-flag')) document.getElementById('as02-job-flag').value = item.risk_job_flag ?? '';
    document.getElementById('as02-job-type').value = item.risk_job_type ?? '';
    populateCheckboxesFromString('as02-occ-chk', item.risk_job_type);
    document.getElementById('as02-job-detail').value = item.job_detail ?? '';
    document.getElementById('as02-diseases').value = item.diseases ?? '';
    setSelectOrOther('as02-herb', 'as02-herb-other-wrap', 'as02-herb-other', item.herb_usage ?? '');
    document.getElementById('as02-herb-name').value = item.herb_name ?? '';
    setSelectOrOther('as02-smoking', 'as02-smoking-other-wrap', 'as02-smoking-other', item.smoking_status ?? '');
    if (document.getElementById('as02-smoking-detail')) document.getElementById('as02-smoking-detail').value = item.smoking_detail ?? '';
    setSelectOrOther('as02-alcohol', 'as02-alcohol-other-wrap', 'as02-alcohol-other', item.alcohol_status ?? '');
    document.getElementById('as02-seafood-freq').value = item.seafood_freq ?? '';
    document.getElementById('as02-seafood-3days').value = item.seafood_3days ?? '';
    document.getElementById('as02-drink-sources').value = item.drink_sources ?? '';
    populateCheckboxesFromString('as02-drk-chk', item.drink_sources);
    if (document.getElementById('as02-drink-years')) document.getElementById('as02-drink-years').value = item.drink_years ?? '';
    document.getElementById('as02-use-sources').value = item.use_sources ?? '';
    populateCheckboxesFromString('as02-use-chk', item.use_sources);
    if (document.getElementById('as02-use-years')) document.getElementById('as02-use-years').value = item.use_years ?? '';
    setSelectOrOther('as02-food-rice', 'as02-rice-other-wrap', 'as02-rice-other', item.food_rice ?? '');
    setSelectOrOther('as02-food-veg', 'as02-veg-other-wrap', 'as02-veg-other', item.food_veg ?? '');
    setSelectOrOther('as02-food-fish', 'as02-fish-other-wrap', 'as02-fish-other', item.food_fish ?? '');
    setSelectOrOther('as02-food-snail', 'as02-snail-other-wrap', 'as02-snail-other', item.food_snail ?? '');
    document.getElementById('as02-home-veg').value = item.home_grown_veg ?? '';
    setSelectOrOther('as02-home-water', 'as02-home-water-other-wrap', 'as02-home-water-other', item.home_grown_water ?? '');
    document.getElementById('as02-eat-river-veg').value = item.eat_river_veg_weekly ?? '';
    document.getElementById('as02-flood-5y').value = item.flood_5years ?? '';
    if (document.getElementById('as02-q2-1')) document.getElementById('as02-q2-1').value = item.q2_1 ?? '';
    if (document.getElementById('as02-q2-2')) document.getElementById('as02-q2-2').value = item.q2_2 ?? '';
    if (document.getElementById('as02-status-2q')) document.getElementById('as02-status-2q').value = item.status_2q ?? '';
    document.getElementById('as02-interviewer').value = item.interviewer_name ?? '';
    if (document.getElementById('as02-role')) document.getElementById('as02-role').value = item.interviewer_role ?? '';
    setSelectOrOther('as02-hc', 'as02-hc-other-wrap', 'as02-hc-other', item.health_center ?? '');
  } else {
    title.innerHTML = `<i class="fa-solid fa-vial-circle-check"></i> บันทึกแบบฟอร์ม Env-As-02 ใหม่ (ก่อนเก็บตัวอย่างทางชีวภาพ)`;
    const nextNum = state.envAs02.length + 1;
    document.getElementById('as02-id').value = `AS02-${String(nextNum).padStart(3, '0')}`;
    document.getElementById('as02-form-no').value = `69-${String(nextNum).padStart(4, '0')}`;
    document.getElementById('as02-date').value = bangkokToday();
    if (document.getElementById('as02-exposure-years')) document.getElementById('as02-exposure-years').value = '';
  }
  modal.style.display = 'flex';
  const bodyEl = document.getElementById('as02-modal-body');
  if (bodyEl) bodyEl.scrollTop = 0;
}

function closeEnvAs02Modal() {
  document.getElementById('env-as02-modal').style.display = 'none';
}

async function handleSaveEnvAs02(e) {
  e.preventDefault();
  const id = document.getElementById('as02-id').value;
  const expYears = document.getElementById('as02-exposure-years') ? document.getElementById('as02-exposure-years').value.trim() : '';
  const q21 = document.getElementById('as02-q2-1') ? document.getElementById('as02-q2-1').value : 'ไม่ใช่';
  const q22 = document.getElementById('as02-q2-2') ? document.getElementById('as02-q2-2').value : 'ไม่ใช่';
  let status2q = document.getElementById('as02-status-2q') ? document.getElementById('as02-status-2q').value : 'ยังไม่คัดกรอง';
  if (q21 === 'ใช่' || q22 === 'ใช่') status2q = 'พบความเสี่ยง (Positive 2Q)';

  const obj = {
    ...(state.envAs02.find(x => x.id === id) || {}),
    history_updated: true,
    history_complete: Boolean(document.getElementById('as02-date').value && document.getElementById('as02-interviewer').value.trim()),
    respondent_id: document.getElementById('as02-fill-from-resp').value || (state.envAs02.find(x => x.id === id)?.respondent_id || ''),
    id: id,
    form_no: document.getElementById('as02-form-no').value.trim(),
    well_id: document.getElementById('as02-well-id').value.trim(),
    full_name: document.getElementById('as02-name').value.trim(),
    age: document.getElementById('as02-age').value,
    phone: document.getElementById('as02-phone').value.trim(),
    cid: document.getElementById('as02-cid').value.trim(),
    gender: getSelectOrOther('as02-gender', 'as02-gender-other'),
    weight_kg: document.getElementById('as02-weight').value,
    height_cm: document.getElementById('as02-height').value,
    house_no: document.getElementById('as02-house').value.trim(),
    moo: document.getElementById('as02-moo').value,
    tambon: getSelectOrOther('as02-tambon', 'as02-tambon-other'),
    marital_status: getSelectOrOther('as02-marital', 'as02-marital-other'),
    education: getSelectOrOther('as02-edu', 'as02-edu-other'),
    amphoe: 'แม่อาย',
    province: 'เชียงใหม่',
    years_in_area: document.getElementById('as02-years').value,
    exposure_years: expYears !== '' ? Number(expYears) : '',
    hours_at_home: document.getElementById('as02-hours-home').value,
    work_out_district: document.getElementById('as02-out-district').value,
    work_out_days: document.getElementById('as02-out-days').value,
    within_1km_river: document.getElementById('as02-within-1km').value,
    risk_job_flag: document.getElementById('as02-job-flag') ? document.getElementById('as02-job-flag').value : 'ไม่ใช่',
    risk_job_type: document.getElementById('as02-job-type').value.trim(),
    job_detail: document.getElementById('as02-job-detail').value.trim(),
    diseases: document.getElementById('as02-diseases').value.trim(),
    herb_usage: getSelectOrOther('as02-herb', 'as02-herb-other'),
    herb_name: document.getElementById('as02-herb-name').value.trim(),
    smoking_status: getSelectOrOther('as02-smoking', 'as02-smoking-other'),
    smoking_detail: document.getElementById('as02-smoking-detail') ? document.getElementById('as02-smoking-detail').value.trim() : '',
    alcohol_status: getSelectOrOther('as02-alcohol', 'as02-alcohol-other'),
    seafood_freq: document.getElementById('as02-seafood-freq').value,
    seafood_3days: document.getElementById('as02-seafood-3days').value,
    drink_sources: document.getElementById('as02-drink-sources').value.trim(),
    drink_years: document.getElementById('as02-drink-years') ? document.getElementById('as02-drink-years').value.trim() : '',
    use_sources: document.getElementById('as02-use-sources').value.trim(),
    use_years: document.getElementById('as02-use-years') ? document.getElementById('as02-use-years').value.trim() : '',
    food_rice: getSelectOrOther('as02-food-rice', 'as02-rice-other'),
    food_veg: getSelectOrOther('as02-food-veg', 'as02-veg-other'),
    food_fish: getSelectOrOther('as02-food-fish', 'as02-fish-other'),
    food_snail: getSelectOrOther('as02-food-snail', 'as02-snail-other'),
    home_grown_veg: document.getElementById('as02-home-veg').value.trim(),
    home_grown_water: getSelectOrOther('as02-home-water', 'as02-home-water-other'),
    eat_river_veg_weekly: document.getElementById('as02-eat-river-veg').value,
    flood_5years: document.getElementById('as02-flood-5y').value,
    q2_1: q21,
    q2_2: q22,
    status_2q: status2q,
    interviewer_name: document.getElementById('as02-interviewer').value.trim(),
    interviewer_role: document.getElementById('as02-role') ? document.getElementById('as02-role').value.trim() : '',
    health_center: getSelectOrOther('as02-hc', 'as02-hc-other'),
    interview_date: document.getElementById('as02-date').value,
    updated_at: new Date().toLocaleString('th-TH')
  };

  const idx = state.envAs02.findIndex(x => x.id === id);
  if (idx >= 0) state.envAs02[idx] = obj;
  else state.envAs02.push(obj);

  saveLocalData();
  closeEnvAs02Modal();
  await postToGoogleSheets({ action: 'saveEnvAs02', data: obj });
}

async function deleteEnvAs02(id) {
  if (!confirm(`ยืนยันการลบข้อมูลแบบฟอร์ม Env-As-02 รหัส ${id} หรือไม่?`)) return;
  state.envAs02 = state.envAs02.filter(x => x.id !== id);
  saveLocalData();
  await postToGoogleSheets({ action: 'deleteEnvAs02', id: id });
}

function filterWellByTypeClick(typeName) {
  switchTab('tab-wells');
  document.getElementById('well-filter-type').value = typeName;
  renderWellsTable();
}

function filterWellByDistClick(distKey) {
  switchTab('tab-wells');
  document.getElementById('well-filter-dist').value = distKey;
  renderWellsTable();
}

function filterWellByHcClick(hcName) {
  switchTab('tab-wells');
  document.getElementById('well-filter-hc').value = hcName;
  renderWellsTable();
}

// Optional well links use the existing empty well_id value, so they can be filled later.
function screeningWellOptions() {
 return state.wells.map(w=>`<option value="${esc(w.well_id)}">[${esc(w.well_id)}${w.sample_code?' / '+esc(w.sample_code):''}] ${esc(w.well_name||w.owner_name||'ไม่ระบุชื่อ')} (ม.${esc(w.moo??'ไม่ระบุ')} ต.${esc(w.tambon||'ไม่ระบุ')})</option>`).join('');
}
function populateScreeningWellSelect(id,selected) {
 const select=document.getElementById(id);if(!select)return;
 const value=String(selected??select.value??'').trim();
 select.required=false;
 select.innerHTML='<option value="">ไม่มี / ยังไม่เชื่อมโยง (เพิ่มภายหลังได้)</option>'+screeningWellOptions();
 // Preserve a recorded ID when it is not currently in the registry; do not silently erase it.
 if(value&&!state.wells.some(w=>String(w.well_id)===value))select.insertAdjacentHTML('beforeend',`<option value="${esc(value)}">[${esc(value)}] รหัสเดิม — ยังไม่พบในทะเบียนแหล่งน้ำ</option>`);
 select.value=value;
}

function populateWellDropdowns() {
  const mapWellSel = document.getElementById('map-filter-well');
  const respFilterWellSel = document.getElementById('resp-filter-well');
  const modalWellSel = document.getElementById('resp-well-id');
  const labFilterWellSel = document.getElementById('waterlab-filter-well');
  const labModalWellSel = document.getElementById('wlab-well-id');

  const currentMapVal = mapWellSel ? mapWellSel.value : 'ALL';
  const currentRespFilterVal = respFilterWellSel ? respFilterWellSel.value : 'ALL';
  const currentModalVal = modalWellSel ? modalWellSel.value : '';
  const currentLabFilterVal = labFilterWellSel ? labFilterWellSel.value : 'ALL';
  const currentLabModalVal = labModalWellSel ? labModalWellSel.value : '';

  const optionsHtml = screeningWellOptions();

  if (mapWellSel) {
    mapWellSel.innerHTML = `<option value="ALL">-- ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ) --</option>` + optionsHtml;
    mapWellSel.value = currentMapVal;
  }
  if (respFilterWellSel) {
    respFilterWellSel.innerHTML = `<option value="ALL">ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ)</option>` + optionsHtml;
    respFilterWellSel.value = currentRespFilterVal;
  }
  populateScreeningWellSelect('resp-well-id',currentModalVal);
  populateScreeningWellSelect('as02-well-id');
  if (labFilterWellSel) {
    labFilterWellSel.innerHTML = `<option value="ALL">ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ)</option>` + optionsHtml;
    labFilterWellSel.value = currentLabFilterVal;
  }
  if (labModalWellSel) {
    labModalWellSel.innerHTML = '<option value="">-- ยังไม่ยืนยันการจับคู่ทะเบียน --</option>' + optionsHtml;
    if (currentLabModalVal) labModalWellSel.value = currentLabModalVal;
  }
}

// ==================== WATER WELLS TABLE, ATTACHMENTS & CRUD ====================
function handleWellFilesSelect(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const currentCount = state.currentWellAttachments.length;
  if (currentCount + files.length > 5) {
    alert(`สามารถแนบรูปภาพหรือเอกสาร PDF ได้สูงสุดไม่เกิน 5 ไฟล์ต่อจุดแหล่งน้ำครับ (ปัจจุบันมีแล้ว ${currentCount} ไฟล์, ท่านเลือกเพิ่ม ${files.length} ไฟล์)`);
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxToAdd = Math.min(files.length, 5 - currentCount);

  Array.from(files).slice(0, maxToAdd).forEach(file => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      alert(`ไฟล์ "${file.name}" ไม่ใช่ไฟล์ JPG, PNG หรือ PDF ที่รองรับครับ`);
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          state.currentWellAttachments.push({
            name: file.name,
            type: 'image',
            size_kb: Math.round(compressedDataUrl.length * 0.75 / 1024),
            dataUrl: compressedDataUrl,
            uploaded_at: new Date().toLocaleString('th-TH')
          });
          renderWellFilesPreview();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      if (file.size > 3.5 * 1024 * 1024) {
        alert(`ไฟล์ PDF "${file.name}" มีขนาดเกิน 3.5 MB กรุณาเลือกไฟล์ที่บีบอัดแล้ว`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        state.currentWellAttachments.push({
          name: file.name,
          type: 'pdf',
          size_kb: Math.round(file.size / 1024),
          dataUrl: e.target.result,
          uploaded_at: new Date().toLocaleString('th-TH')
        });
        renderWellFilesPreview();
      };
      reader.readAsDataURL(file);
    }
  });

  event.target.value = '';
}

function renderWellFilesPreview() {
  const container = document.getElementById('well-files-preview');
  const countEl = document.getElementById('well-files-count');
  if (!container) return;

  const count = state.currentWellAttachments.length;
  if (countEl) countEl.textContent = `แนบแล้ว ${count} / 5 ไฟล์`;

  if (count === 0) {
    container.innerHTML = '<span class="text-muted" style="font-size:12px;">ยังไม่มีไฟล์รูปภาพหรือ PDF ที่แนบ</span>';
    return;
  }

  container.innerHTML = state.currentWellAttachments.map((att, idx) => {
    if (att.type === 'image') {
      return `
        <div class="well-att-card">
          <img src="${att.dataUrl}" alt="${att.name}" onclick="window.open('${att.dataUrl}')" title="คลิกเพื่อดูภาพขนาดเต็ม">
          <button type="button" class="well-att-del" onclick="removeWellAttachment(${idx})" title="ลบไฟล์นี้">&times;</button>
          <div class="well-att-name" title="${att.name}">${att.name} (${att.size_kb} KB)</div>
        </div>
      `;
    } else {
      return `
        <div class="well-att-card">
          <div class="well-att-pdf-box" onclick="window.open('${att.dataUrl}')" title="คลิกเพื่อเปิดไฟล์ PDF">
            <i class="fa-solid fa-file-pdf"></i>
            <div>PDF</div>
          </div>
          <button type="button" class="well-att-del" onclick="removeWellAttachment(${idx})" title="ลบไฟล์นี้">&times;</button>
          <div class="well-att-name" title="${att.name}">${att.name} (${att.size_kb} KB)</div>
        </div>
      `;
    }
  }).join('');
}

function removeWellAttachment(idx) {
  state.currentWellAttachments.splice(idx, 1);
  renderWellFilesPreview();
}

function openWellGalleryModal(wellId) {
  const well = state.wells.find(w => w.well_id === wellId);
  if (!well) return;

  const modal = document.getElementById('well-gallery-modal');
  const title = document.getElementById('well-gallery-title');
  const body = document.getElementById('well-gallery-body');
  if (!modal || !body) return;

  const atts = Array.isArray(well.attachments) ? well.attachments : [];
  title.innerHTML = `<i class="fa-solid fa-images"></i> รูปภาพและเอกสารจุดแหล่งน้ำ: [${well.well_id}] ${well.well_name}`;

  if (atts.length === 0) {
    body.innerHTML = `
      <div style="text-align:center; padding:35px 20px; color:#64748b;">
        <i class="fa-regular fa-image" style="font-size:48px; opacity:0.4; margin-bottom:12px;"></i>
        <p>ยังไม่มีการแนบรูปภาพหรือเอกสารสำหรับจุดแหล่งน้ำนี้</p>
        <button class="btn btn-primary" onclick="closeWellGalleryModal(); openWellModal('${well.well_id}');" style="margin-top:10px;">
          <i class="fa-solid fa-upload"></i> คลิกที่นี่เพื่อเพิ่มรูปภาพ / PDF
        </button>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:13px; color:#475569;">
          จุดบ่อน้ำ: <b>${well.well_name}</b> (ม.${well.moo} ต.${well.tambon}) | ไฟล์แนบทั้งหมด <b>${atts.length} ไฟล์</b>
        </div>
        <button class="btn btn-sm btn-outline" onclick="closeWellGalleryModal(); openWellModal('${well.well_id}');">
          <i class="fa-solid fa-pen"></i> แก้ไข/เพิ่มรูป
        </button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
        ${atts.map((att, i) => {
          if (att.type === 'image') {
            return `
              <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:8px; display:flex; flex-direction:column;">
                <a href="${att.dataUrl}" target="_blank" download="${att.name}" title="คลิกเพื่อดูภาพเต็ม / ดาวน์โหลด">
                  <img src="${att.dataUrl}" alt="${att.name}" style="width:100%; height:160px; object-fit:cover; border-radius:6px; cursor:zoom-in;">
                </a>
                <div style="margin-top:6px; font-size:12px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${att.name}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${att.uploaded_at || ''} (${att.size_kb || '-'} KB)</div>
                <div style="margin-top:6px; display:flex; gap:6px;">
                  <a href="${att.dataUrl}" target="_blank" class="btn btn-xs btn-outline" style="text-decoration:none; flex:1; text-align:center;">ดูรูปใหญ่</a>
                  <a href="${att.dataUrl}" download="${att.name}" class="btn btn-xs btn-primary" style="text-decoration:none; flex:1; text-align:center;">ดาวน์โหลด</a>
                </div>
              </div>
            `;
          } else {
            return `
              <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:8px; display:flex; flex-direction:column;">
                <div style="height:160px; background:#fef2f2; border:1px dashed #fca5a5; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#dc2626;">
                  <i class="fa-solid fa-file-pdf" style="font-size:42px; margin-bottom:8px;"></i>
                  <span style="font-weight:700; font-size:13px;">เอกสาร PDF</span>
                </div>
                <div style="margin-top:6px; font-size:12px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${att.name}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${att.uploaded_at || ''} (${att.size_kb || '-'} KB)</div>
                <div style="margin-top:6px; display:flex; gap:6px;">
                  <a href="${att.dataUrl}" target="_blank" class="btn btn-xs btn-outline" style="text-decoration:none; flex:1; text-align:center;">เปิดอ่าน</a>
                  <a href="${att.dataUrl}" download="${att.name}" class="btn btn-xs btn-primary" style="text-decoration:none; flex:1; text-align:center;">ดาวน์โหลด</a>
                </div>
              </div>
            `;
          }
        }).join('')}
      </div>
    `;
  }

  modal.style.display = 'flex';
}

function closeWellGalleryModal() {
  const modal = document.getElementById('well-gallery-modal');
  if (modal) modal.style.display = 'none';
}

function filterPeopleByWell(wellId) {
  switchTab('tab-respondents');
  const sel = document.getElementById('resp-filter-well');
  if (sel) {
    sel.value = wellId;
    renderRespondentsTable();
  }
}

function focusOnMap(lat, lng) {
  switchTab('tab-map');
  if (state.map) {
    setTimeout(() => {
      state.map.invalidateSize();
      state.map.setView([lat, lng], 17);
    }, 150);
  }
}

function openWellModal(wellId = null) {
  const modal = document.getElementById('well-modal');
  const title = document.getElementById('well-modal-title');
  document.getElementById('well-form').reset();
  document.querySelectorAll('#well-form .other-input-wrap').forEach(w => { w.style.display = 'none'; });

  if (wellId) {
    const w = state.wells.find(item => item.well_id === wellId);
    if (!w) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลแหล่งน้ำ (${w.well_id})`;
    document.getElementById('well-id').value = w.well_id;
    document.getElementById('well-id').readOnly = true;
    document.getElementById('well-sample-code').value = w.sample_code || '';
    document.getElementById('well-name').value = w.well_name;
    setSelectOrOther('well-type', 'well-type-other-wrap', 'well-type-other', w.well_type || 'บ่อบาดาล');
    if (document.getElementById('well-depth')) document.getElementById('well-depth').value = w.depth_meters || '';
    setSelectOrOther('well-hc', 'well-hc-other-wrap', 'well-hc-other', w.health_center ?? '');
    document.getElementById('well-lat').value = w.latitude;
    document.getElementById('well-lng').value = w.longitude;
    document.getElementById('well-utm-e').value = w.utm_e || '';
    document.getElementById('well-utm-n').value = w.utm_n || '';
    document.getElementById('well-house').value = w.house_no || '';
    document.getElementById('well-moo').value = w.moo || '';
    setSelectOrOther('well-tambon', 'well-tambon-other-wrap', 'well-tambon-other', w.tambon || 'ท่าตอน');
    document.getElementById('well-dist').value = w.distance_river_m !== undefined ? w.distance_river_m : 100;
    setSelectOrOther('well-usage-select', 'well-usage-other-wrap', 'well-usage', w.usage_type || 'ใช้อุปโภค');
    document.getElementById('well-user-count').value = w.user_count ?? '';
    document.getElementById('well-arsenic').value = w.arsenic_level !== undefined ? w.arsenic_level : '';
    setSelectOrOther('well-status-select', 'well-status-other-wrap', 'well-status', w.safety_status || w.arsenic_status || 'เฝ้าระวังตามระยะห่างแม่น้ำกก');
    document.getElementById('well-notes').value = w.notes || '';
    state.currentWellAttachments = Array.isArray(w.attachments) ? [...w.attachments] : [];
  } else {
    title.innerHTML = `<i class="fa-solid fa-faucet-drip"></i> เพิ่มจุดแหล่งน้ำใหม่`;
    document.getElementById('well-id').value = nextWellId();
    document.getElementById('well-id').readOnly = true;
    document.getElementById('well-lat').value = '';
    document.getElementById('well-lng').value = '';
    document.getElementById('well-dist').value = '';
    document.getElementById('well-user-count').value = '';
    state.currentWellAttachments = [];
  }

  renderWellFilesPreview();
  modal.style.display = 'flex';
  const bodyEl = document.getElementById('well-modal-body');
  if (bodyEl) bodyEl.scrollTop = 0;
}

function closeWellModal() {
  document.getElementById('well-modal').style.display = 'none';
}

function useCurrentGpsForWell() {
  if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('well-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('well-lng').value = pos.coords.longitude.toFixed(6);
  });
}

async function handleSaveWell(e) {
  e.preventDefault();
  const dist = optionalNumber(document.getElementById('well-dist').value);
  let distBand = 'มากกว่า 300 เมตร';
  if (dist === null) distBand = 'ไม่ระบุ';
  else if (dist <= 100) distBand = 'ไม่เกิน 100 เมตร';
  else if (dist <= 200) distBand = '101 - 200 เมตร';
  else if (dist <= 300) distBand = '201 - 300 เมตร';

  const pCode = document.getElementById('well-sample-code').value.trim();
  const wellId = document.getElementById('well-id').value.trim();
  const existing = state.wells.find(w => w.well_id === wellId);

  const wellObj = {
    ...(existing || {}),
    well_id: wellId,
    seq: existing ? existing.seq : state.wells.length + 1,
    sample_code: pCode,
    well_name: document.getElementById('well-name').value.trim(),
    owner_name: existing && existing.well_name === document.getElementById('well-name').value.trim() ? existing.owner_name : document.getElementById('well-name').value.trim(),
    well_type: getSelectOrOther('well-type', 'well-type-other'),
    depth_meters: document.getElementById('well-depth') ? document.getElementById('well-depth').value.trim() : '',
    health_center: getSelectOrOther('well-hc', 'well-hc-other'),
    latitude: parseFloat(document.getElementById('well-lat').value),
    longitude: parseFloat(document.getElementById('well-lng').value),
    utm_e: document.getElementById('well-utm-e').value || '',
    utm_n: document.getElementById('well-utm-n').value || '',
    house_no: document.getElementById('well-house').value.trim(),
    moo: Number(document.getElementById('well-moo').value),
    tambon: getSelectOrOther('well-tambon', 'well-tambon-other'),
    amphoe: 'แม่อาย',
    province: 'เชียงใหม่',
    distance_river_m: dist,
    distance_band: distBand,
    usage_type: getSelectOrOther('well-usage-select', 'well-usage'),
    user_count: optionalNumber(document.getElementById('well-user-count').value),
    arsenic_level: document.getElementById('well-arsenic').value,
    safety_status: getSelectOrOther('well-status-select', 'well-status') || (pCode ? `ส่งตรวจสารปนเปื้อน (${pCode})` : 'สำรวจแล้ว'),
    notes: document.getElementById('well-notes').value.trim(),
    attachments: [...state.currentWellAttachments],
    updated_at: new Date().toLocaleString('th-TH'),
    updated_by: state.currentUser ? state.currentUser.displayName : 'Admin'
  };

  const idx = state.wells.findIndex(w => w.well_id === wellObj.well_id);
  if (idx >= 0) {
    state.wells[idx] = wellObj;
  } else {
    state.wells.push(wellObj);
  }

  saveLocalData();
  closeWellModal();
  const lightWell = { ...wellObj, attachments_count: (wellObj.attachments || []).length, attachments: undefined };
  await postToGoogleSheets({ action: 'saveWell', data: lightWell });
}

function recalcScore() {
  let score = 0;
  for (let i = 1; i <= 11; i++) {
    const chk = document.getElementById(`env-q${i}`);
    if (chk && chk.checked) {
      score += ENV_WEIGHTS[`q${i}`];
    }
  }

  const scoreEl = document.getElementById('calc-total-score');
  const badgeEl = document.getElementById('calc-risk-badge');
  const measureEl = document.getElementById('calc-measure-text');
  if (scoreEl) scoreEl.textContent = score;

  const rLow = document.getElementById('criteria-row-low');
  const rMed = document.getElementById('criteria-row-med');
  const rHigh = document.getElementById('criteria-row-high');
  if (rLow) rLow.className = '';
  if (rMed) rMed.className = '';
  if (rHigh) rHigh.className = '';

  if (score >= 20) {
    if (badgeEl) {
      badgeEl.className = 'risk-badge risk-high';
      badgeEl.textContent = 'สูง / มาก (คะแนน ≥ 20)';
    }
    if (measureEl) measureEl.textContent = 'มาตรการ: ส่งพบแพทย์ตรวจร่างกาย ซักประวัติ Env-As-02 และเก็บปัสสาวะตรวจสารหนู';
    if (rHigh) rHigh.className = 'risk-criteria-row-active';
  } else if (score >= 10) {
    if (badgeEl) {
      badgeEl.className = 'risk-badge risk-med';
      badgeEl.textContent = 'ปานกลาง (คะแนน 10 - <20)';
    }
    if (measureEl) measureEl.textContent = 'มาตรการ: สื่อสารความเสี่ยง ซักประวัติ Env-As-02 และพิจารณาตรวจสารหนูในปัสสาวะ';
    if (rMed) rMed.className = 'risk-criteria-row-active';
  } else {
    if (badgeEl) {
      badgeEl.className = 'risk-badge risk-low';
      badgeEl.textContent = 'ต่ำ (คะแนน 0 - < 10)';
    }
    if (measureEl) measureEl.textContent = 'มาตรการ: สื่อสารความเสี่ยง ให้สุขศึกษา ติดตามเฝ้าระวังทุก 1 ปี';
    if (rLow) rLow.className = 'risk-criteria-row-active';
  }
  return score;
}

function useCurrentGpsForRespondent() {
  if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('resp-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('resp-lng').value = pos.coords.longitude.toFixed(6);
  });
}

function openDetailedRespondentModal(respId = null) {
  populateWellDropdowns();
  const modal = document.getElementById('respondent-modal');
  const title = document.getElementById('resp-modal-title');
  document.getElementById('respondent-form').reset();
  document.querySelectorAll('#respondent-form .other-input-wrap').forEach(w => { w.style.display = 'none'; });
  document.querySelectorAll('.as01-occ-chk, .as01-dis-chk, .as01-sym-chk').forEach(c => { c.checked = false; });

  if (respId) {
    const r = state.respondents.find(item => item.id === respId);
    if (!r) return;
    title.innerHTML = `<i class="fa-solid fa-user-pen"></i> แก้ไขแบบฟอร์ม Env-As-01: ${r.full_name} (${r.code})`;
    document.getElementById('resp-id').value = r.id;
    document.getElementById('resp-code').value = r.code || '';
    if (document.getElementById('resp-survey-date')) document.getElementById('resp-survey-date').value = r.survey_date || '';
    setSelectOrOther('resp-target-group', 'resp-target-other-wrap', 'resp-target-other', r.target_group || 'กลุ่มใหม่');
    document.getElementById('resp-cut-point').value = r.cut_point || '';
    document.getElementById('resp-well-id').value = r.well_id || '';
    setSelectOrOther('resp-hc', 'resp-hc-other-wrap', 'resp-hc-other', r.health_center || 'รพ.สต.บ้านท่าตอน');
    if (document.getElementById('resp-interviewer')) document.getElementById('resp-interviewer').value = r.interviewer_name || 'เจ้าหน้าที่สาธารณสุข อ.แม่อาย';

    document.getElementById('resp-name').value = r.full_name || '';
    document.getElementById('resp-age').value = r.age || '';
    setSelectOrOther('resp-gender', 'resp-gender-other-wrap', 'resp-gender-other', r.gender || '1) ชาย');
    document.getElementById('resp-cid').value = r.cid || '';
    if (document.getElementById('resp-no-cid')) document.getElementById('resp-no-cid').checked = Boolean(r.no_cid || r.cid === 'ไม่มีเลข 13 หลัก');
    document.getElementById('resp-house').value = r.house_no || '';
    document.getElementById('resp-moo').value = r.moo || '';
    setSelectOrOther('resp-tambon', 'resp-tambon-other-wrap', 'resp-tambon-other', r.tambon || 'ท่าตอน');
    setSelectOrOther('resp-marital', 'resp-marital-other-wrap', 'resp-marital-other', r.marital_status || '2) คู่');
    setSelectOrOther('resp-edu', 'resp-edu-other-wrap', 'resp-edu-other', r.education || '1) ไม่ได้เรียนหนังสือ');
    document.getElementById('resp-years-area').value = r.years_in_area || '';
    if (document.getElementById('resp-exposure-years')) document.getElementById('resp-exposure-years').value = r.exposure_years !== undefined ? r.exposure_years : '';
    document.getElementById('resp-lat').value = r.latitude ?? '';
    document.getElementById('resp-lng').value = r.longitude ?? '';

    document.getElementById('resp-job-flag').value = r.risk_job_flag || 'ไม่ใช่';
    document.getElementById('resp-job-type').value = r.risk_job_type || '';
    populateCheckboxesFromString('as01-occ-chk', r.risk_job_type);
    document.getElementById('resp-job-detail').value = r.job_detail || '';
    document.getElementById('resp-job-duration').value = r.job_duration || '';
    document.getElementById('resp-job-hours').value = r.job_hours || '';
    document.getElementById('resp-swim-duration').value = r.swim_duration || '';
    document.getElementById('resp-swim-hours').value = r.swim_hours || '';

    document.getElementById('resp-disease-flag').value = r.disease_flag || 'ไม่มี';
    document.getElementById('resp-diseases').value = r.diseases || '';
    populateCheckboxesFromString('as01-dis-chk', r.diseases);
    document.getElementById('resp-symptom-flag').value = r.symptom_flag || 'ไม่มี';
    document.getElementById('resp-symptoms').value = r.symptoms || '';
    populateCheckboxesFromString('as01-sym-chk', r.symptoms);

    if (document.getElementById('resp-q2-1')) document.getElementById('resp-q2-1').value = r.q2_1 || '';
    if (document.getElementById('resp-q2-2')) document.getElementById('resp-q2-2').value = r.q2_2 || '';
    if (document.getElementById('resp-status-2q')) document.getElementById('resp-status-2q').value = r.status_2q || 'ยังไม่คัดกรอง';

    for (let i = 1; i <= 11; i++) {
      document.getElementById(`env-q${i}`).checked = Boolean(Number(r[`q${i}`]));
    }
    recalcScore();
  } else {
    title.innerHTML = `<i class="fa-solid fa-file-medical"></i> บันทึกแบบฟอร์ม Env-As-01 ใหม่ (คัดกรองความเสี่ยงระดับบุคคล)`;
    const nextSeq = state.respondents.length + 1;
    document.getElementById('resp-id').value = `RESP-${String(nextSeq).padStart(3, '0')}`;
    document.getElementById('resp-code').value = `NM${String(nextSeq).padStart(3, '0')}`;
    if (document.getElementById('resp-survey-date')) document.getElementById('resp-survey-date').value = bangkokToday();
    document.getElementById('resp-lat').value = '';
    document.getElementById('resp-lng').value = '';
    if (document.getElementById('resp-exposure-years')) document.getElementById('resp-exposure-years').value = '';
    recalcScore();
  }

  modal.style.display = 'flex';
  const bodyEl = document.getElementById('resp-modal-body');
  if (bodyEl) bodyEl.scrollTop = 0;
}

function closeRespondentModal() {
  document.getElementById('respondent-modal').style.display = 'none';
}

async function handleSaveRespondent(e) {
  e.preventDefault();
  const totalScore = recalcScore();
  const riskLevel = totalScore > 20 ? 'มาก' : (totalScore >= 10 ? 'ปานกลาง' : 'ต่ำ');

  const id = document.getElementById('resp-id').value;
  const existing = state.respondents.find(item => item.id === id);
  const targetGroupVal = getSelectOrOther('resp-target-group', 'resp-target-other');
  const isTargetUrine = targetGroupVal !== 'ประชาชนทั่วไป (แท็บการตอบกลับ)';

  const expYears = document.getElementById('resp-exposure-years') ? document.getElementById('resp-exposure-years').value.trim() : '';
  const q21 = document.getElementById('resp-q2-1') ? document.getElementById('resp-q2-1').value : 'ไม่ใช่';
  const q22 = document.getElementById('resp-q2-2') ? document.getElementById('resp-q2-2').value : 'ไม่ใช่';
  let status2q = document.getElementById('resp-status-2q') ? document.getElementById('resp-status-2q').value : 'ยังไม่คัดกรอง';
  if (q21 === 'ใช่' || q22 === 'ใช่') status2q = 'พบความเสี่ยง (Positive 2Q)';

  const respObj = {
    id: id,
    seq: existing ? existing.seq : state.respondents.length + 1,
    code: document.getElementById('resp-code').value.trim(),
    is_urine_target: isTargetUrine,
    urine_seq: existing ? existing.urine_seq : (isTargetUrine ? state.respondents.filter(x => x.is_urine_target).length + 1 : null),
    source_tab: isTargetUrine ? 'รายชื่อเก็บปัสสาวะ (รายชื่อขั้น 2)' : 'การตอบกลับ (คัดกรองขั้นแรก)',
    survey_date: document.getElementById('resp-survey-date') ? document.getElementById('resp-survey-date').value : '2026-10-27',
    interviewer_name: document.getElementById('resp-interviewer') ? document.getElementById('resp-interviewer').value.trim() : 'เจ้าหน้าที่สาธารณสุข',
    health_center: getSelectOrOther('resp-hc', 'resp-hc-other'),
    well_id: document.getElementById('resp-well-id').value,
    target_group: targetGroupVal,
    cut_point: document.getElementById('resp-cut-point').value.trim(),
    full_name: document.getElementById('resp-name').value.trim(),
    age: document.getElementById('resp-age').value,
    gender: getSelectOrOther('resp-gender', 'resp-gender-other'),
    cid: document.getElementById('resp-cid').value.trim(),
    no_cid: document.getElementById('resp-no-cid') ? document.getElementById('resp-no-cid').checked : false,
    house_no: document.getElementById('resp-house').value.trim(),
    moo: document.getElementById('resp-moo').value,
    tambon: getSelectOrOther('resp-tambon', 'resp-tambon-other'),
    amphoe: 'แม่อาย',
    province: 'เชียงใหม่',
    marital_status: getSelectOrOther('resp-marital', 'resp-marital-other'),
    education: getSelectOrOther('resp-edu', 'resp-edu-other'),
    years_in_area: document.getElementById('resp-years-area').value,
    exposure_years: expYears !== '' ? Number(expYears) : '',
    risk_job_flag: document.getElementById('resp-job-flag').value,
    risk_job_type: document.getElementById('resp-job-type').value.trim(),
    job_detail: document.getElementById('resp-job-detail').value.trim(),
    job_duration: document.getElementById('resp-job-duration').value.trim(),
    job_hours: document.getElementById('resp-job-hours').value.trim(),
    swim_duration: document.getElementById('resp-swim-duration').value.trim(),
    swim_hours: document.getElementById('resp-swim-hours').value.trim(),
    disease_flag: document.getElementById('resp-disease-flag').value,
    diseases: document.getElementById('resp-diseases').value.trim(),
    symptom_flag: document.getElementById('resp-symptom-flag').value,
    symptoms: document.getElementById('resp-symptoms').value.trim(),
    q1: document.getElementById('env-q1').checked ? 1 : 0,
    q2: document.getElementById('env-q2').checked ? 1 : 0,
    q3: document.getElementById('env-q3').checked ? 1 : 0,
    q4: document.getElementById('env-q4').checked ? 1 : 0,
    q5: document.getElementById('env-q5').checked ? 1 : 0,
    q6: document.getElementById('env-q6').checked ? 1 : 0,
    q7: document.getElementById('env-q7').checked ? 1 : 0,
    q8: document.getElementById('env-q8').checked ? 1 : 0,
    q9: document.getElementById('env-q9').checked ? 1 : 0,
    q10: document.getElementById('env-q10').checked ? 1 : 0,
    q11: document.getElementById('env-q11').checked ? 1 : 0,
    total_score: totalScore,
    risk_level: riskLevel,
    q2_1: q21,
    q2_2: q22,
    status_2q: status2q,
    date_2q: existing ? existing.date_2q : '',
    assessor_2q: existing ? existing.assessor_2q : '',
    note_2q: existing ? existing.note_2q : '',
    latitude: parseFloat(document.getElementById('resp-lat').value),
    longitude: parseFloat(document.getElementById('resp-lng').value),
    updated_at: new Date().toLocaleString('th-TH'),
    updated_by: state.currentUser ? state.currentUser.displayName : 'Admin'
  };

  const idx = state.respondents.findIndex(item => item.id === id);
  if (idx >= 0) {
    state.respondents[idx] = respObj;
  } else {
    state.respondents.push(respObj);
  }

  saveLocalData();
  closeRespondentModal();
  await postToGoogleSheets({ action: 'saveRespondent', data: respObj });
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// ==================== GOOGLE SHEETS CLOUD SYNC & ADMIN LOCK ====================
function autoSaveGasUrlInput() {
 // Endpoint changes are applied only by the explicit save action after signing out.
}

function toggleUnlockGasInput() {
 if(state.currentUser?.role!=='admin'){alert('ผู้ดูแลระบบเท่านั้นที่แก้ลิงก์ได้');return;}
 const input=document.getElementById('gas-url-input');if(!input)return;
 state.gasUnlocked=!state.gasUnlocked;input.readOnly=!state.gasUnlocked;
}

async function saveGasUrl() {
 if(state.currentUser?.role!=='admin'){alert('ผู้ดูแลระบบเท่านั้นที่แก้ลิงก์ได้');return;}
 const url=document.getElementById('gas-url-input').value.trim();
 if(!validGasUrl(url)){alert('ใช้ลิงก์ Google Apps Script ที่ลงท้าย /exec เท่านั้น');return;}
 if(pendingCloudWrites().length){alert('กรุณาส่งรายการรอส่งให้สำเร็จก่อนเปลี่ยนลิงก์');return;}
 handleLogout();persistGasUrlEverywhere(url);state.cloudCapabilities=null;await probeCloudConnection();
 setLoginMessage('บันทึกลิงก์แล้ว กรุณาเข้าสู่ระบบส่วนกลางอีกครั้ง');
}

async function saveGasUrlToAppJsFile() {
  const input = document.getElementById('gas-url-input');
  const url = (input && input.value.trim()) ? input.value.trim() : state.gasUrl;
  if (!url) {
    alert('กรุณาวางลิงก์ Google Apps Script Web App URL ในช่องลิงก์ก่อนครับ');
    return;
  }
  persistGasUrlEverywhere(url);
  try {
    const res = await fetch('app.js');
    let code = await res.text();
    code = code.replace(/const DEFAULT_GAS_URL\s*=\s*'[^']*';/, `const DEFAULT_GAS_URL = '${url}';`);

    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'app.js',
        types: [{ description: 'JavaScript File', accept: { 'text/javascript': ['.js'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(code);
      await writable.close();
      alert('บันทึกฝังลิงก์ลงในไฟล์ app.js สำเร็จเรียบร้อยแล้ว! ทีนี้ไม่ว่าจะเปิดเครื่องไหนหรืออัปโหลดขึ้น GitHub ก็ไม่ต้องวางลิงก์ใหม่อีกเลยครับ');
    } else {
      const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'app.js';
      a.click();
      alert('ดาวน์โหลดไฟล์ app.js ที่ฝังลิงก์ถาวรแล้ว! นำไปวางทับไฟล์ app.js ในโฟลเดอร์โปรเจกต์ได้เลยครับ');
    }
  } catch (err) {
    alert('บันทึกลิงก์ไว้ในหน่วยความจำถาวรของเบราว์เซอร์เรียบร้อยแล้วครับ (หากต้องการให้ฝังลงไฟล์โค้ดโดยตรง สามารถส่งลิงก์ Web App URL มาในแชทเพื่อให้ระบบฝังลงไฟล์ให้ทันทีได้ครับ)');
  }
}

function updateSyncBadge() {
 const badge=document.getElementById('sync-status-badge');if(!badge)return;
 const count=pendingCloudWrites().length;
 badge.className='badge '+(state.cloudVerified&&!count?'badge-cloud':'badge-local');
 badge.textContent=count?'รอส่ง Google Sheets '+count+' รายการ':state.cloudVerified?'เชื่อมต่อ Google Sheets แล้ว':'ยังไม่ยืนยันข้อมูลจาก Google Sheets';
 updatePendingNotice();
}

function logCloudMessage(msg) {
  const logEl = document.getElementById('cloud-sync-log');
  if (logEl) {
    logEl.textContent = `[${new Date().toLocaleTimeString('th-TH')}] ${msg}`;
  }
}

function downloadCsvFile(filename, content) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

const WATER_LAB_PARAMS = [
  { key: 'ph', seq: 1, name: 'ความเป็นกรด-ด่าง (pH)', unit: '-', whoLabel: '6.5-8.5', ruralLabel: '6.5-8.5', dohLabel: '6.5-8.5', type: 'range', WHO_1984: [6.5, 8.5], RURAL: [6.5, 8.5], DOH_2543: [6.5, 8.5], secId: 'wlab-sec-phys' },
  { key: 'colour', seq: 2, name: 'สี (Colour)', unit: 'แพลตตินัมโคบอลต์', whoLabel: '15', ruralLabel: '15', dohLabel: '15', type: 'max', WHO_1984: 15, RURAL: 15, DOH_2543: 15 },
  { key: 'turbidity', seq: 3, name: 'ความขุ่น (Turbidity)', unit: 'เอ็นทียู (NTU)', whoLabel: '5', ruralLabel: '10', dohLabel: '10', type: 'max', WHO_1984: 5, RURAL: 10, DOH_2543: 10 },
  { key: 'tds', seq: 4, name: 'ปริมาณสารละลายทั้งหมดที่เหลือจากการระเหย (TDS)', unit: 'มก./ล.', whoLabel: '1,000', ruralLabel: '1,000', dohLabel: '1,000', type: 'max', WHO_1984: 1000, RURAL: 1000, DOH_2543: 1000 },
  { key: 'hardness', seq: 5, name: 'ความกระด้าง (Hardness)', unit: 'มก./ล.', whoLabel: '500', ruralLabel: '300', dohLabel: '500', type: 'max', WHO_1984: 500, RURAL: 300, DOH_2543: 500 },
  { key: 'fe', seq: 6, name: 'เหล็ก (Fe)', unit: 'มก./ล.', whoLabel: '0.3', ruralLabel: '0.5', dohLabel: '0.5', type: 'max', WHO_1984: 0.3, RURAL: 0.5, DOH_2543: 0.5, secId: 'wlab-sec-metal' },
  { key: 'mn', seq: 7, name: 'แมงกานีส (Mn)', unit: 'มก./ล.', whoLabel: '0.1', ruralLabel: '0.3', dohLabel: '0.3', type: 'max', WHO_1984: 0.1, RURAL: 0.3, DOH_2543: 0.3 },
  { key: 'cu', seq: 8, name: 'ทองแดง (Cu)', unit: 'มก./ล.', whoLabel: '1.0', ruralLabel: '1.0', dohLabel: '1.0', type: 'max', WHO_1984: 1.0, RURAL: 1.0, DOH_2543: 1.0 },
  { key: 'zn', seq: 9, name: 'สังกะสี (Zn)', unit: 'มก./ล.', whoLabel: '5.0', ruralLabel: '5.0', dohLabel: '3.0', type: 'max', WHO_1984: 5.0, RURAL: 5.0, DOH_2543: 3.0 },
  { key: 'pb', seq: 10, name: 'ตะกั่ว (Pb)', unit: 'มก./ล.', whoLabel: '0.05', ruralLabel: '0.05', dohLabel: '0.03', type: 'max', WHO_1984: 0.05, RURAL: 0.05, DOH_2543: 0.03 },
  { key: 'cr', seq: 11, name: 'โครเมียม (Cr)', unit: 'มก./ล.', whoLabel: '0.05', ruralLabel: '0.05', dohLabel: '0.05', type: 'max', WHO_1984: 0.05, RURAL: 0.05, DOH_2543: 0.05 },
  { key: 'cd', seq: 12, name: 'แคดเมียม (Cd)', unit: 'มก./ล.', whoLabel: '0.005', ruralLabel: '0.005', dohLabel: '0.003', type: 'max', WHO_1984: 0.005, RURAL: 0.005, DOH_2543: 0.003 },
  { key: 'as_val', seq: 13, name: 'สารหนู (As) ⭐', unit: 'มก./ล.', whoLabel: '0.05', ruralLabel: '0.05', dohLabel: '0.01', type: 'max', WHO_1984: 0.05, RURAL: 0.05, DOH_2543: 0.01 },
  { key: 'hg', seq: 14, name: 'ปรอท (Hg)', unit: 'มคก./ล.', whoLabel: '1.0', ruralLabel: '1.0', dohLabel: '1.0', type: 'max', WHO_1984: 1.0, RURAL: 1.0, DOH_2543: 1.0 },
  { key: 'so4', seq: 15, name: 'ซัลเฟต (SO4 2-)', unit: 'มก./ล.', whoLabel: '400', ruralLabel: '400', dohLabel: '250', type: 'max', WHO_1984: 400, RURAL: 400, DOH_2543: 250, secId: 'wlab-sec-bact' },
  { key: 'cl', seq: 16, name: 'คลอไรด์ (Cl-)', unit: 'มก./ล.', whoLabel: '250', ruralLabel: '250', dohLabel: '250', type: 'max', WHO_1984: 250, RURAL: 250, DOH_2543: 250 },
  { key: 'no3', seq: 17, name: 'ไนเตรท (NO3- as N)', unit: 'มก./ล.', whoLabel: '10', ruralLabel: '10', dohLabel: '50', type: 'max', WHO_1984: 10, RURAL: 10, DOH_2543: 50 },
  { key: 'f', seq: 18, name: 'ฟลูออไรด์ (F-)', unit: 'มก./ล.', whoLabel: '1.5', ruralLabel: '1.0', dohLabel: '0.7', type: 'max', WHO_1984: 1.5, RURAL: 1.0, DOH_2543: 0.7 },
  { key: 'residual_cl', seq: 19, name: 'คลอรีนอิสระตกค้าง (Residual Free Chlorine)', unit: 'มก./ล.', whoLabel: '-', ruralLabel: '0.2-0.5', dohLabel: '0.2-0.5***', type: 'range_opt', WHO_1984: null, RURAL: [0.2, 0.5], DOH_2543: [0.2, 0.5] },
  { key: 'total_coliform', seq: 20, name: 'โคลิฟอร์มแบคทีเรีย (Total Coliform Bacteria)', unit: 'เอ็มพีเอ็น/100 มล.', whoLabel: '0', ruralLabel: '10', dohLabel: '0', type: 'max', WHO_1984: 0, RURAL: 10, DOH_2543: 0 },
  { key: 'faecal_coliform', seq: 21, name: 'ฟีคัลโคลิฟอร์มแบคทีเรีย (Faecal Coliform Bacteria)', unit: 'เอ็มพีเอ็น/100 มล.', whoLabel: '0', ruralLabel: '0', dohLabel: '0', type: 'max', WHO_1984: 0, RURAL: 0, DOH_2543: 0 }
];

const INITIAL_WATER_LABS = SOURCE_WATER_LABS;

const INITIAL_KNOWLEDGE_DOCS = [
  {
    id: 'DOC-001',
    title: 'แนวทางการเฝ้าระวังผลกระทบต่อสุขภาพประชาชน กรณีการปนเปื้อนสารหนูในสิ่งแวดล้อม (ฉบับสมบูรณ์ 58 หน้า)',
    category: 'แนวทางปฏิบัติ/คู่มือ',
    author: 'กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม กรมควบคุมโรค (กันยายน 2569)',
    date: '2026-09-01',
    description: 'คู่มือปฏิบัติงานฉบับหลักสำหรับบุคลากรสาธารณสุข ครอบคลุมข้อมูลพิษวิทยาสารหนู การประเมินความเสี่ยง HRA (HQ & Cancer Risk) แนวทางเฝ้าระวังเชิงรับ-เชิงรุก รหัส ICD-10 (Z13.88, R82.6, T57) การสอบสวนโรค การเก็บปัสสาวะ และภาคผนวกแบบฟอร์ม Env-As-01, 02, 03 และแบบตรวจร่างกายโดยแพทย์',
    file_url: 'docs/arsenic-surveillance-guideline.pdf',
    file_type: 'pdf',
    is_builtin: true
  },
  {
    id: 'DOC-002',
    title: 'ตารางเกณฑ์มาตรฐานคุณภาพน้ำบริโภค และน้ำประปา กรมอนามัย (21 พารามิเตอร์)',
    category: 'มาตรฐานคุณภาพน้ำ/สิ่งแวดล้อม',
    author: 'กรมอนามัย กระทรวงสาธารณสุข',
    date: '2026-05-01',
    description: 'ตารางเปรียบเทียบเกณฑ์มาตรฐานคุณภาพน้ำดื่มของ WHO (ปี 2527), เกณฑ์คุณภาพน้ำบริโภคในชนบท และเกณฑ์คุณภาพน้ำประปา กรมอนามัย (ปี 2543) ครบทั้ง 21 พารามิเตอร์ (กายภาพ เคมี โลหะหนัก สารหนู และแบคทีเรียโคลิฟอร์ม)',
    file_url: 'water-standard-doh.jpg',
    file_type: 'image',
    is_builtin: true
  },
  {
    id: 'DOC-003',
    title: 'แบบฟอร์ม Env-As-01: แบบคัดกรองและประเมินความเสี่ยงทางสุขภาพประชาชน ระดับบุคคล (ฉบับ อ.แม่อาย)',
    category: 'แบบฟอร์มคัดกรอง/สอบสวนโรค',
    author: 'กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม กรมควบคุมโรค',
    date: '',
    description: 'ไฟล์ต้นฉบับ PDF แบบคัดกรองและประเมินความเสี่ยงการสัมผัสสารหนู ระดับบุคคล (ส่วนที่ 1-4 พร้อมตารางคำนวณคะแนนถ่วงน้ำหนัก 11 ข้อ คะแนนเต็ม 30.5 คะแนน)',
    file_url: 'docs/Env-As-01-original.pdf',
    file_type: 'pdf',
    is_builtin: true
  },
  {
    id: 'DOC-004',
    title: 'แบบฟอร์ม Env-As-02: แบบซักประวัติการสัมผัสสารหนูจากสิ่งแวดล้อม (ก่อนเก็บตัวอย่างชีวภาพ)',
    category: 'แบบฟอร์มคัดกรอง/สอบสวนโรค',
    author: 'กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม กรมควบคุมโรค',
    date: '2026-04-29',
    description: 'ไฟล์ต้นฉบับ PDF แบบซักประวัติก่อนเก็บตัวอย่างปัสสาวะส่งตรวจทางห้องปฏิบัติการ (ปรับปรุง 29 เม.ย. 69) สำหรับประเมินแหล่งน้ำดื่ม น้ำใช้ อาหารทะเล และยาสมุนไพร',
    file_url: 'docs/Env-As-02-original.pdf',
    file_type: 'pdf',
    is_builtin: true
  }
];

INITIAL_KNOWLEDGE_DOCS.push(
 {id:'SYSTEM-AS01-2Q',title:'AS-01 ฉบับใช้กับระบบ พร้อมข้อมูลเพิ่มเติมและ 2Q',category:'แบบฟอร์มคัดกรอง/สอบสวนโรค',author:'งานควบคุมโรค โรงพยาบาลแม่อาย',date:'2026-10-31',description:'แบบฟอร์มต้นฉบับครบ 3 หน้า พร้อมแผ่น Lab Code ข้อมูลสำหรับระบบ ระยะเวลาสัมผัส และคัดกรอง 2Q สำหรับพิมพ์ใช้งาน',file_url:'docs/Env-As-01-system-2Q.pdf',file_type:'pdf',is_builtin:true},
 {id:'SYSTEM-AS02-2Q',title:'AS-02 ฉบับใช้กับระบบ พร้อมข้อมูลเพิ่มเติมและ 2Q',category:'แบบฟอร์มคัดกรอง/สอบสวนโรค',author:'งานควบคุมโรค โรงพยาบาลแม่อาย',date:'2026-10-31',description:'แบบฟอร์มต้นฉบับครบ 3 หน้า ข้อ 6–7 มีจำนวนปีต่อแหล่ง พร้อมแผ่น Lab Code ระยะเวลาสัมผัส และ 2Q สำหรับพิมพ์ใช้งาน',file_url:'docs/Env-As-02-system-2Q.pdf',file_type:'pdf',is_builtin:true}
);

function onWaterLabWellChange() {
  const wellId = document.getElementById('wlab-well-id')?.value;
  const w = state.wells.find(x => x.well_id === wellId);
  const codeInp = document.getElementById('wlab-sample-code');
  if (w && codeInp && !codeInp.value.trim()) {
    codeInp.value = w.sample_code || `LAB-${w.well_id}`;
  }
}

function openWaterLabForWell(wellId) {
  const existing = (state.waterLabs || []).find(l => l.well_id === wellId);
  if (existing) {
    openWaterLabModal(existing.id);
  } else {
    openWaterLabModal(null, wellId);
  }
}

function openWaterLabModal(labId = null, preselectWellId = null) {
  const modal = document.getElementById('water-lab-modal');
  const title = document.getElementById('water-lab-modal-title');
  document.getElementById('water-lab-form').reset();
  document.querySelectorAll('#water-lab-form .other-input-wrap').forEach(w => { w.style.display = 'none'; });
  populateWellDropdowns();

  document.getElementById('wlab-point-name').value='';
  document.getElementById('wlab-source-unit').value='';
  if (labId) {
    const rec = state.waterLabs.find(x => x.id === labId);
    if (!rec) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> แก้ไขผลตรวจวิเคราะห์คุณภาพน้ำ (${rec.sample_code || rec.id})`;
    document.getElementById('wlab-point-name').value=rec.point_name||'';
    document.getElementById('wlab-source-unit').value=rec.source_unit||'';
    document.getElementById('wlab-id').value = rec.id;
    document.getElementById('wlab-well-id').value = rec.well_id;
    document.getElementById('wlab-sample-code').value = rec.sample_code || '';
    document.getElementById('wlab-sample-date').value = rec.sample_date || '';
    document.getElementById('wlab-standard-type').value = rec.standard_type || 'SOURCE_SSO';
    setSelectOrOther('wlab-lab-select', 'wlab-lab-other-wrap', 'wlab-lab-other', rec.lab_name || '');
    document.getElementById('wlab-collector').value = rec.collector || '';
    document.getElementById('wlab-notes').value = rec.notes || '';
    buildWaterLabParamsInputs(rec);
  } else {
    title.innerHTML = `<i class="fa-solid fa-flask-vial"></i> บันทึกผลตรวจวิเคราะห์คุณภาพน้ำใหม่ (ตามเกณฑ์กรมอนามัย 21 พารามิเตอร์)`;
    document.getElementById('wlab-id').value = '';
    if (preselectWellId) {
      document.getElementById('wlab-well-id').value = preselectWellId;
    }
    document.getElementById('wlab-sample-date').value = bangkokToday();
    onWaterLabWellChange();
    buildWaterLabParamsInputs(null);
  }

  modal.style.display = 'flex';
  const bodyEl = document.getElementById('waterlab-modal-body');
  if (bodyEl) bodyEl.scrollTop = 0;
}

function closeWaterLabModal() {
  document.getElementById('water-lab-modal').style.display = 'none';
}

async function handleSaveWaterLab(e) {
  e.preventDefault();
  const id = document.getElementById('wlab-id').value || `WLAB-${Date.now()}`;
  const wellId = document.getElementById('wlab-well-id').value;

  const rec = {
    ...(state.waterLabs.find(x => x.id === id) || {}),
    id,
    well_id: wellId,
    match_status: wellId ? 'ผู้ใช้ยืนยันการจับคู่' : 'รอจับคู่ทะเบียน',
    sample_code: document.getElementById('wlab-sample-code').value.trim(),
    sample_date: document.getElementById('wlab-sample-date').value,
    point_name:document.getElementById('wlab-point-name').value.trim(),
    source_unit:document.getElementById('wlab-source-unit').value.trim(),
    standard_type: document.getElementById('wlab-standard-type').value,
    lab_name: getSelectOrOther('wlab-lab-select', 'wlab-lab-other'),
    collector: document.getElementById('wlab-collector').value.trim(),
    notes: document.getElementById('wlab-notes').value.trim(),
    updated_at: new Date().toLocaleString('th-TH')
  };

  WATER_LAB_PARAMS.forEach(p => {
    const inp = document.getElementById(`wlab-inp-${p.key}`);
    rec[p.key] = inp && inp.value.trim() !== '' ? inp.value.trim() : '';
  });

  rec.fiscal_year=recordFiscalYear(rec,'water');
  const evalRes = evaluateWaterLabRecord(rec);
  rec.overall_status = evalRes.overallStatus;
  rec.failed_params = evalRes.failedNames.join(', ');

  const idx = state.waterLabs.findIndex(x => x.id === id);
  if (idx >= 0) state.waterLabs[idx] = rec;
  else state.waterLabs.unshift(rec);

  // อัปเดตค่าสารหนูและสถานะความปลอดภัยไปยังจุดบ่อน้ำที่เชื่อมโยงทันที
  const wIdx = state.wells.findIndex(w => w.well_id === wellId);
  if (wIdx >= 0) {
    if (rec.as_val !== '') {
      state.wells[wIdx].arsenic_level = rec.as_val;
    }
    state.wells[wIdx].safety_status = rec.overall_status === 'เกินเกณฑ์มาตรฐาน'
      ? `ผลตรวจเกินค่ามาตรฐาน (${rec.failed_params})`
      : rec.overall_status;
  }

  saveLocalData();
  closeWaterLabModal();
  await postToGoogleSheets({ action: 'saveWaterLab', data: rec });
}

async function deleteWaterLab(labId) {
  if (!confirm('ยืนยันการลบข้อมูลผลตรวจแล็บน้ำรายการนี้หรือไม่?')) return;
  state.waterLabs = state.waterLabs.filter(x => x.id !== labId);
  saveLocalData();
  await postToGoogleSheets({ action: 'deleteWaterLab', id: labId });
}

function openWaterStandardModal() {
  document.getElementById('water-std-modal').style.display = 'flex';
}

function closeWaterStandardModal() {
  document.getElementById('water-std-modal').style.display = 'none';
}

function renderKnowledgeDocs() {
  const grid = document.getElementById('kb-docs-grid');
  if (!grid) return;

  const q = (document.getElementById('kb-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('kb-filter-cat')?.value || 'ALL';

  const filtered = (state.knowledgeDocs || []).filter(doc => {
    if (cat !== 'ALL' && doc.category !== cat) return false;
    if (q) {
      const hay = `${doc.title} ${doc.category} ${doc.author} ${doc.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = filtered.map(doc => {
    let iconClass = 'kb-icon-pdf';
    let iconTag = '<i class="fa-solid fa-file-pdf"></i>';
    if (doc.file_type === 'image' || /\.(jpg|jpeg|png|webp)$/i.test(doc.file_url || '')) {
      iconClass = 'kb-icon-img';
      iconTag = '<i class="fa-solid fa-file-image"></i>';
    } else if (doc.file_type === 'doc') {
      iconClass = 'kb-icon-doc';
      iconTag = '<i class="fa-solid fa-file-lines"></i>';
    }

    return `
      <div class="kb-card">
        <div>
          <div class="kb-card-top">
            <div class="kb-icon ${iconClass}">${iconTag}</div>
            <div>
              <span class="badge-pill" style="font-size:11px;">${doc.category || 'คู่มือแนวทาง'}</span>
              <h3 style="font-size:15px; margin-top:4px; line-height:1.35;">${doc.title}</h3>
            </div>
          </div>
          <p style="font-size:12.5px; color:#475569; margin-top:10px;">${doc.description || ''}</p>
          <div class="kb-meta">
            <div><i class="fa-solid fa-building-shield"></i> ${doc.author || '-'}</div>
            <div><i class="fa-regular fa-calendar"></i> วันที่อัปเดต: ${doc.date || '-'}</div>
          </div>
        </div>
        <div class="kb-actions">
          <button class="btn btn-sm btn-primary" onclick="previewKnowledgeDoc('${doc.id}')">
            <i class="fa-solid fa-book-open-reader"></i> เปิดอ่านในหน้าเว็บ
          </button>
          <a href="${doc.file_url || '#'}" target="_blank" download="${doc.file_name || ''}" class="btn btn-sm btn-outline" style="text-decoration:none;">
            <i class="fa-solid fa-download"></i> ดาวน์โหลด / เปิดแท็บใหม่
          </a>
          ${!doc.is_builtin ? `<button class="btn btn-sm btn-danger" onclick="deleteKnowledgeDoc('${doc.id}')" title="ลบเอกสาร"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function previewKnowledgeDoc(docId) {
  const doc = (state.knowledgeDocs || []).find(d => d.id === docId);
  if (!doc) return;

  const modal = document.getElementById('kb-viewer-modal');
  const titleEl = document.getElementById('kb-viewer-title');
  const bodyEl = document.getElementById('kb-viewer-body');
  const dlLink = document.getElementById('kb-viewer-download');

  titleEl.innerHTML = `<i class="fa-solid fa-book-open"></i> ${doc.title}`;
  dlLink.href = doc.file_url || '#';
  if (doc.file_name) dlLink.setAttribute('download', doc.file_name);

  const isImg = doc.file_type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_url || '') || (doc.file_url && doc.file_url.startsWith('data:image/'));
  if (isImg) {
    bodyEl.innerHTML = `
      <div style="flex:1; overflow:auto; display:flex; align-items:center; justify-content:center; padding:20px;">
        <img src="${doc.file_url}" alt="${doc.title}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; background:#fff;" />
      </div>
    `;
  } else {
    bodyEl.innerHTML = `
      <iframe src="${doc.file_url}" style="width:100%; height:100%; border:none; flex:1; background:#fff;" title="${doc.title}"></iframe>
    `;
  }

  modal.style.display = 'flex';
}

function closeKnowledgeViewer() {
  const modal = document.getElementById('kb-viewer-modal');
  const bodyEl = document.getElementById('kb-viewer-body');
  if (bodyEl) bodyEl.innerHTML = '';
  if (modal) modal.style.display = 'none';
}

function openAddKnowledgeModal() {
  document.getElementById('kb-add-form').reset();
  document.getElementById('kb-cat-other-wrap').style.display = 'none';
  document.getElementById('kb-date').value = bangkokToday();
  document.getElementById('kb-add-modal').style.display = 'flex';
}

function closeAddKnowledgeModal() {
  document.getElementById('kb-add-modal').style.display = 'none';
}

async function handleSaveKnowledgeDoc(e) {
  e.preventDefault();
  const title = document.getElementById('kb-title').value.trim();
  const category = getSelectOrOther('kb-category', 'kb-cat-other');
  const author = document.getElementById('kb-author').value.trim();
  const date = document.getElementById('kb-date').value;
  const description = document.getElementById('kb-desc').value.trim();
  const fileInput = document.getElementById('kb-file-input');
  const urlInput = document.getElementById('kb-file-url').value.trim();

  let fileUrl = urlInput;
  let fileName = '';
  let fileType = 'pdf';

  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    fileName = file.name;
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf';
    else fileType = 'doc';

    if (file.size <= 4.5 * 1024 * 1024) {
      fileUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
    } else if (!fileUrl) {
      fileUrl = URL.createObjectURL(file);
      alert('หมายเหตุ: ไฟล์มีขนาดใหญ่เกิน 4.5 MB ระบบได้สร้างลิงก์เปิดดูสำหรับเซสชันนี้แล้ว หากต้องการให้เปิดได้ถาวรบน GitHub Pages แนะนำให้นำไฟล์ไปวางในโฟลเดอร์โปรเจกต์หรืออัปโหลดขึ้น Google Drive แล้ววางลิงก์ครับ');
    }
  } else if (fileUrl) {
    if (/\.(jpg|jpeg|png|webp)$/i.test(fileUrl)) fileType = 'image';
  } else {
    alert('กรุณาเลือกไฟล์คู่มือจากเครื่อง หรือระบุชื่อไฟล์/ลิงก์เอกสารอย่างน้อย 1 ช่องครับ');
    return;
  }

  const newDoc = {
    id: `DOC-${String((state.knowledgeDocs || []).length + 1).padStart(3, '0')}-${Date.now().toString().slice(-3)}`,
    title,
    category,
    author,
    date,
    description,
    file_url: fileUrl,
    file_name: fileName,
    file_type: fileType,
    is_builtin: false
  };

  state.knowledgeDocs.unshift(newDoc);
  saveLocalData();
  closeAddKnowledgeModal();
  await postToGoogleSheets({
    action: 'saveKnowledgeDoc',
    data: {
      ...newDoc,
      file_url: newDoc.file_url.startsWith('data:') ? `[ไฟล์แนบ: ${fileName}]` : newDoc.file_url
    }
  });
}

async function deleteKnowledgeDoc(docId) {
  if (!confirm('ยืนยันการลบเอกสารคู่มือรายการนี้ออกจากระบบหรือไม่?')) return;
  state.knowledgeDocs = state.knowledgeDocs.filter(d => d.id !== docId);
  saveLocalData();
  await postToGoogleSheets({ action: 'deleteKnowledgeDoc', id: docId });
}

// Fiscal-year views retain the historical source data and all later records together.
function bangkokToday() {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
function fiscalYearFromDate(value) {
 const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return null;
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())return null;
 return year+543+(month>=10?1:0);
}
function recordFiscalYear(record,stage=1) {
 const date=stage===2?record.interview_date:stage==='water'?record.sample_date:record.survey_date;
 return fiscalYearFromDate(date)||Number(record.fiscal_year||record.source_year)||null;
}
function yearRows(rows,stage=1) {return rows.filter(r=>recordFiscalYear(r,stage)===Number(state.fiscalYear||2569));}
function canonicalTambon(tambon,moo) {
 const raw=String(tambon||'').trim();
 if(raw==='แม่นางวาง')return 'แม่นาวาง';
 if(raw==='ท่่าตอน')return 'ท่าตอน';
 if(raw==='แม่เมืองน้อย'&&Number(moo)===6)return 'แม่นาวาง';
 return raw;
}
function normalizeStageRecord(record,stage) {
 const hydrated=backfillBasicProfile(record,stage);
 const r=stage===1?normalizeRespondentRecord(hydrated,0):{...hydrated};
 const corrected=canonicalTambon(r.tambon,r.moo);
 if(corrected!==r.tambon){r.source_tambon=r.source_tambon||r.tambon;r.area_correction='แก้พื้นที่ตามคำยืนยันผู้ใช้';r.tambon=corrected;}
 r.fiscal_year=recordFiscalYear(r,stage)||2569;
 r.source_tab=(stage===2?'เก็บแม่อาย':'ประเมินแม่อาย')+' '+r.fiscal_year;
 return r;
}
function initializeFiscalYears() {
 let saved;try{saved=localStorage.getItem('MAEAI_ONLINE_FISCAL_YEAR');}catch(e){}
 state.fiscalYear=Number(saved)||2569;
}
function refreshFiscalYearOptions() {
 const select=document.getElementById('fiscal-year-filter');if(!select)return;
 const years=[...new Set([2569,fiscalYearFromDate(bangkokToday()),state.fiscalYear,...state.respondents.map(r=>recordFiscalYear(r,1)),...state.envAs02.map(r=>recordFiscalYear(r,2)),...state.waterLabs.map(r=>recordFiscalYear(r,'water'))].filter(Boolean))].sort((a,b)=>b-a);
 select.innerHTML=years.map(y=>`<option value="${y}" ${y===Number(state.fiscalYear)?'selected':''}>ปีงบประมาณ ${y}</option>`).join('');
 document.querySelectorAll('[data-fiscal-year]').forEach(el=>el.textContent=state.fiscalYear);
 // Keep option labels and legacy headings aligned with the selected year.
 const walk=document.createTreeWalker(document.getElementById('app-container'),NodeFilter.SHOW_TEXT);
 for(let node=walk.nextNode();node;node=walk.nextNode()){
  if(['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement?.tagName))continue;
  node.nodeValue=node.nodeValue.replace(/(ประเมินแม่อาย|เก็บแม่อาย) (?:ปี )?\d{4}/g,`$1 ${state.fiscalYear}`);
 }
 setText('respondents-heading',`ทะเบียน Env-As-01 — ประเมินแม่อาย ${state.fiscalYear} (${yearRows(state.respondents).length} ราย)`);
 refreshWaterLabYearOptions();
 setText('dashboard-heading',`ระบบข้อมูลแหล่งแม่น้ำกก อ.แม่อาย — ปีงบประมาณ ${state.fiscalYear}`);
 setText('registry-csv-label','ส่งออกทะเบียนปีที่เลือก');
}
function setFiscalYearFilter(value) {
 state.fiscalYear=Number(value)||2569;
 try{localStorage.setItem('MAEAI_ONLINE_FISCAL_YEAR',String(state.fiscalYear));}catch(e){}
 refreshAllViews();
}
function formatSampleDate(value) {
 if(!fiscalYearFromDate(value))return value||'ไม่ระบุวันที่';
 return new Date(value.slice(0,10)+'T00:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'});
}
function nextWellId() {
 let n=Math.max(0,...state.wells.map(w=>Number(String(w.well_id).match(/^W(\d+)/)?.[1])||0))+1;
 while(state.wells.some(w=>w.well_id===`W${String(n).padStart(3,'0')}`))n++;
 return `W${String(n).padStart(3,'0')}`;
}
function waterLabArea(record) {
 const well=state.wells.find(w=>w.well_id===record.well_id);
 const text=record.point_name||'';
 return {tambon:canonicalTambon(record.tambon||well?.tambon||text.match(/ต\.?\s*(ท่าตอน|แม่นาวาง)/)?.[1]||'',record.moo??well?.moo),moo:record.moo??well?.moo??text.match(/(?:ม\.?|หมู่(?:ที่)?)\s*(\d+)/)?.[1]??''};
}
function sortedWaterLabs(rows) {
 return [...rows].sort((a,b)=>{
  const aa=waterLabArea(a),bb=waterLabArea(b);
  return (aa.tambon||'๙').localeCompare(bb.tambon||'๙','th')||String(a.sample_date||'9999').localeCompare(String(b.sample_date||'9999'))||String(a.point_name||'').localeCompare(String(b.point_name||''),'th',{numeric:true})||String(a.id).localeCompare(String(b.id));
 });
}

// Source-grounded calculations, 2569 revision. Historical source rows remain separate by stage.
const DATA_VERSION = 'MAEAI_FISCAL_20261030_V2';
const RELEASE_VERSION = '2026-10-31-form-links-codes';
const ONLINE_API_REVISION = 'MAEAI_ONLINE_20261031';
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setText(id, value) { const el=document.getElementById(id); if(el) el.textContent=value; }
function setHtml(id, value) { const el=document.getElementById(id); if(el) el.innerHTML=value; }
function valueOrBlank(v) { return v === null || v === undefined || v === '' ? '' : v; }
function optionalNumber(v) { return v === null || v === undefined || String(v).trim()==='' || !Number.isFinite(Number(v)) ? null : Number(v); }
function distanceBand(d) { return d===null ? 'ไม่ระบุ' : d<=100 ? 'ไม่เกิน 100 เมตร' : d<=200 ? '101 - 200 เมตร' : d<=300 ? '201 - 300 เมตร' : 'มากกว่า 300 เมตร'; }
function normalizeWellRecord(w, idx) {
  const d=optionalNumber(w.distance_river_m);
  return {...w,seq:optionalNumber(w.seq)??idx+1,tambon:String(w.tambon||'').trim(),health_center:String(w.health_center||'').trim().replace(/^รพ\.สต\.ท่ามะแกง$/,'รพ.สต.บ้านท่ามะแกง'),distance_river_m:d,distance_band:distanceBand(d),user_count:optionalNumber(w.user_count),attachments:Array.isArray(w.attachments)?w.attachments:[]};
}
function normalizeRespondentRecord(r, idx) {
  return {...r,seq:optionalNumber(r.seq)??idx+1,total_score:optionalNumber(r.total_score),risk_level:r.risk_level||'ไม่ระบุ',source_tab:r.source_tab||'บันทึกเพิ่มเติมปี 69',survey_date:r.survey_date||'',health_center:r.health_center||'',q2_1:r.q2_1||'',q2_2:r.q2_2||'',status_2q:r.status_2q||'ยังไม่คัดกรอง'};
}
function hasCorruptedEncoding(arr) { return !Array.isArray(arr); }
function renderWellsTable() {
 const q=document.getElementById('well-search')?.value||'',t=document.getElementById('well-filter-tambon')?.value||'ALL',type=document.getElementById('well-filter-type')?.value||'ALL',dist=document.getElementById('well-filter-dist')?.value||'ALL',hc=document.getElementById('well-filter-hc')?.value||'ALL';
 const rows=state.wells.filter(w=>(t==='ALL'||w.tambon===t)&&(type==='ALL'||type==='SAMPLE_ONLY'&&w.sample_code||w.well_type===type)&&(dist==='ALL'||w.distance_band===dist)&&(hc==='ALL'||w.health_center===hc)&&(!q||[w.well_id,w.sample_code,w.well_name,w.owner_name,w.house_no,w.moo,w.tambon].join(' ').toLowerCase().includes(q.toLowerCase())));
 setHtml('wells-table-body',rows.map(w=>`<tr><td>${w.seq}</td><td>${esc(w.sample_code||'ไม่ระบุ')}</td><td>${esc(w.well_id)}</td><td>${esc(w.well_name)}${w.source_issues?.length?'<br><small>'+esc(w.source_issues.join('; '))+'</small>':''}</td><td>บ้าน ${esc(w.house_no||'ไม่ระบุ')} ม.${esc(w.moo)} ต.${esc(w.tambon)}</td><td>${esc(w.well_type)}${w.depth_meters?' ลึก '+esc(w.depth_meters)+' ม.':''}</td><td><a href="javascript:void(0)" onclick="focusOnMap(${Number(w.latitude)},${Number(w.longitude)})">${Number(w.latitude).toFixed(5)}, ${Number(w.longitude).toFixed(5)}</a><br><small>UTM ${esc(w.utm_e)}, ${esc(w.utm_n)}</small></td><td>${w.distance_river_m===null?'ไม่ระบุ':w.distance_river_m+' ม.'}<br><small>${esc(w.distance_band)}</small></td><td>${esc(w.usage_type||'ไม่ระบุ')}</td><td><button class="btn btn-sm btn-outline" onclick="openWellGalleryModal('${esc(w.well_id)}')">${(w.attachments||[]).length} ไฟล์</button></td><td>${w.user_count===null?'ไม่ระบุ':w.user_count+' คน'}</td><td>${esc(w.health_center||'ไม่ระบุ')}</td><td><button class="btn btn-sm btn-primary" onclick="openWellModal('${esc(w.well_id)}')">แก้ไข</button> <button class="btn btn-sm btn-outline" onclick="openWaterLabForWell('${esc(w.well_id)}')">ผลตรวจ</button> <button class="btn btn-sm btn-danger" onclick="deleteWell('${esc(w.well_id)}')">ลบ</button></td></tr>`).join('')||'<tr><td colspan="13">ไม่พบข้อมูล</td></tr>');
}

// One-time enrichment of blank legacy fields. Existing values and later explicit clears survive.
const BASIC_PROFILE_VERSION = '2026-10-31-basic-profile-v1';
const BASIC_PROFILE_FIELDS = ['age','gender','cid','phone','house_no','amphoe','province','health_center','marital_status','education','years_in_area','weight_kg','height_cm'];
function backfillBasicProfile(record,stage) {
 if(record.basic_profile_backfill_version===BASIC_PROFILE_VERSION)return record;
 const source=(stage===1?INITIAL_RESPONDENTS:INITIAL_ENV_AS02).find(r=>r.id===record.id);
 if(!source||Number(record.fiscal_year||record.source_year||2569)!==Number(source.fiscal_year||source.source_year||2569)
  ||historyNameKey(record.full_name)!==historyNameKey(source.full_name)
  ||String(record.moo)!==String(source.moo)
  ||canonicalTambon(record.tambon,record.moo)!==canonicalTambon(source.tambon,source.moo))return record;
 const result={...record},copied=[];
 for(const field of BASIC_PROFILE_FIELDS){
  if(!historyValuePresent(result[field])&&historyValuePresent(source[field])){result[field]=source[field];copied.push(field);}
 }
 result.basic_profile_backfill_version=BASIC_PROFILE_VERSION;
 result.basic_profile_source={...(record.basic_profile_source||source.basic_profile_source),backfilled_fields:copied};
 return result;
}
function formatBasicAddress(record) {
 return [historyValuePresent(record.house_no)?'บ้านเลขที่ '+record.house_no:'',historyValuePresent(record.moo)?'ม.'+record.moo:'',record.tambon?'ต.'+record.tambon:'',record.amphoe?'อ.'+record.amphoe:'',record.province?'จ.'+record.province:''].filter(Boolean).join(' ')||'ไม่ระบุ';
}
function googleMapsUrl(latitude,longitude) {
 if(!historyValuePresent(latitude)||!historyValuePresent(longitude))return '';
 const lat=Number(latitude),lng=Number(longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return '';
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng);
}
function wellGoogleMapsLink(latitude,longitude) {
 const url=googleMapsUrl(latitude,longitude);
 return url?`<a class="btn btn-sm btn-outline google-maps-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">เปิดใน Google Maps</a>`:'';
}
async function copyRespondentCid(id) {
 const record=state.respondents.find(r=>r.id===id)||state.envAs02.find(r=>r.id===id);
 if(!historyValuePresent(record?.cid))return;
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
  await navigator.clipboard.writeText(String(record.cid));
  alert('คัดลอกเลขประจำตัวประชาชนแล้ว');
 }catch(e){prompt('คัดลอกเลขประจำตัวประชาชนจากช่องนี้',String(record.cid));}
}


function waterHistoryRevision(){return {completed:true,pending_ids:[]};}
function mergeCloudWaterLabHistory(incoming){return incoming.map(r=>({...r}));}
function waterLabYearRows(){
 const year=state.waterLabYear||'ALL';
 return (state.waterLabs||[]).filter(r=>year==='ALL'||recordFiscalYear(r,'water')===Number(year));
}
function refreshWaterLabYearOptions(){
 const select=document.getElementById('waterlab-filter-year');
 const years=[...new Set((state.waterLabs||[]).map(r=>recordFiscalYear(r,'water')).filter(Boolean))].sort((a,b)=>b-a);
 if(!state.waterLabYear)state.waterLabYear='ALL';
 if(select){select.innerHTML='<option value="ALL">ทุกปี — เปรียบเทียบผลย้อนหลัง</option>'+years.map(y=>`<option value="${y}">ปีงบประมาณ ${y}</option>`).join('');select.value=state.waterLabYear;}
 setText('waterlab-heading','ผลตรวจแหล่งน้ำในชุมชน สสอ. — '+(state.waterLabYear==='ALL'?'ทุกปี':`ปีงบประมาณ ${state.waterLabYear}`));
 setText('nav-lab-count',waterLabYearRows().length);
}
function setWaterLabYear(value){state.waterLabYear=value||'ALL';try{localStorage.setItem('MAEAI_ONLINE_WATERLAB_YEAR',state.waterLabYear);}catch(e){}renderWaterLabDashboardAndTable();}

function loadLocalData() {
 state.loadWarnings=[];state.sessionEpoch=0;state.pendingWrites=[];state.activeCloudRequests=new Set();
 state.cleanModalTitles=Array.from(document.querySelectorAll('.modal-backdrop h3[id]')).map(el=>[el.id,el.innerHTML]);
 for(const key of ['wells','respondents','envAs02','waterLabs','knowledgeDocs'])state[key]=[];
 let configured='';try{configured=localStorage.getItem(STORAGE_KEY_GAS_URL)||'';state.waterLabYear=localStorage.getItem('MAEAI_ONLINE_WATERLAB_YEAR')||'ALL';}catch(e){}
 applyRestoredGasUrl(validGasUrl(configured)?configured:DEFAULT_GAS_URL);
 initializeFiscalYears();
}
function riskBars(rows) {
  return ['ต่ำ','ปานกลาง','มาก','ไม่ระบุ'].map((level,i)=>{const count=rows.filter(r=>(r.risk_level||'ไม่ระบุ')===level).length;if(!count&&level==='ไม่ระบุ')return '';const pct=rows.length?100*count/rows.length:0;return `<div class="bar-row"><div class="bar-label-line"><span>${level} (ตามต้นฉบับ)</span><strong>${count} รายการ (${pct.toFixed(1)}%)</strong></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${['#16a34a','#f97316','#dc2626','#64748b'][i]}"></div></div></div>`;}).join('');
}
function bars(items, denominator) {
 return items.map(([label,count,color])=>{const pct=denominator?count/denominator*100:0;return `<div class="bar-row"><div class="bar-label-line"><span>${esc(label)}</span><strong>${count} (${pct.toFixed(1)}%)</strong></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color||'#0284c7'}"></div></div></div>`;}).join('');
}
function updateKpiCards() {
 const a=yearRows(state.respondents),b=yearRows(state.envAs02,2),w=state.wells;
 setText('nav-well-count',w.length);setText('nav-resp-count',a.length);setText('nav-lab-count',waterLabYearRows().length);
 setText('kpi-total-wells',w.length);setText('kpi-well-sub',`บาดาล ${w.filter(x=>x.well_type==='บ่อบาดาล').length} | น้ำตื้น ${w.filter(x=>x.well_type==='บ่อน้ำตื้น').length} | ประปาภูเขา ${w.filter(x=>x.well_type==='ประปาภูเขา').length}`);
 setText('kpi-sample-wells',w.filter(x=>x.sample_code).length);setText('kpi-near-wells',w.filter(x=>x.distance_river_m!==null&&x.distance_river_m<=100).length);
 setText('kpi-total-resp',`${a.length} / ${b.length}`);setText('kpi-tambon-sub','Env-As-01 / กลุ่มซักประวัติและเก็บปัสสาวะ (แยกขั้นตอน)');
 setText('kpi-risk-alert',a.filter(x=>['ปานกลาง','มาก'].includes(x.risk_level)).length);setText('kpi-risk-sub',['ต่ำ','ปานกลาง','มาก'].map(k=>`${k} ${a.filter(x=>x.risk_level===k).length}`).join(' | '));
 setText('dash-tab1-total',a.length);setText('dash-tab2-total',b.length);setText('screening-risk-caption',['ต่ำ','ปานกลาง','มาก'].map(k=>`${k} ${a.filter(x=>x.risk_level===k).length} ราย`).join(' | '));
 setText('dynamic-source-notice',`ปีงบประมาณ ${state.fiscalYear}: Env-As-01 ${a.length} ราย → Env-As-02/เก็บปัสสาวะ ${b.length} ราย เป็นการติดตาม ไม่บวกเป็นจำนวนคนใหม่`);
}
// Both stages retain their own totals; follow-up records are never added to AS-01 totals.
function dashboardGroupLabel(value) {return String(value??'').trim()||'ไม่ระบุ';}
function dashboardRiskCounts(rows) {return ['ต่ำ','ปานกลาง','มาก'].map(level=>rows.filter(r=>r.risk_level===level).length);}
function dashboardStageCountCells(as01,as02) {
 return [[as01,'as01'],[as02,'as02']].map(([rows,stage])=>{
  const values=[rows.length,...dashboardRiskCounts(rows)];
  return values.map((value,i)=>`<td class="dashboard-stage-${stage}" data-stage="${stage}" data-count-kind="${['total','low','medium','high'][i]}"><span${i===2?' class="dashboard-risk-medium"':i===3?' class="dashboard-risk-high"':''}>${value}</span></td>`).join('');
 }).join('');
}
function dashboardTotalRow(as01,as02,groupColumns,withExposure=false) {
 const labels=['ทุกหมู่บ้าน','ทุก รพ.สต.'];
 const extra=Array.from({length:groupColumns-1},(_,i)=>`<td>${groupColumns===2?'ทุกพื้นที่':labels[i]}</td>`).join('');
 const known=as01.filter(r=>historyValuePresent(r.exposure_years)).length;
 return `<tr class="dashboard-total-row"><th scope="row">รวมทั้งหมด</th>${extra}${dashboardStageCountCells(as01,as02)}${withExposure?`<td>ระบุ ${known}/${as01.length} ราย</td>`:''}</tr>`;
}
// Village lists use authenticated in-memory records; editing reuses existing record forms.
function dashboardVillageRecords(tambon,moo) {
 const matches=r=>dashboardGroupLabel(r.tambon)===dashboardGroupLabel(tambon)&&dashboardGroupLabel(r.moo)===dashboardGroupLabel(moo);
 return [
  ...yearRows(state.respondents).filter(matches).map(record=>({stage:1,record})),
  ...yearRows(state.envAs02,2).filter(matches).map(record=>({stage:2,record}))
 ].sort((a,b)=>Number(historyValuePresent(a.record.health_center))-Number(historyValuePresent(b.record.health_center))||a.stage-b.stage||String(a.record.code||a.record.id).localeCompare(String(b.record.code||b.record.id),'th',{numeric:true}));
}
function dashboardVillageDialogMarkup(tambon,moo) {
 const rows=dashboardVillageRecords(tambon,moo);
 const counts=[1,2].map(stage=>rows.filter(r=>r.stage===stage).length);
 return `<div class="modal-dialog modal-lg dashboard-village-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-village-title">
  <div class="modal-header"><h3 id="dashboard-village-title">รายชื่อ ต.${esc(dashboardGroupLabel(tambon))} หมู่ ${esc(dashboardGroupLabel(moo))} — ปีงบประมาณ ${state.fiscalYear}</h3><button type="button" class="btn-close" data-village-close aria-label="ปิดรายชื่อหมู่บ้าน">×</button></div>
  <div class="modal-body"><p class="data-note">AS-01 ${counts[0]} ราย · AS-02 ${counts[1]} ราย แสดงแยกตามแบบฟอร์ม ไม่บวกเป็นจำนวนคนใหม่<br>หาก รพ.สต. ยังไม่ระบุ ให้กด “แก้ไข” ของรายการนั้น เลือกช่อง “รพ.สต. ที่รับผิดชอบ” ให้ตรงกับข้อมูลจริง แล้วบันทึก</p>
  <div class="table-responsive"><table class="data-table compact-table dashboard-village-list"><thead><tr><th>แบบฟอร์ม</th><th>รหัสรายการ</th><th>วันที่</th><th>ชื่อ–นามสกุล</th><th>รพ.สต. ที่รับผิดชอบ</th><th>ความเสี่ยง</th><th>จัดการ</th></tr></thead><tbody>${rows.map(({stage,record:r})=>`<tr><td>AS-0${stage}</td><td>${esc(r.code||r.form_no||r.id)}</td><td>${esc((stage===1?r.survey_date:r.interview_date)||'ไม่ระบุ')}</td><td>${esc(r.full_name||'ไม่ระบุ')}</td><td>${esc(historyValuePresent(r.health_center)?r.health_center:'ยังไม่ระบุ — กรุณาแก้ไข')}</td><td><span${r.risk_level==='มาก'?' class="dashboard-risk-high"':r.risk_level==='ปานกลาง'?' class="dashboard-risk-medium"':''}>${esc(r.risk_level||'ไม่ระบุ')}</span></td><td><button type="button" class="btn btn-sm btn-primary" data-village-edit-stage="${stage}" data-village-record-id="${esc(r.id)}" aria-label="แก้ไข AS-0${stage} ${esc(r.code||r.form_no||r.id)}">แก้ไข AS-0${stage}</button></td></tr>`).join('')||'<tr><td colspan="7">ไม่มีรายการในปีงบประมาณที่เลือก</td></tr>'}</tbody></table></div></div>
  <div class="modal-footer"><button type="button" class="btn btn-outline" data-village-close>ปิดรายชื่อ</button></div></div>`;
}
function openDashboardVillage(tambon,moo) {
 if(!state.currentUser||!state.cloudToken||!state.dataLoaded){alert('กรุณาเข้าสู่ระบบส่วนกลางก่อนดูรายชื่อ');return;}
 state.dashboardVillageSelection={tambon:dashboardGroupLabel(tambon),moo:dashboardGroupLabel(moo)};
 let modal=document.getElementById('dashboard-village-modal');
 if(!modal){
  modal=document.createElement('div');modal.id='dashboard-village-modal';modal.className='modal-backdrop';document.body.appendChild(modal);
  modal.addEventListener('click',event=>{
   const edit=event.target.closest('button[data-village-edit-stage]');
   if(edit){editDashboardVillageRecord(Number(edit.dataset.villageEditStage),edit.dataset.villageRecordId);return;}
   if(event.target===modal||event.target.closest('[data-village-close]'))closeDashboardVillage();
  });
  modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeDashboardVillage();}});
 }
 modal.innerHTML=dashboardVillageDialogMarkup(tambon,moo);modal.style.display='flex';
 modal.querySelector('[data-village-close]')?.focus();
}
function closeDashboardVillage() {
 const modal=document.getElementById('dashboard-village-modal');if(modal)modal.style.display='none';
 state.dashboardVillageSelection=null;
 const body=document.getElementById('dash-resp-by-moo-body');
 body?.querySelector('button[data-village-open]')?.focus();
}
function editDashboardVillageRecord(stage,id) {
 if(!state.currentUser||!state.cloudToken||!state.dataLoaded)return false;
 if(stage!==1&&stage!==2)return false;
 const s=state.dashboardVillageSelection;if(!s)return false;
 // Revalidate against this village and year before opening an existing person's form.
 if(!dashboardVillageRecords(s.tambon,s.moo).some(item=>item.stage===stage&&String(item.record.id)===String(id)))return false;
 closeDashboardVillage();
 if(stage===1)openRespondentModal(id);else openEnvAs02Modal(id);
 return true;
}
function bindDashboardVillageLinks() {
 const body=document.getElementById('dash-resp-by-moo-body');if(!body||body.dataset.villageLinksBound)return;
 body.dataset.villageLinksBound='true';
 const activate=event=>{
  const row=event.target.closest('tr[data-village-tambon]');if(!row)return;
  if(event.type==='keydown'){
   if(event.target!==row||!['Enter',' '].includes(event.key))return;
   event.preventDefault();
  }
  openDashboardVillage(row.dataset.villageTambon,row.dataset.villageMoo);
 };
 body.addEventListener('click',activate);body.addEventListener('keydown',activate);
}
window.addEventListener('DOMContentLoaded',bindDashboardVillageLinks);

function dashboardRiskSummary(rows,stage) {
 const levels=['ต่ำ','ปานกลาง','มาก'];
 const unknown=rows.filter(r=>!levels.includes(r.risk_level));
 const groups=levels.map(level=>({level,rows:rows.filter(r=>r.risk_level===level)}));
 if(unknown.length)groups.push({level:'ยังไม่ระบุ',rows:unknown});
 const counts=group=>['ท่าตอน','แม่นาวาง'].map(area=>group.filter(r=>dashboardGroupLabel(r.tambon)===area).length);
 const cell=(value,high)=>`<td>${high?'<span class="dashboard-risk-high">'+esc(value)+'</span>':esc(value)}</td>`;
 const body=groups.map(({level,rows:group})=>{
  const high=level==='มาก',values=counts(group);
  const cells=stage===1?[level,level==='ยังไม่ระบุ'?'ยังไม่มีผลประเมิน':'ตามต้นฉบับ',...values,group.length,level==='ยังไม่ระบุ'?'ตรวจสอบข้อมูลรายบุคคล':'ติดตามตามผลประเมินต้นฉบับ']:[`ความเสี่ยง${level} (เก็บแม่อาย ${state.fiscalYear})`,...values,group.length];
  return `<tr data-risk="${high?'high':level==='ปานกลาง'?'medium':level==='ต่ำ'?'low':'unknown'}">${cells.map(value=>cell(value,high)).join('')}</tr>`;
 }).join('');
 const totals=counts(rows),other=rows.length-totals[0]-totals[1];
 const foot=`<tr class="dashboard-total-row"><th scope="row">รวมทั้งหมด</th>${stage===1?'<td>ทุกระดับความเสี่ยง</td>':''}${totals.map(n=>`<td data-summary-count>${n}</td>`).join('')}<td data-summary-count>${rows.length}</td>${stage===1?'<td>แบบประเมิน AS-01</td>':''}</tr>`;
 return {body,foot,other};
}

function renderExecutiveDashboard() {
 const wells=state.wells,a=yearRows(state.respondents),b=yearRows(state.envAs02,2);
 setHtml('chart-well-types',bars(['บ่อน้ำตื้น','บ่อบาดาล','ประปาภูเขา'].map(k=>[k,wells.filter(x=>x.well_type===k).length]),wells.length));
 setHtml('chart-well-distance',bars(['ไม่เกิน 100 เมตร','101 - 200 เมตร','201 - 300 เมตร','มากกว่า 300 เมตร','ไม่ระบุ'].map(k=>[k,wells.filter(x=>x.distance_band===k).length]),wells.length));
 const hcs=[...new Set(wells.map(w=>w.health_center||'ไม่ระบุ'))];
 setHtml('chart-well-hc',bars(hcs.map(h=>[h,wells.filter(w=>(w.health_center||'ไม่ระบุ')===h).length]),wells.length));
 setHtml('chart-resp-tab1-risk',riskBars(a));setHtml('chart-resp-tab2-risk',riskBars(b));
 const summaryA=dashboardRiskSummary(a,1),summaryB=dashboardRiskSummary(b,2);
 setHtml('dash-risk-matrix-tab1-body',summaryA.body);setHtml('dash-risk-matrix-tab1-foot',summaryA.foot);
 setHtml('dash-pivot-tab2-body',summaryB.body);setHtml('dash-pivot-tab2-foot',summaryB.foot);
 for(const [stage,result] of [[1,summaryA],[2,summaryB]]){const note=document.getElementById('dashboard-summary-area-note-'+stage);if(note){note.hidden=!result.other;note.textContent=`ยอดรวมมีรายการพื้นที่อื่นหรือยังไม่ระบุตำบล ${result.other} ราย`;}}
 const area=r=>dashboardGroupLabel(r.tambon),hcOf=r=>dashboardGroupLabel(r.health_center);
 const areas=['ท่าตอน','แม่นาวาง',...[...new Set([...a,...b].map(area))].filter(t=>!['ท่าตอน','แม่นาวาง'].includes(t))];
 setHtml('dash-resp-by-tambon-body',areas.map(t=>{const aa=a.filter(r=>area(r)===t),bb=b.filter(r=>area(r)===t);return `<tr><td>${esc(t)}</td>${dashboardStageCountCells(aa,bb)}</tr>`;}).join(''));
 setHtml('dash-resp-by-tambon-foot',dashboardTotalRow(a,b,1));
 const healthCenters=[...new Set([...a,...b].map(hcOf))];
 setHtml('dash-resp-by-hc-body',healthCenters.map(h=>{const aa=a.filter(r=>hcOf(r)===h),bb=b.filter(r=>hcOf(r)===h);return `<tr><td>${esc(h)}</td><td>${esc([...new Set([...aa,...bb].map(area))].join(', '))}</td>${dashboardStageCountCells(aa,bb)}</tr>`;}).join('')||'<tr><td colspan="10">ไม่มีข้อมูลในปีงบประมาณที่เลือก</td></tr>');
 setHtml('dash-resp-by-hc-foot',dashboardTotalRow(a,b,2));
 const villageKey=r=>JSON.stringify([area(r),dashboardGroupLabel(r.moo)]);
 const keys=[...new Set([...a,...b].map(villageKey))].sort((x,y)=>x.localeCompare(y,'th',{numeric:true}));
 setHtml('dash-resp-by-moo-body',keys.map(k=>{const aa=a.filter(r=>villageKey(r)===k),bb=b.filter(r=>villageKey(r)===k);const [t,m]=JSON.parse(k);const known=aa.filter(r=>historyValuePresent(r.exposure_years));const hc=[...new Set([...aa,...bb].map(hcOf))].join(', ')||'ไม่ระบุ';return `<tr class="dashboard-village-row" tabindex="0" data-village-tambon="${esc(t)}" data-village-moo="${esc(m)}" aria-label="ดูรายชื่อ ต.${esc(t)} หมู่ ${esc(m)}"><td>${esc(t)}<br><button type="button" class="btn btn-sm btn-outline dashboard-village-open" data-village-open aria-label="ดูรายชื่อ ต.${esc(t)} หมู่ ${esc(m)}">ดูรายชื่อ</button></td><td>${esc(m)}</td><td>${esc(hc)}</td>${dashboardStageCountCells(aa,bb)}<td>${known.length?'ระบุ '+known.length+'/'+aa.length+' ราย':'ยังไม่มีข้อมูล'}</td></tr>`;}).join('')||'<tr><td colspan="12">ไม่มีข้อมูลในปีงบประมาณที่เลือก</td></tr>');
 setHtml('dash-resp-by-moo-foot',dashboardTotalRow(a,b,3,true));
 const villageModal=document.getElementById('dashboard-village-modal');
 if(villageModal?.style.display==='flex'&&state.dashboardVillageSelection){const v=state.dashboardVillageSelection;villageModal.innerHTML=dashboardVillageDialogMarkup(v.tambon,v.moo);}

 const unknown=rows=>rows.filter(r=>!['ต่ำ','ปานกลาง','มาก'].includes(r.risk_level)).length;
 const unknownA=unknown(a),unknownB=unknown(b),note=document.getElementById('dashboard-risk-missing-note');
 if(note){note.hidden=!unknownA&&!unknownB;note.textContent=`รายการที่ยังไม่ระบุระดับความเสี่ยง: AS-01 ${unknownA} ราย, AS-02 ${unknownB} ราย (นับรวมในคอลัมน์รวมแล้ว)`;}
 const wk=[...new Set(wells.map(x=>x.tambon+'|'+x.moo))].sort();
 setHtml('dash-moo-breakdown-body',wk.map(k=>{const group=wells.filter(x=>x.tambon+'|'+x.moo===k),known=group.filter(x=>x.user_count!==null),sum=known.reduce((v,x)=>v+x.user_count,0);const [t,m]=k.split('|');return `<tr><td>${esc(t)}</td><td>${esc(m)}</td>${['บ่อน้ำตื้น','บ่อบาดาล','ประปาภูเขา'].map(type=>`<td>${group.filter(x=>x.well_type===type).length}</td>`).join('')}<td>${group.length}</td><td>${group.filter(x=>x.sample_code).length}</td><td>${sum} คน (ระบุ ${known.length}/${group.length} แห่ง)</td></tr>`;}).join(''));
 const screened=a.filter(x=>x.status_2q&&x.status_2q!=='ยังไม่คัดกรอง');
 setHtml('chart-2q-overview',bars([['ยังไม่คัดกรอง',a.length-screened.length,'#64748b'],['มีผลบันทึก',screened.length,'#0284c7']],a.length));
 setHtml('dash-2q-hc-body',`<tr><td>ไม่ระบุ</td><td>${a.length}</td><td>${screened.length}</td><td>${a.filter(x=>String(x.status_2q).includes('ปกติ')).length}</td><td>${a.filter(x=>String(x.status_2q).includes('Positive')).length}</td><td>${a.length-screened.length}</td></tr>`);
}
function renderScreeningDashboardAndTables() {
 const a=yearRows(state.respondents),b=yearRows(state.envAs02,2);
 setText('scr-as01-count',a.length);setText('scr-as02-count',b.length);
 setText('scr-as02-risk-count-note',`กลุ่ม AS-02 ปี ${state.fiscalYear}: เสี่ยงต่ำ ${b.filter(r=>r.risk_level==='ต่ำ').length} | ปานกลาง ${b.filter(r=>r.risk_level==='ปานกลาง').length} | มาก ${b.filter(r=>r.risk_level==='มาก').length}`);
 setHtml('scr-chart-as01-risk',riskBars(a));
 setHtml('scr-chart-as01-questions','<p class="data-note">ข้อมูลสรุปเดิมไม่มีคำตอบรายข้อ สามารถเพิ่มรายละเอียดในแบบฟอร์มได้</p>');
 setHtml('scr-chart-as02-summary',riskBars(b));
 setHtml('scr-chart-2q-summary','<p class="data-note">แสดงผล 2Q ที่บันทึกในทะเบียนของปีงบประมาณที่เลือก</p>');
 renderScreeningAs01Table();renderScreeningAs02Table();renderScreening2QTable();
}
function sourceStageRows(mode) {
 return mode==='TARGET_90'||mode==='TARGET_130' ? yearRows(state.envAs02,2) : yearRows(state.respondents);
}
function sourceSearch(rows,q) { return rows.filter(r=>!q||[r.code,r.form_no,r.full_name,r.age,r.gender,r.cid,r.phone,r.tambon,r.moo,r.source_tab,r.health_center].join(' ').toLowerCase().includes(q.toLowerCase())); }
function renderScreeningAs01Table() {
 const mode=document.getElementById('scr-as01-tab')?.value||'ALL',risk=document.getElementById('scr-as01-risk')?.value||'ALL';
 const rows=sourceSearch(sourceStageRows(mode),document.getElementById('scr-as01-search')?.value||'').filter(r=>risk==='ALL'||r.risk_level===risk);
 setHtml('scr-as01-tbody',rows.map(r=>`<tr><td>${esc(r.code)}<br><small>${esc(r.source_tab)}</small></td><td>${esc(r.survey_date||'ไม่ระบุ')}</td><td>${esc(r.full_name)}</td><td>${esc(valueOrBlank(r.age)===''?'ไม่ระบุ':r.age)}</td><td>${esc(r.gender||'ไม่ระบุ')}</td><td>${esc(r.house_no||'')} ม.${esc(r.moo)} ต.${esc(r.tambon)}</td><td>${esc(r.health_center||'ไม่ระบุ')}</td><td>${esc(historyValuePresent(r.exposure_years)?r.exposure_years:'ไม่ระบุ')}</td><td>${esc(r.risk_job_type||'ไม่ระบุ')}</td><td>${esc(r.diseases||'ไม่ระบุ')}</td><td>${r.total_score??'ไม่ระบุ'}</td><td>${esc(r.risk_level)}</td><td>${esc(r.status_2q||'ยังไม่คัดกรอง')}</td><td><button class="btn btn-sm btn-primary" onclick="${mode==='TARGET_90'?'openEnvAs02Modal':'openRespondentModal'}('${esc(r.id)}')">แก้ไข</button></td></tr>`).join('')||'<tr><td colspan="14">ไม่พบข้อมูล</td></tr>');
}
function renderScreeningAs02Table() {
 const rows=sourceSearch(yearRows(state.envAs02,2),document.getElementById('scr-as02-search')?.value||'');
 setHtml('scr-as02-tbody',rows.map(r=>`<tr><td>${esc(r.code||r.form_no||r.id)}</td><td>${esc(r.interview_date||'ไม่ระบุ')}</td><td>${esc(r.full_name)}</td><td>${esc(valueOrBlank(r.age)===''?'ไม่ระบุ':r.age)}</td><td>${esc(r.gender||'ไม่ระบุ')}</td><td>${esc(valueOrBlank(r.weight_kg)===''?'ไม่ระบุ':r.weight_kg)}</td><td>${esc(valueOrBlank(r.height_cm)===''?'ไม่ระบุ':r.height_cm)}</td><td>${esc(r.phone||'ไม่ระบุ')}</td><td>ม.${esc(r.moo)} ต.${esc(r.tambon)}</td><td>${esc(historyValuePresent(r.exposure_years)?r.exposure_years:'ไม่ระบุ')}</td><td>${esc([r.herb_usage,r.smoking_status,r.alcohol_status].filter(Boolean).join(' / ')||'ไม่ระบุ')}</td><td>${esc(r.seafood_3days||'ไม่ระบุ')}</td><td>${esc(formatWaterSources(r,'drink')||'ไม่ระบุ')}</td><td>${esc(formatWaterSources(r,'use')||'ไม่ระบุ')}</td><td>คะแนน ${r.total_score??'ไม่ระบุ'} (${esc(r.risk_level||'ไม่ระบุ')})${r.respondent_id?'<br>เชื่อมกับ AS-01 แล้ว':''}</td><td>${r.history_complete?'บันทึกประวัติเพิ่มแล้ว':'มีรายชื่อ; รายละเอียดประวัติยังไม่บันทึก'}</td><td><button class="btn btn-sm btn-primary" onclick="openEnvAs02Modal('${esc(r.id)}')">แก้ไข/เชื่อมรายชื่อ</button></td></tr>`).join('')||'<tr><td colspan="17">ไม่พบข้อมูล</td></tr>');
}
function renderScreening2QTable() {
 const mode=document.getElementById('scr-2q-tab')?.value||'ALL',status=document.getElementById('scr-2q-status')?.value||'ALL',q=document.getElementById('scr-2q-search')?.value||'';
 const rows=sourceSearch(sourceStageRows(mode),q).filter(r=>status==='ALL'||r.status_2q===status||status==='POSITIVE'&&String(r.status_2q).includes('Positive')||status==='NEGATIVE'&&String(r.status_2q).includes('ปกติ')||status==='WAIT'&&r.status_2q==='ยังไม่คัดกรอง');
 setHtml('scr-2q-tbody',rows.map(r=>`<tr><td>${esc(r.code)}<br>${esc(r.source_tab)}</td><td>${esc(r.full_name)}</td><td>${esc(r.age??'ไม่ระบุ')} / ${esc(r.gender||'ไม่ระบุ')}</td><td>ม.${esc(r.moo)} ต.${esc(r.tambon)}</td><td>${esc(r.risk_level)}</td><td>${esc(r.q2_1||'ยังไม่บันทึก')}</td><td>${esc(r.q2_2||'ยังไม่บันทึก')}</td><td>${esc(r.status_2q||'ยังไม่คัดกรอง')}</td><td>${esc(r.date_2q||'ไม่ระบุ')}</td><td><button class="btn btn-sm btn-primary" onclick="${mode==='TARGET_90'?'open2QModalForAs02':'open2QModal'}('${esc(r.id)}')">บันทึก 2Q</button></td></tr>`).join('')||'<tr><td colspan="10">ไม่พบข้อมูล</td></tr>');
}
function syncCoordinatesFromSelectedWell() {
 // A water-use link does not establish a person's residence coordinate. Keep explicit GPS unchanged.
}
function open2QModalForAs02(id) {
 const r=state.envAs02.find(x=>x.id===id);if(!r)return;
 if(!r.respondent_id){alert('ยังไม่มีการยืนยันรายชื่อกับขั้นแรก กรุณาตรวจและเชื่อมรายชื่อก่อนบันทึกผล 2Q ร่วมกัน');showSourceEditor(id,2);return;}
 open2QModal(r.respondent_id);
}
function export2QCsv() {
 csvFile(`2Q_recorded_${state.fiscalYear}.csv`,['รหัส','ชื่อ','ข้อ 1','ข้อ 2','ผล 2Q','วันที่','ผู้ประเมิน'],yearRows(state.respondents).map(r=>[r.code,r.full_name,r.q2_1,r.q2_2,r.status_2q,r.date_2q,r.assessor_2q]));
}
function renderRespondentsTable() {
 const rows=sourceSearch(sourceStageRows(document.getElementById('resp-filter-tab')?.value||'ALL'),document.getElementById('resp-search')?.value||'').filter(r=>{
  const t=document.getElementById('resp-filter-tambon')?.value||'ALL',risk=document.getElementById('resp-filter-risk')?.value||'ALL',well=document.getElementById('resp-filter-well')?.value||'ALL',hc=document.getElementById('resp-filter-hc')?.value||'ALL';return (t==='ALL'||r.tambon===t)&&(risk==='ALL'||r.risk_level===risk||risk==='ปานกลาง-มาก'&&['ปานกลาง','มาก'].includes(r.risk_level))&&(well==='ALL'||r.well_id===well)&&(hc==='ALL'||r.health_center===hc);
 });
 setHtml('respondents-table-body',rows.map(r=>`<tr><td>${r.seq}</td><td>${esc(r.code)}</td><td>${esc(r.full_name)}</td><td class="registry-cid">${esc(r.cid||'ไม่ระบุ')}${historyValuePresent(r.cid)?'<br><button class="btn btn-sm btn-outline" onclick="copyRespondentCid(\''+esc(r.id)+'\')">คัดลอกเลขบัตร</button>':''}</td><td>${esc(valueOrBlank(r.age)===''?'ไม่ระบุ':r.age)}</td><td>${esc(r.gender||'ไม่ระบุ')}</td><td>${esc(formatBasicAddress(r))}</td><td title="${r.basic_profile_source?.health_center?'อ้างอิงตารางพื้นที่รับผิดชอบตามหมู่และตำบล':''}">${esc(r.health_center||'ไม่ระบุ')}</td><td>${esc(r.well_id||'ยังไม่เชื่อมบ่อ')}</td><td>${r.total_score??'ไม่ระบุ'}</td><td>${esc(r.risk_level)}</td><td>${esc(r.source_tab)}</td><td>${esc(r.status_2q||'ยังไม่คัดกรอง')}</td><td><button class="btn btn-sm btn-primary" onclick="${state.envAs02.some(a=>a.id===r.id)?'openEnvAs02Modal':'openRespondentModal'}('${esc(r.id)}')">แก้ไข</button></td></tr>`).join('')||'<tr><td colspan="14">ไม่พบข้อมูล</td></tr>');
}
function renderPivotSummary() {
 const a=yearRows(state.respondents),b=yearRows(state.envAs02,2);
 setHtml('pivot-summary-body',[[`ประเมินแม่อาย ${state.fiscalYear} (AS-01)`,a],[`เก็บแม่อาย ${state.fiscalYear} (AS-02)`,b]].map(([name,rows])=>`<tr><td>${esc(name)}</td><td>${rows.filter(x=>x.tambon==='ท่าตอน').length}</td><td>${rows.filter(x=>x.tambon==='แม่นาวาง').length}</td><td>${rows.length}</td></tr>`).join(''));
 const groups=new Map();for(const r of a){const key=r.tambon+'|'+r.moo;const group=groups.get(key)||{tambon:r.tambon,moo:r.moo,count:0};group.count++;groups.set(key,group);}
 const rows=[...groups.values()].sort((x,y)=>String(x.tambon).localeCompare(String(y.tambon),'th')||Number(x.moo)-Number(y.moo));
 setHtml('village-screening-summary-body',rows.map(r=>`<tr><td>${esc(r.tambon)}</td><td>${esc(r.moo)}</td><td>${r.count}</td></tr>`).join('')+`<tr><th colspan="2">รวมประเมินแม่อาย ${state.fiscalYear}</th><th>${a.length}</th></tr>`);
}
function showSourceEditor(id,stage) {
 const rows=stage===2?state.envAs02:state.respondents,r=rows.find(x=>x.id===id);if(!r)return;
 let modal=document.getElementById('source-record-modal');if(!modal){modal=document.createElement('div');modal.id='source-record-modal';modal.className='modal-backdrop';document.body.appendChild(modal);}
 modal.style.display='flex';modal.innerHTML=`<div class="modal-dialog"><div class="modal-header"><h3>แก้ไขทะเบียนขั้น ${stage}: ${esc(r.code)}</h3><button type="button" class="btn-close" onclick="document.getElementById('source-record-modal').style.display='none'">×</button></div><form onsubmit="saveSourceEditor(event,'${esc(id)}',${stage})"><div class="modal-body"><p class="data-note">ค่าตามชีท ${esc(r.source_tab)} แถว ${r.source?.row||'-'}; ชื่อซ้ำข้ามขั้นตอนเป็นการติดตาม ไม่ลบรายการอัตโนมัติ</p><div class="form-group"><label>ชื่อ–นามสกุล</label><input id="source-edit-name" required value="${esc(r.full_name)}"></div><div class="form-grid-2"><div class="form-group"><label>หมู่</label><input id="source-edit-moo" type="number" value="${esc(r.moo)}"></div><div class="form-group"><label>ตำบล</label><input id="source-edit-tambon" value="${esc(r.tambon)}"></div><div class="form-group"><label>คะแนนรวมตามต้นฉบับ</label><input id="source-edit-score" type="number" step="any" value="${esc(r.total_score)}"></div><div class="form-group"><label>ระดับความเสี่ยงตามต้นฉบับ</label><select id="source-edit-risk">${['ต่ำ','ปานกลาง','มาก','ไม่ระบุ'].map(v=>`<option ${v===r.risk_level?'selected':''}>${v}</option>`).join('')}</select></div></div>${stage===2?`<div class="form-group"><label>ยืนยันการเชื่อมกับผลคัดกรองขั้นแรก (ตรวจบุคคลก่อนเลือก)</label><select id="source-edit-link"><option value="">ยังไม่ยืนยันการจับคู่</option>${state.respondents.map(a=>`<option value="${esc(a.id)}" ${r.respondent_id===a.id?'selected':''}>${esc(a.code+' '+a.full_name+' ม.'+a.moo+' ต.'+a.tambon)}${r.candidate_respondent_ids?.includes(a.id)?' — ชื่อ/พื้นที่ตรงกัน':''}</option>`).join('')}</select></div><p>คะแนนของสองขั้นตอนเก็บแยกกัน ไม่เขียนทับกัน</p>`:''}</div><div class="modal-footer"><button class="btn btn-primary" type="submit">บันทึก</button>${stage===2?`<button class="btn btn-outline" type="button" onclick="document.getElementById('source-record-modal').style.display='none';openDetailedEnvAs02('${esc(id)}')">เพิ่ม/แก้รายละเอียดซักประวัติ</button>`:''}</div></form></div>`;
}
function saveSourceEditor(e,id,stage) {
 e.preventDefault();const rows=stage===2?state.envAs02:state.respondents,r=rows.find(x=>x.id===id);if(!r)return;
 r.full_name=document.getElementById('source-edit-name').value.trim();r.moo=optionalNumber(document.getElementById('source-edit-moo').value);r.tambon=document.getElementById('source-edit-tambon').value.trim();r.total_score=optionalNumber(document.getElementById('source-edit-score').value);r.risk_level=document.getElementById('source-edit-risk').value;
 if(stage===2){r.respondent_id=document.getElementById('source-edit-link').value;r.link_status=r.respondent_id?'ผู้ใช้ยืนยันการจับคู่':'ยังไม่ยืนยันการจับคู่';}
 r.updated_at=new Date().toISOString();saveLocalData();document.getElementById('source-record-modal').style.display='none';
}
function parseReportedValue(raw) {
 const s=String(raw??'').trim();if(!s)return {type:'missing'};
 if(/^(ND|Not\s*Detected|ไม่พบ.*)$/i.test(s))return {type:'nd'};
 const m=s.match(/^(<=|>=|<|>|≤|≥)?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i);if(!m)return {type:'invalid'};
 return {type:m[1]?'bound':'number',op:m[1]||'=',value:Number(m[2])};
}
function checkSingleParam(paramDef,rawVal,stdType) {
 const v=parseReportedValue(rawVal);if(v.type==='missing')return {status:'NA',label:'ไม่มีผลตรวจ'};
 if(v.type==='nd')return {status:'UNKNOWN',label:'ไม่พบตามรายงาน; ไม่ระบุขีดจำกัดการตรวจ'};
 if(v.type==='invalid')return {status:'UNKNOWN',label:'รูปแบบผลตรวจรอตรวจสอบ'};
 const threshold=stdType==='SOURCE_SSO'?({as_val:0.01,cd:0.003,pb:0.01,hg:0.001}[paramDef?.key]):paramDef?.[stdType||'DOH_2543'];
 if(threshold===null||threshold===undefined)return {status:'UNKNOWN',label:'ไม่มีเกณฑ์เปรียบเทียบในชุดนี้'};
 let status='UNKNOWN';
 if(Array.isArray(threshold)){if(v.type==='number')status=v.value>=threshold[0]&&v.value<=threshold[1]?'PASS':'FAIL';}
 else if(v.type==='number')status=v.value<=threshold?'PASS':'FAIL';
 else if(['<','<=','≤'].includes(v.op)&&v.value<=threshold)status='PASS';
 else if((v.op==='>'&&v.value>=threshold)||(['>=','≥'].includes(v.op)&&v.value>threshold))status='FAIL';
 return {status,label:status==='PASS'?'ไม่เกินเกณฑ์ที่เลือก':status==='FAIL'?'เกินเกณฑ์ที่เลือก':'ยังประเมินไม่ได้จากขอบเขตที่รายงาน'};
}
function evaluateWaterLabRecord(rec) {
 let testedCount=0,unknownCount=0,passCount=0;const failedNames=[];
 WATER_LAB_PARAMS.forEach(p=>{const out=checkSingleParam(p,rec[p.key],rec.standard_type||'DOH_2543');if(out.status!=='NA')testedCount++;if(out.status==='UNKNOWN')unknownCount++;if(out.status==='PASS')passCount++;if(out.status==='FAIL')failedNames.push(p.name);});
 const overallStatus=failedNames.length?'เกินเกณฑ์มาตรฐาน':testedCount===0?'ไม่มีผลตรวจ':unknownCount?'ยังสรุปไม่ได้ (มีผล ND/ข้อมูลไม่ครบ)':'ไม่เกินเกณฑ์เฉพาะรายการที่ประเมินได้';
 return {testedCount,unknownCount,passCount,failedNames,overallStatus};
}
function buildWaterLabParamsInputs(existingRecord=null) {
 const std=document.getElementById('wlab-standard-type')?.value||'SOURCE_SSO';
 setHtml('wlab-params-tbody',WATER_LAB_PARAMS.map(p=>`<tr${p.secId?' id="'+p.secId+'"':''}><td>${p.seq}</td><td>${esc(p.name)}</td><td>${std==='SOURCE_SSO'&&['as_val','cd','pb','hg'].includes(p.key)?'mg/kg (หน่วยตามชีทผลตรวจ)':esc(p.unit)}</td><td>${esc(p.whoLabel)}</td><td>${esc(p.ruralLabel)}</td><td>${esc(p.dohLabel)}</td><td>${std==='SOURCE_SSO'?esc({as_val:'0.01',cd:'0.003',pb:'0.01',hg:'0.001'}[p.key]??'ไม่มีเกณฑ์ในชีทผลตรวจ'):esc(Array.isArray(p[std])?p[std].join('–'):p[std]??'ไม่ระบุ')}</td><td><input type="text" class="lab-param-input" id="wlab-inp-${p.key}" value="${esc(existingRecord?.[p.key]??'')}" placeholder="เช่น ND, Not Detected, &lt;0.005, 0.001" oninput="evaluateAllWaterLabInputs()"></td><td id="wlab-badge-${p.key}"></td></tr>`).join(''));
 evaluateAllWaterLabInputs();
}
function rebuildWaterLabParams() {
 const values=Object.fromEntries(WATER_LAB_PARAMS.map(p=>[p.key,document.getElementById('wlab-inp-'+p.key)?.value||'']));
 buildWaterLabParamsInputs(values);
}
function evaluateAllWaterLabInputs() {
 const rec={standard_type:document.getElementById('wlab-standard-type')?.value||'SOURCE_SSO'};
 WATER_LAB_PARAMS.forEach(p=>{const inp=document.getElementById('wlab-inp-'+p.key);if(!inp)return;rec[p.key]=inp.value;const result=checkSingleParam(p,inp.value,rec.standard_type);setText('wlab-badge-'+p.key,result.label);});
 const e=evaluateWaterLabRecord(rec);setText('wlab-live-summary',`มีผล ${e.testedCount}/21 รายการ | เกินเกณฑ์ ${e.failedNames.length} | ยังประเมินไม่ได้ ${e.unknownCount}`);setText('wlab-live-badge',e.overallStatus);
}
function saveLocalData() {
 // Clinical and location records stay in authenticated session memory, never browser storage.
 fillAvailableAS02History();refreshAllViews();
}
async function deleteWell(id) {
 const count=state.waterLabs.filter(r=>r.well_id===id).length;
 if(!confirm(`ลบทะเบียน ${id}? ผลตรวจที่เชื่อม ${count} รายการจะยังอยู่และเปลี่ยนเป็นรอจับคู่`))return;
 state.wells=state.wells.filter(w=>w.well_id!==id);
 state.waterLabs.forEach(r=>{if(r.well_id===id){r.well_id='';r.match_status='ทะเบียนบ่อถูกลบ รอจับคู่ใหม่';}});
 state.respondents.forEach(r=>{if(r.well_id===id)r.well_id='';});state.envAs02.forEach(r=>{if(r.well_id===id)r.well_id='';});saveLocalData();
 postToGoogleSheets({action:'deleteWell',well_id:id});
}
async function deleteRespondent(id) {
 if(!confirm('ลบรายการขั้นแรกนี้? ผลติดตามขั้นสองจะยังอยู่และยกเลิกเฉพาะลิงก์ที่ยืนยันไว้'))return;
 state.respondents=state.respondents.filter(r=>r.id!==id);state.envAs02.forEach(r=>{if(r.respondent_id===id){r.respondent_id='';r.as01_auto_link_disabled=true;r.link_status='รายการขั้นแรกถูกลบ รอจับคู่ใหม่';}});saveLocalData();
}
function renderWaterLabDashboardAndTable() {
 refreshWaterLabYearOptions();
 const labs=waterLabYearRows();labs.forEach(r=>{const e=evaluateWaterLabRecord(r);r.overall_status=e.overallStatus;r.failed_params=e.failedNames.join(', ');});
 const statuses=[...new Set(labs.map(r=>r.overall_status))];
 setHtml('chart-waterlab-status',bars(statuses.map(s=>[s,labs.filter(r=>r.overall_status===s).length,s==='เกินเกณฑ์มาตรฐาน'?'#dc2626':'#64748b']),labs.length));
 const rounds=[...new Set(labs.map(r=>r.sample_date))].sort();
 setHtml('chart-waterlab-params',bars(rounds.map(d=>[d+' (รอบตรวจ)',labs.filter(r=>r.sample_date===d).length]),labs.length)+`<p class="data-note">${labs.length} ตัวอย่างใน ${rounds.length} รอบ ไม่ใช่จำนวนบ่อไม่ซ้ำ; จับคู่ทะเบียนได้ ${labs.filter(r=>r.well_id).length} ตัวอย่าง / รอตรวจสอบ ${labs.filter(r=>!r.well_id).length} ตัวอย่าง<br>เทียบเกณฑ์ตามชีทต้นฉบับ หน่วย mg/kg; ไม่ใช่การรับรองน้ำดื่ม</p>`);
 renderWaterLabTable();
}
function renderWaterLabParamCell(record,param) {
 const value=record[param.key];
 if(value===null||value===undefined||value==='')return `<td data-param-key="${esc(param.key)}" data-result-status="NA" title="ยังไม่มีผลบันทึก">—</td>`;
 const result=checkSingleParam(param,value,record.standard_type||'DOH_2543');
 const abnormal=result.status==='FAIL';
 const unit=record.standard_type==='SOURCE_SSO'&&['as_val','cd','pb','hg'].includes(param.key)?record.source_unit||'หน่วยตามต้นฉบับ':param.unit;
 return `<td data-param-key="${esc(param.key)}" data-result-status="${result.status}" class="${abnormal?'lab-result-abnormal':''}" title="${esc(result.label)}">${esc(value)}${unit&&unit!=='-'?'<br><small>'+esc(unit)+'</small>':''}</td>`;
}
function renderWaterLabTable() {
 const q=document.getElementById('waterlab-search')?.value||'',well=document.getElementById('waterlab-filter-well')?.value||'ALL',result=document.getElementById('waterlab-filter-result')?.value||'ALL',std=document.getElementById('waterlab-filter-std')?.value||'ALL';
 const rows=sortedWaterLabs(waterLabYearRows()).filter(r=>(well==='ALL'||well==='UNMATCHED'&&!r.well_id||r.well_id===well)&&(result==='ALL'||r.overall_status===result)&&(std==='ALL'||r.standard_type===std)&&(!q||[r.point_name,r.source_point_code,r.source_point_label,r.source_village_name,r.sample_date,r.source_date,r.sample_code,r.well_id,r.notes].join(' ').toLowerCase().includes(q.toLowerCase())));
 const header=document.getElementById('waterlab-table-head');
 if(header)header.innerHTML='<th>รหัสรายการ / จุดตามต้นฉบับ</th><th>วันที่เก็บ/ส่งตรวจ</th><th>ปีงบประมาณ</th><th>ชื่อจุดเก็บ / จุดแหล่งน้ำที่เชื่อม</th><th>หมู่ที่ / ตำบล</th>'+WATER_LAB_PARAMS.map(p=>`<th data-param-key="${esc(p.key)}">${esc(p.name.replace(' ⭐',''))}</th>`).join('')+'<th>จำนวนค่าตรวจ / แหล่งที่มา</th><th>สรุปเฉพาะรายการที่มีข้อมูล</th><th>จัดการ</th>';
 setHtml('waterlab-table-body',rows.map(r=>{
  const w=state.wells.find(w=>w.well_id===r.well_id),e=evaluateWaterLabRecord(r);
  const loc=waterLabArea(r),area=[historyValuePresent(loc.moo)?'ม.'+esc(loc.moo):'',loc.tambon?'ต.'+esc(loc.tambon):''].filter(Boolean).join(' ')||'ตามชื่อจุดเก็บต้นฉบับ';
  return `<tr><td>${esc(r.sample_code)}${r.source_point_code?'<br><b>จุด '+esc(r.source_point_code)+'</b>':''}</td><td>${esc(formatSampleDate(r.sample_date))}${r.source_date?'<br><small>วันที่ส่งตรวจตามต้นฉบับ '+esc(r.source_date)+'</small>':''}</td><td>${recordFiscalYear(r,'water')||'ไม่ระบุ'}</td><td class="waterlab-point-name">${esc(r.point_name||w?.well_name||'ไม่ระบุ')}<br><b>${esc(r.well_id||'ยังไม่เชื่อมทะเบียน')}</b></td><td>${area}</td>${WATER_LAB_PARAMS.map(p=>renderWaterLabParamCell(r,p)).join('')}<td>${e.testedCount} รายการ<br><small>${esc(r.source?.sheet||'บันทึกเพิ่มเติม')} แถว ${r.source?.row||'-'}</small></td><td class="${e.failedNames.length?'lab-result-abnormal':''}">${esc(e.overallStatus)}<br><small>Not Detected คงตามใบผลตรวจ</small></td><td><button class="btn btn-sm btn-primary" onclick="openWaterLabModal('${esc(r.id)}')">แก้ไข</button> <button class="btn btn-sm btn-danger" onclick="deleteWaterLab('${esc(r.id)}')">ลบ</button></td></tr>`;
 }).join('')||`<tr><td colspan="${WATER_LAB_PARAMS.length+8}">ไม่พบข้อมูล</td></tr>`);
}
function csvFile(filename,headers,rows) {
 const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';downloadCsvFile(filename,[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n'));
}
function exportRespondentsCsv() {
 csvFile(`Env_As_01_${state.fiscalYear}.csv`,IMPORT_SCHEMAS.as01.fields.map(f=>f.key),yearRows(state.respondents).map(r=>exportTemplateRecord('as01',r)));
}
function exportEnvAs02Csv() {
 csvFile(`Env_As_02_${state.fiscalYear}.csv`,IMPORT_SCHEMAS.as02.fields.map(f=>f.key),yearRows(state.envAs02,2).map(r=>exportTemplateRecord('as02',r)));
}
function exportWellsCsv() {
 csvFile('water_wells_source_2569.csv',['รหัสบ่อ','ลำดับ','รหัสตัวอย่างตามทะเบียน','ชื่อ','บ้านเลขที่','บ้านเลขที่ดิบในต้นฉบับ','หมู่','ตำบล','ประเภท','UTM E','UTM N','Latitude','Longitude','สมมติฐานพิกัด','ระยะจากแม่น้ำ','จำนวนผู้ใช้ที่ระบุ','รพ.สต.','ข้อควรตรวจสอบ'],state.wells.map(w=>[w.well_id,w.seq,w.sample_code,w.owner_name,w.house_no,w.house_no_source,w.moo,w.tambon,w.well_type,w.utm_e,w.utm_n,w.latitude,w.longitude,w.coordinate_basis,w.distance_river_m,w.user_count,w.health_center,w.notes]));
}
function exportWaterLabCsv() {
 const headers=['รหัสตัวอย่างระบบ','ปีงบประมาณ','วันที่เก็บ/ส่งตรวจ','วันที่ตามต้นฉบับ','ชื่อจุดเก็บ','รหัสจุดตามต้นฉบับ','ชื่อจุดตามต้นฉบับ','รหัสแหล่งน้ำที่เชื่อม','หน่วยตามชีทต้นฉบับ',...WATER_LAB_PARAMS.map(p=>p.name.replace(' ⭐','')),'สรุปเฉพาะข้อมูลที่มี','แหล่งที่มา','แถว','หมายเหตุ'];
 csvFile(`community_water_labs_SSO_${state.waterLabYear||'ALL'}.csv`,headers,sortedWaterLabs(waterLabYearRows()).map(r=>[r.sample_code,recordFiscalYear(r,'water'),r.sample_date,r.source_date,r.point_name,r.source_point_code,r.source_point_label,r.well_id,r.source_unit,...WATER_LAB_PARAMS.map(p=>r[p.key]),evaluateWaterLabRecord(r).overallStatus,r.source?.sheet,r.source?.row,r.notes]));
}
function downloadFullBackupJson() {
 if(!state.cloudToken||!state.dataLoaded){alert('กรุณาเข้าสู่ระบบส่วนกลางก่อน');return;}
 downloadCsvFile('maeai_backup_'+bangkokToday()+'.json',JSON.stringify({data_version:DATA_VERSION,exported_at:new Date().toISOString(),wells:state.wells,respondents:state.respondents,envAs02:state.envAs02,waterLabs:state.waterLabs,knowledgeDocs:state.knowledgeDocs,pendingWrites:pendingCloudWrites()},null,2));
}
function resetToSeedData() {
 return pullFromGoogleSheets();
}
// Central-only online release. Tokens and unsent records live only in this session.
function pendingCloudWrites(){return state.pendingWrites||[];}
function storePendingCloudWrites(rows){state.pendingWrites=rows;updatePendingNotice();}
function updatePendingNotice(){
 const notice=document.getElementById('pending-cloud-notice'),count=pendingCloudWrites().length;
 if(notice)notice.hidden=!count||!state.currentUser;
 setText('pending-cloud-message','Google Sheets ยังไม่ยืนยัน '+count+' รายการ กรุณาส่งให้สำเร็จก่อนปิดหน้าเว็บ');
}
async function cloudRequest(payload=null,action='capabilities'){
 if(!validGasUrl(state.gasUrl))throw Error('กรุณาตั้งค่าลิงก์ Google Apps Script /exec');
 if(action==='getAll'&&!payload)payload={action:'getAll'};
 const controller=new AbortController(),epoch=state.sessionEpoch;
 if(!state.activeCloudRequests)state.activeCloudRequests=new Set();
 state.activeCloudRequests.add(controller);
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  let url=state.gasUrl,options={signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'};
  if(payload){options.method='POST';options.headers={'Content-Type':'text/plain;charset=utf-8'};options.body=JSON.stringify({...payload,data_version:DATA_VERSION,token:payload.token??state.cloudToken??''});}
  else{const u=new URL(url);u.searchParams.set('action',action);url=u.toString();}
  const response=await fetch(url,options);if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(epoch!==state.sessionEpoch){const e=Error('ยกเลิกคำขอจากการเข้าสู่ระบบครั้งก่อน');e.code='STALE_SESSION';throw e;}
  if(data.status!=='success'){const e=Error(data.message||'ส่วนกลางยังไม่ยืนยันการบันทึก');e.code=data.code;throw e;}
  return data;
 }finally{clearTimeout(timeout);state.activeCloudRequests.delete(controller);}
}
async function saveLoginGasUrl(){
 if(state.loginBusy)return;
 try{persistGasUrlEverywhere(document.getElementById('login-gas-url').value);state.cloudCapabilities=null;setLoginMessage('');await probeCloudConnection();}
 catch(e){setLoginMessage(e.message);}
}
async function probeCloudConnection(){
 try{
  const data=await cloudRequest();
  if(data.data_version!==DATA_VERSION||data.requires_auth!==true||data.api_revision!==ONLINE_API_REVISION||data.supports_post_get_all!==true)throw Error('กรุณาอัปเดต Apps Script จากชุดออนไลน์ และ Deploy รายการเดิมเป็น New version ก่อน');
  state.cloudCapabilities=data;state.connectionError='';
  setText('login-connection-status',data.initialized?'ส่วนกลางพร้อมใช้งาน กรุณาเข้าสู่ระบบ':'พบตัวเชื่อม แต่ฐานกลางยังไม่เริ่มต้น กรุณาตรวจฐานเดิมกับผู้ดูแลระบบ');
  return data;
 }catch(e){
  state.cloudCapabilities=null;state.connectionError=e.message;state.cloudVerified=false;
  setText('login-connection-status','ส่วนกลางยังไม่พร้อม: '+e.message);logCloudMessage(e.message);return null;
 }
}
async function loginToCentral(username,password){
 try{
  const data=await cloudRequest({action:'login',username,password});
  if(data.data_version!==DATA_VERSION||!data.token||!data.user?.username)throw Error('ผลตอบกลับการเข้าสู่ระบบไม่ครบ');
  state.cloudToken=data.token;state.currentUser=data.user;state.cloudCapabilities.initialized=data.initialized;
  if(!data.initialized)throw Error('ยังไม่มีฐานกลางที่พร้อมใช้งาน กรุณาตรวจชีท V2 เดิมกับผู้ดูแลระบบ ฉบับออนไลน์ไม่สร้างฐานจากข้อมูลว่าง');
  await readCentralData();
  setLoginMessage('');enterApplication();
 }catch(e){
  const token=state.cloudToken;clearSessionData();
  if(token)cloudRequest({action:'logout',token}).catch(()=>{});
  throw e;
 }
}
async function readCentralData(){
 const data=await cloudRequest({action:'getAll'});
 if(data.data_version!==DATA_VERSION||!data.initialized)throw Error('ฐานกลางยังไม่พร้อม หรือรุ่นข้อมูลไม่ตรงกัน');
 if(!['wells','respondents','envAs02','waterLabs','knowledgeDocs'].every(k=>Array.isArray(data[k])))throw Error('ข้อมูลส่วนกลางไม่ครบชุด');
 const wells=data.wells.map((r,i)=>normalizeWellRecord(r,i));
 const respondents=data.respondents.map((r,i)=>normalizeStageRecord({...r,seq:r.seq??i+1},1));
 const envAs02=data.envAs02.map(r=>normalizeStageRecord(r,2));
 state.wells=wells;state.respondents=respondents;state.envAs02=envAs02;
 state.waterLabs=mergeCloudWaterLabHistory(data.waterLabs);state.knowledgeDocs=data.knowledgeDocs;
 // Built-in documents contain blank forms/manuals only, never person records.
 for(const builtin of INITIAL_KNOWLEDGE_DOCS){const doc=state.knowledgeDocs.find(d=>d.id===builtin.id);if(doc)Object.assign(doc,{file_url:builtin.file_url,author:builtin.author,is_builtin:true});else state.knowledgeDocs.push({...builtin});}
 state.dataLoaded=true;state.cloudVerified=true;saveLocalData();updateSyncBadge();
 logCloudMessage('อ่านข้อมูลล่าสุดจาก Google Sheets สำเร็จ');return true;
}
function expireCentralSession(error){
 const count=pendingCloudWrites().length;clearSessionData();
 setLoginMessage(error.message+(count?' มี '+count+' รายการที่ยังไม่ยืนยันการบันทึก กรุณาตรวจสอบกับฐานกลางหลังเข้าสู่ระบบใหม่':''));
}
function flushPendingCloudWrites(){
 if(state.cloudFlushPromise)return state.cloudFlushPromise;
 if(!state.cloudToken||!state.currentUser||!state.dataLoaded)return Promise.resolve(false);
 const epoch=state.sessionEpoch;
 const promise=(async()=>{
  while(pendingCloudWrites().length){
   const first=pendingCloudWrites()[0];
   try{
    await cloudRequest(first);
    if(epoch!==state.sessionEpoch)return false;
    storePendingCloudWrites(pendingCloudWrites().filter(r=>r._queue_id!==first._queue_id));
   }catch(e){
    if(epoch!==state.sessionEpoch)return false;
    state.cloudVerified=false;
    if(e.code==='AUTH_REQUIRED')expireCentralSession(e);
    else{updateSyncBadge();logCloudMessage('ยังไม่บันทึกส่วนกลาง: '+e.message);}
    return false;
   }
  }
  state.cloudVerified=true;updateSyncBadge();return true;
 })();
 state.cloudFlushPromise=promise;
 promise.finally(()=>{if(state.cloudFlushPromise===promise)state.cloudFlushPromise=null;});
 return promise;
}
async function postToGoogleSheets(payload){
 if(!state.cloudToken||!state.currentUser||!state.dataLoaded){alert('กรุณาเข้าสู่ระบบส่วนกลางและโหลดข้อมูลให้สำเร็จก่อนบันทึก');return false;}
 const epoch=state.sessionEpoch;
 const rows=pendingCloudWrites();rows.push(JSON.parse(JSON.stringify({...payload,_queue_id:Date.now()+'-'+Math.random().toString(36).slice(2)})));storePendingCloudWrites(rows);
 const ok=await flushPendingCloudWrites();
 if(!ok&&epoch===state.sessionEpoch&&state.currentUser)alert('Google Sheets ยังไม่ยืนยันการบันทึก มี '+pendingCloudWrites().length+' รายการรอส่ง กรุณากดส่งรายการรอส่งก่อนปิดหน้าเว็บ');
 return ok;
}
async function pullFromGoogleSheets(silent=false){
 if(!state.cloudToken||!state.currentUser){if(!silent)alert('กรุณาเข้าสู่ระบบส่วนกลางก่อน');return false;}
 if(pendingCloudWrites().length&&!await flushPendingCloudWrites())return false;
 try{return await readCentralData();}
 catch(e){
  if(e.code==='AUTH_REQUIRED')expireCentralSession(e);
  else if(e.code!=='STALE_SESSION'){state.cloudVerified=false;updateSyncBadge();logCloudMessage('อ่านส่วนกลางไม่สำเร็จ: '+e.message);if(!silent)alert(e.message);}
  return false;
 }
}
async function syncAllToGoogleSheets(){
 if(!state.cloudToken||!state.dataLoaded){alert('กรุณาเข้าสู่ระบบส่วนกลางก่อน');return false;}
 const ok=await flushPendingCloudWrites()&&await pullFromGoogleSheets(true);
 if(ok)alert('Google Sheets ยืนยันรายการที่ส่งและอ่านข้อมูลล่าสุดกลับสำเร็จ');
 else if(state.currentUser)alert('ยังส่งหรืออ่านข้อมูลกลับไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและสถานะรอส่ง');
 return Boolean(ok);
}
function copyAppsScriptCode(){alert('ใช้ไฟล์ apps-script/google-apps-script.gs ในชุดออนไลน์ วางแทนโค้ดเดิม แล้ว Deploy > Manage deployments > Edit > New version โดยใช้ลิงก์เดิม ไม่ต้องเริ่มต้นฐานกลางใหม่');}
window.addEventListener('DOMContentLoaded',()=>{state.cloudProbe=probeCloudConnection().finally(()=>state.cloudProbeComplete=true);});
window.addEventListener('beforeunload',e=>{if(pendingCloudWrites().length){e.preventDefault();e.returnValue='';}});


function openRespondentModal(id=null) {
 const r=state.respondents.find(x=>x.id===id);
 if(r?.source_summary_only){showSourceEditor(id,1);return;}
 openDetailedRespondentModal(id);
}
function openEnvAs02Modal(id=null) {
 if(id&&state.envAs02.find(x=>x.id===id)?.source_summary_only){showSourceEditor(id,2);return;}
 openDetailedEnvAs02(id);
}
function filterRespondentsByTab(mode) {
 switchTab('tab-respondents');const sel=document.getElementById('resp-filter-tab');if(sel)sel.value=mode;renderRespondentsTable();
}
window.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('#env-as02-form select,#well-hc,#wlab-lab-select').forEach(select=>{if(!Array.from(select.options).some(x=>x.value===''))select.insertAdjacentHTML('afterbegin','<option value="">-- ยังไม่ระบุ --</option>');});
 const warn=document.getElementById('data-quality-details');
 if(warn)warn.textContent='ฉบับออนไลน์อ่านข้อมูลจาก Google Sheets หลังเข้าสู่ระบบเท่านั้น แยกข้อมูลคัดกรองตามวันที่บริการ/ปีงบประมาณ พิกัดและผลตรวจแสดงตามข้อมูลที่บันทึกในฐานกลาง';
});


// Carry forward available history for the same person; each assessment keeps its own results.
const AS01_HISTORY_FIELDS = [
 'full_name','age','gender','cid','phone','house_no','moo','tambon','amphoe','province','health_center',
 'marital_status','education','years_in_area','exposure_years','risk_job_flag','risk_job_type',
 'job_detail','job_duration','job_hours','disease_flag','diseases','weight_kg','height_cm',
 'herb_usage','herb_name','herb_fda','smoking_status','smoking_type','smoking_per_day','smoking_years',
 'smoking_quit_years','alcohol_status','alcohol_other','seafood_freq','seafood_3days',
 'drink_sources','drink_years','use_sources','use_years','food_rice','food_veg','food_fish',
 'food_snail','home_grown_veg','home_grown_water','eat_river_veg_weekly','flood_5years'
];
function historyValuePresent(value) {
 return value!==null && value!==undefined && !['','ไม่ระบุ','ยังไม่ระบุ'].includes(String(value).trim());
}
function historyNameKey(value) {
 return String(value||'').normalize('NFC').trim()
  .replace(/^(นางสาว|นาย|นาง|เด็กชาย|เด็กหญิง|ด\.?ช\.?|ด\.?ญ\.?)\s*/, '')
  .replace(/\s+/g,'').toLowerCase();
}
function historyAreaKey(value) {return String(value??'').normalize('NFC').replace(/\s+/g,'');}
function findAS01HistorySource(record) {
 if(record.respondent_id)return state.respondents.find(r=>r.id===record.respondent_id)||null;
 if(record.as01_auto_link_disabled)return null;
 const key=historyNameKey(record.full_name);if(!key)return null;
 const matches=state.respondents.filter(r=>historyNameKey(r.full_name)===key &&
  (!recordFiscalYear(record,2)||!recordFiscalYear(r,1)||recordFiscalYear(record,2)===recordFiscalYear(r,1)) &&
  ['moo','tambon'].every(field=>!historyValuePresent(record[field])||!historyValuePresent(r[field])||historyAreaKey(record[field])===historyAreaKey(r[field])));
 return matches.length===1?matches[0]:null;
}
function fillAS02HistoryFromAS01(record) {
 const source=findAS01HistorySource(record);if(!source)return [];
 if(!record.respondent_id){record.respondent_id=source.id;record.link_status='เชื่อมกับ AS-01 ตามชื่อและพื้นที่';record.as01_link_basis='unique_name_with_consistent_area_and_year';}
 const copied=[];
 for(const field of AS01_HISTORY_FIELDS){
  if(record.as01_prefill_exclusions?.[field]||historyValuePresent(record[field])||!historyValuePresent(source[field]))continue;
  record[field]=source[field];
  record.as01_prefill={...(record.as01_prefill||{}),[field]:{source_record_id:source.id,source_field:field,copied_at:new Date().toISOString(),value:source[field]}};
  copied.push(field);
 }
 return copied;
}
function fillAvailableAS02History() {
 for(const record of state.envAs02||[])fillAS02HistoryFromAS01(record);
}

// Pending review: full editable form data; uploaded source provenance remains intact.
const REVIEW_COMMON_FIELDS = [
 ['fiscal_year','ปีงบประมาณ (คำนวณจากวันที่ หากไม่ทราบวันที่ให้ระบุปี)','number'],['code','รหัสแบบ / Lab Code'],['full_name','ชื่อ–นามสกุล'],['age','อายุ (ปี)','number'],['gender','เพศ'],['cid','เลขประจำตัวประชาชน'],['phone','โทรศัพท์'],['house_no','บ้านเลขที่'],['moo','หมู่ที่','number'],['tambon','ตำบล'],['amphoe','อำเภอ'],['province','จังหวัด'],['health_center','รพ.สต. ที่รับผิดชอบ'],['well_id','ทะเบียนแหล่งน้ำที่ยืนยัน','well'],['latitude','ละติจูดที่วัดจริง','number'],['longitude','ลองจิจูดที่วัดจริง','number'],['marital_status','สถานภาพสมรส'],['education','การศึกษา'],['years_in_area','ระยะเวลาอาศัย (ปี)','number'],['exposure_years','ระยะเวลาสัมผัส (ปี)','number'],['risk_job_flag','มีอาชีพเสี่ยง','yesno'],['risk_job_type','อาชีพเสี่ยง'],['job_detail','รายละเอียดงาน','textarea'],['job_duration','ระยะเวลาทำงาน'],['job_hours','ชั่วโมงสัมผัสจากงาน'],['disease_flag','มีโรคประจำตัว','yesno'],['diseases','โรคประจำตัว','textarea'],['total_score','คะแนนรวมตามข้อมูลจริง','number'],['risk_level','ระดับความเสี่ยงตามข้อมูลจริง','risk'],['notes','หมายเหตุ','textarea']
];
const REVIEW_AS01_FIELDS = [['survey_date','วันที่ลงสำรวจ / ประเมิน','date'],['interviewer_name','ผู้ประเมิน'],['target_group','กลุ่มเป้าหมาย'],['cut_point','เกณฑ์คัดเลือก / หมายเหตุ'],['swim_duration','ระยะเวลาว่ายน้ำหรือสัมผัสน้ำ'],['swim_hours','ชั่วโมงสัมผัสน้ำ'],['symptom_flag','มีอาการ','yesno'],['symptoms','อาการ','textarea'],...Array.from({length:11},(_,i)=>['q'+(i+1),'คำตอบข้อ '+(i+1)+' (ไม่ระบุ / ไม่ใช่ / ใช่)','binary'])];
const REVIEW_AS02_FIELDS = [['form_no','เลขที่แบบ Env-As-02'],['respondent_id','เชื่อมรายชื่อ Env-As-01 ที่ยืนยัน','respondent'],['interview_date','วันที่ซักประวัติ','date'],['interviewer_name','ผู้ซักประวัติ'],['interviewer_role','ตำแหน่งผู้ซักประวัติ'],['weight_kg','น้ำหนัก (กิโลกรัม)','number'],['height_cm','ส่วนสูง (เซนติเมตร)','number'],['hours_at_home','ชั่วโมงอยู่บ้านต่อวัน','number'],['work_out_district','ทำงานนอกอำเภอ','yesno'],['work_out_days','จำนวนวันที่ทำงานนอกอำเภอ','number'],['within_1km_river','บ้านอยู่ในรัศมี 1 กม.'],['herb_usage','การใช้สมุนไพร'],['herb_name','ชื่อสมุนไพร'],['herb_fda','ข้อมูลทะเบียนสมุนไพร'],['smoking_status','การสูบบุหรี่'],['smoking_type','ชนิดบุหรี่'],['smoking_per_day','จำนวนบุหรี่ต่อวัน'],['smoking_years','จำนวนปีที่สูบ'],['smoking_quit_years','จำนวนปีที่เลิก'],['alcohol_status','การดื่มสุรา'],['alcohol_other','รายละเอียดสุรา'],['seafood_freq','ความถี่กินอาหารทะเล'],['seafood_3days','อาหารทะเลใน 3 วันก่อนเก็บตัวอย่าง'],['drink_sources','แหล่งน้ำดื่ม','textarea'],['drink_years','ระยะเวลาใช้น้ำดื่ม'],['use_sources','แหล่งน้ำใช้','textarea'],['use_years','ระยะเวลาใช้น้ำอุปโภค'],['food_rice','แหล่งข้าว'],['food_veg','แหล่งผัก'],['food_fish','แหล่งปลา'],['food_snail','แหล่งหอย'],['home_grown_veg','ผักที่ปลูกเอง'],['home_grown_water','น้ำที่ใช้ปลูกผัก'],['eat_river_veg_weekly','กินผักริมน้ำเป็นประจำ'],['flood_5years','น้ำท่วมบ้านใน 5 ปี']];
const REVIEW_2Q_FIELDS = [['q2_1','2Q ข้อ 1: หดหู่ เศร้า หรือท้อแท้','yesno'],['q2_2','2Q ข้อ 2: เบื่อ ไม่เพลิดเพลิน','yesno'],['date_2q','วันที่คัดกรอง 2Q','date'],['assessor_2q','ผู้ประเมิน 2Q'],['note_2q','หมายเหตุ 2Q','textarea']];
function reviewFieldMarkup(field, record) {
 const [key,label,type='text']=field,value=record[key]??'';let input;
 let options=null;
 if(type==='risk')options=['','ต่ำ','ปานกลาง','มาก','ไม่ระบุ'].map(v=>[v,v||'ยังไม่ระบุ']);
 if(type==='yesno')options=[['','ยังไม่ระบุ'],['ไม่ใช่','ไม่ใช่'],['ใช่','ใช่']];
 if(type==='binary')options=[['','ยังไม่ระบุ'],['0','ไม่ใช่'],['1','ใช่']];
 if(type==='well')options=[['','ยังไม่ยืนยันการเชื่อมแหล่งน้ำ'],...state.wells.map(w=>[w.well_id,w.well_id+' '+w.well_name])];
 if(type==='respondent')options=[['','ยังไม่ยืนยันการเชื่อมรายชื่อ'],...state.respondents.map(r=>[r.id,r.code+' '+r.full_name+' ม.'+r.moo+' ต.'+r.tambon])];
 if(options) { if(value!==''&&!options.some(o=>String(o[0])===String(value)))options.push([value,value]);input=`<select data-review-key="${key}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select>`; }
 else if(type==='textarea')input=`<textarea rows="3" data-review-key="${key}">${esc(value)}</textarea>`;
 else input=`<input data-review-key="${key}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(value)}" ${key==='full_name'?'required':''}>`;
 return `<div class="form-group"><label>${esc(label)}</label>${input}</div>`;
}
function openReviewRecordEditor(stage,id=null,recordStage=1) {
 const rows=(stage===2||stage==='2q'&&recordStage===2)?state.envAs02:state.respondents;
 const existing=rows.find(r=>r.id===id);
 const record=existing||{amphoe:'แม่อาย',province:'เชียงใหม่',status_2q:'ยังไม่คัดกรอง',survey_date:stage===1?bangkokToday():'',interview_date:stage===2?bangkokToday():'',fiscal_year:fiscalYearFromDate(bangkokToday())};
 const fields=stage==='2q'?REVIEW_2Q_FIELDS:[...REVIEW_COMMON_FIELDS,...(stage===2?REVIEW_AS02_FIELDS:REVIEW_AS01_FIELDS),...REVIEW_2Q_FIELDS];
 let modal=document.getElementById('review-record-modal');if(!modal){modal=document.createElement('div');modal.id='review-record-modal';modal.className='modal-backdrop';document.body.appendChild(modal);}
 modal.style.display='flex';
 const stageArg=JSON.stringify(stage).replace(/"/g,'&quot;');
 const chooser=stage==='2q'?`<div class="form-group"><label>รายชื่อผู้รับการคัดกรอง</label><select id="review-2q-person" onchange="openReviewRecordEditor('2q',this.value,${recordStage})"><option value="">-- เลือกรายชื่อ --</option>${rows.map(r=>`<option value="${esc(r.id)}" ${r.id===id?'selected':''}>${esc(r.code+' '+r.full_name)}</option>`).join('')}</select></div>`:'';
 modal.innerHTML=`<div class="modal-dialog modal-lg"><div class="modal-header"><h3>${existing?'แก้ไข':'เพิ่ม'} ${stage==='2q'?'ผลคัดกรอง 2Q':stage===2?'แบบ Env-As-02':'แบบ Env-As-01'}</h3><button type="button" class="btn-close" onclick="closeReviewRecordEditor()">×</button></div><form id="review-record-form" onsubmit="saveReviewRecord(event,${stageArg},'${esc(id||'')}',${recordStage})"><div class="modal-body">${chooser}<p class="data-note">แก้ไขข้อมูลแบบฟอร์มได้ครบ ช่องที่ไม่มีข้อมูลให้เว้นว่าง คะแนนและระดับความเสี่ยงเดิมจะไม่ถูกคำนวณทับจากคำตอบที่ยังไม่ระบุ</p>${existing?.source?`<p>ต้นฉบับ: ${esc(existing.source.sheet||existing.source_tab)} แถว ${existing.source.row||'ไม่ระบุ'} (เก็บที่มาเดิมไว้)</p>`:''}<div class="form-grid-2">${fields.map(f=>reviewFieldMarkup(f,record)).join('')}</div></div><div class="modal-footer"><button class="btn btn-primary" type="submit">บันทึกข้อมูล</button><button class="btn btn-outline" type="button" onclick="closeReviewRecordEditor()">ยกเลิก</button>${existing?`<button class="btn btn-danger" type="button" onclick="deleteReviewRecord(${stageArg},'${esc(id)}',${recordStage})">${stage==='2q'?'ลบเฉพาะผล 2Q':'ลบรายการนี้'}</button>`:''}</div></form></div>`;
}
function closeReviewRecordEditor() {const modal=document.getElementById('review-record-modal');if(modal)modal.style.display='none';}
function saveReviewRecord(e,stage,id,recordStage=1) {
 e.preventDefault();const rows=(stage===2||stage==='2q'&&recordStage===2)?state.envAs02:state.respondents;
 if(stage==='2q')id=document.getElementById('review-2q-person').value||id;
 if(stage==='2q'&&!id){alert('กรุณาเลือกรายชื่อก่อนบันทึก');return;}
 const current=rows.find(r=>r.id===id),fields=stage==='2q'?REVIEW_2Q_FIELDS:[...REVIEW_COMMON_FIELDS,...(stage===2?REVIEW_AS02_FIELDS:REVIEW_AS01_FIELDS),...REVIEW_2Q_FIELDS];
 const result={...(current||{}),id:current?.id||`MANUAL-${stage}-${Date.now()}`,recorded_at:current?.recorded_at||new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:state.currentUser?.displayName||'ผู้ใช้งาน'};
 for(const [key,,type='text'] of fields){const input=document.querySelector(`#review-record-form [data-review-key="${key}"]`);if(!input)continue;const v=input.value.trim();result[key]=(type==='number'||type==='binary')?optionalNumber(v):v;}
 const q1=result.q2_1,q2=result.q2_2;
 result.status_2q=q1==='ใช่'||q2==='ใช่'?'พบความเสี่ยง (Positive 2Q)':q1==='ไม่ใช่'&&q2==='ไม่ใช่'?'ปกติ (ไม่พบความเสี่ยง)':'ยังไม่คัดกรอง';
 if(stage!=='2q'){
  const dateKey=stage===2?'interview_date':'survey_date';
  if(!current&&!result[dateKey]){result[dateKey]=bangkokToday();result.date_basis='recorded_date_default';}
  else if(result[dateKey]!==current?.[dateKey])result.date_basis=!current&&result[dateKey]===bangkokToday()?'recorded_date_default':'user_entered';
  result.fiscal_year=fiscalYearFromDate(result[dateKey])||Number(result.fiscal_year)||recordFiscalYear(current||{},stage)||fiscalYearFromDate(bangkokToday());
  result.source_tab=(stage===2?'เก็บแม่อาย':'ประเมินแม่อาย')+' '+result.fiscal_year;
  if(!current){result.seq=Math.max(0,...rows.map(r=>Number(r.seq)||0))+1;result.source_year=result.fiscal_year;result.dataset=stage===2?'collection':'assessment';}
 }
 if(stage===2){
  result.history_updated=true;
  result.as01_prefill_exclusions={...(current?.as01_prefill_exclusions||{})};
  for(const field of AS01_HISTORY_FIELDS){
   if(!historyValuePresent(result[field])&&historyValuePresent(current?.[field]))result.as01_prefill_exclusions[field]=true;
   else if(historyValuePresent(result[field]))delete result.as01_prefill_exclusions[field];
  }
  if(current?.respondent_id&&!result.respondent_id)result.as01_auto_link_disabled=true;
  if(result.respondent_id)result.as01_auto_link_disabled=false;
  fillAS02HistoryFromAS01(result);
  result.link_status=result.respondent_id?'เชื่อมกับ AS-01 แล้ว':'ยังไม่เชื่อมกับ AS-01';
 }
 const index=rows.findIndex(r=>r.id===result.id);if(index<0)rows.push(result);else rows[index]=result;
 if(stage!=='2q'){state.fiscalYear=result.fiscal_year;try{localStorage.setItem('MAEAI_ONLINE_FISCAL_YEAR',String(state.fiscalYear));}catch(e){}}
 saveLocalData();closeReviewRecordEditor();
 postToGoogleSheets({action:stage===2||stage==='2q'&&recordStage===2?'saveEnvAs02':'saveRespondent',data:result});
}
function deleteReviewRecord(stage,id,recordStage=1) {
 const rows=(stage===2||stage==='2q'&&recordStage===2)?state.envAs02:state.respondents;
 const record=rows.find(r=>r.id===id);if(!record)return;
 if(!confirm(stage==='2q'?`ลบเฉพาะผล 2Q ของ ${record.full_name}? ทะเบียนและผลประเมินสารหนูยังอยู่`:`ลบรายการ ${record.full_name} ใน ${stage===2?'Env-As-02':'Env-As-01'}? รายการอีกแบบฟอร์มจะยังอยู่`))return;
 if(stage==='2q'){for(const [key] of REVIEW_2Q_FIELDS)record[key]='';record.status_2q='ยังไม่คัดกรอง';}
 else if(stage===2)state.envAs02=state.envAs02.filter(r=>r.id!==id);
 else {state.respondents=state.respondents.filter(r=>r.id!==id);state.envAs02.forEach(r=>{if(r.respondent_id===id){r.respondent_id='';r.as01_auto_link_disabled=true;r.link_status='รายการขั้นแรกถูกลบ รอตรวจสอบลิงก์';}});}
 saveLocalData();closeReviewRecordEditor();
 postToGoogleSheets(stage==='2q'?{action:recordStage===2?'saveEnvAs02':'saveRespondent',data:record}:{action:stage===2?'deleteEnvAs02':'deleteRespondent',id});
}
function openRespondentModal(id=null) {openRestoredScreeningForm(1,id);}
function openEnvAs02Modal(id=null) {openRestoredScreeningForm(2,id);}
function open2QModal(id=null) {openReviewRecordEditor('2q',id,1);}
function open2QModalForAs02(id) {openReviewRecordEditor('2q',id,2);}


// The original, sectioned forms are the primary editors. Preserve all extra/source fields.
const DETAILED_SHARED_FIELDS = {
 full_name:'name',age:'age',gender:'gender',cid:'cid',house_no:'house',moo:'moo',tambon:'tambon',
 marital_status:'marital',education:'edu',exposure_years:'exposure-years',risk_job_flag:'job-flag',
 risk_job_type:'job-type',job_detail:'job-detail',job_duration:'job-duration',job_hours:'job-hours',
 diseases:'diseases',phone:'phone',fiscal_year:'fiscal-year',notes:'notes',latitude:'lat',longitude:'lng',
 q2_1:'q2-1',q2_2:'q2-2',date_2q:'date-2q',assessor_2q:'assessor-2q',note_2q:'note-2q'
};
const DETAILED_AS01_FIELDS = {
 weight_kg:'weight',height_cm:'height',
 code:'code',survey_date:'survey-date',target_group:'target-group',cut_point:'cut-point',well_id:'well-id',
 health_center:'hc',interviewer_name:'interviewer',years_in_area:'years-area',disease_flag:'disease-flag',
 swim_duration:'swim-duration',swim_hours:'swim-hours',symptom_flag:'symptom-flag',symptoms:'symptoms'
};
const DETAILED_AS02_FIELDS = {
 code:'code',form_no:'form-no',respondent_id:'fill-from-resp',interview_date:'date',well_id:'well-id',
 weight_kg:'weight',height_cm:'height',years_in_area:'years',hours_at_home:'hours-home',
 work_out_district:'out-district',work_out_days:'out-days',within_1km_river:'within-1km',
 herb_usage:'herb',herb_name:'herb-name',smoking_status:'smoking',smoking_detail:'smoking-detail',
 alcohol_status:'alcohol',seafood_freq:'seafood-freq',seafood_3days:'seafood-3days',
 drink_sources:'drink-sources',drink_years:'drink-years',use_sources:'use-sources',use_years:'use-years',
 food_rice:'food-rice',food_veg:'food-veg',food_fish:'food-fish',food_snail:'food-snail',
 home_grown_veg:'home-veg',home_grown_water:'home-water',eat_river_veg_weekly:'eat-river-veg',
 flood_5years:'flood-5y',interviewer_name:'interviewer',interviewer_role:'role',health_center:'hc'
};
const DETAILED_NUMERIC_FIELDS = new Set(['age','fiscal_year','latitude','longitude','exposure_years','weight_kg','height_cm']);
function detailedFields(stage) {return {...DETAILED_SHARED_FIELDS,...(stage===2?DETAILED_AS02_FIELDS:DETAILED_AS01_FIELDS)};}
function detailedOtherBase(prefix,suffix) {
 const aliases={'target-group':'target','food-rice':'rice','food-veg':'veg','food-fish':'fish','food-snail':'snail'};
 return prefix+'-'+(aliases[suffix]||suffix);
}
function setDetailedField(prefix,suffix,value) {
 const el=document.getElementById(prefix+'-'+suffix);if(!el)return;
 const text=value??'';
 if(suffix==='well-id'&&['resp','as02'].includes(prefix)){populateScreeningWellSelect(prefix+'-well-id',text);return;}
 if(el.tagName==='SELECT'){
  if(!Array.from(el.options).some(o=>o.value===''))el.insertAdjacentHTML('afterbegin','<option value="">-- ยังไม่ระบุ --</option>');
  // Match original options regardless of a legacy numeric prefix; keep all other values verbatim.
  const key=v=>String(v).replace(/^\d+\s*[).]\s*/,'').trim();
  const known=Array.from(el.options).find(o=>o.value!=='OTHER'&&key(o.value)===key(text));
  if(known)el.value=known.value;
  else if(text!==''&&Array.from(el.options).some(o=>o.value==='OTHER')){
   el.value='OTHER';const wrap=document.getElementById(detailedOtherBase(prefix,suffix)+'-other-wrap');
   if(wrap){wrap.style.display='block';const input=wrap.querySelector('input');if(input)input.value=text;}
  }else if(text!==''){
   el.insertAdjacentHTML('beforeend',`<option value="${esc(text)}">${esc(text)}</option>`);el.value=String(text);
  }else el.value='';
 }else el.value=text;
}
function getDetailedField(prefix,suffix) {
 const el=document.getElementById(prefix+'-'+suffix);if(!el)return undefined;
 if(el.tagName==='SELECT'&&el.value==='OTHER')return document.getElementById(detailedOtherBase(prefix,suffix)+'-other')?.value.trim()||'';
 return el.value.trim();
}
function screening2QResult(q1,q2) {
 return q1==='ใช่'||q2==='ใช่'?'พบความเสี่ยง (Positive 2Q)':q1==='ไม่ใช่'&&q2==='ไม่ใช่'?'ปกติ (ไม่พบความเสี่ยง)':'ยังไม่คัดกรอง';
}
function recalcModalAs01_2Q(){setDetailed2QStatus('resp');}
function recalcModalAs02_2Q(){setDetailed2QStatus('as02');}
function setDetailed2QStatus(prefix) {
 const out=document.getElementById(prefix+'-status-2q');if(out)out.value=screening2QResult(getDetailedField(prefix,'q2-1'),getDetailedField(prefix,'q2-2'));
}
function riskFromAssessmentScore(score){return score>=20?'มาก':score>=10?'ปานกลาง':'ต่ำ';}
const recalcOriginalScreeningScore = recalcScore;
recalcScore = function() {
 const context=state.detailedScreening;
 const score=recalcOriginalScreeningScore();
 if(!context||context.stage!==1)return score;
 const complete=document.getElementById('as01-assessment-complete')?.checked;
 const note=document.getElementById('as01-source-score-note');
 if(note)note.textContent=complete?'คะแนนคำนวณจากคำตอบทั้ง 11 ข้อตามค่าน้ำหนักในแบบฟอร์ม':
  historyValuePresent(context.record.total_score)?`คะแนนเดิมตามต้นฉบับ ${context.record.total_score} (${context.record.risk_level||'ไม่ระบุ'}) จะคงไว้จนกว่าจะยืนยันการประเมินครบ 11 ข้อ`:
  'ติ๊กข้อที่ตอบใช่ แล้วกดยืนยันประเมินครบ 11 ข้อ เพื่อบันทึกคะแนนและระดับความเสี่ยง';
 if(!complete){
  const badge=document.getElementById('calc-risk-badge');if(badge){badge.className='risk-badge';badge.textContent='รอยืนยันประเมินครบ 11 ข้อ';}
  setText('calc-measure-text','คะแนนด้านซ้ายเป็นผลรวมคำตอบที่ติ๊กในขณะนี้');
  for(const key of ['low','med','high'])document.getElementById('criteria-row-'+key)?.classList.remove('risk-criteria-row-active');
 }
 return score;
};
function setAS02FormNumberRequirement(isEditing) {
 const input=document.getElementById('as02-form-no');
 if(input){input.required=!isEditing;input.readOnly=false;input.disabled=false;}
 setText('as02-form-no-label',isEditing?'เลขที่แบบฟอร์ม Env-As-02 (ไม่บังคับเมื่อแก้ไข)':'เลขที่แบบฟอร์ม Env-As-02 *');
 setText('as02-form-no-hint',isEditing?'แก้ไขเลขที่แบบฟอร์มได้ หรือเว้นว่างหากยังไม่มีเลข โดยคงข้อมูลรายการเดิมไว้':'เพิ่มรายการใหม่ต้องระบุเลขที่แบบฟอร์ม สามารถแก้เลขที่ได้');
}
function openRestoredScreeningForm(stage,id) {
 state.detailedScreening=null;
 const rows=stage===2?state.envAs02:state.respondents;
 const existing=rows.find(r=>r.id===id);if(id&&!existing)return;
 if(stage===2)openDetailedEnvAs02(id);else openDetailedRespondentModal(id);
 const prefix=stage===2?'as02':'resp',form=document.getElementById(stage===2?'env-as02-form':'respondent-form');
 const editableCode=document.getElementById(stage===2?'as02-form-no':'resp-code');
 if(editableCode){editableCode.readOnly=false;editableCode.disabled=false;}
 const seq=Math.max(0,...rows.map(r=>Number(r.seq)||0))+1;
 const year=fiscalYearFromDate(bangkokToday());
 const record=existing||{id:`MANUAL-${stage}-${Date.now()}`,seq,code:stage===1?`NM${String(seq).padStart(3,'0')}`:'',
  form_no:stage===2?`${String(year).slice(-2)}-${String(seq).padStart(4,'0')}`:'',
  [stage===2?'interview_date':'survey_date']:bangkokToday(),fiscal_year:year,
  amphoe:'แม่อาย',province:'เชียงใหม่',status_2q:'ยังไม่คัดกรอง'};
 state.detailedScreening={stage,record,existing:Boolean(existing),changedAnswers:new Set()};
 for(const [key,suffix] of Object.entries(detailedFields(stage)))setDetailedField(prefix,suffix,record[key]);
 setDetailedField(prefix,'id',record.id);
 setDetailedField(prefix,'amphoe-prov',[record.amphoe,record.province].filter(Boolean).join(' / '));
 if(stage===1){
  document.getElementById('resp-no-cid').checked=Boolean(record.no_cid||record.cid==='ไม่มีเลข 13 หลัก');
  for(let i=1;i<=11;i++){
   const el=document.getElementById('env-q'+i),answer=record['q'+i];
   el.checked=Number(answer)===1;el.indeterminate=!historyValuePresent(answer);
   el.onchange=()=>{el.indeterminate=false;state.detailedScreening.changedAnswers.add(i);recalcScore();};
  }
  document.getElementById('as01-assessment-complete').checked=Array.from({length:11},(_,i)=>record['q'+(i+1)]).every(v=>historyValuePresent(v)&&[0,1].includes(Number(v)));
  for(const [cls,key] of [['as01-occ-chk','risk_job_type'],['as01-dis-chk','diseases'],['as01-sym-chk','symptoms']])populateCheckboxesFromString(cls,record[key]);
  recalcScore();
 }else{
  setAS02FormNumberRequirement(Boolean(existing));
  populateCheckboxesFromString('as02-occ-chk',record.risk_job_type);
  restoreAS02WaterSources(record);
 }
 setDetailedField(prefix,'status-2q',record.status_2q||screening2QResult(record.q2_1,record.q2_2));
 form.onsubmit=e=>saveRestoredScreeningForm(e,stage);
}
function collectRestoredScreeningRecord(stage) {
 const context=state.detailedScreening,prefix=stage===2?'as02':'resp';
 const record={...context.record};
 for(const [key,suffix] of Object.entries(detailedFields(stage))){
  const value=getDetailedField(prefix,suffix);if(value===undefined)continue;
  record[key]=DETAILED_NUMERIC_FIELDS.has(key)?optionalNumber(value):value;
 }
 const area=getDetailedField(prefix,'amphoe-prov')??'';
 const parts=area.split('/').map(s=>s.trim());record.amphoe=parts[0];
 record.province=parts.length>1?parts.slice(1).join(' / '):area?context.record.province||'':'';
 const dateKey=stage===2?'interview_date':'survey_date';
 record.fiscal_year=fiscalYearFromDate(record[dateKey])||Number(record.fiscal_year)||recordFiscalYear(context.record,stage)||fiscalYearFromDate(bangkokToday());
 record.source_tab=(stage===2?'เก็บแม่อาย':'ประเมินแม่อาย')+' '+record.fiscal_year;
 record.recorded_at=context.record.recorded_at||new Date().toISOString();record.updated_at=new Date().toISOString();
 record.updated_by=state.currentUser?.displayName||'ผู้ใช้งาน';
 if(!context.existing){record.source_year=record.fiscal_year;record.dataset=stage===2?'collection':'assessment';record.date_basis='recorded_date_default';}
 else if(record[dateKey]!==context.record[dateKey])record.date_basis='user_entered';
 const qChanged=['q2_1','q2_2'].some(k=>(record[k]||'')!==(context.record[k]||''));
 record.status_2q=qChanged||record.q2_1||record.q2_2?screening2QResult(record.q2_1,record.q2_2):context.record.status_2q||'ยังไม่คัดกรอง';
 if(stage===1){
  record.no_cid=document.getElementById('resp-no-cid').checked;
  if(record.no_cid)record.cid='ไม่มีเลข 13 หลัก';
  if(document.getElementById('as01-assessment-complete').checked){
   record.total_score=0;
   for(let i=1;i<=11;i++){record['q'+i]=document.getElementById('env-q'+i).checked?1:0;record.total_score+=record['q'+i]*ENV_WEIGHTS['q'+i];}
   record.risk_level=riskFromAssessmentScore(record.total_score);record.assessment_complete=true;record.assessment_scoring_basis='Env-As-01_22.05.69(แม่อาย)';
  }else if(!context.existing){record.total_score=null;record.risk_level='ไม่ระบุ';record.assessment_complete=false;}
 }else{
  for(const kind of ['drink','use']){const history=collectAS02WaterSources(kind);record[kind+'_source_years']=history.years;record[kind+'_sources_other']=history.extra;record[kind+'_sources']=formatWaterSources(record,kind);}
  record.history_updated=true;record.history_complete=Boolean(record.interview_date&&record.interviewer_name);
  record.as01_prefill_exclusions={...(context.record.as01_prefill_exclusions||{})};
  for(const field of AS01_HISTORY_FIELDS){
   if(!historyValuePresent(record[field])&&historyValuePresent(context.record[field]))record.as01_prefill_exclusions[field]=true;
   else if(historyValuePresent(record[field]))delete record.as01_prefill_exclusions[field];
  }
  if(context.record.respondent_id&&!record.respondent_id)record.as01_auto_link_disabled=true;
  if(record.respondent_id)record.as01_auto_link_disabled=false;
  fillAS02HistoryFromAS01(record);
  record.link_status=record.respondent_id?'เชื่อมกับ AS-01 แล้ว':'ยังไม่เชื่อมกับ AS-01';
 }
 return record;
}
async function saveRestoredScreeningForm(e,stage) {
 e.preventDefault();
 if(stage===1&&!getDetailedField('resp','code')){alert('กรุณาระบุเลขที่แบบคัดกรอง / รหัส (Code)');return;}
 if(stage===2&&!state.detailedScreening.existing&&!getDetailedField('as02','form-no')){alert('กรุณาระบุเลขที่แบบฟอร์มสำหรับรายการใหม่');return;}
 if(stage===1&&state.detailedScreening.changedAnswers.size&&!document.getElementById('as01-assessment-complete').checked){
  alert('กรุณายืนยันว่าประเมินครบทั้ง 11 ข้อแล้ว ก่อนบันทึกคำตอบและคำนวณคะแนนใหม่');return;
 }
 const record=collectRestoredScreeningRecord(stage);if(!record.full_name){alert('กรุณาระบุชื่อ–นามสกุล');return;}
 if(stage===1&&(historyValuePresent(record.latitude)!==historyValuePresent(record.longitude))){alert('กรุณาระบุพิกัดให้ครบทั้งละติจูดและลองจิจูด หรือเว้นว่างทั้งสองช่องหากยังไม่ทราบ');return;}
 const rows=stage===2?state.envAs02:state.respondents,index=rows.findIndex(r=>r.id===record.id);
 if(index<0)rows.push(record);else rows[index]=record;
 state.fiscalYear=record.fiscal_year;try{localStorage.setItem('MAEAI_ONLINE_FISCAL_YEAR',String(record.fiscal_year));}catch(e){}
 saveLocalData();if(stage===2)closeEnvAs02Modal();else closeRespondentModal();
 await postToGoogleSheets({action:stage===2?'saveEnvAs02':'saveRespondent',data:record});
}
function autofillAs02FromRespondent(id) {
 const source=state.respondents.find(r=>r.id===id);if(!source)return;
 const fields=detailedFields(2);
 for(const key of AS01_HISTORY_FIELDS){if(fields[key]&&historyValuePresent(source[key]))setDetailedField('as02',fields[key],source[key]);}
 setDetailedField('as02','amphoe-prov',[source.amphoe,source.province].filter(Boolean).join(' / '));
 populateCheckboxesFromString('as02-occ-chk',source.risk_job_type);
 restoreAS02WaterSources(source);
 // The current AS-02 interview keeps its own 2Q answers and interview date.
}
