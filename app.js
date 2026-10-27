/**
 * ระบบข้อมูลแหล่งแม่น้ำกก อ.แม่อาย
 * ฐานข้อมูลแหล่งน้ำ 147 บ่อ (สสอ.แม่อาย) และระบบคัดกรองสารหนู (Env-As-01 รวม 283 ราย / Env-As-02)
 * พื้นที่ ต.ท่าตอน และ ต.แม่นาวาง อ.แม่อาย จ.เชียงใหม่
 */

const STORAGE_KEY_WELLS = 'ARSENIC_GIS_WELLS_147_V5';
const STORAGE_KEY_RESPONDENTS = 'ARSENIC_GIS_RESPONDENTS_283_V5';
const STORAGE_KEY_ENV_AS02 = 'ARSENIC_GIS_ENV_AS02_V5';
const STORAGE_KEY_WATER_LABS = 'ARSENIC_GIS_WATER_LABS_V1';
const STORAGE_KEY_KNOWLEDGE_DOCS = 'ARSENIC_GIS_KNOWLEDGE_DOCS_V1';
const STORAGE_KEY_GAS_URL = 'ARSENIC_GIS_GAS_URL_V1';
const STORAGE_KEY_USER = 'ARSENIC_GIS_USER_V1';

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
  pickingMode: null
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
    targetInput.value = checkedVals.join(', ');
  }
  if (flagSelectId) {
    const flagSel = document.getElementById(flagSelectId);
    if (flagSel) {
      if (checkedVals.length > 0) {
        flagSel.value = flagSel.options[1] ? flagSel.options[1].value : 'ใช่';
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

function hasCorruptedEncoding(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return true;
  const sampleStr = JSON.stringify(arr[0]);
  return sampleStr.includes('เธ') || sampleStr.includes('เน');
}

function normalizeWellRecord(w, idx) {
  const d = Number(w.distance_river_m) || 0;
  let distBand = 'มากกว่า 300 เมตร';
  if (d <= 100) distBand = 'ไม่เกิน 100 เมตร';
  else if (d <= 200) distBand = '101 - 200 เมตร';
  else if (d <= 300) distBand = '201 - 300 เมตร';

  let tambon = String(w.tambon || 'ท่าตอน').trim();
  if (tambon === '' || tambon.includes('ม่าตอน')) tambon = 'ท่าตอน';

  let hc = String(w.health_center || '').trim();
  if (hc === 'รพ.สต.ท่ามะแกง') hc = 'รพ.สต.บ้านท่ามะแกง';
  if (hc === '') hc = tambon === 'แม่นาวาง' ? 'รพ.สต.บ้านแม่เมืองน้อย' : 'รพ.สต.บ้านเมืองงาม';

  return {
    ...w,
    seq: Number(w.seq) || (idx + 1),
    tambon: tambon,
    health_center: hc,
    depth_meters: w.depth_meters !== undefined ? w.depth_meters : '',
    distance_river_m: d,
    distance_band: distBand
  };
}

function normalizeRespondentRecord(r, idx) {
  const score = Number(r.total_score) || 0;
  let rLevel = r.risk_level || 'ต่ำ';
  if (rLevel === 'สูง') rLevel = 'มาก';
  if (!['ต่ำ', 'ปานกลาง', 'มาก'].includes(rLevel)) {
    if (score >= 20) rLevel = 'มาก';
    else if (score >= 10) rLevel = 'ปานกลาง';
    else rLevel = 'ต่ำ';
  }

  const codeStr = String(r.code || '');
  const isTarget130 = r.is_urine_target !== undefined
    ? Boolean(r.is_urine_target)
    : (codeStr.startsWith('OCM') || codeStr.startsWith('NM') || codeStr.startsWith('CM'));

  return {
    ...r,
    seq: Number(r.seq) || (idx + 1),
    total_score: score,
    risk_level: rLevel,
    is_urine_target: isTarget130,
    source_tab: r.source_tab || (isTarget130 ? 'รายชื่อเก็บปัสสาวะ (130 ราย)' : 'การตอบกลับ (คัดกรองทั่วไป 153 ราย)'),
    survey_date: r.survey_date || '2026-05-22',
    interviewer_name: r.interviewer_name || 'เจ้าหน้าที่สาธารณสุข อ.แม่อาย',
    tambon: String(r.tambon || 'ท่าตอน').trim()
  };
}

function loadLocalData() {
  try {
    // ล้างคีย์รุ่นเก่าเพื่อให้โหลดข้อมูลครบทั้ง 283 รายการ (แท็บการตอบกลับ + เก็บปัสสาวะ)
    ['ARSENIC_GIS_WELLS_V1', 'ARSENIC_GIS_RESPONDENTS_V1', 'ARSENIC_GIS_WELLS_147_V2', 'ARSENIC_GIS_RESPONDENTS_130_V2', 'ARSENIC_GIS_WELLS_147_V3', 'ARSENIC_GIS_RESPONDENTS_130_V3'].forEach(k => localStorage.removeItem(k));

    const savedWells = localStorage.getItem(STORAGE_KEY_WELLS);
    const savedResps = localStorage.getItem(STORAGE_KEY_RESPONDENTS);
    const savedAs02 = localStorage.getItem(STORAGE_KEY_ENV_AS02);
    const savedLabs = localStorage.getItem(STORAGE_KEY_WATER_LABS);
    const savedDocs = localStorage.getItem(STORAGE_KEY_KNOWLEDGE_DOCS);
    const savedGasUrl = localStorage.getItem(STORAGE_KEY_GAS_URL);

    let parsedWells = savedWells ? JSON.parse(savedWells) : null;
    let parsedResps = savedResps ? JSON.parse(savedResps) : null;
    let parsedAs02 = savedAs02 ? JSON.parse(savedAs02) : null;
    let parsedLabs = savedLabs ? JSON.parse(savedLabs) : null;
    let parsedDocs = savedDocs ? JSON.parse(savedDocs) : null;

    if (!parsedWells || hasCorruptedEncoding(parsedWells)) {
      parsedWells = [...INITIAL_WELLS];
    }
    if (!parsedResps || hasCorruptedEncoding(parsedResps) || parsedResps.length < 280) {
      parsedResps = [...INITIAL_RESPONDENTS];
    }
    if (!parsedAs02 || hasCorruptedEncoding(parsedAs02)) {
      parsedAs02 = typeof INITIAL_ENV_AS02 !== 'undefined' ? [...INITIAL_ENV_AS02] : [];
    }
    if (!parsedLabs || !Array.isArray(parsedLabs) || parsedLabs.length === 0) {
      parsedLabs = [...INITIAL_WATER_LABS];
    }
    if (!parsedDocs || !Array.isArray(parsedDocs) || parsedDocs.length === 0) {
      parsedDocs = [...INITIAL_KNOWLEDGE_DOCS];
    }

    state.wells = parsedWells.map(normalizeWellRecord);
    state.respondents = parsedResps.map(normalizeRespondentRecord);
    state.envAs02 = parsedAs02;
    state.waterLabs = parsedLabs;
    state.knowledgeDocs = parsedDocs;
    state.gasUrl = savedGasUrl || '';

    const gasInput = document.getElementById('gas-url-input');
    if (gasInput && state.gasUrl) {
      gasInput.value = state.gasUrl;
      updateSyncBadge(true);
    }
  } catch (err) {
    console.error('Error loading localStorage:', err);
    state.wells = INITIAL_WELLS.map(normalizeWellRecord);
    state.respondents = INITIAL_RESPONDENTS.map(normalizeRespondentRecord);
    state.envAs02 = typeof INITIAL_ENV_AS02 !== 'undefined' ? [...INITIAL_ENV_AS02] : [];
    state.waterLabs = [...INITIAL_WATER_LABS];
    state.knowledgeDocs = [...INITIAL_KNOWLEDGE_DOCS];
  }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY_WELLS, JSON.stringify(state.wells));
  localStorage.setItem(STORAGE_KEY_RESPONDENTS, JSON.stringify(state.respondents));
  localStorage.setItem(STORAGE_KEY_ENV_AS02, JSON.stringify(state.envAs02));
  localStorage.setItem(STORAGE_KEY_WATER_LABS, JSON.stringify(state.waterLabs));
  try {
    localStorage.setItem(STORAGE_KEY_KNOWLEDGE_DOCS, JSON.stringify(state.knowledgeDocs));
  } catch (e) {
    console.warn('Knowledge docs storage quota:', e);
  }
  refreshAllViews();
}

// ==================== AUTHENTICATION (LOGIN / LOGOUT) ====================
function checkSavedSession() {
  const savedUser = sessionStorage.getItem(STORAGE_KEY_USER);
  if (savedUser) {
    state.currentUser = JSON.parse(savedUser);
    enterApplication();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl = document.getElementById('login-error');

  const validAccounts = {
    admin: { pass: '1234', displayName: 'ผู้ดูแลระบบ (Admin สสอ.)', role: 'admin' },
    staff: { pass: '1234', displayName: 'เจ้าหน้าที่ รพ.สต. (Staff)', role: 'staff' },
    maeai: { pass: '1234', displayName: 'สาธารณสุขอำเภอแม่อาย', role: 'admin' }
  };

  if (validAccounts[username] && validAccounts[username].pass === password) {
    errEl.style.display = 'none';
    state.currentUser = {
      username,
      displayName: validAccounts[username].displayName,
      role: validAccounts[username].role
    };
    sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(state.currentUser));
    enterApplication();
  } else {
    errEl.style.display = 'block';
  }
}

function handleLogout() {
  sessionStorage.removeItem(STORAGE_KEY_USER);
  state.currentUser = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function enterApplication() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  document.getElementById('current-user-display').textContent = state.currentUser.displayName;

  if (!state.map) {
    initMap();
    fetchLocalWeather();
  }
  refreshAllViews();
}

// ==================== NAVIGATION TABS ====================
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  const btn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  if (tabId === 'tab-map' && state.map) {
    setTimeout(() => {
      state.map.invalidateSize();
    }, 150);
  }
}

function switchScreeningSubTab(mode) {
  const sub1 = document.getElementById('subview-as01');
  const sub2 = document.getElementById('subview-as02');
  const btn1 = document.getElementById('btn-subtab-as01');
  const btn2 = document.getElementById('btn-subtab-as02');

  if (mode === 'as01') {
    sub1.style.display = 'block';
    sub2.style.display = 'none';
    btn1.className = 'btn btn-primary';
    btn2.className = 'btn btn-outline';
  } else {
    sub1.style.display = 'none';
    sub2.style.display = 'block';
    btn1.className = 'btn btn-outline';
    btn2.className = 'btn btn-primary';
  }
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

      const popupHtml = `
        <div style="min-width:260px; font-family:'Sarabun',sans-serif;">
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
            <b>รพ.สต.:</b> ${well.health_center || '-'}
          </div>
          <hr style="margin:6px 0; border:none; border-top:1px solid #e2e8f0;"/>
          <div style="font-size:12px;">
            <b>👥 กลุ่มเป้าหมายที่เชื่อมโยงกับบ่อนี้ (${linkedUsers.length} ราย):</b>
            <ul style="padding-left:16px; margin:4px 0;">${userNamesHtml || '<li>ยังไม่มีรายชื่อผูกตรง</li>'}${moreCount}</ul>
          </div>
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button onclick="openWellModal('${well.well_id}')" style="padding:4px 8px; background:#0f766e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">แก้ไขบ่อน้ำ</button>
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
        <div style="min-width:240px; font-family:'Sarabun',sans-serif;">
          <div style="font-weight:700; font-size:14px; color:#0f172a;">
            👤 ${person.full_name} <span style="color:#0284c7;">(${person.code || '-'})</span>
          </div>
          <div style="font-size:12.5px; margin-top:4px; line-height:1.45;">
            <b>อายุ/เพศ:</b> ${person.age || '-'} ปี (${person.gender})<br/>
            <b>ที่อยู่:</b> บ้านเลขที่ ${person.house_no || '-'} หมู่ ${person.moo} ต.${person.tambon}<br/>
            <b>กลุ่มเป้าหมาย:</b> ${person.target_group} (${person.cut_point || '-'})<br/>
            <b>อาชีพ:</b> ${person.risk_job_type || 'ทั่วไป'} ${person.job_detail ? '(' + person.job_detail + ')' : ''}<br/>
            <b>แหล่งน้ำที่เชื่อมโยง:</b> <span style="color:#0f766e; font-weight:600;">[${person.well_id}] ${linkedWell ? linkedWell.well_name : ''}</span>
          </div>
          <div style="margin-top:6px; padding:6px 8px; background:#f1f5f9; border-radius:6px; font-size:12.5px;">
            คะแนนความเสี่ยง: <b>${person.total_score}</b> คะแนน &rarr; 
            <b style="color:${fillColor}">ระดับ${person.risk_level}</b>
          </div>
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button onclick="openRespondentModal('${person.id}')" style="padding:4px 8px; background:#16a34a; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
              แก้ไข Env-As-01
            </button>
            <button onclick="openEnvAs02ForRespondent('${person.id}')" style="padding:4px 8px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
              ซักประวัติ Env-As-02
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

function updateKpiCards() {
  const totalWells = state.wells.length;
  const shallowCount = state.wells.filter(w => w.well_type === 'บ่อน้ำตื้น').length;
  const groundwaterCount = state.wells.filter(w => w.well_type === 'บ่อบาดาล').length;
  const mountainCount = state.wells.filter(w => w.well_type === 'ประปาภูเขา').length;
  const sampleCount = state.wells.filter(w => w.sample_code && w.sample_code !== '').length;
  const near100Count = state.wells.filter(w => Number(w.distance_river_m) <= 100).length;

  const totalResp = state.respondents.length;
  const lowCount = state.respondents.filter(r => r.risk_level === 'ต่ำ').length;
  const medCount = state.respondents.filter(r => r.risk_level === 'ปานกลาง').length;
  const highCount = state.respondents.filter(r => r.risk_level === 'มาก').length;

  const thatonCount = state.respondents.filter(r => r.tambon === 'ท่าตอน').length;
  const maenawangCount = state.respondents.filter(r => r.tambon === 'แม่นาวาง').length;

  document.getElementById('nav-well-count').textContent = totalWells;
  document.getElementById('nav-resp-count').textContent = totalResp;
  if (document.getElementById('nav-lab-count')) {
    document.getElementById('nav-lab-count').textContent = state.waterLabs ? state.waterLabs.length : 0;
  }
  document.getElementById('kpi-total-wells').textContent = totalWells;
  document.getElementById('kpi-well-sub').textContent = `บาดาล ${groundwaterCount} | น้ำตื้น ${shallowCount} | ประปาภูเขา ${mountainCount}`;
  document.getElementById('kpi-sample-wells').textContent = sampleCount;
  document.getElementById('kpi-near-wells').textContent = near100Count;
  document.getElementById('kpi-total-resp').textContent = `${totalResp} / ${state.envAs02.length}`;
  document.getElementById('kpi-tambon-sub').textContent = `Env-As-01 (${totalResp}) | Env-As-02 (${state.envAs02.length})`;
  document.getElementById('kpi-risk-alert').textContent = medCount + highCount;
  document.getElementById('kpi-risk-sub').textContent = `ต่ำ ${lowCount} | ปานกลาง ${medCount} | สูง ${highCount}`;
}

function renderExecutiveDashboard() {
  const totalWells = Math.max(1, state.wells.length);

  // 1. กราฟประเภทแหล่งน้ำ
  const typesData = [
    { label: 'บ่อบาดาล', count: state.wells.filter(w => w.well_type === 'บ่อบาดาล').length, color: '#0284c7' },
    { label: 'บ่อน้ำตื้น (ส่งตรวจ P1-P43)', count: state.wells.filter(w => w.well_type === 'บ่อน้ำตื้น').length, color: '#e11d48' },
    { label: 'ประปาภูเขา', count: state.wells.filter(w => w.well_type === 'ประปาภูเขา').length, color: '#0f766e' }
  ];
  const typeContainer = document.getElementById('chart-well-types');
  if (typeContainer) {
    typeContainer.innerHTML = typesData.map(item => {
      const pct = ((item.count / totalWells) * 100).toFixed(1);
      return `
        <div class="bar-row" onclick="filterWellByTypeClick('${item.label.split(' ')[0]}')">
          <div class="bar-label-line">
            <span>${item.label}</span>
            <strong>${item.count} บ่อ (${pct}%)</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${item.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. กราฟระยะห่างจากแม่น้ำกก (ใช้ค่าตัวเลข distance_river_m โดยตรงเพื่อความแม่นยำ 100%)
  const distRanges = [
    { label: 'ไม่เกิน 100 เมตร (ใกล้ลำน้ำกกมาก)', key: 'ไม่เกิน 100 เมตร', count: state.wells.filter(w => Number(w.distance_river_m) <= 100).length, color: '#dc2626' },
    { label: '101 - 200 เมตร', key: '101 - 200 เมตร', count: state.wells.filter(w => Number(w.distance_river_m) > 100 && Number(w.distance_river_m) <= 200).length, color: '#f97316' },
    { label: '201 - 300 เมตร', key: '201 - 300 เมตร', count: state.wells.filter(w => Number(w.distance_river_m) > 200 && Number(w.distance_river_m) <= 300).length, color: '#eab308' },
    { label: 'มากกว่า 300 เมตร', key: 'มากกว่า 300 เมตร', count: state.wells.filter(w => Number(w.distance_river_m) > 300).length, color: '#22c55e' }
  ];
  const distContainer = document.getElementById('chart-well-distance');
  if (distContainer) {
    distContainer.innerHTML = distRanges.map(b => {
      const pct = ((b.count / totalWells) * 100).toFixed(1);
      return `
        <div class="bar-row" onclick="filterWellByDistClick('${b.key}')">
          <div class="bar-label-line">
            <span>${b.label}</span>
            <strong>${b.count} บ่อ (${pct}%)</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${b.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. กราฟแยกตาม รพ.สต.
  const hcNames = ['รพ.สต.บ้านท่าตอน', 'รพ.สต.บ้านท่ามะแกง', 'รพ.สต.บ้านเมืองงาม', 'รพ.สต.บ้านแม่เมืองน้อย'];
  const hcColors = ['#0f766e', '#0284c7', '#7c3aed', '#d97706'];
  const hcContainer = document.getElementById('chart-well-hc');
  if (hcContainer) {
    hcContainer.innerHTML = hcNames.map((hc, idx) => {
      const c = state.wells.filter(w => w.health_center === hc).length;
      const pct = ((c / totalWells) * 100).toFixed(1);
      return `
        <div class="bar-row" onclick="filterWellByHcClick('${hc}')">
          <div class="bar-label-line">
            <span>${hc}</span>
            <strong>${c} บ่อ (${pct}%)</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${hcColors[idx % hcColors.length]};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. ตารางสรุปแหล่งน้ำแยกตาม ตำบล / หมู่บ้าน
  const mooGroups = {};
  state.wells.forEach(w => {
    const key = `${w.tambon}|${w.moo}`;
    if (!mooGroups[key]) {
      mooGroups[key] = {
        tambon: w.tambon,
        moo: w.moo,
        hc: w.health_center,
        shallow: 0,
        groundwater: 0,
        mountain: 0,
        total: 0,
        sample: 0,
        users: 0
      };
    }
    const g = mooGroups[key];
    if (w.well_type === 'บ่อน้ำตื้น') g.shallow++;
    else if (w.well_type === 'บ่อบาดาล') g.groundwater++;
    else if (w.well_type === 'ประปาภูเขา') g.mountain++;
    g.total++;
    if (w.sample_code) g.sample++;
    g.users += Number(w.user_count) || 1;
  });

  const sortedMoo = Object.values(mooGroups).sort((a, b) => {
    if (a.tambon !== b.tambon) return a.tambon.localeCompare(b.tambon, 'th');
    return Number(a.moo) - Number(b.moo);
  });

  const mooBody = document.getElementById('dash-moo-breakdown-body');
  if (mooBody) {
    let sumShallow = 0, sumGround = 0, sumMtn = 0, sumTot = 0, sumSample = 0, sumUsers = 0;
    const rowsHtml = sortedMoo.map(g => {
      sumShallow += g.shallow;
      sumGround += g.groundwater;
      sumMtn += g.mountain;
      sumTot += g.total;
      sumSample += g.sample;
      sumUsers += g.users;
      return `
        <tr>
          <td><b>ต.${g.tambon} หมู่ที่ ${g.moo}</b></td>
          <td>${g.hc}</td>
          <td class="text-center">${g.shallow || '-'}</td>
          <td class="text-center">${g.groundwater || '-'}</td>
          <td class="text-center">${g.mountain || '-'}</td>
          <td class="text-center"><b>${g.total}</b></td>
          <td class="text-center"><span class="risk-badge status-danger">${g.sample || 0}</span></td>
          <td class="text-center">${g.users} คน</td>
        </tr>
      `;
    }).join('');

    mooBody.innerHTML = rowsHtml + `
      <tr style="background:#f1f5f9; font-weight:700;">
        <td colspan="2">รวมทั้งหมด (${sortedMoo.length} หมู่บ้านเป้าหมาย)</td>
        <td class="text-center">${sumShallow}</td>
        <td class="text-center">${sumGround}</td>
        <td class="text-center">${sumMtn}</td>
        <td class="text-center">${sumTot}</td>
        <td class="text-center">${sumSample}</td>
        <td class="text-center">${sumUsers} คน</td>
      </tr>
    `;
  }

  // 5. กราฟและตารางสรุประดับความเสี่ยง (รองรับทั้งแท็บการตอบกลับ 283 ราย และแท็บเก็บปัสสาวะ 130 ราย)
  const tabFilterEl = document.getElementById('dash-resp-tab-filter');
  const dashTabMode = tabFilterEl ? tabFilterEl.value : 'ALL';
  const dashRespPool = state.respondents.filter(r => {
    if (dashTabMode === 'TARGET_130') return Boolean(r.is_urine_target);
    if (dashTabMode === 'GENERAL_153') return !Boolean(r.is_urine_target);
    return true;
  });

  const totalResp = Math.max(1, dashRespPool.length);
  const riskLevels = [
    { label: 'กลุ่มโอกาสสัมผัสสารหนู ต่ำ', range: '0 - <10', key: 'ต่ำ', color: '#16a34a', badge: 'risk-low', measure: 'สื่อสารความเสี่ยง ให้สุขศึกษา ประเมินซ้ำทุก 1 ปี' },
    { label: 'กลุ่มโอกาสสัมผัสสารหนู ปานกลาง', range: '10 - 20', key: 'ปานกลาง', color: '#f97316', badge: 'risk-med', measure: 'ซักประวัติ Env-As-02 & ตรวจสารหนูในปัสสาวะ' },
    { label: 'กลุ่มโอกาสสัมผัสสารหนู สูง/มาก', range: '> 20', key: 'มาก', color: '#dc2626', badge: 'risk-high', measure: 'พบแพทย์ตรวจร่างกาย & ตรวจสารหนูในปัสสาวะ' }
  ];

  const respRiskContainer = document.getElementById('chart-resp-risk');
  if (respRiskContainer) {
    respRiskContainer.innerHTML = riskLevels.map(r => {
      const c = dashRespPool.filter(p => p.risk_level === r.key).length;
      const pct = ((c / totalResp) * 100).toFixed(1);
      return `
        <div class="bar-row" onclick="filterByRiskFromKpi('${r.key}')">
          <div class="bar-label-line">
            <span>${r.label} (${r.range} คะแนน)</span>
            <strong>${c} ราย (${pct}%)</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${r.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const riskMatrixBody = document.getElementById('dash-risk-matrix-body');
  if (riskMatrixBody) {
    riskMatrixBody.innerHTML = riskLevels.map(r => {
      const thaton = dashRespPool.filter(p => p.risk_level === r.key && p.tambon === 'ท่าตอน').length;
      const maenawang = dashRespPool.filter(p => p.risk_level === r.key && p.tambon === 'แม่นาวาง').length;
      const tot = thaton + maenawang;
      return `
        <tr>
          <td><span class="risk-badge ${r.badge}">${r.key}</span></td>
          <td>${r.range}</td>
          <td>${thaton}</td>
          <td>${maenawang}</td>
          <td><b>${tot}</b></td>
          <td style="text-align:left; font-size:12px;">${r.measure}</td>
        </tr>
      `;
    }).join('');
  }

  renderPivotSummary();
}

function renderDashboard() {
  renderExecutiveDashboard();
}

// ==================== SCREENING TAB (ENV-AS-01 & ENV-AS-02 DASHBOARD + CRUD) ====================
function renderScreeningDashboardAndTables() {
  const totalAs01 = Math.max(1, state.respondents.length);
  const totalAs02 = Math.max(1, state.envAs02.length);

  const c1El = document.getElementById('scr-as01-count');
  const c2El = document.getElementById('scr-as02-count');
  if (c1El) c1El.textContent = state.respondents.length;
  if (c2El) c2El.textContent = state.envAs02.length;

  // 1. กราฟ Env-As-01 Risk
  const scrRiskEl = document.getElementById('scr-chart-as01-risk');
  if (scrRiskEl) {
    const rData = [
      { label: 'ความเสี่ยงต่ำ (0 - <10)', key: 'ต่ำ', color: '#16a34a' },
      { label: 'ความเสี่ยงปานกลาง (10 - 20)', key: 'ปานกลาง', color: '#f97316' },
      { label: 'ความเสี่ยงมาก/สูง (> 20)', key: 'มาก', color: '#dc2626' }
    ];
    scrRiskEl.innerHTML = rData.map(item => {
      const cnt = state.respondents.filter(r => r.risk_level === item.key).length;
      const pct = ((cnt / totalAs01) * 100).toFixed(1);
      return `
        <div class="bar-row">
          <div class="bar-label-line"><span>${item.label}</span><strong>${cnt} ราย (${pct}%)</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${item.color};"></div></div>
        </div>
      `;
    }).join('');
  }

  // 2. กราฟพฤติกรรมเสี่ยงสูงสุดจาก 11 ข้อใน Env-As-01
  const scrQuestionsEl = document.getElementById('scr-chart-as01-questions');
  if (scrQuestionsEl) {
    const qLabels = [
      { key: 'q7', label: 'ข้อ 7: พักอาศัยในพื้นที่ > 5 ปี' },
      { key: 'q6', label: 'ข้อ 6: บ้านอยู่ในรัศมี 1 กม. จากแม่น้ำกก' },
      { key: 'q2', label: 'ข้อ 2: ดื่ม/ใช้น้ำบ่อตื้น/บาดาลประกอบอาหาร' },
      { key: 'q11', label: 'ข้อ 11: กินพืชผักที่ปลูกริมน้ำกกประจำ' },
      { key: 'q5', label: 'ข้อ 5: ทำงานสัมผัสน้ำจากแม่น้ำปนเปื้อน' },
      { key: 'q10', label: 'ข้อ 10: เคยมีน้ำหลากเข้าบ้านในรอบ 5 ปี' }
    ];
    scrQuestionsEl.innerHTML = qLabels.map(q => {
      const cnt = state.respondents.filter(r => Number(r[q.key]) === 1).length;
      const pct = ((cnt / totalAs01) * 100).toFixed(1);
      return `
        <div class="bar-row">
          <div class="bar-label-line"><span>${q.label}</span><strong>${cnt} ราย (${pct}%)</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:#0284c7;"></div></div>
        </div>
      `;
    }).join('');
  }

  // 3. กราฟสรุป Env-As-02 (ก่อนเก็บตัวอย่างทางชีวภาพ)
  const scrAs02El = document.getElementById('scr-chart-as02-summary');
  if (scrAs02El) {
    const within1km = state.envAs02.filter(x => String(x.within_1km_river).includes('ใช่')).length;
    const drinkWell = state.envAs02.filter(x => String(x.drink_sources).includes('บ่อ')).length;
    const growVeg = state.envAs02.filter(x => String(x.food_veg).includes('ปลูกเอง') || String(x.eat_river_veg_weekly).includes('ใช่')).length;
    const seafood3d = state.envAs02.filter(x => String(x.seafood_3days).includes('ใช่') && !String(x.seafood_3days).includes('ไม่ใช่')).length;
    const herbUse = state.envAs02.filter(x => x.herb_usage && !String(x.herb_usage).includes('ไม่ได้กิน')).length;

    const metrics = [
      { label: 'พักในรัศมี 1 กม. จากแม่น้ำปนเปื้อน', cnt: within1km, color: '#0f766e' },
      { label: 'ดื่มน้ำจากบ่อน้ำตื้น/บ่อบาดาล', cnt: drinkWell, color: '#d97706' },
      { label: 'กินพืชผักปลูกเอง/ริมน้ำปนเปื้อน', cnt: growVeg, color: '#16a34a' },
      { label: 'กินอาหารทะเลใน 3 วันก่อนตรวจปัสสาวะ', cnt: seafood3d, color: '#e11d48' },
      { label: 'ใช้ยาสมุนไพร/ยาลูกกลอนใน 3 เดือน', cnt: herbUse, color: '#7c3aed' }
    ];

    scrAs02El.innerHTML = metrics.map(m => {
      const pct = ((m.cnt / totalAs02) * 100).toFixed(1);
      return `
        <div class="bar-row">
          <div class="bar-label-line"><span>${m.label}</span><strong>${m.cnt} ราย (${pct}%)</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${m.color};"></div></div>
        </div>
      `;
    }).join('');
  }

  renderScreeningAs01Table();
  renderScreeningAs02Table();
}

function renderScreeningAs01Table() {
  const tbody = document.getElementById('scr-as01-tbody');
  if (!tbody) return;
  const q = (document.getElementById('scr-as01-search').value || '').toLowerCase().trim();
  const tabSel = document.getElementById('scr-as01-tab') ? document.getElementById('scr-as01-tab').value : 'ALL';
  const risk = document.getElementById('scr-as01-risk').value;

  const filtered = state.respondents.filter(r => {
    if (tabSel === 'TARGET_130' && !r.is_urine_target) return false;
    if (tabSel === 'GENERAL_153' && r.is_urine_target) return false;
    if (risk !== 'ALL' && r.risk_level !== risk) return false;
    if (q) {
      const hay = `${r.code} ${r.full_name} ${r.cid} ${r.house_no} ${r.tambon} ${r.source_tab}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  tbody.innerHTML = filtered.map(r => {
    let badgeClass = 'risk-low';
    let measure = 'สื่อสารความเสี่ยง / ประเมินทุก 1 ปี';
    if (r.risk_level === 'ปานกลาง') {
      badgeClass = 'risk-med';
      measure = 'ซักประวัติ Env-As-02 & ตรวจปัสสาวะ';
    } else if (r.risk_level === 'มาก') {
      badgeClass = 'risk-high';
      measure = 'พบแพทย์ & ตรวจสารหนูในปัสสาวะ';
    }
    const tabBadge = r.is_urine_target
      ? `<span class="badge" style="background:#dcfce7;color:#15803d;font-size:11px;">เก็บปัสสาวะ (130)</span>`
      : `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:11px;">การตอบกลับ (ทั่วไป)</span>`;

    return `
      <tr>
        <td><b>${r.code || r.id}</b><div style="margin-top:2px;">${tabBadge}</div></td>
        <td>${r.survey_date || '2026-05-22'}<br/><small style="color:#64748b;">${r.interviewer_name || ''}</small></td>
        <td><b>${r.full_name}</b></td>
        <td>${r.age || '-'} ปี / ${r.gender ? r.gender.replace('1) ', '').replace('2) ', '') : '-'}</td>
        <td>${r.cid || '-'}</td>
        <td>บ้าน ${r.house_no || '-'} ม.${r.moo} ต.${r.tambon}</td>
        <td>${r.risk_job_type || 'ไม่ใช่'} ${r.job_detail ? `<small>(${r.job_detail})</small>` : ''}</td>
        <td>
          <div>โรค: ${r.diseases || 'ไม่มี'}</div>
          ${r.symptoms ? `<div style="color:#dc2626;font-size:11.5px;">อาการ: ${r.symptoms}</div>` : ''}
        </td>
        <td><b>${r.total_score}</b> / 30.5</td>
        <td><span class="risk-badge ${badgeClass}">${r.risk_level}</span></td>
        <td><small>${measure}</small></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="openRespondentModal('${r.id}')" title="แก้ไข Env-As-01"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-success" onclick="openEnvAs02ForRespondent('${r.id}')" title="ซักประวัติต่อใน Env-As-02"><i class="fa-solid fa-vial"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteRespondent('${r.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderScreeningAs02Table() {
  const tbody = document.getElementById('scr-as02-tbody');
  if (!tbody) return;
  const q = (document.getElementById('scr-as02-search').value || '').toLowerCase().trim();

  const filtered = state.envAs02.filter(item => {
    if (!q) return true;
    const hay = `${item.form_no} ${item.full_name} ${item.phone} ${item.tambon} ${item.health_center}`.toLowerCase();
    return hay.includes(q);
  });

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td><b>${item.form_no}</b></td>
      <td>${item.interview_date || '2026-05-22'}</td>
      <td><b>${item.full_name}</b></td>
      <td>${item.age || '-'} ปี | ${item.weight_kg || '-'} กก. / ${item.height_cm || '-'} ซม.</td>
      <td>${item.phone || '-'}</td>
      <td>บ้าน ${item.house_no || '-'} ม.${item.moo} ต.${item.tambon} (${item.within_1km_river})</td>
      <td>สมุนไพร: ${item.herb_usage}<br/><small>บุหรี่: ${item.smoking_status} | สุรา: ${item.alcohol_status}</small></td>
      <td>${item.seafood_freq}<br/><b>3 วันก่อนตรวจ: ${item.seafood_3days}</b></td>
      <td>ดื่ม: ${item.drink_sources} ${item.drink_years ? `(${item.drink_years} ปี)` : ''}<br/><small>ใช้: ${item.use_sources} ${item.use_years ? `(${item.use_years} ปี)` : ''}</small></td>
      <td>ข้าว: ${item.food_rice}<br/><small>ผัก: ${item.food_veg}</small></td>
      <td>${item.interviewer_name || '-'}<br/><small>${item.health_center || '-'}</small></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm btn-primary" onclick="openEnvAs02Modal('${item.id}')" title="แก้ไข Env-As-02"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteEnvAs02('${item.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

// ==================== ENV-AS-02 MODAL & CRUD ====================
function populateAs02RespondentDropdown() {
  const sel = document.getElementById('as02-fill-from-resp');
  if (!sel) return;
  sel.innerHTML = `<option value="">-- เลือกเพื่อดึงข้อมูลส่วนบุคคลจาก Env-As-01 (283 ราย) อัตโนมัติ --</option>` +
    state.respondents.map(r => `<option value="${r.id}">[${r.code}] ${r.full_name} (ม.${r.moo} ต.${r.tambon} - คะแนน ${r.total_score})</option>`).join('');
}

function autofillAs02FromRespondent(respId) {
  const r = state.respondents.find(x => x.id === respId);
  if (!r) return;
  document.getElementById('as02-name').value = r.full_name || '';
  document.getElementById('as02-age').value = r.age || '';
  setSelectOrOther('as02-gender', 'as02-gender-other-wrap', 'as02-gender-other', r.gender || '1) ชาย');
  document.getElementById('as02-cid').value = r.cid || '';
  document.getElementById('as02-house').value = r.house_no || '';
  document.getElementById('as02-moo').value = r.moo || '';
  setSelectOrOther('as02-tambon', 'as02-tambon-other-wrap', 'as02-tambon-other', r.tambon || 'ท่าตอน');
  setSelectOrOther('as02-marital', 'as02-marital-other-wrap', 'as02-marital-other', r.marital_status || '2) คู่');
  setSelectOrOther('as02-edu', 'as02-edu-other-wrap', 'as02-edu-other', r.education || '1) ไม่ได้เรียนหนังสือ');
  document.getElementById('as02-years').value = r.years_in_area || '';
  document.getElementById('as02-well-id').value = r.well_id || '';
  document.getElementById('as02-within-1km').value = r.q6 ? '1.ใช่' : '2.ไม่ใช่';
  if (document.getElementById('as02-job-flag')) document.getElementById('as02-job-flag').value = r.risk_job_flag || 'ไม่ใช่';
  document.getElementById('as02-job-type').value = r.risk_job_type || '';
  populateCheckboxesFromString('as02-occ-chk', r.risk_job_type);
  document.getElementById('as02-job-detail').value = `${r.job_detail || ''} ${r.job_duration ? '(' + r.job_duration + ')' : ''}`.trim();
  document.getElementById('as02-diseases').value = r.diseases || 'ไม่มี';
  document.getElementById('as02-eat-river-veg').value = r.q11 ? '1.ใช่' : '2.ไม่ใช่';
  document.getElementById('as02-flood-5y').value = r.q10 ? '1.เคย' : '2.ไม่เคย';
}

function openEnvAs02ForRespondent(respId) {
  openEnvAs02Modal(null);
  document.getElementById('as02-fill-from-resp').value = respId;
  autofillAs02FromRespondent(respId);
}

function openEnvAs02Modal(id = null) {
  populateAs02RespondentDropdown();
  const modal = document.getElementById('env-as02-modal');
  const title = document.getElementById('as02-modal-title');
  document.getElementById('env-as02-form').reset();
  document.querySelectorAll('#env-as02-form .other-input-wrap').forEach(w => { w.style.display = 'none'; });
  document.querySelectorAll('.as02-occ-chk, .as02-drk-chk, .as02-use-chk').forEach(c => { c.checked = false; });

  if (id) {
    const item = state.envAs02.find(x => x.id === id);
    if (!item) return;
    title.innerHTML = `<i class="fa-solid fa-vial-circle-check"></i> แก้ไขแบบฟอร์ม Env-As-02 (${item.form_no}: ${item.full_name})`;
    document.getElementById('as02-id').value = item.id;
    document.getElementById('as02-form-no').value = item.form_no || '';
    document.getElementById('as02-date').value = item.interview_date || '2026-10-27';
    document.getElementById('as02-well-id').value = item.well_id || '';
    document.getElementById('as02-name').value = item.full_name || '';
    document.getElementById('as02-age').value = item.age || '';
    document.getElementById('as02-phone').value = item.phone || '';
    document.getElementById('as02-cid').value = item.cid || '';
    setSelectOrOther('as02-gender', 'as02-gender-other-wrap', 'as02-gender-other', item.gender || '1) ชาย');
    document.getElementById('as02-weight').value = item.weight_kg || '';
    document.getElementById('as02-height').value = item.height_cm || '';
    document.getElementById('as02-house').value = item.house_no || '';
    document.getElementById('as02-moo').value = item.moo || '';
    setSelectOrOther('as02-tambon', 'as02-tambon-other-wrap', 'as02-tambon-other', item.tambon || 'ท่าตอน');
    setSelectOrOther('as02-marital', 'as02-marital-other-wrap', 'as02-marital-other', item.marital_status || '2) คู่');
    setSelectOrOther('as02-edu', 'as02-edu-other-wrap', 'as02-edu-other', item.education || '1) ไม่ได้เรียนหนังสือ');
    document.getElementById('as02-years').value = item.years_in_area || '';
    document.getElementById('as02-hours-home').value = item.hours_at_home || 12;
    document.getElementById('as02-out-district').value = item.work_out_district || 'ไม่ใช่';
    document.getElementById('as02-out-days').value = item.work_out_days || 0;
    document.getElementById('as02-within-1km').value = item.within_1km_river || '1.ใช่';
    if (document.getElementById('as02-job-flag')) document.getElementById('as02-job-flag').value = item.risk_job_flag || (item.risk_job_type ? 'ใช่' : 'ไม่ใช่');
    document.getElementById('as02-job-type').value = item.risk_job_type || '';
    populateCheckboxesFromString('as02-occ-chk', item.risk_job_type);
    document.getElementById('as02-job-detail').value = item.job_detail || '';
    document.getElementById('as02-diseases').value = item.diseases || '';
    setSelectOrOther('as02-herb', 'as02-herb-other-wrap', 'as02-herb-other', item.herb_usage || '5. ไม่ได้กิน');
    document.getElementById('as02-herb-name').value = item.herb_name || '';
    setSelectOrOther('as02-smoking', 'as02-smoking-other-wrap', 'as02-smoking-other', item.smoking_status || '1. ไม่สูบ');
    if (document.getElementById('as02-smoking-detail')) document.getElementById('as02-smoking-detail').value = item.smoking_detail || '';
    setSelectOrOther('as02-alcohol', 'as02-alcohol-other-wrap', 'as02-alcohol-other', item.alcohol_status || '1. ไม่ดื่ม');
    document.getElementById('as02-seafood-freq').value = item.seafood_freq || '5. ไม่ได้กิน';
    document.getElementById('as02-seafood-3days').value = item.seafood_3days || '2. ไม่ใช่';
    document.getElementById('as02-drink-sources').value = item.drink_sources || '';
    populateCheckboxesFromString('as02-drk-chk', item.drink_sources);
    if (document.getElementById('as02-drink-years')) document.getElementById('as02-drink-years').value = item.drink_years || '';
    document.getElementById('as02-use-sources').value = item.use_sources || '';
    populateCheckboxesFromString('as02-use-chk', item.use_sources);
    if (document.getElementById('as02-use-years')) document.getElementById('as02-use-years').value = item.use_years || '';
    setSelectOrOther('as02-food-rice', 'as02-rice-other-wrap', 'as02-rice-other', item.food_rice || 'ปลูกเอง');
    setSelectOrOther('as02-food-veg', 'as02-veg-other-wrap', 'as02-veg-other', item.food_veg || 'ปลูกเอง');
    setSelectOrOther('as02-food-fish', 'as02-fish-other-wrap', 'as02-fish-other', item.food_fish || 'ซื้อจากตลาด หรือรถพุ่มพวง');
    setSelectOrOther('as02-food-snail', 'as02-snail-other-wrap', 'as02-snail-other', item.food_snail || 'ซื้อจากตลาด หรือรถพุ่มพวง');
    document.getElementById('as02-home-veg').value = item.home_grown_veg || '';
    setSelectOrOther('as02-home-water', 'as02-home-water-other-wrap', 'as02-home-water-other', item.home_grown_water || '3. บ่อน้ำบาดาล');
    document.getElementById('as02-eat-river-veg').value = item.eat_river_veg_weekly || '2.ไม่ใช่';
    document.getElementById('as02-flood-5y').value = item.flood_5years || '2.ไม่เคย';
    document.getElementById('as02-interviewer').value = item.interviewer_name || 'เจ้าหน้าที่สาธารณสุข';
    if (document.getElementById('as02-role')) document.getElementById('as02-role').value = item.interviewer_role || 'นักวิชาการสาธารณสุข';
    setSelectOrOther('as02-hc', 'as02-hc-other-wrap', 'as02-hc-other', item.health_center || 'รพ.สต.บ้านท่าตอน');
  } else {
    title.innerHTML = `<i class="fa-solid fa-vial-circle-check"></i> บันทึกแบบฟอร์ม Env-As-02 ใหม่ (ก่อนเก็บตัวอย่างทางชีวภาพ)`;
    const nextNum = state.envAs02.length + 1;
    document.getElementById('as02-id').value = `AS02-${String(nextNum).padStart(3, '0')}`;
    document.getElementById('as02-form-no').value = `69-${String(nextNum).padStart(4, '0')}`;
    document.getElementById('as02-date').value = new Date().toISOString().slice(0, 10);
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
  const obj = {
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

  const optionsHtml = state.wells.map(w =>
    `<option value="${w.well_id}">[${w.well_id}${w.sample_code ? ' / ' + w.sample_code : ''}] ${w.well_name} (ม.${w.moo} ต.${w.tambon})</option>`
  ).join('');

  if (mapWellSel) {
    mapWellSel.innerHTML = `<option value="ALL">-- ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ) --</option>` + optionsHtml;
    mapWellSel.value = currentMapVal;
  }
  if (respFilterWellSel) {
    respFilterWellSel.innerHTML = `<option value="ALL">ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ)</option>` + optionsHtml;
    respFilterWellSel.value = currentRespFilterVal;
  }
  if (modalWellSel) {
    modalWellSel.innerHTML = `<option value="">-- เลือกจุดบ่อน้ำในหมู่บ้าน --</option>` + optionsHtml;
    modalWellSel.value = currentModalVal;
  }
  if (labFilterWellSel) {
    labFilterWellSel.innerHTML = `<option value="ALL">ทุกจุดบ่อน้ำ (${state.wells.length} บ่อ)</option>` + optionsHtml;
    labFilterWellSel.value = currentLabFilterVal;
  }
  if (labModalWellSel) {
    labModalWellSel.innerHTML = optionsHtml;
    if (currentLabModalVal) labModalWellSel.value = currentLabModalVal;
  }
}

// ==================== WATER WELLS TABLE & CRUD ====================
function renderWellsTable() {
  const tbody = document.getElementById('wells-table-body');
  if (!tbody) return;

  const q = (document.getElementById('well-search').value || '').toLowerCase().trim();
  const tambon = document.getElementById('well-filter-tambon').value;
  const wType = document.getElementById('well-filter-type').value;
  const dist = document.getElementById('well-filter-dist').value;
  const hc = document.getElementById('well-filter-hc').value;

  const filtered = state.wells.filter(w => {
    if (tambon !== 'ALL' && w.tambon !== tambon) return false;
    if (wType === 'SAMPLE_ONLY' && !w.sample_code) return false;
    if (wType !== 'ALL' && wType !== 'SAMPLE_ONLY' && w.well_type !== wType) return false;
    if (dist !== 'ALL' && w.distance_band !== dist) return false;
    if (hc !== 'ALL' && w.health_center !== hc) return false;
    if (q) {
      const hay = `${w.well_id} ${w.sample_code} ${w.well_name} ${w.well_type} ${w.house_no} หมู่ ${w.moo} ${w.tambon} ${w.health_center}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  tbody.innerHTML = filtered.map((w, idx) => {
    const linkedCount = state.respondents.filter(r => r.well_id === w.well_id).length;
    let typeBadge = 'status-safe';
    if (w.well_type === 'บ่อน้ำตื้น') typeBadge = 'status-warn';
    if (w.sample_code) typeBadge = 'status-danger';

    return `
      <tr>
        <td>${w.seq || (idx + 1)}</td>
        <td>${w.sample_code ? `<span class="risk-badge status-danger">${w.sample_code}</span>` : '-'}</td>
        <td><b>${w.well_id}</b></td>
        <td>${w.well_name}</td>
        <td>บ้าน ${w.house_no || '-'} ม.${w.moo} ต.${w.tambon}</td>
        <td>
          <span class="risk-badge ${typeBadge}">${w.well_type}</span>
          ${w.depth_meters ? `<div style="font-size:11px; color:#0369a1; margin-top:2px;">ลึก ~${w.depth_meters} ม.</div>` : ''}
        </td>
        <td>
          <a href="javascript:void(0)" onclick="focusOnMap(${w.latitude}, ${w.longitude})" title="คลิกเพื่อดูจุดบนแผนที่ดาวเทียม">
            <i class="fa-solid fa-location-dot"></i> ${Number(w.latitude).toFixed(5)}, ${Number(w.longitude).toFixed(5)}
          </a>
          <div style="font-size:11px; color:#64748b;">UTM: ${w.utm_e || '-'}, ${w.utm_n || '-'}</div>
        </td>
        <td>
          <b>${w.distance_river_m} ม.</b>
          <div style="font-size:11px; color:#64748b;">${w.distance_band}</div>
        </td>
        <td>${w.usage_type || 'ใช้อุปโภค'}</td>
        <td>
          <div>ครัวเรือน: <b>${w.user_count || 1}</b> คน</div>
          ${linkedCount > 0 ? `<button class="btn btn-sm btn-outline" style="margin-top:3px;" onclick="filterPeopleByWell('${w.well_id}')"><i class="fa-solid fa-link"></i> กลุ่มเสี่ยง ${linkedCount} ราย</button>` : ''}
        </td>
        <td>${w.health_center || '-'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-outline" style="color:#0369a1; border-color:#7dd3fc;" onclick="openWaterLabForWell('${w.well_id}')" title="บันทึก/ดูผลตรวจแล็บน้ำของบ่อนี้"><i class="fa-solid fa-flask-vial"></i> ผลแล็บ</button>
          <button class="btn btn-sm btn-primary" onclick="openWellModal('${w.well_id}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteWell('${w.well_id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
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
    setSelectOrOther('well-hc', 'well-hc-other-wrap', 'well-hc-other', w.health_center || 'รพ.สต.บ้านท่าตอน');
    document.getElementById('well-lat').value = w.latitude;
    document.getElementById('well-lng').value = w.longitude;
    document.getElementById('well-utm-e').value = w.utm_e || '';
    document.getElementById('well-utm-n').value = w.utm_n || '';
    document.getElementById('well-house').value = w.house_no || '';
    document.getElementById('well-moo').value = w.moo || '';
    setSelectOrOther('well-tambon', 'well-tambon-other-wrap', 'well-tambon-other', w.tambon || 'ท่าตอน');
    document.getElementById('well-dist').value = w.distance_river_m !== undefined ? w.distance_river_m : 100;
    setSelectOrOther('well-usage-select', 'well-usage-other-wrap', 'well-usage', w.usage_type || 'ใช้อุปโภค');
    document.getElementById('well-user-count').value = w.user_count || 1;
    document.getElementById('well-arsenic').value = w.arsenic_level !== undefined ? w.arsenic_level : '';
    setSelectOrOther('well-status-select', 'well-status-other-wrap', 'well-status', w.safety_status || w.arsenic_status || 'เฝ้าระวังตามระยะห่างแม่น้ำกก');
    document.getElementById('well-notes').value = w.notes || '';
  } else {
    title.innerHTML = `<i class="fa-solid fa-faucet-drip"></i> เพิ่มจุดแหล่งน้ำใหม่`;
    const nextNum = state.wells.length + 1;
    document.getElementById('well-id').value = `W${String(nextNum).padStart(3, '0')}`;
    document.getElementById('well-id').readOnly = false;
    document.getElementById('well-lat').value = 20.0560;
    document.getElementById('well-lng').value = 99.4000;
    document.getElementById('well-dist').value = 100;
    document.getElementById('well-user-count').value = 2;
  }

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
  const dist = parseFloat(document.getElementById('well-dist').value) || 0;
  let distBand = 'มากกว่า 300 เมตร';
  if (dist <= 100) distBand = 'ไม่เกิน 100 เมตร';
  else if (dist <= 200) distBand = '101 - 200 เมตร';
  else if (dist <= 300) distBand = '201 - 300 เมตร';

  const pCode = document.getElementById('well-sample-code').value.trim();
  const wellId = document.getElementById('well-id').value.trim();
  const existing = state.wells.find(w => w.well_id === wellId);

  const wellObj = {
    well_id: wellId,
    seq: existing ? existing.seq : state.wells.length + 1,
    sample_code: pCode,
    well_name: document.getElementById('well-name').value.trim(),
    owner_name: document.getElementById('well-name').value.trim(),
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
    user_count: Number(document.getElementById('well-user-count').value) || 1,
    arsenic_level: document.getElementById('well-arsenic').value,
    safety_status: getSelectOrOther('well-status-select', 'well-status') || (pCode ? `ส่งตรวจสารปนเปื้อน (${pCode})` : 'สำรวจแล้ว'),
    notes: document.getElementById('well-notes').value.trim(),
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
  await postToGoogleSheets({ action: 'saveWell', data: wellObj });
}

async function deleteWell(wellId) {
  const linked = state.respondents.filter(r => r.well_id === wellId).length;
  if (!confirm(`ยืนยันการลบจุดบ่อน้ำ ${wellId} หรือไม่? (มีผู้ใช้น้ำเชื่อมโยงอยู่ ${linked} ราย)`)) return;
  state.wells = state.wells.filter(w => w.well_id !== wellId);
  saveLocalData();
  await postToGoogleSheets({ action: 'deleteWell', well_id: wellId });
}

// ==================== RESPONDENTS TABLE, PIVOT & CRUD ====================
function renderPivotSummary() {
  const tbody1 = document.getElementById('pivot-summary-body');
  const tbody2 = document.getElementById('dash-pivot-body');

  const groups = [
    { key: 'ประชาชนทั่วไป (แท็บการตอบกลับ)', label: '1. ประชาชนทั่วไป (แท็บการตอบกลับ)' },
    { key: 'กลุ่มใหม่', label: '2. กลุ่มใหม่ (แท็บเก็บปัสสาวะ)' },
    { key: 'กลุ่มเดิม 68', label: '3. กลุ่มเดิม 68 (แท็บเก็บปัสสาวะ)' },
    { key: 'ผู้ประกอบอาชีพ', label: '4. ผู้ประกอบอาชีพ (แท็บเก็บปัสสาวะ)' }
  ];
  let totalThaton = 0;
  let totalMaenawang = 0;

  const rowsHtml = groups.map(g => {
    const thaton = state.respondents.filter(r => r.target_group === g.key && r.tambon === 'ท่าตอน').length;
    const maenawang = state.respondents.filter(r => r.target_group === g.key && r.tambon === 'แม่นาวาง').length;
    const sum = thaton + maenawang;
    totalThaton += thaton;
    totalMaenawang += maenawang;
    return `
      <tr>
        <td>${g.label}</td>
        <td>${thaton || '-'}</td>
        <td>${maenawang || '-'}</td>
        <td><b>${sum}</b></td>
      </tr>
    `;
  }).join('');

  const target130Thaton = state.respondents.filter(r => r.is_urine_target && r.tambon === 'ท่าตอน').length;
  const target130Maenawang = state.respondents.filter(r => r.is_urine_target && r.tambon === 'แม่นาวาง').length;

  const fullHtml = rowsHtml + `
    <tr style="background:#f0fdf4; font-weight:600; color:#15803d;">
      <td>รวมเฉพาะกลุ่มเป้าหมายเก็บปัสสาวะ (แท็บที่ 2)</td>
      <td>${target130Thaton}</td>
      <td>${target130Maenawang}</td>
      <td><b>${target130Thaton + target130Maenawang}</b></td>
    </tr>
    <tr style="background:#e2e8f0; font-weight:700;">
      <td>รวมทั้งหมดในแท็บ "การตอบกลับ" (Grand Total)</td>
      <td>${totalThaton}</td>
      <td>${totalMaenawang}</td>
      <td>${totalThaton + totalMaenawang}</td>
    </tr>
  `;

  if (tbody1) tbody1.innerHTML = fullHtml;
  if (tbody2) tbody2.innerHTML = fullHtml;
}

function renderRespondentsTable() {
  const tbody = document.getElementById('respondents-table-body');
  if (!tbody) return;

  const q = (document.getElementById('resp-search').value || '').toLowerCase().trim();
  const tabSel = document.getElementById('resp-filter-tab') ? document.getElementById('resp-filter-tab').value : 'ALL';
  const tambon = document.getElementById('resp-filter-tambon').value;
  const group = document.getElementById('resp-filter-group').value;
  const risk = document.getElementById('resp-filter-risk').value;
  const wellId = document.getElementById('resp-filter-well').value;

  const filtered = state.respondents.filter(r => {
    if (tabSel === 'TARGET_130' && !r.is_urine_target) return false;
    if (tabSel === 'GENERAL_153' && r.is_urine_target) return false;
    if (tambon !== 'ALL' && r.tambon !== tambon) return false;
    if (group !== 'ALL' && r.target_group !== group) return false;
    if (risk !== 'ALL' && r.risk_level !== risk) return false;
    if (wellId !== 'ALL' && r.well_id !== wellId) return false;
    if (q) {
      const hay = `${r.full_name} ${r.cid} ${r.code} ${r.house_no} ${r.tambon} ${r.cut_point} ${r.well_id} ${r.source_tab}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  tbody.innerHTML = filtered.map((r, idx) => {
    let badgeClass = 'risk-low';
    if (r.risk_level === 'ปานกลาง') badgeClass = 'risk-med';
    if (r.risk_level === 'มาก') badgeClass = 'risk-high';

    const tabBadge = r.is_urine_target
      ? `<span class="badge" style="background:#dcfce7;color:#15803d;font-size:11px;">เก็บปัสสาวะ (130)</span>`
      : `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:11px;">การตอบกลับ (153)</span>`;

    return `
      <tr>
        <td>${r.seq || (idx + 1)}</td>
        <td><b>${r.code || '-'}</b><div style="margin-top:2px;">${tabBadge}</div></td>
        <td>${r.survey_date || '2026-05-22'}</td>
        <td>
          <a href="javascript:void(0)" onclick="focusOnMap(${r.latitude}, ${r.longitude})" style="font-weight:600; color:#0f172a; text-decoration:none;">
            ${r.full_name} <i class="fa-solid fa-location-dot" style="color:#0284c7;"></i>
          </a>
        </td>
        <td>${r.age || '-'} ปี / ${r.gender ? r.gender.replace('1) ', '').replace('2) ', '') : '-'}</td>
        <td>${r.cid || '-'}</td>
        <td>บ้าน ${r.house_no || '-'} ม.${r.moo} ต.${r.tambon}</td>
        <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${r.well_id || '-'}</span></td>
        <td>${r.risk_job_type || 'ทั่วไป'} ${r.job_detail ? `<small class="text-muted">(${r.job_detail})</small>` : ''}</td>
        <td><b>${r.total_score}</b></td>
        <td><span class="risk-badge ${badgeClass}">${r.risk_level}</span></td>
        <td>${r.cut_point || '-'}</td>
        <td>${r.target_group || '-'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="openRespondentModal('${r.id}')" title="แก้ไข Env-As-01"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-success" onclick="openEnvAs02ForRespondent('${r.id}')" title="บันทึกต่อใน Env-As-02"><i class="fa-solid fa-vial"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteRespondent('${r.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
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

  if (score > 20) {
    if (badgeEl) {
      badgeEl.className = 'risk-badge risk-high';
      badgeEl.textContent = 'สูง / มาก (คะแนน > 20)';
    }
    if (measureEl) measureEl.textContent = 'มาตรการ: ส่งพบแพทย์ตรวจร่างกาย ซักประวัติ Env-As-02 และเก็บปัสสาวะตรวจสารหนู';
    if (rHigh) rHigh.className = 'risk-criteria-row-active';
  } else if (score >= 10) {
    if (badgeEl) {
      badgeEl.className = 'risk-badge risk-med';
      badgeEl.textContent = 'ปานกลาง (คะแนน 10 - 20)';
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

function syncCoordinatesFromSelectedWell() {
  const wellId = document.getElementById('resp-well-id').value;
  const well = state.wells.find(w => w.well_id === wellId);
  if (well) {
    document.getElementById('resp-lat').value = well.latitude;
    document.getElementById('resp-lng').value = well.longitude;
    document.getElementById('resp-moo').value = well.moo;
    setSelectOrOther('resp-tambon', 'resp-tambon-other-wrap', 'resp-tambon-other', well.tambon);
  }
}

function useCurrentGpsForRespondent() {
  if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('resp-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('resp-lng').value = pos.coords.longitude.toFixed(6);
  });
}

function openRespondentModal(respId = null) {
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
    if (document.getElementById('resp-survey-date')) document.getElementById('resp-survey-date').value = r.survey_date || '2026-05-22';
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
    document.getElementById('resp-lat').value = r.latitude || 20.055;
    document.getElementById('resp-lng').value = r.longitude || 99.400;

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

    for (let i = 1; i <= 11; i++) {
      document.getElementById(`env-q${i}`).checked = Boolean(Number(r[`q${i}`]));
    }
    recalcScore();
  } else {
    title.innerHTML = `<i class="fa-solid fa-file-medical"></i> บันทึกแบบฟอร์ม Env-As-01 ใหม่ (คัดกรองความเสี่ยงระดับบุคคล)`;
    const nextSeq = state.respondents.length + 1;
    document.getElementById('resp-id').value = `RESP-${String(nextSeq).padStart(3, '0')}`;
    document.getElementById('resp-code').value = `NM${String(nextSeq).padStart(3, '0')}`;
    if (document.getElementById('resp-survey-date')) document.getElementById('resp-survey-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('resp-lat').value = 20.0560;
    document.getElementById('resp-lng').value = 99.4000;
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
  const isTarget130 = targetGroupVal !== 'ประชาชนทั่วไป (แท็บการตอบกลับ)';

  const respObj = {
    id: id,
    seq: existing ? existing.seq : state.respondents.length + 1,
    code: document.getElementById('resp-code').value.trim(),
    is_urine_target: isTarget130,
    source_tab: isTarget130 ? 'รายชื่อเก็บปัสสาวะ (130 ราย)' : 'การตอบกลับ (คัดกรองทั่วไป 153 ราย)',
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

async function deleteRespondent(respId) {
  const r = state.respondents.find(item => item.id === respId);
  if (!r) return;
  if (!confirm(`ยืนยันการลบรายชื่อ "${r.full_name}" (${r.code}) ออกจากระบบหรือไม่?`)) return;

  state.respondents = state.respondents.filter(item => item.id !== respId);
  saveLocalData();
  await postToGoogleSheets({ action: 'deleteRespondent', id: respId });
}

// ==================== BULK CSV IMPORT & SAMPLE TEMPLATES ====================
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

function downloadTemplateCsv(type) {
  if (type === 'wells') {
    const headers = ['well_id', 'sample_code', 'well_name', 'house_no', 'moo', 'tambon', 'well_type', 'depth_meters', 'utm_e', 'utm_n', 'latitude', 'longitude', 'distance_river_m', 'usage_type', 'user_count', 'health_center'];
    const sample1 = ['W148', 'P44', 'ศาลาหมู่บ้านตัวอย่าง', '10', '3', 'ท่าตอน', 'บ่อน้ำตื้น', '12', '538100', '2218000', '', '', '80', 'ใช้อุปโภค', '4', 'รพ.สต.บ้านท่าตอน'];
    const sample2 = ['W149', '', 'นายสมชาย ใจดี', '25', '14', 'แม่นาวาง', 'บ่อบาดาล', '45', '542500', '2216600', '', '', '220', 'ใช้อุปโภค', '2', 'รพ.สต.บ้านแม่เมืองน้อย'];
    downloadCsvFile('template_import_wells.csv', [headers.join(','), sample1.join(','), sample2.join(',')].join('\n'));
  } else if (type === 'waterlab') {
    const headers = ['well_id', 'sample_code', 'sample_date', 'lab_name', 'standard_type', 'ph', 'colour', 'turbidity', 'tds', 'hardness', 'fe', 'mn', 'cu', 'zn', 'pb', 'cr', 'cd', 'as_val', 'hg', 'so4', 'cl', 'no3', 'f', 'residual_cl', 'total_coliform', 'faecal_coliform', 'notes'];
    const sample1 = ['W001-P1', 'P1', '2026-05-22', 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', 'DOH_2543', '7.2', '5', '3.5', '280', '140', '0.18', '0.08', '0.05', '0.2', '0.002', '0.005', '0.0005', '0.004', '0.1', '45', '30', '8', '0.3', '', '0', '0', 'ตัวอย่างผลตรวจผ่านเกณฑ์ทุกพารามิเตอร์'];
    downloadCsvFile('template_import_water_lab_doh.csv', [headers.join(','), sample1.join(',')].join('\n'));
  } else if (type === 'as01') {
    const headers = ['code', 'full_name', 'age', 'gender', 'cid', 'house_no', 'moo', 'tambon', 'marital_status', 'education', 'years_in_area', 'risk_job_flag', 'risk_job_type', 'job_detail', 'job_duration', 'job_hours', 'disease_flag', 'diseases', 'symptom_flag', 'symptoms', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'target_group', 'well_id', 'survey_date', 'interviewer_name'];
    const sample1 = ['NM131', 'นายตัวอย่าง ทดสอบนำเข้า', '45', '1) ชาย', '1501000012345', '99', '5', 'ท่าตอน', '2) คู่', '2) ประถมศึกษา', '30', 'ใช่', '3) เกษตรกร', 'ทำสวนใกล้แม่น้ำกก', '10ปี', '6', 'ไม่มี', '', 'ไม่มี', '', '0', '1', '0', '0', '1', '1', '1', '0', '0', '0', '1', 'กลุ่มใหม่', 'W001-P1', '2026-05-22', 'เจ้าหน้าที่ รพ.สต.'];
    downloadCsvFile('template_import_env_as01.csv', [headers.join(','), sample1.join(',')].join('\n'));
  } else if (type === 'as02') {
    const headers = ['form_no', 'full_name', 'age', 'phone', 'gender', 'weight_kg', 'height_cm', 'cid', 'house_no', 'moo', 'tambon', 'within_1km_river', 'risk_job_type', 'diseases', 'herb_usage', 'smoking_status', 'alcohol_status', 'seafood_freq', 'seafood_3days', 'drink_sources', 'use_sources', 'food_rice', 'food_veg', 'eat_river_veg_weekly', 'flood_5years', 'interviewer_name', 'health_center', 'interview_date'];
    const sample1 = ['69-0050', 'นายตัวอย่าง ทดสอบนำเข้า', '45', '0812345678', '1) ชาย', '60', '165', '1501000012345', '99', '5', 'ท่าตอน', '1.ใช่', '3) เกษตรกร', 'ไม่มี', '5. ไม่ได้กิน', '1. ไม่สูบ', '1. ไม่ดื่ม', '4. เดือนละ 1-2 ครั้ง', 'ไม่ใช่', '1. บ่อน้ำตื้น (10 ปี)', '3. บ่อบาดาล (10 ปี)', '1. ปลูกเอง', '1. ปลูกเอง/หาเอง', '1.ใช่', '2.ไม่เคย', 'เจ้าหน้าที่สาธารณสุข', 'รพ.สต.บ้านท่าตอน', '2026-05-22'];
    downloadCsvFile('template_import_env_as02.csv', [headers.join(','), sample1.join(',')].join('\n'));
  }
}

function handleBulkImport(type) {
  const fileInputMap = {
    wells: 'import-file-wells',
    waterlab: 'import-file-waterlab',
    as01: 'import-file-as01',
    as02: 'import-file-as02'
  };
  const fileInput = document.getElementById(fileInputMap[type]);
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('กรุณาเลือกไฟล์ .CSV ที่ต้องการนำเข้าก่อนครับ');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) {
      alert('ไฟล์ CSV ไม่มีข้อมูลแถวสำหรับนำเข้า');
      return;
    }

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 3) continue;

      if (type === 'wells') {
        const hasDepthCol = cols.length >= 16;
        const depthVal = hasDepthCol ? cols[7] : '';
        const offset = hasDepthCol ? 1 : 0;
        const utmE = parseFloat(cols[7 + offset]) || 538000;
        const utmN = parseFloat(cols[8 + offset]) || 2218000;
        let lat = parseFloat(cols[9 + offset]);
        let lng = parseFloat(cols[10 + offset]);
        if (isNaN(lat) || isNaN(lng)) {
          const conv = utm47NToLatLng(utmE, utmN);
          lat = conv.lat;
          lng = conv.lng;
        }
        const newWell = normalizeWellRecord({
          well_id: cols[0] || `W${String(state.wells.length + 1).padStart(3, '0')}`,
          seq: state.wells.length + 1,
          sample_code: cols[1] || '',
          well_name: cols[2] || 'จุดบ่อน้ำนำเข้า',
          owner_name: cols[2] || '',
          house_no: cols[3] || '',
          moo: Number(cols[4]) || 1,
          tambon: cols[5] || 'ท่าตอน',
          well_type: cols[6] || 'บ่อบาดาล',
          depth_meters: depthVal !== '' ? parseFloat(depthVal) : '',
          utm_e: utmE,
          utm_n: utmN,
          latitude: lat,
          longitude: lng,
          distance_river_m: parseFloat(cols[11 + offset]) || 100,
          usage_type: cols[12 + offset] || 'ใช้อุปโภค',
          user_count: Number(cols[13 + offset]) || 1,
          health_center: cols[14 + offset] || 'รพ.สต.บ้านท่าตอน',
          safety_status: cols[1] ? `ส่งตรวจสารปนเปื้อน (${cols[1]})` : 'สำรวจแล้ว'
        }, state.wells.length);
        state.wells.push(newWell);
        importedCount++;
      } else if (type === 'waterlab') {
        const labRec = {
          id: `WLAB-${String(state.waterLabs.length + 1).padStart(3, '0')}`,
          well_id: cols[0] || 'W001-P1',
          sample_code: cols[1] || `LAB-${state.waterLabs.length + 1}`,
          sample_date: cols[2] || new Date().toISOString().slice(0, 10),
          lab_name: cols[3] || 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่',
          standard_type: cols[4] || 'DOH_2543',
          ph: cols[5] || '', colour: cols[6] || '', turbidity: cols[7] || '', tds: cols[8] || '',
          hardness: cols[9] || '', fe: cols[10] || '', mn: cols[11] || '', cu: cols[12] || '',
          zn: cols[13] || '', pb: cols[14] || '', cr: cols[15] || '', cd: cols[16] || '',
          as_val: cols[17] || '', hg: cols[18] || '', so4: cols[19] || '', cl: cols[20] || '',
          no3: cols[21] || '', f: cols[22] || '', residual_cl: cols[23] || '',
          total_coliform: cols[24] || '', faecal_coliform: cols[25] || '',
          notes: cols[26] || ''
        };
        const evalRes = evaluateWaterLabRecord(labRec);
        labRec.overall_status = evalRes.overallStatus;
        labRec.failed_params = evalRes.failedNames.join(', ');
        state.waterLabs.push(labRec);
        importedCount++;
      } else if (type === 'as01') {
        const qVals = [];
        for (let qIdx = 20; qIdx <= 30; qIdx++) {
          qVals.push(Number(cols[qIdx]) ? 1 : 0);
        }
        const score = qVals[0]*5 + qVals[1]*5 + qVals[2]*5 + qVals[3]*1.5 + qVals[4]*1.5 + qVals[5]*1 + qVals[6]*1 + qVals[7]*4 + qVals[8]*4 + qVals[9]*1 + qVals[10]*1.5;
        const wellId = cols[32] || (state.wells[0] ? state.wells[0].well_id : 'W001-P1');
        const wRef = state.wells.find(w => w.well_id === wellId) || state.wells[0];

        const newResp = normalizeRespondentRecord({
          id: `RESP-${String(state.respondents.length + 1).padStart(3, '0')}`,
          seq: state.respondents.length + 1,
          code: cols[0] || `NM${String(state.respondents.length + 1).padStart(3, '0')}`,
          full_name: cols[1] || '',
          age: cols[2] || '',
          gender: cols[3] || '1) ชาย',
          cid: cols[4] || '',
          house_no: cols[5] || '',
          moo: cols[6] || 1,
          tambon: cols[7] || 'ท่าตอน',
          marital_status: cols[8] || '2) คู่',
          education: cols[9] || '2) ประถมศึกษา',
          years_in_area: cols[10] || '',
          risk_job_flag: cols[11] || 'ไม่ใช่',
          risk_job_type: cols[12] || '',
          job_detail: cols[13] || '',
          job_duration: cols[14] || '',
          job_hours: cols[15] || '',
          disease_flag: cols[16] || 'ไม่มี',
          diseases: cols[17] || '',
          symptom_flag: cols[18] || 'ไม่มี',
          symptoms: cols[19] || '',
          q1: qVals[0], q2: qVals[1], q3: qVals[2], q4: qVals[3], q5: qVals[4],
          q6: qVals[5], q7: qVals[6], q8: qVals[7], q9: qVals[8], q10: qVals[9], q11: qVals[10],
          total_score: score,
          target_group: cols[31] || 'กลุ่มใหม่',
          well_id: wellId,
          survey_date: cols[33] || new Date().toISOString().slice(0, 10),
          interviewer_name: cols[34] || 'เจ้าหน้าที่สาธารณสุข',
          latitude: wRef ? wRef.latitude + 0.0002 : 20.056,
          longitude: wRef ? wRef.longitude + 0.0002 : 99.400
        }, state.respondents.length);
        state.respondents.push(newResp);
        importedCount++;
      } else if (type === 'as02') {
        state.envAs02.push({
          id: `AS02-${String(state.envAs02.length + 1).padStart(3, '0')}`,
          form_no: cols[0] || `69-${String(state.envAs02.length + 1).padStart(4, '0')}`,
          full_name: cols[1] || '',
          age: cols[2] || '',
          phone: cols[3] || '',
          gender: cols[4] || '1) ชาย',
          weight_kg: cols[5] || '',
          height_cm: cols[6] || '',
          cid: cols[7] || '',
          house_no: cols[8] || '',
          moo: cols[9] || '',
          tambon: cols[10] || 'ท่าตอน',
          within_1km_river: cols[11] || '1.ใช่',
          risk_job_type: cols[12] || '',
          diseases: cols[13] || '',
          herb_usage: cols[14] || '5. ไม่ได้กิน',
          smoking_status: cols[15] || '1. ไม่สูบ',
          alcohol_status: cols[16] || '1. ไม่ดื่ม',
          seafood_freq: cols[17] || '5. ไม่ได้กินเลย',
          seafood_3days: cols[18] || 'ไม่ใช่',
          drink_sources: cols[19] || '',
          use_sources: cols[20] || '',
          food_rice: cols[21] || '1. ปลูกเอง',
          food_veg: cols[22] || '1. ปลูกเอง/หาเอง',
          eat_river_veg_weekly: cols[23] || '2.ไม่ใช่',
          flood_5years: cols[24] || '2.ไม่เคย',
          interviewer_name: cols[25] || 'เจ้าหน้าที่สาธารณสุข',
          health_center: cols[26] || 'รพ.สต.บ้านท่าตอน',
          interview_date: cols[27] || new Date().toISOString().slice(0, 10)
        });
        importedCount++;
      }
    }

    saveLocalData();
    alert(`นำเข้าข้อมูลสำเร็จจำนวน ${importedCount} รายการ! แดชบอร์ดและแผนที่อัปเดตเรียบร้อยแล้ว`);
  };
  reader.readAsText(file, 'utf-8');
}

// ==================== GOOGLE SHEETS CLOUD SYNC & ADMIN LOCK ====================
function toggleUnlockGasInput() {
  const input = document.getElementById('gas-url-input');
  const saveBtn = document.getElementById('btn-save-gas-url');
  const unlockBtn = document.getElementById('btn-unlock-gas');
  if (!input) return;

  if (!state.gasUnlocked) {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      const pin = prompt('กรุณากรอกรหัสผ่านผู้ดูแลระบบ (Admin Password) เพื่อปลดล็อกแก้ไขลิงก์ Google Sheets:');
      if (pin !== '1234') {
        alert('รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง');
        return;
      }
    }
    state.gasUnlocked = true;
    input.readOnly = false;
    input.style.background = '#ffffff';
    input.style.cursor = 'text';
    input.focus();
    if (saveBtn) saveBtn.disabled = false;
    if (unlockBtn) unlockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> ล็อกช่องลิงก์`;
  } else {
    state.gasUnlocked = false;
    input.readOnly = true;
    input.style.background = '#e2e8f0';
    input.style.cursor = 'not-allowed';
    if (saveBtn) saveBtn.disabled = true;
    if (unlockBtn) unlockBtn.innerHTML = `<i class="fa-solid fa-key"></i> ปลดล็อกแก้ไขลิงก์ (เฉพาะ Admin)`;
  }
}

function saveGasUrl() {
  const input = document.getElementById('gas-url-input');
  const url = input ? input.value.trim() : '';
  state.gasUrl = url;
  localStorage.setItem(STORAGE_KEY_GAS_URL, url);
  updateSyncBadge(Boolean(url));
  logCloudMessage(`บันทึก URL เรียบร้อยแล้ว: ${url || '(โหมดออฟไลน์)'}`);
  if (state.gasUnlocked) toggleUnlockGasInput();
}

function updateSyncBadge(connected) {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;
  if (connected) {
    badge.className = 'badge badge-cloud';
    badge.innerHTML = `<i class="fa-solid fa-cloud-check"></i> เชื่อมต่อ Google Sheets แล้ว`;
  } else {
    badge.className = 'badge badge-local';
    badge.innerHTML = `<i class="fa-solid fa-database"></i> โหมดพร้อมใช้งาน (Local + Cloud)`;
  }
}

function logCloudMessage(msg) {
  const logEl = document.getElementById('cloud-sync-log');
  if (logEl) {
    logEl.textContent = `[${new Date().toLocaleTimeString('th-TH')}] ${msg}`;
  }
}

async function postToGoogleSheets(payload) {
  if (!state.gasUrl) return;
  try {
    logCloudMessage(`กำลังส่งข้อมูล (${payload.action}) ไปยัง Google Sheets...`);
    await fetch(state.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    logCloudMessage(`ซิงค์ข้อมูล (${payload.action}) ลง Google Sheets สำเร็จ!`);
  } catch (err) {
    logCloudMessage(`เกิดข้อผิดพลาดในการซิงค์: ${err.message}`);
  }
}

async function syncAllToGoogleSheets() {
  if (!state.gasUrl) {
    alert('กรุณาปลดล็อกแล้ววางลิงก์ Google Apps Script Web App URL ในช่องลิงก์และกดบันทึกก่อนครับ');
    return;
  }
  const lightDocs = (state.knowledgeDocs || []).map(d => ({
    id: d.id,
    title: d.title,
    category: d.category,
    author: d.author,
    date: d.date,
    description: d.description,
    file_url: d.file_url && d.file_url.startsWith('data:') ? '[ไฟล์แนบในระบบ]' : d.file_url
  }));
  await postToGoogleSheets({
    action: 'syncAll',
    wells: state.wells,
    waterLabs: state.waterLabs,
    respondents: state.respondents,
    envAs02: state.envAs02,
    knowledgeDocs: lightDocs
  });
  alert(`ส่งข้อมูลทั้งหมด (แหล่งน้ำ ${state.wells.length} บ่อ + ผลแล็บน้ำ ${state.waterLabs.length} รายการ + คัดกรอง Env-As-01 ${state.respondents.length} ราย + ซักประวัติ Env-As-02 ${state.envAs02.length} ราย + คู่มือ ${lightDocs.length} รายการ) ขึ้น Google Sheets เรียบร้อยแล้ว!`);
}

async function pullFromGoogleSheets() {
  if (!state.gasUrl) {
    alert('กรุณาตั้งค่า Google Apps Script Web App URL ก่อนครับ');
    return;
  }
  try {
    logCloudMessage('กำลังดึงข้อมูลล่าสุดจาก Google Sheets...');
    const res = await fetch(`${state.gasUrl}?action=getAll`);
    const data = await res.json();
    if (data.status === 'success') {
      if (Array.isArray(data.wells) && data.wells.length > 0) state.wells = data.wells.map(normalizeWellRecord);
      if (Array.isArray(data.waterLabs) && data.waterLabs.length > 0) state.waterLabs = data.waterLabs;
      if (Array.isArray(data.respondents) && data.respondents.length > 0) state.respondents = data.respondents.map(normalizeRespondentRecord);
      if (Array.isArray(data.envAs02) && data.envAs02.length > 0) state.envAs02 = data.envAs02;
      saveLocalData();
      logCloudMessage(`ดึงข้อมูลสำเร็จ! (บ่อน้ำ ${state.wells.length} จุด, ผลแล็บ ${state.waterLabs.length} รายการ, Env-As-01 ${state.respondents.length} ราย, Env-As-02 ${state.envAs02.length} ราย)`);
    }
  } catch (err) {
    logCloudMessage(`ดึงข้อมูลไม่สำเร็จ (ตรวจสอบสิทธิ์การ Deploy เป็น Anyone): ${err.message}`);
  }
}

// ==================== EXPORT CSV / BACKUP / RESET ====================
function exportRespondentsCsv() {
  const headers = [
    'ลำดับ', 'รหัสแบบคัดกรอง(code)', 'แหล่งข้อมูล(source_tab)', 'วันที่ลงสำรวจ', 'ผู้สัมภาษณ์',
    'ชื่อ - นามสกุล', 'อายุ (ปี)', 'เพศ', 'เลขประจำตัวประชาชน',
    'บ้านเลขที่', 'หมู่ที่', 'ตำบล', 'อำเภอ', 'จังหวัด',
    'รหัสจุดบ่อน้ำ', 'พิกัดละติจูด', 'พิกัดลองจิจูด',
    'อาชีพที่เสี่ยง', 'ลักษณะงาน', 'โรคประจำตัว', 'อาการแสดง',
    'ข้อ1', 'ข้อ2', 'ข้อ3', 'ข้อ4', 'ข้อ5', 'ข้อ6', 'ข้อ7', 'ข้อ8', 'ข้อ9', 'ข้อ10', 'ข้อ11',
    'รวมคะแนน', 'ความเสี่ยง', 'cut point', 'กลุ่มเป้าหมาย'
  ];

  const rows = state.respondents.map((r, idx) => [
    r.seq || (idx + 1),
    `"${r.code || ''}"`,
    `"${r.source_tab || 'การตอบกลับ'}"`,
    `"${r.survey_date || ''}"`,
    `"${r.interviewer_name || ''}"`,
    `"${r.full_name || ''}"`,
    r.age || '',
    `"${r.gender || ''}"`,
    `"${r.cid || ''}"`,
    `"${r.house_no || ''}"`,
    r.moo || '',
    `"${r.tambon || ''}"`,
    `"${r.amphoe || 'แม่อาย'}"`,
    `"${r.province || 'เชียงใหม่'}"`,
    `"${r.well_id || ''}"`,
    r.latitude || '',
    r.longitude || '',
    `"${r.risk_job_type || ''}"`,
    `"${r.job_detail || ''}"`,
    `"${r.diseases || ''}"`,
    `"${r.symptoms || ''}"`,
    r.q1||0, r.q2||0, r.q3||0, r.q4||0, r.q5||0, r.q6||0, r.q7||0, r.q8||0, r.q9||0, r.q10||0, r.q11||0,
    r.total_score,
    `"${r.risk_level || ''}"`,
    `"${r.cut_point || ''}"`,
    `"${r.target_group || ''}"`
  ]);

  downloadCsvFile('Env_As_01_screening_283_maeai.csv', [headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
}

function exportEnvAs02Csv() {
  const headers = [
    'เลขที่แบบฟอร์ม', 'ชื่อ-นามสกุล', 'อายุ', 'เบอร์โทร', 'เพศ', 'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)', 'เลข13หลัก',
    'บ้านเลขที่', 'หมู่ที่', 'ตำบล', 'รัศมี1กม.แม่น้ำปนเปื้อน', 'อาชีพเสี่ยง', 'โรคประจำตัว',
    'การใช้ยาสมุนไพร', 'การสูบบุหรี่', 'การดื่มสุรา', 'ความถี่อาหารทะเล(1เดือน)', 'กินอาหารทะเลใน3วันก่อนตรวจ',
    'แหล่งน้ำดื่มประจำ', 'แหล่งน้ำใช้ในครัวเรือน', 'ข้าวที่บริโภค', 'พืชผักที่บริโภค',
    'กินผักริมน้ำปนเปื้อนประจำ', 'น้ำหลากเข้าบ้านใน5ปี', 'ผู้สัมภาษณ์', 'รพ.สต.', 'วันที่สัมภาษณ์'
  ];
  const rows = state.envAs02.map(item => [
    `"${item.form_no || ''}"`, `"${item.full_name || ''}"`, item.age || '', `"${item.phone || ''}"`,
    `"${item.gender || ''}"`, item.weight_kg || '', item.height_cm || '', `"${item.cid || ''}"`,
    `"${item.house_no || ''}"`, item.moo || '', `"${item.tambon || ''}"`, `"${item.within_1km_river || ''}"`,
    `"${item.risk_job_type || ''}"`, `"${item.diseases || ''}"`, `"${item.herb_usage || ''}"`,
    `"${item.smoking_status || ''}"`, `"${item.alcohol_status || ''}"`, `"${item.seafood_freq || ''}"`,
    `"${item.seafood_3days || ''}"`, `"${item.drink_sources || ''}"`, `"${item.use_sources || ''}"`,
    `"${item.food_rice || ''}"`, `"${item.food_veg || ''}"`, `"${item.eat_river_veg_weekly || ''}"`,
    `"${item.flood_5years || ''}"`, `"${item.interviewer_name || ''}"`, `"${item.health_center || ''}"`,
    `"${item.interview_date || ''}"`
  ]);
  downloadCsvFile('Env_As_02_pre_lab_survey.csv', [headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
}

function exportWellsCsv() {
  const headers = [
    'ลำดับ', 'รหัสส่งตรวจ', 'รหัสระบบ', 'ชื่อ-สกุล/แหล่งน้ำ', 'บ้านเลขที่', 'หมู่ที่', 'ตำบล',
    'ลักษณะบ่อ', 'ความลึกโดยประมาณ(เมตร)', 'พิกัด_UTM_N(X)', 'พิกัด_UTM_E(Y)', 'ละติจูด(Lat)', 'ลองจิจูด(Lng)',
    'ระยะห่างแม่น้ำกก(เมตร)', 'ช่วงระยะห่าง', 'ลักษณะการใช้งาน', 'จำนวนผู้ใช้น้ำ', 'รพ.สต.'
  ];
  const rows = state.wells.map((w, idx) => [
    w.seq || (idx + 1),
    `"${w.sample_code || ''}"`,
    `"${w.well_id}"`,
    `"${w.well_name}"`,
    `"${w.house_no || ''}"`,
    w.moo,
    `"${w.tambon}"`,
    `"${w.well_type}"`,
    w.depth_meters !== undefined && w.depth_meters !== '' ? w.depth_meters : '',
    w.utm_e || '',
    w.utm_n || '',
    w.latitude,
    w.longitude,
    w.distance_river_m || 0,
    `"${w.distance_band || ''}"`,
    `"${w.usage_type || ''}"`,
    w.user_count || 1,
    `"${w.health_center || ''}"`
  ]);
  downloadCsvFile('water_wells_147_maeai.csv', [headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
}

function downloadCsvFile(filename, content) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function downloadFullBackupJson() {
  const dataStr = JSON.stringify({
    wells: state.wells,
    waterLabs: state.waterLabs,
    respondents: state.respondents,
    envAs02: state.envAs02,
    knowledgeDocs: state.knowledgeDocs
  }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'arsenic_gis_full_backup.json';
  link.click();
}

function resetToSeedData() {
  if (!confirm('ต้องการล้างแคชและรีเซ็ตข้อมูลกลับเป็นค่าเริ่มต้น (แหล่งน้ำ 147 บ่อ + ผลแล็บน้ำ + Env-As-01 ทั้งหมด 283 ราย + Env-As-02 + คู่มือ) หรือไม่?')) return;
  localStorage.clear();
  state.wells = INITIAL_WELLS.map(normalizeWellRecord);
  state.respondents = INITIAL_RESPONDENTS.map(normalizeRespondentRecord);
  state.envAs02 = typeof INITIAL_ENV_AS02 !== 'undefined' ? [...INITIAL_ENV_AS02] : [];
  state.waterLabs = [...INITIAL_WATER_LABS];
  state.knowledgeDocs = [...INITIAL_KNOWLEDGE_DOCS];
  saveLocalData();
  alert('ล้างแคชและรีเซ็ตข้อมูลเริ่มต้นใหม่ทั้งหมดเรียบร้อยแล้ว!');
}

async function copyAppsScriptCode() {
  try {
    const res = await fetch('google-apps-script.gs');
    const code = await res.text();
    await navigator.clipboard.writeText(code);
    alert('คัดลอกโค้ด Google Apps Script ลงในคลิปบอร์ดเรียบร้อยแล้ว! นำไปวางในเมนู Extensions > Apps Script ของ Google Sheets ได้เลยครับ');
  } catch (err) {
    alert('คุณสามารถเปิดไฟล์ google-apps-script.gs ในโฟลเดอร์โปรเจกต์เพื่อคัดลอกโค้ดได้โดยตรงครับ');
  }
}

// ==================== WATER QUALITY LAB PARAMETERS (DOH 21 PARAMETERS) ====================
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

const INITIAL_WATER_LABS = [
  { id: 'WLAB-001', well_id: 'W001-P1', sample_code: 'P1', sample_date: '2026-05-20', lab_name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', standard_type: 'DOH_2543', collector: 'เจ้าหน้าที่ สสอ.แม่อาย', ph: '7.1', colour: '5', turbidity: '3.2', tds: '245', hardness: '120', fe: '0.22', mn: '0.09', cu: '0.04', zn: '0.18', pb: '0.002', cr: '0.004', cd: '0.0005', as_val: '0.004', hg: '0.1', so4: '38', cl: '22', no3: '6.5', f: '0.28', residual_cl: '', total_coliform: '0', faecal_coliform: '0', overall_status: 'ผ่านเกณฑ์มาตรฐาน', failed_params: '', notes: 'บ่อน้ำตื้น ม.3 ต.ท่าตอน ผลตรวจสารหนูและโลหะหนักอยู่ในเกณฑ์มาตรฐาน' },
  { id: 'WLAB-002', well_id: 'W002-P2', sample_code: 'P2', sample_date: '2026-05-20', lab_name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', standard_type: 'DOH_2543', collector: 'เจ้าหน้าที่ สสอ.แม่อาย', ph: '6.9', colour: '8', turbidity: '4.8', tds: '310', hardness: '155', fe: '0.41', mn: '0.15', cu: '0.05', zn: '0.25', pb: '0.003', cr: '0.005', cd: '0.0006', as_val: '0.006', hg: '0.12', so4: '42', cl: '28', no3: '8.2', f: '0.31', residual_cl: '', total_coliform: '0', faecal_coliform: '0', overall_status: 'ผ่านเกณฑ์มาตรฐาน', failed_params: '', notes: 'บ่อน้ำตื้น ม.3 ต.ท่าตอน ผ่านเกณฑ์มาตรฐานกรมอนามัย' },
  { id: 'WLAB-003', well_id: 'W003-P3', sample_code: 'P3', sample_date: '2026-05-20', lab_name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', standard_type: 'DOH_2543', collector: 'เจ้าหน้าที่ สสอ.แม่อาย', ph: '6.7', colour: '12', turbidity: '14.5', tds: '390', hardness: '180', fe: '0.68', mn: '0.35', cu: '0.06', zn: '0.30', pb: '0.004', cr: '0.006', cd: '0.0008', as_val: '0.008', hg: '0.15', so4: '55', cl: '34', no3: '9.0', f: '0.35', residual_cl: '', total_coliform: '4', faecal_coliform: '0', overall_status: 'เกินเกณฑ์มาตรฐาน', failed_params: 'ความขุ่น (Turbidity), เหล็ก (Fe), แมงกานีส (Mn), โคลิฟอร์มแบคทีเรีย (Total Coliform Bacteria)', notes: 'สารหนูไม่เกินเกณฑ์ (0.008 mg/L) แต่พบความขุ่น เหล็ก แมงกานีส และโคลิฟอร์มเกินเกณฑ์น้ำประปา แนะนำต้มสุกและติดตั้งถังกรองสนิมเหล็ก' },
  { id: 'WLAB-004', well_id: 'W004-P4', sample_code: 'P4', sample_date: '2026-05-20', lab_name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', standard_type: 'DOH_2543', collector: 'เจ้าหน้าที่ สสอ.แม่อาย', ph: '7.3', colour: '5', turbidity: '2.8', tds: '220', hardness: '110', fe: '0.19', mn: '0.07', cu: '0.03', zn: '0.15', pb: '0.001', cr: '0.003', cd: '0.0004', as_val: '0.003', hg: '0.08', so4: '30', cl: '18', no3: '5.4', f: '0.24', residual_cl: '', total_coliform: '0', faecal_coliform: '0', overall_status: 'ผ่านเกณฑ์มาตรฐาน', failed_params: '', notes: 'ผลตรวจปกติทุกพารามิเตอร์' },
  { id: 'WLAB-005', well_id: 'W005-P5', sample_code: 'P5', sample_date: '2026-05-21', lab_name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่', standard_type: 'DOH_2543', collector: 'เจ้าหน้าที่ รพ.สต.บ้านท่าตอน', ph: '7.0', colour: '6', turbidity: '3.9', tds: '265', hardness: '135', fe: '0.28', mn: '0.11', cu: '0.04', zn: '0.20', pb: '0.002', cr: '0.004', cd: '0.0005', as_val: '0.005', hg: '0.10', so4: '35', cl: '24', no3: '7.1', f: '0.29', residual_cl: '', total_coliform: '0', faecal_coliform: '0', overall_status: 'ผ่านเกณฑ์มาตรฐาน', failed_params: '', notes: 'ผลตรวจปกติทุกพารามิเตอร์' }
];

const INITIAL_KNOWLEDGE_DOCS = [
  {
    id: 'DOC-001',
    title: 'แนวทางการเฝ้าระวังผลกระทบต่อสุขภาพประชาชน กรณีการปนเปื้อนสารหนูในสิ่งแวดล้อม (ฉบับสมบูรณ์ 58 หน้า)',
    category: 'แนวทางปฏิบัติ/คู่มือ',
    author: 'กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม กรมควบคุมโรค (กันยายน 2569)',
    date: '2026-09-01',
    description: 'คู่มือปฏิบัติงานฉบับหลักสำหรับบุคลากรสาธารณสุข ครอบคลุมข้อมูลพิษวิทยาสารหนู การประเมินความเสี่ยง HRA (HQ & Cancer Risk) แนวทางเฝ้าระวังเชิงรับ-เชิงรุก รหัส ICD-10 (Z13.88, R82.6, T57) การสอบสวนโรค การเก็บปัสสาวะ และภาคผนวกแบบฟอร์ม Env-As-01, 02, 03 และแบบตรวจร่างกายโดยแพทย์',
    file_url: 'แนวทางการเฝ้าระวังผลกระทบต่อสุขภาพประชา.pdf',
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
    date: '2026-05-22',
    description: 'ไฟล์ต้นฉบับ PDF แบบคัดกรองและประเมินความเสี่ยงการสัมผัสสารหนู ระดับบุคคล (ส่วนที่ 1-4 พร้อมตารางคำนวณคะแนนถ่วงน้ำหนัก 11 ข้อ คะแนนเต็ม 30.5 คะแนน)',
    file_url: 'Env-As-01_22.05.69(แม่อาย).pdf',
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
    file_url: 'Env-As-02 (ปรับปรุง_290469).pdf',
    file_type: 'pdf',
    is_builtin: true
  }
];

function checkSingleParam(paramDef, rawVal, stdType) {
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'NA', label: 'ไม่ได้ตรวจ' };
  }
  const num = parseFloat(rawVal);
  if (isNaN(num)) return { status: 'NA', label: 'ไม่ได้ตรวจ' };

  const threshold = paramDef[stdType || 'DOH_2543'];
  if (threshold === null || threshold === undefined) {
    return { status: 'PASS', label: 'ผ่านเกณฑ์' };
  }

  if (paramDef.type === 'range' || paramDef.type === 'range_opt') {
    const [minV, maxV] = threshold;
    if (num >= minV && num <= maxV) {
      return { status: 'PASS', label: `ผ่าน (${minV}-${maxV})` };
    }
    return { status: 'FAIL', label: `ไม่ผ่าน (เกณฑ์ ${minV}-${maxV})` };
  } else {
    if (num <= threshold) {
      return { status: 'PASS', label: `ผ่าน (≤${threshold})` };
    }
    return { status: 'FAIL', label: `เกินเกณฑ์ (> ${threshold})` };
  }
}

function evaluateWaterLabRecord(rec) {
  const stdType = rec.standard_type || 'DOH_2543';
  let testedCount = 0;
  const failedNames = [];

  WATER_LAB_PARAMS.forEach(p => {
    const res = checkSingleParam(p, rec[p.key], stdType);
    if (res.status !== 'NA') {
      testedCount++;
      if (res.status === 'FAIL') {
        failedNames.push(p.name);
      }
    }
  });

  const overallStatus = failedNames.length > 0 ? 'เกินเกณฑ์มาตรฐาน' : 'ผ่านเกณฑ์มาตรฐาน';
  return { testedCount, failedNames, overallStatus };
}

function renderWaterLabDashboardAndTable() {
  const labs = state.waterLabs || [];
  const totalLabs = Math.max(1, labs.length);
  const passCount = labs.filter(l => l.overall_status === 'ผ่านเกณฑ์มาตรฐาน').length;
  const failCount = labs.filter(l => l.overall_status === 'เกินเกณฑ์มาตรฐาน').length;
  const heavyMetalFail = labs.filter(l => {
    const std = l.standard_type || 'DOH_2543';
    return ['as_val', 'pb', 'cd', 'cr', 'hg'].some(k => {
      const pDef = WATER_LAB_PARAMS.find(p => p.key === k);
      return checkSingleParam(pDef, l[k], std).status === 'FAIL';
    });
  }).length;

  const statusChart = document.getElementById('chart-waterlab-status');
  if (statusChart) {
    const bars = [
      { label: 'ผ่านเกณฑ์มาตรฐานทุกพารามิเตอร์ที่ตรวจ', count: passCount, color: '#16a34a' },
      { label: 'พบพารามิเตอร์เกินเกณฑ์มาตรฐาน (ต้องปรับปรุง/เฝ้าระวัง)', count: failCount, color: '#dc2626' },
      { label: 'พบสารหนู (As) หรือโลหะหนักมีพิษเกินเกณฑ์', count: heavyMetalFail, color: '#991b1b' }
    ];
    statusChart.innerHTML = bars.map(b => {
      const pct = ((b.count / totalLabs) * 100).toFixed(1);
      return `
        <div class="bar-row">
          <div class="bar-label-line"><span>${b.label}</span><strong>${b.count} ตัวอย่าง (${pct}%)</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${b.color};"></div></div>
        </div>
      `;
    }).join('');
  }

  const paramChart = document.getElementById('chart-waterlab-params');
  if (paramChart) {
    const failCounts = WATER_LAB_PARAMS.map(p => {
      const c = labs.filter(l => checkSingleParam(p, l[p.key], l.standard_type || 'DOH_2543').status === 'FAIL').length;
      return { name: p.name, count: c };
    }).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

    if (failCounts.length === 0) {
      paramChart.innerHTML = `<div style="padding:18px; text-align:center; color:#16a34a; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ตัวอย่างน้ำทั้งหมดในระบบผ่านเกณฑ์มาตรฐานทุกพารามิเตอร์</div>`;
    } else {
      paramChart.innerHTML = failCounts.map(fc => {
        const pct = ((fc.count / totalLabs) * 100).toFixed(1);
        return `
          <div class="bar-row">
            <div class="bar-label-line"><span>${fc.name}</span><strong>เกินเกณฑ์ ${fc.count} บ่อ (${pct}%)</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:#f97316;"></div></div>
          </div>
        `;
      }).join('');
    }
  }

  renderWaterLabTable();
}

function renderWaterLabTable() {
  const tbody = document.getElementById('waterlab-table-body');
  if (!tbody) return;

  const q = (document.getElementById('waterlab-search')?.value || '').toLowerCase().trim();
  const wellFilter = document.getElementById('waterlab-filter-well')?.value || 'ALL';
  const resFilter = document.getElementById('waterlab-filter-result')?.value || 'ALL';
  const stdFilter = document.getElementById('waterlab-filter-std')?.value || 'ALL';

  const filtered = (state.waterLabs || []).filter(item => {
    if (wellFilter !== 'ALL' && item.well_id !== wellFilter) return false;
    if (resFilter !== 'ALL' && item.overall_status !== resFilter) return false;
    if (stdFilter !== 'ALL' && item.standard_type !== stdFilter) return false;
    if (q) {
      const w = state.wells.find(x => x.well_id === item.well_id);
      const hay = `${item.id} ${item.sample_code} ${item.well_id} ${w ? w.well_name + ' ' + w.tambon : ''} ${item.failed_params} ${item.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const fmtVal = (rec, key) => {
    const v = rec[key];
    if (v === undefined || v === null || v === '') return '<span style="color:#94a3b8;">-</span>';
    const pDef = WATER_LAB_PARAMS.find(p => p.key === key);
    const res = checkSingleParam(pDef, v, rec.standard_type || 'DOH_2543');
    if (res.status === 'FAIL') {
      return `<span class="lab-fail" title="${res.label}">${v} ⚠️</span>`;
    }
    return `<span class="lab-pass" title="${res.label}">${v}</span>`;
  };

  tbody.innerHTML = filtered.map(item => {
    const w = state.wells.find(x => x.well_id === item.well_id);
    const evalInfo = evaluateWaterLabRecord(item);
    const statusBadge = item.overall_status === 'เกินเกณฑ์มาตรฐาน'
      ? `<span class="risk-badge risk-high">เกินเกณฑ์ (${evalInfo.failedNames.length} ตัว)</span>`
      : `<span class="risk-badge risk-low">ผ่านเกณฑ์มาตรฐาน</span>`;

    return `
      <tr>
        <td><b>${item.sample_code || item.id}</b><div style="font-size:11px; color:#64748b;">${item.lab_name || '-'}</div></td>
        <td>${item.sample_date || '-'}</td>
        <td>
          <b>${item.well_id}</b>
          ${w ? `<div style="font-size:11.5px; color:#0f766e;">${w.well_name}</div>` : ''}
        </td>
        <td>${w ? `${w.well_type}<br/><small>ม.${w.moo} ต.${w.tambon}</small>` : '-'}</td>
        <td class="text-center">${fmtVal(item, 'as_val')}</td>
        <td style="font-size:12px;">
          pH: ${fmtVal(item, 'ph')} | ขุ่น: ${fmtVal(item, 'turbidity')}<br/>TDS: ${fmtVal(item, 'tds')}
        </td>
        <td style="font-size:12px;">
          Fe: ${fmtVal(item, 'fe')}<br/>Mn: ${fmtVal(item, 'mn')}
        </td>
        <td style="font-size:12px;">
          Pb: ${fmtVal(item, 'pb')} | Cd: ${fmtVal(item, 'cd')}<br/>Hg: ${fmtVal(item, 'hg')}
        </td>
        <td style="font-size:12px;">
          Total: ${fmtVal(item, 'total_coliform')}<br/>Faecal: ${fmtVal(item, 'faecal_coliform')}
        </td>
        <td style="font-size:11.5px; max-width:190px;">
          ตรวจรวม <b>${evalInfo.testedCount}/21</b> ตัว
          ${evalInfo.failedNames.length > 0 ? `<div style="color:#b91c1c; font-weight:600; margin-top:2px;">ไม่ผ่าน: ${evalInfo.failedNames.join(', ')}</div>` : ''}
          ${item.notes ? `<div style="color:#64748b; margin-top:2px;">${item.notes}</div>` : ''}
        </td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="openWaterLabModal('${item.id}')" title="แก้ไขผลแล็บ"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteWaterLab('${item.id}')" title="ลบ"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function buildWaterLabParamsInputs(existingRecord = null) {
  const tbody = document.getElementById('wlab-params-tbody');
  if (!tbody) return;

  tbody.innerHTML = WATER_LAB_PARAMS.map(p => {
    const val = existingRecord && existingRecord[p.key] !== undefined ? existingRecord[p.key] : '';
    return `
      <tr ${p.secId ? `id="${p.secId}"` : ''}>
        <td class="text-center"><b>${p.seq}</b></td>
        <td><b>${p.name}</b></td>
        <td class="text-center">${p.unit}</td>
        <td class="text-center">${p.whoLabel}</td>
        <td class="text-center">${p.ruralLabel}</td>
        <td class="text-center" style="background:#f0fdf4; font-weight:700; color:#0f766e;">${p.dohLabel}</td>
        <td class="text-center">
          <input type="number" step="any" class="lab-param-input" id="wlab-inp-${p.key}" value="${val}" placeholder="เว้นว่างหากไม่ตรวจ" oninput="evaluateAllWaterLabInputs()" />
        </td>
        <td class="text-center" id="wlab-badge-${p.key}">
          <span class="lab-na">ไม่ได้ตรวจ</span>
        </td>
      </tr>
    `;
  }).join('');

  evaluateAllWaterLabInputs();
}

function evaluateAllWaterLabInputs() {
  const stdType = document.getElementById('wlab-standard-type')?.value || 'DOH_2543';
  let tested = 0;
  let failed = 0;
  const failedList = [];

  WATER_LAB_PARAMS.forEach(p => {
    const inp = document.getElementById(`wlab-inp-${p.key}`);
    const badgeCell = document.getElementById(`wlab-badge-${p.key}`);
    if (!inp || !badgeCell) return;

    const res = checkSingleParam(p, inp.value, stdType);
    if (res.status === 'NA') {
      badgeCell.innerHTML = `<span class="lab-na">ไม่ได้ตรวจ</span>`;
    } else if (res.status === 'PASS') {
      tested++;
      badgeCell.innerHTML = `<span class="lab-pass"><i class="fa-solid fa-check"></i> ${res.label}</span>`;
    } else {
      tested++;
      failed++;
      failedList.push(p.name);
      badgeCell.innerHTML = `<span class="lab-fail"><i class="fa-solid fa-triangle-exclamation"></i> ${res.label}</span>`;
    }
  });

  const sumEl = document.getElementById('wlab-live-summary');
  const badgeEl = document.getElementById('wlab-live-badge');
  if (sumEl && badgeEl) {
    if (tested === 0) {
      sumEl.textContent = 'ยังไม่ได้กรอกค่าพารามิเตอร์';
      badgeEl.className = 'badge-risk risk-low';
      badgeEl.textContent = 'รอการกรอกข้อมูล';
    } else if (failed === 0) {
      sumEl.textContent = `ตรวจ ${tested} พารามิเตอร์ — ผ่านเกณฑ์มาตรฐานครบทุกตัว`;
      badgeEl.className = 'badge-risk risk-low';
      badgeEl.textContent = 'ผ่านเกณฑ์มาตรฐาน';
    } else {
      sumEl.textContent = `ตรวจ ${tested} พารามิเตอร์ — เกินเกณฑ์ ${failed} ตัว (${failedList.join(', ')})`;
      badgeEl.className = 'badge-risk risk-high';
      badgeEl.textContent = `เกินเกณฑ์มาตรฐาน (${failed} ตัว)`;
    }
  }
}

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

  if (labId) {
    const rec = state.waterLabs.find(x => x.id === labId);
    if (!rec) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> แก้ไขผลตรวจวิเคราะห์คุณภาพน้ำ (${rec.sample_code || rec.id})`;
    document.getElementById('wlab-id').value = rec.id;
    document.getElementById('wlab-well-id').value = rec.well_id;
    document.getElementById('wlab-sample-code').value = rec.sample_code || '';
    document.getElementById('wlab-sample-date').value = rec.sample_date || new Date().toISOString().slice(0, 10);
    document.getElementById('wlab-standard-type').value = rec.standard_type || 'DOH_2543';
    setSelectOrOther('wlab-lab-select', 'wlab-lab-other-wrap', 'wlab-lab-other', rec.lab_name || 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 1 เชียงใหม่');
    document.getElementById('wlab-collector').value = rec.collector || 'เจ้าหน้าที่สาธารณสุข';
    document.getElementById('wlab-notes').value = rec.notes || '';
    buildWaterLabParamsInputs(rec);
  } else {
    title.innerHTML = `<i class="fa-solid fa-flask-vial"></i> บันทึกผลตรวจวิเคราะห์คุณภาพน้ำใหม่ (ตามเกณฑ์กรมอนามัย 21 พารามิเตอร์)`;
    document.getElementById('wlab-id').value = '';
    if (preselectWellId) {
      document.getElementById('wlab-well-id').value = preselectWellId;
    }
    document.getElementById('wlab-sample-date').value = new Date().toISOString().slice(0, 10);
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
  const id = document.getElementById('wlab-id').value || `WLAB-${String(state.waterLabs.length + 1).padStart(3, '0')}`;
  const wellId = document.getElementById('wlab-well-id').value;

  const rec = {
    id,
    well_id: wellId,
    sample_code: document.getElementById('wlab-sample-code').value.trim(),
    sample_date: document.getElementById('wlab-sample-date').value,
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
      : 'ผลตรวจปกติ (ผ่านเกณฑ์)';
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

function exportWaterLabCsv() {
  const headers = [
    'รหัสผลแล็บ', 'รหัสตัวอย่าง', 'วันที่เก็บตัวอย่าง', 'รหัสบ่อน้ำ(well_id)', 'ชื่อจุดบ่อน้ำ',
    'ห้องปฏิบัติการ', 'เกณฑ์เปรียบเทียบ', 'สรุปผลการตรวจ', 'พารามิเตอร์ที่ไม่ผ่านเกณฑ์',
    ...WATER_LAB_PARAMS.map(p => `${p.name} (${p.unit})`),
    'หมายเหตุ'
  ];

  const rows = (state.waterLabs || []).map(l => {
    const w = state.wells.find(x => x.well_id === l.well_id);
    return [
      `"${l.id}"`,
      `"${l.sample_code || ''}"`,
      `"${l.sample_date || ''}"`,
      `"${l.well_id || ''}"`,
      `"${w ? w.well_name : ''}"`,
      `"${l.lab_name || ''}"`,
      `"${l.standard_type || 'DOH_2543'}"`,
      `"${l.overall_status || ''}"`,
      `"${l.failed_params || ''}"`,
      ...WATER_LAB_PARAMS.map(p => l[p.key] !== undefined && l[p.key] !== '' ? l[p.key] : ''),
      `"${l.notes || ''}"`
    ];
  });

  downloadCsvFile('water_quality_lab_doh21_maeai.csv', [headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
}

// ==================== KNOWLEDGE BASE / MANUALS & BUILT-IN VIEWER ====================
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
  document.getElementById('kb-date').value = new Date().toISOString().slice(0, 10);
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
