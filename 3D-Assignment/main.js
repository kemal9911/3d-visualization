// ---------------- GLOBALS ----------------
let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

const CLIENT_ID = window.CLIENT_ID || "";
const SHEET_CSV_URL = window.SHEET_CSV_URL || "";

let isLoggedIn = false;

// ---------------- GOOGLE SIGN-IN ----------------
function handleCredentialResponse(response) {
  document.getElementById('user-info').innerText = "Signed In ✔";
  document.getElementById('controls').style.display = "flex";
  isLoggedIn = true;

  // Now start 3D + CSV
  initThree();
  fetchAndBuild();
}

function tryInitGoogleSignIn() {
  if (typeof google !== "undefined" && google.accounts && CLIENT_ID) {
    try {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup"
      });

      google.accounts.id.renderButton(
        document.getElementById("user-info"),
        { theme: "outline", size: "large" }
      );

    } catch (err) {
      console.warn("Google Identity init failed:", err);
      document.getElementById('user-info').innerText = "Sign-in ready";
    }
  } else {
    document.getElementById('user-info').innerText =
      CLIENT_ID ? "Sign-in ready" : "Sign-in not configured";
  }
}

// ---------------- STARTUP ----------------
window.onload = () => {
  tryInitGoogleSignIn();
};

// ---------------- CSV FETCH & BUILD ----------------
async function fetchAndBuild() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const text = await res.text();
    const rows = CSVToArray(text);
    const data = rowsToObjects(rows);

    createObjectsFromData(data);
    buildTableTargets();
    buildSphereTargets();
    buildDoubleHelixTargets();
    buildGridTargets();

    transform(targets.table, 2000);
  } catch (err) {
    console.error(err);
    alert("Error loading Google Sheet CSV. Check console.");
  }
}

// ---------------- CSV PARSER ----------------
function CSVToArray(str) {
  const rows = [];
  const lines = str.split(/\r?\n/).filter(l => l.trim() !== "");

  for (const line of lines) {
    const values = [];
    let cur = "", inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(cur); cur = ""; continue; }
      cur += ch;
    }

    values.push(cur);
    rows.push(values.map(v => v.trim()));
  }
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0].map(h => h.replace(/\s+/g, ""));
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] || "";
    }
    data.push(obj);
  }
  return data;
}

// ---------------- TILE CREATION ----------------
function createTileElement(d) {
  const el = document.createElement("div");
  el.className = "element";

  const netKey = (d.NetWorth !== undefined)
    ? "NetWorth"
    : (d.Networth !== undefined)
      ? "Networth"
      : (Object.keys(d).find(k => /networth/i.test(k)) || "");

  const netValue = netKey ? d[netKey] : "";

  el.style.backgroundColor = tileColorFromWorth(netValue);

  el.innerHTML = `
    <div>
      <div class="name">${escapeHtml(d.Name || "")}</div>
      <div class="company">${escapeHtml(d.Company || "")}</div>
      <div class="country">${escapeHtml(d.Country || "")}</div>
    </div>
    <div class="worth">${escapeHtml(formatMoney(netValue))}</div>
  `;

  return el;
}

function createObjectsFromData(data) {
  for (const o of objects) if (o.parent) scene.remove(o);
  objects.length = 0;

  for (let i = 0; i < data.length; i++) {
    const tile = createTileElement(data[i]);
    const object = new THREE.CSS3DObject(tile);

    object.position.x = Math.random() * 4000 - 2000;
    object.position.y = Math.random() * 4000 - 2000;
    object.position.z = Math.random() * 4000 - 2000;

    scene.add(object);
    objects.push(object);
  }
}

