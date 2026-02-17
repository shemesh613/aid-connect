// ============================================
// Aid Connect - Map View (Leaflet + OpenStreetMap)
// ============================================

let taskMap = null;
let mapMarkers = [];
let mapInitialized = false;

const URGENCY_COLORS = {
  high: '#E53935',
  medium: '#FB8C00',
  low: '#43A047'
};

const TASK_ICONS = {
  medical: '🏥',
  transport: '🚗',
  shopping: '🛒',
  general: '🤝'
};

function initMap() {
  if (mapInitialized) return;

  const mapEl = document.getElementById('tasks-map');
  if (!mapEl) return;

  // Default: Israel center
  taskMap = L.map('tasks-map', { zoomControl: false }).setView([31.77, 35.21], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18
  }).addTo(taskMap);

  L.control.zoom({ position: 'topleft' }).addTo(taskMap);

  // Try to get user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        taskMap.setView([pos.coords.latitude, pos.coords.longitude], 13);
      },
      () => {},
      { timeout: 5000 }
    );
  }

  mapInitialized = true;
  loadTasksOnMap();
}

function loadTasksOnMap() {
  if (!taskMap) return;

  const handleSnapshot = (snapshot) => {
    // Clear old markers
    mapMarkers.forEach(m => taskMap.removeLayer(m));
    mapMarkers = [];

    const tasks = [];
    snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));

    // Filter to open only (in case fallback returns all)
    const openTasks = tasks.filter(t => t.status === 'open');

    // Geocode and place markers
    openTasks.forEach(task => {
      if (task.lat && task.lng) {
        addTaskMarker(task, task.lat, task.lng);
      } else if (task.locationFrom) {
        geocodeAndMark(task, task.locationFrom);
      }
    });
  };

  db.collection('tasks')
    .where('status', '==', 'open')
    .onSnapshot(handleSnapshot, (error) => {
      console.error('Map tasks error, using fallback:', error);
      db.collection('tasks').onSnapshot(handleSnapshot);
    });
}

function addTaskMarker(task, lat, lng) {
  const color = URGENCY_COLORS[task.urgency] || '#666';
  const icon = TASK_ICONS[task.type] || '📌';

  const marker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'task-map-marker',
      html: `<div style="
        background:${color};
        color:white;
        width:36px;
        height:36px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        border:2px solid white;
      ">${icon}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    })
  }).addTo(taskMap);

  const urgLabel = { high: '🔴 דחוף', medium: '🟠 בינוני', low: '🟢 רגיל' };

  marker.bindPopup(`
    <div style="direction:rtl; text-align:right; min-width:180px; font-family:'Heebo',sans-serif;">
      <strong style="font-size:1.1em;">${task.title}</strong><br>
      <span style="color:${color}; font-size:0.85em;">${urgLabel[task.urgency] || ''}</span><br>
      ${task.locationFrom ? `📍 ${task.locationFrom}<br>` : ''}
      ${task.contact ? `📞 <a href="tel:${task.contact}">${task.contact}</a><br>` : ''}
      <button onclick="takeTask('${task.id}')" style="
        margin-top:8px;
        background:#1976D2;
        color:white;
        border:none;
        padding:6px 16px;
        border-radius:8px;
        cursor:pointer;
        font-family:inherit;
        font-size:0.9em;
      ">✋ אני לוקח!</button>
    </div>
  `, { direction: 'right' });

  mapMarkers.push(marker);
}

// Simple geocoding using Nominatim (free, rate-limited)
async function geocodeAndMark(task, address) {
  try {
    // Add "Israel" to improve results
    const query = encodeURIComponent(address + ', ישראל');
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=he`);
    const data = await resp.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      addTaskMarker(task, lat, lng);

      // Cache coordinates in Firestore
      db.collection('tasks').doc(task.id).update({ lat, lng }).catch(() => {});
    }
  } catch (e) {
    console.log('Geocode error:', e);
  }
}

// Refresh map when navigating to it
function onMapView() {
  if (!mapInitialized) {
    setTimeout(initMap, 100);
  } else {
    taskMap.invalidateSize();
  }
}