function escapeHtml(s) {
  return s ? String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

function parseNetWorth(w) {
  if (!w) return 0;
  let s = w.replace(/\$/g, "").replace(/,/g, "").trim().toUpperCase();
  if (s.endsWith("B")) return parseFloat(s) * 1e9;
  if (s.endsWith("M")) return parseFloat(s) * 1e6;
  if (s.endsWith("K")) return parseFloat(s) * 1e3;
  return parseFloat(s) || 0;
}

function tileColorFromWorth(w) {
  const v = parseNetWorth(w);
  if (v < 100000) return "#ff4d4f";   // RED
  if (v > 200000) return "#52c41a";   // GREEN
  return "#fa8c16";                   // ORANGE
}

function formatMoney(w) {
  const v = parseNetWorth(w);
  if (!w) return "";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1000) return (v / 1000).toFixed(2) + "K";
  return v;
}

// ---------------- 3D INITIAL SETUP ----------------
function initThree() {
  const container = document.getElementById("container");

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 2000;

  scene = new THREE.Scene();

  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  container.appendChild(renderer.domElement);

  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;

  document.getElementById("tableBtn").onclick = () => transform(targets.table);
  document.getElementById("sphereBtn").onclick = () => transform(targets.sphere);
  document.getElementById("helixBtn").onclick = () => transform(targets.helix);
  document.getElementById("gridBtn").onclick = () => transform(targets.grid);

  window.addEventListener('resize', onWindowResize, false);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
  requestAnimationFrame(animate);
  if (TWEEN.update) TWEEN.update(time);
  controls.update();
  renderer.render(scene, camera);
}

// ---------------- LAYOUT TARGETS ----------------
function buildTableTargets() {
  const cols = 20;
  const rows = 10;
  const spacingX = 200;
  const spacingY = 220;

  targets.table = [];

  for (let i = 0; i < objects.length; i++) {
    const obj = new THREE.Object3D();
    const col = i % cols;
    const row = Math.floor(i / cols);

    obj.position.x = (col - 9.5) * spacingX;
    obj.position.y = (4.5 - row) * spacingY;
    obj.position.z = 0;

    targets.table.push(obj);
  }
}

function buildSphereTargets() {
  const radius = 1200;
  const l = objects.length;
  targets.sphere = [];

  for (let i = 0; i < l; i++) {
    const phi = Math.acos(-1 + (2 * i) / l);
    const theta = Math.sqrt(l * Math.PI) * phi;

    const obj = new THREE.Object3D();
    obj.position.x = radius * Math.cos(theta) * Math.sin(phi);
    obj.position.y = radius * Math.sin(theta) * Math.sin(phi);
    obj.position.z = radius * Math.cos(phi);

    targets.sphere.push(obj);
  }
}

function buildDoubleHelixTargets() {
  const radius = 700;
  const separation = 120;
  const spacingY = 14;

  targets.helix = [];

  for (let i = 0; i < objects.length; i++) {
    const theta = i * 0.35;
    const y = -i * spacingY + (objects.length * spacingY) / 2;
    const arm = i % 2 === 0 ? 1 : -1;

    const obj = new THREE.Object3D();
    obj.position.x = Math.sin(theta) * (radius + arm * separation);
    obj.position.y = y;
    obj.position.z = Math.cos(theta) * (radius + arm * separation);

    targets.helix.push(obj);
  }
}

function buildGridTargets() {
  const xCount = 5, yCount = 4, zCount = 10;
  const spacing = 350;

  targets.grid = [];
  let i = 0;

  for (let x = 0; x < xCount; x++) {
    for (let y = 0; y < yCount; y++) {
      for (let z = 0; z < zCount; z++) {
        if (!objects[i]) return;

        const obj = new THREE.Object3D();
        obj.position.set(
          (x - 2) * spacing,
          (y - 1.5) * spacing,
          (z - 4.5) * spacing
        );

        targets.grid.push(obj);
        i++;
      }
    }
  }
}

function transform(targetsArr, duration = 2000) {
  TWEEN.removeAll();

  for (let i = 0; i < objects.length; i++) {
    if (!targetsArr[i]) continue;

    new TWEEN.Tween(objects[i].position)
      .to(targetsArr[i].position, duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }
}
