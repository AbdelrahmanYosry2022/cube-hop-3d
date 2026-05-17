import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import noorModelUrl from "./assets/noor-model.glb?url";

const gameRoot = document.querySelector("#game");
const loading = document.querySelector("#loading");
const levelTextEl = document.querySelector("#levelText");
const moveCountEl = document.querySelector("#moveCount");
const starRatingEl = document.querySelector("#starRating");
const tilePositionEl = document.querySelector("#tilePosition");
const statusTextEl = document.querySelector("#statusText");
const restartButton = document.querySelector("#restartButton");
const winOverlay = document.querySelector("#winOverlay");
const winEyebrow = document.querySelector("#winEyebrow");
const winTitle = document.querySelector("#winTitle");
const winDetail = document.querySelector("#winDetail");
const resultStars = document.querySelector("#resultStars");
const resultMoves = document.querySelector("#resultMoves");
const resultTime = document.querySelector("#resultTime");
const resultPar = document.querySelector("#resultPar");
const nextLevelButton = document.querySelector("#nextLevelButton");
const overlayRestartButton = document.querySelector("#overlayRestartButton");
const cameraButton = document.querySelector("#cameraButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
const orientationFullscreenButton = document.querySelector("#orientationFullscreenButton");
const controlButtons = [...document.querySelectorAll(".control-key")];
const avatarButtons = [...document.querySelectorAll(".avatar-button")];

const tileSize = 1.5;
const boardRadius = 4;
const hopDuration = 260;
const landingDuration = 320;
const noorForwardOffset = -Math.PI / 2;
const cameraPresets = {
  classic: {
    label: "Classic camera",
    icon: "◉",
    offset: new THREE.Vector3(5.8, 6.5, 7.6),
    lookAtYOffset: 0,
    lerp: 0.07,
  },
  mobile: {
    label: "Mobile camera",
    icon: "◎",
    offset: new THREE.Vector3(4.2, 4.55, 5.6),
    lookAtYOffset: 0.18,
    lerp: 0.09,
  },
};
const levels = [
  {
    name: "Level 1",
    par: 7,
    start: { x: 0, z: 0 },
    goal: { x: 3, z: -3 },
    hazards: [
      { x: 1, z: -1 },
      { x: 2, z: -1 },
      { x: -1, z: -2 },
      { x: 0, z: 2 },
      { x: 2, z: 1 },
      { x: -3, z: 1 },
    ],
    disappearing: [],
  },
  {
    name: "Level 2",
    par: 10,
    start: { x: -3, z: 3 },
    goal: { x: 3, z: -3 },
    hazards: [
      { x: -2, z: 1 },
      { x: -1, z: 1 },
      { x: 1, z: -1 },
      { x: 2, z: -2 },
      { x: 0, z: 2 },
      { x: 3, z: 0 },
    ],
    disappearing: [
      { x: -1, z: 2, phase: 0 },
      { x: 0, z: 1, phase: 0.35 },
      { x: 1, z: 0, phase: 0.7 },
      { x: 2, z: -1, phase: 1.05 },
    ],
  },
  {
    name: "Level 3",
    par: 13,
    start: { x: -4, z: 4 },
    goal: { x: 4, z: -4 },
    hazards: [
      { x: -3, z: 2 },
      { x: -1, z: 2 },
      { x: 1, z: 1 },
      { x: 2, z: 0 },
      { x: 3, z: -1 },
      { x: 0, z: -2 },
      { x: -2, z: -1 },
      { x: 1, z: -3 },
    ],
    disappearing: [
      { x: -3, z: 3, phase: 0.05 },
      { x: -2, z: 2, phase: 0.4 },
      { x: -1, z: 1, phase: 0.75 },
      { x: 0, z: 0, phase: 1.1 },
      { x: 1, z: -1, phase: 1.45 },
      { x: 2, z: -2, phase: 1.8 },
    ],
  },
];

let moves = 0;
let lastStarScore = 3;
let levelStartedAt = performance.now();
let levelElapsedMs = 0;
let levelIndex = 0;
let level = levels[levelIndex];
let currentTile = { ...level.start };
let targetTile = { ...level.start };
let hop = null;
let gameState = "playing";
let statusMessage = "Find goal";
let activeAvatar = "cube";
let noorModel = null;
let noorMixer = null;
let noorHopAction = null;
let noorReady = false;
let noorLoading = false;
let queuedNoorSelection = false;
let devQueryApplied = false;
let avatarYaw = 0;
let lastFrameTime = performance.now();
let landingStartedAt = null;
let hazardKeys = new Set();
let disappearingKeys = new Set();
let disappearingActiveKeys = new Set();
let goalKey = "";
let audioContext = null;
let cameraMode = "classic";
let cameraModeLocked = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111419);
scene.fog = new THREE.Fog(0x111419, 12, 25);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5.8, 6.5, 7.6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
gameRoot.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xc9fff0, 0x1f2430, 1.8);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xfff1cf, 3.2);
sun.position.set(4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 24;
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
scene.add(sun);

const board = new THREE.Group();
scene.add(board);

const tileGeo = new THREE.BoxGeometry(1.34, 0.18, 1.34);
const tileMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x2c343d, roughness: 0.72, metalness: 0.05 }),
  new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.78, metalness: 0.03 }),
];
const hazardTileMaterial = new THREE.MeshStandardMaterial({ color: 0x503039, roughness: 0.8, metalness: 0.02 });
const goalTileMaterial = new THREE.MeshStandardMaterial({ color: 0x244a3a, roughness: 0.68, metalness: 0.04 });
const disappearingTileMaterial = new THREE.MeshStandardMaterial({
  color: 0x31556b,
  roughness: 0.66,
  metalness: 0.04,
  transparent: true,
  opacity: 0.92,
});

function tileKey(tile) {
  return `${tile.x},${tile.z}`;
}

const boardTiles = new Map();

for (let x = -boardRadius; x <= boardRadius; x += 1) {
  for (let z = -boardRadius; z <= boardRadius; z += 1) {
    const material = tileMaterials[Math.abs(x + z) % 2];
    const tile = new THREE.Mesh(tileGeo, material);
    tile.position.set(x * tileSize, -0.12, z * tileSize);
    tile.receiveShadow = true;
    tile.userData.baseMaterial = material;
    tile.userData.key = tileKey({ x, z });
    boardTiles.set(tile.userData.key, tile);
    board.add(tile);
  }
}

const hazardGroup = new THREE.Group();
const hazardSpikeGeo = new THREE.ConeGeometry(0.26, 0.36, 4);
const hazardSpikeMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.52, metalness: 0.05 });
scene.add(hazardGroup);

const goalGroup = new THREE.Group();
const goalRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.48, 0.045, 10, 42),
  new THREE.MeshBasicMaterial({ color: 0x42d392 })
);
goalRing.rotation.x = Math.PI / 2;
goalRing.position.y = 0.08;
goalGroup.add(goalRing);
const goalGem = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.34),
  new THREE.MeshStandardMaterial({ color: 0x42d392, emissive: 0x103d2c, roughness: 0.36, metalness: 0.16 })
);
goalGem.position.y = 0.72;
goalGem.castShadow = true;
goalGroup.add(goalGem);
scene.add(goalGroup);

const targetMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.48, 0.58, 32),
  new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.84 })
);
targetMarker.rotation.x = -Math.PI / 2;
targetMarker.position.y = 0.01;
scene.add(targetMarker);

const player = new THREE.Group();
const cubeAvatar = new THREE.Group();
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0x42d392,
    roughness: 0.45,
    metalness: 0.18,
  })
);
cube.castShadow = true;
cube.receiveShadow = true;
cube.position.y = 0.5;
cubeAvatar.add(cube);

const cubeEdge = new THREE.LineSegments(
  new THREE.EdgesGeometry(cube.geometry),
  new THREE.LineBasicMaterial({ color: 0xe8fff6, transparent: true, opacity: 0.45 })
);
cubeEdge.position.copy(cube.position);
cubeAvatar.add(cubeEdge);
player.add(cubeAvatar);
scene.add(player);

const noorAvatar = new THREE.Group();
noorAvatar.visible = false;
player.add(noorAvatar);

const noorBody = new THREE.Group();
noorAvatar.add(noorBody);

const forwardMarker = new THREE.Mesh(
  new THREE.ConeGeometry(0.16, 0.42, 3),
  new THREE.MeshBasicMaterial({ color: 0xff5c5c })
);
forwardMarker.name = "NoorForwardMarker";
forwardMarker.position.set(0.92, 0.72, 0);
forwardMarker.rotation.z = -Math.PI / 2;
forwardMarker.visible = false;
noorAvatar.add(forwardMarker);

const landingRing = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.55, 42),
  new THREE.MeshBasicMaterial({
    color: 0xffcf5c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
);
landingRing.rotation.x = -Math.PI / 2;
landingRing.position.y = 0.045;
landingRing.visible = false;
scene.add(landingRing);

const effectGroup = new THREE.Group();
const effectParticleGeo = new THREE.SphereGeometry(0.055, 8, 8);
const activeParticles = [];
scene.add(effectGroup);

const grid = new THREE.GridHelper((boardRadius * 2 + 1) * tileSize, boardRadius * 2 + 1, 0x42d392, 0x3f4b55);
grid.position.y = 0.012;
grid.material.transparent = true;
grid.material.opacity = 0.18;
scene.add(grid);

function tileToWorld(tile) {
  return {
    x: tile.x * tileSize,
    z: tile.z * tileSize,
  };
}

function clampTile(value) {
  return Math.max(-boardRadius, Math.min(boardRadius, value));
}

function setPlayerToTile(tile) {
  const world = tileToWorld(tile);
  player.position.set(world.x, 0, world.z);
  targetMarker.position.x = world.x;
  targetMarker.position.z = world.z;
}

function resetBoardVisuals() {
  boardTiles.forEach((tile) => {
    tile.material = tile.userData.baseMaterial;
    tile.visible = true;
    tile.position.y = -0.12;
  });

  hazardKeys.forEach((key) => {
    const tile = boardTiles.get(key);
    if (tile) tile.material = hazardTileMaterial;
  });

  disappearingKeys.forEach((key) => {
    const tile = boardTiles.get(key);
    if (tile) tile.material = disappearingTileMaterial;
  });

  const goalTile = boardTiles.get(goalKey);
  if (goalTile) goalTile.material = goalTileMaterial;
}

function rebuildHazards() {
  hazardGroup.clear();
  level.hazards.forEach((tile) => {
    const world = tileToWorld(tile);
    const spike = new THREE.Mesh(hazardSpikeGeo, hazardSpikeMaterial);
    spike.position.set(world.x, 0.16, world.z);
    spike.rotation.y = Math.PI / 4;
    spike.castShadow = true;
    hazardGroup.add(spike);
  });
}

function loadLevel(nextIndex, message = "Find goal") {
  hideWinOverlay();
  levelIndex = Math.max(0, Math.min(levels.length - 1, nextIndex));
  level = levels[levelIndex];
  hazardKeys = new Set(level.hazards.map(tileKey));
  disappearingKeys = new Set(level.disappearing.map(tileKey));
  disappearingActiveKeys = new Set(disappearingKeys);
  goalKey = tileKey(level.goal);

  currentTile = { ...level.start };
  targetTile = { ...level.start };
  hop = null;
  moves = 0;
  lastStarScore = 3;
  levelStartedAt = performance.now();
  levelElapsedMs = 0;
  landingStartedAt = null;
  landingRing.visible = false;
  gameState = "playing";
  statusMessage = message;

  const goalWorld = tileToWorld(level.goal);
  goalGroup.position.set(goalWorld.x, 0, goalWorld.z);
  rebuildHazards();
  resetBoardVisuals();
  setPlayerToTile(currentTile);
  updateHud();
}

function isHazard(tile) {
  return hazardKeys.has(tileKey(tile));
}

function isGoal(tile) {
  return tileKey(tile) === goalKey;
}

function isMissingTile(tile) {
  const key = tileKey(tile);
  return disappearingKeys.has(key) && !disappearingActiveKeys.has(key);
}

function calculateStars(moveCount = moves) {
  if (moveCount <= level.par) return 3;
  if (moveCount <= level.par + 3) return 2;
  return 1;
}

function formatStars(score) {
  return `${"★".repeat(score)}${"☆".repeat(3 - score)}`;
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function updateHud() {
  levelTextEl.textContent = String(levelIndex + 1);
  moveCountEl.textContent = String(moves);
  lastStarScore = calculateStars();
  starRatingEl.textContent = formatStars(lastStarScore);
  tilePositionEl.textContent = `${currentTile.x}, ${currentTile.z}`;
  statusTextEl.textContent = statusMessage;
  document.body.dataset.avatar = activeAvatar;
  document.body.dataset.avatarYaw = avatarYaw.toFixed(3);
  document.body.dataset.gameState = gameState;
  document.body.dataset.status = statusMessage;
  document.body.dataset.level = String(levelIndex + 1);
}

function setLoadingMessage(message, isError = false) {
  loading.textContent = message;
  loading.classList.toggle("is-hidden", !message);
  loading.classList.toggle("is-error", isError);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, duration, type = "sine", volume = 0.06, delay = 0) {
  const audio = getAudioContext();
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(name) {
  if (name === "hop") {
    playTone(260, 0.09, "triangle", 0.045);
    playTone(420, 0.08, "sine", 0.025, 0.035);
  }
  if (name === "danger") {
    playTone(170, 0.16, "sawtooth", 0.05);
    playTone(96, 0.2, "square", 0.035, 0.08);
  }
  if (name === "win") {
    [392, 523, 659, 784].forEach((note, index) => playTone(note, 0.14, "sine", 0.055, index * 0.09));
  }
}

function showWinOverlay({ final = false } = {}) {
  winOverlay.classList.remove("is-hidden");
  winEyebrow.textContent = final ? "Game clear" : "Level clear";
  winTitle.textContent = final ? "You win!" : `${formatStars(lastStarScore)} clear!`;
  winDetail.textContent = final
    ? `Finished ${level.name}.`
    : `${levels[levelIndex + 1].name} is ready.`;
  resultStars.textContent = formatStars(lastStarScore);
  resultMoves.textContent = String(moves);
  resultTime.textContent = formatTime(levelElapsedMs);
  resultPar.textContent = String(level.par);
  nextLevelButton.textContent = final ? "Play again" : "Next level";
}

function hideWinOverlay() {
  winOverlay.classList.add("is-hidden");
}

function directionToYaw(direction) {
  if (direction.x !== 0) return direction.x > 0 ? Math.PI / 2 : -Math.PI / 2;
  return direction.z > 0 ? 0 : Math.PI;
}

function shortestAngleLerp(start, end, amount) {
  let delta = end - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return start + delta * amount;
}

function setNoorMotion(amount, direction) {
  const leanX = direction ? direction.z * -0.18 * amount : 0;
  const leanZ = direction ? direction.x * 0.18 * amount : 0;
  const twistY = direction ? direction.x * 0.12 * amount : 0;
  noorBody.rotation.x = leanX;
  noorBody.rotation.z = leanZ;
  noorBody.rotation.y = twistY;
  noorBody.position.y = Math.sin(amount * Math.PI) * 0.1;
}

function playNoorHop() {
  if (!noorHopAction) return;
  noorHopAction.reset();
  noorHopAction.setLoop(THREE.LoopOnce, 1);
  noorHopAction.clampWhenFinished = true;
  noorHopAction.play();
}

function startLandingEffect() {
  const world = tileToWorld(targetTile);
  landingStartedAt = performance.now();
  landingRing.position.x = world.x;
  landingRing.position.z = world.z;
  landingRing.scale.setScalar(0.78);
  landingRing.material.opacity = 0.7;
  landingRing.visible = true;
}

function spawnBurst(tile, color = 0x42d392, count = 18) {
  const world = tileToWorld(tile);
  for (let index = 0; index < count; index += 1) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const particle = new THREE.Mesh(effectParticleGeo, material);
    const angle = (index / count) * Math.PI * 2;
    const speed = 0.035 + Math.random() * 0.035;
    particle.position.set(world.x, 0.32 + Math.random() * 0.3, world.z);
    effectGroup.add(particle);
    activeParticles.push({
      mesh: particle,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, 0.045 + Math.random() * 0.06, Math.sin(angle) * speed),
      bornAt: performance.now(),
      life: 520 + Math.random() * 320,
    });
  }
}

function resetLevel(message = "Try again") {
  hideWinOverlay();
  gameState = "resetting";
  statusMessage = message;
  spawnBurst(currentTile, 0xff6b6b, 16);
  updateHud();

  window.setTimeout(() => {
    loadLevel(levelIndex, "Find goal");
  }, 850);
}

function finishLevel() {
  playSound("win");
  lastStarScore = calculateStars();
  levelElapsedMs = performance.now() - levelStartedAt;
  spawnBurst(currentTile, 0x42d392, 28);
  if (levelIndex < levels.length - 1) {
    gameState = "won";
    statusMessage = "Level clear!";
    updateHud();
    showWinOverlay({ final: false });
    return;
  }

  gameState = "won";
  statusMessage = "Game clear!";
  updateHud();
  showWinOverlay({ final: true });
}

function animateLandingEffect(now) {
  if (!landingStartedAt) {
    noorBody.scale.set(1, 1, 1);
    return;
  }

  const progress = Math.min((now - landingStartedAt) / landingDuration, 1);
  const impact = 1 - progress;
  const bounce = Math.sin(progress * Math.PI);

  landingRing.scale.setScalar(0.78 + progress * 1.1);
  landingRing.material.opacity = impact * 0.62;

  if (activeAvatar === "noor") {
    noorBody.scale.set(1 + impact * 0.08, 1 - impact * 0.12 + bounce * 0.04, 1 + impact * 0.08);
  }

  if (progress >= 1) {
    landingStartedAt = null;
    landingRing.visible = false;
    noorBody.scale.set(1, 1, 1);
  }
}

function animateParticles(now) {
  for (let index = activeParticles.length - 1; index >= 0; index -= 1) {
    const particle = activeParticles[index];
    const age = now - particle.bornAt;
    const progress = Math.min(age / particle.life, 1);
    particle.velocity.y -= 0.003;
    particle.mesh.position.add(particle.velocity);
    particle.mesh.material.opacity = 0.9 * (1 - progress);
    particle.mesh.scale.setScalar(1 - progress * 0.55);

    if (progress >= 1) {
      effectGroup.remove(particle.mesh);
      particle.mesh.material.dispose();
      activeParticles.splice(index, 1);
    }
  }
}

function animateDisappearingTiles(now) {
  disappearingActiveKeys.clear();

  level.disappearing.forEach((tileConfig) => {
    const key = tileKey(tileConfig);
    const tile = boardTiles.get(key);
    if (!tile) return;

    const wave = Math.sin(now * 0.0028 + tileConfig.phase * Math.PI);
    const active = wave > -0.72;
    tile.visible = active;
    tile.position.y = active ? -0.12 + Math.max(0, wave) * 0.025 : -0.35;

    if (active) disappearingActiveKeys.add(key);
  });

  if (gameState === "playing" && !hop && isMissingTile(currentTile)) {
    resetLevel("No tile!");
  }
}

function applyDevQuery() {
  if (devQueryApplied) return;
  const params = new URLSearchParams(window.location.search);
  const avatar = params.get("avatar");
  const move = params.get("move");
  const movesParam = params.get("moves");
  const debugMode = params.get("debug") === "1";

  if (avatar === "noor" && !noorReady) {
    queuedNoorSelection = true;
    loadNoorModel(true);
    return;
  }

  devQueryApplied = true;
  if (avatar === "noor") setAvatar("noor");
  if (avatar === "cube") setAvatar("cube");
  if (!debugMode) return;

  if (params.get("complete") === "1") {
    window.setTimeout(() => finishLevel(), 350);
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(move)) {
    window.setTimeout(() => tryMove(move), 250);
  }
  if (movesParam) {
    movesParam
      .split(",")
      .map((item) => item.trim())
      .filter((item) => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(item))
      .forEach((item, index) => window.setTimeout(() => tryMove(item), 350 + index * 720));
  }
}

function setAvatar(avatar) {
  if (avatar === "noor" && !noorReady) {
    queuedNoorSelection = true;
    loadNoorModel(true);
    return;
  }
  activeAvatar = avatar;
  cubeAvatar.visible = avatar === "cube";
  noorAvatar.visible = avatar === "noor";
  avatarButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.avatar === avatar);
  });
  updateHud();
}

function pulseButton(key) {
  const button = controlButtons.find((item) => item.dataset.key === key);
  if (!button) return;
  button.classList.add("is-active");
  window.setTimeout(() => button.classList.remove("is-active"), 140);
}

function tryMove(key) {
  if (hop || gameState !== "playing") return;

  const direction = {
    ArrowUp: { x: 0, z: -1 },
    ArrowDown: { x: 0, z: 1 },
    ArrowLeft: { x: -1, z: 0 },
    ArrowRight: { x: 1, z: 0 },
  }[key];

  if (!direction) return;
  pulseButton(key);

  const nextTile = {
    x: clampTile(currentTile.x + direction.x),
    z: clampTile(currentTile.z + direction.z),
  };

  if (nextTile.x === currentTile.x && nextTile.z === currentTile.z) return;

  const start = { ...currentTile };
  targetTile = nextTile;
  const startWorld = tileToWorld(start);
  const endWorld = tileToWorld(nextTile);

  hop = {
    startTime: performance.now(),
    startWorld,
    endWorld,
    direction,
    startYaw: avatarYaw,
    endYaw: directionToYaw(direction) + noorForwardOffset,
    startRotation: cube.rotation.clone(),
    endRotation: new THREE.Euler(
      cube.rotation.x + direction.z * Math.PI * 0.5,
      cube.rotation.y,
      cube.rotation.z - direction.x * Math.PI * 0.5
    ),
  };

  playSound("hop");
  if (activeAvatar === "noor") playNoorHop();
}

function finishHop() {
  currentTile = { ...targetTile };
  moves += 1;
  hop = null;
  setPlayerToTile(currentTile);
  startLandingEffect();
  if (isMissingTile(currentTile)) {
    playSound("danger");
    resetLevel("No tile!");
    return;
  }
  if (isHazard(currentTile)) {
    playSound("danger");
    resetLevel("Danger!");
    return;
  }
  if (isGoal(currentTile)) {
    finishLevel();
    return;
  }
  statusMessage = "Find goal";
  updateHud();
}

function animateHop(now) {
  if (!hop) return;

  const progress = Math.min((now - hop.startTime) / hopDuration, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  const jumpHeight = Math.sin(progress * Math.PI) * 0.72;

  player.position.x = THREE.MathUtils.lerp(hop.startWorld.x, hop.endWorld.x, eased);
  player.position.z = THREE.MathUtils.lerp(hop.startWorld.z, hop.endWorld.z, eased);
  player.position.y = jumpHeight;
  avatarYaw = shortestAngleLerp(hop.startYaw, hop.endYaw, Math.min(progress * 4, 1));
  noorAvatar.rotation.y = avatarYaw;
  document.body.dataset.avatarYaw = avatarYaw.toFixed(3);

  if (activeAvatar === "cube") {
    cube.rotation.x = THREE.MathUtils.lerp(hop.startRotation.x, hop.endRotation.x, eased);
    cube.rotation.z = THREE.MathUtils.lerp(hop.startRotation.z, hop.endRotation.z, eased);
  } else {
    setNoorMotion(Math.sin(progress * Math.PI), hop.direction);
  }

  targetMarker.position.x = hop.endWorld.x;
  targetMarker.position.z = hop.endWorld.z;
  targetMarker.material.opacity = 0.42 + Math.sin(progress * Math.PI) * 0.42;

  if (progress >= 1) finishHop();
}

function updateCamera() {
  const preset = cameraPresets[cameraMode] || cameraPresets.classic;
  const follow = new THREE.Vector3(
    player.position.x + preset.offset.x,
    preset.offset.y,
    player.position.z + preset.offset.z
  );
  camera.position.lerp(follow, preset.lerp);
  camera.lookAt(player.position.x, preset.lookAtYOffset, player.position.z);
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  if (noorMixer) noorMixer.update(delta);
  animateHop(now);
  animateLandingEffect(now);
  animateParticles(now);
  animateDisappearingTiles(now);
  if (!hop) setNoorMotion(0, null);
  targetMarker.rotation.z += 0.012;
  hazardGroup.children.forEach((spike) => {
    spike.rotation.y += 0.018;
  });
  goalGem.rotation.y += 0.025;
  goalGem.position.y = 0.72 + Math.sin(now * 0.004) * 0.1;
  goalRing.rotation.z += 0.018;
  updateCamera();
  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (!cameraModeLocked) setCameraMode(getPreferredCameraMode(), false);
}

function isMobileLandscape() {
  return window.matchMedia("(hover: none) and (pointer: coarse) and (orientation: landscape)").matches;
}

function getPreferredCameraMode() {
  return isMobileLandscape() ? "mobile" : "classic";
}

function setCameraMode(mode, lock = true) {
  cameraMode = mode === "mobile" ? "mobile" : "classic";
  cameraModeLocked = lock;
  const preset = cameraPresets[cameraMode];
  document.body.dataset.cameraMode = cameraMode;
  if (cameraButton) {
    cameraButton.querySelector("[aria-hidden='true']").textContent = preset.icon;
    cameraButton.setAttribute("aria-label", preset.label);
    cameraButton.title = preset.label;
  }
}

function toggleCameraMode() {
  setCameraMode(cameraMode === "mobile" ? "classic" : "mobile", true);
}

async function requestLandscapeFullscreen() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Some mobile browsers only allow fullscreen from specific touch gestures.
  }

  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch {
    // iOS Safari may ignore orientation lock; the portrait overlay still guides the player.
  }

  updateFullscreenState();
}

function updateFullscreenState() {
  const fullscreen = Boolean(document.fullscreenElement);
  document.body.classList.toggle("is-fullscreen", fullscreen);
  if (fullscreenButton) {
    fullscreenButton.querySelector("[aria-hidden='true']").textContent = fullscreen ? "×" : "⛶";
    fullscreenButton.setAttribute("aria-label", fullscreen ? "Exit fullscreen" : "Fullscreen");
    fullscreenButton.title = fullscreen ? "Exit fullscreen" : "Fullscreen";
  }
}

let swipeStart = null;

function startSwipe(clientX, clientY) {
  swipeStart = {
    x: clientX,
    y: clientY,
    time: performance.now(),
  };
}

function finishSwipe(clientX, clientY) {
  if (!swipeStart) return;

  const dx = clientX - swipeStart.x;
  const dy = clientY - swipeStart.y;
  const distance = Math.hypot(dx, dy);
  const elapsed = performance.now() - swipeStart.time;
  swipeStart = null;

  if (distance < 38 || elapsed > 720) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    tryMove(dx > 0 ? "ArrowRight" : "ArrowLeft");
  } else {
    tryMove(dy > 0 ? "ArrowDown" : "ArrowUp");
  }
}

function handlePointerStart(event) {
  if (event.pointerType === "touch") return;
  if (event.target.closest("button")) return;
  startSwipe(event.clientX, event.clientY);
}

function handlePointerEnd(event) {
  if (event.pointerType === "touch") return;
  if (!swipeStart || event.target.closest("button")) return;
  finishSwipe(event.clientX, event.clientY);
}

function handleTouchStart(event) {
  if (event.target.closest("button")) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  startSwipe(touch.clientX, touch.clientY);
}

function handleTouchEnd(event) {
  if (!swipeStart || event.target.closest("button")) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  finishSwipe(touch.clientX, touch.clientY);
}

window.addEventListener("resize", resize);
document.addEventListener("fullscreenchange", updateFullscreenState);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    resetLevel("Restart");
    return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    if (event.repeat) return;
    tryMove(event.key);
  }
});

controlButtons.forEach((button) => {
  button.addEventListener("click", () => tryMove(button.dataset.key));
});

restartButton.addEventListener("click", () => resetLevel("Restart"));
cameraButton.addEventListener("click", toggleCameraMode);
fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
    return;
  }
  requestLandscapeFullscreen();
});
orientationFullscreenButton.addEventListener("click", requestLandscapeFullscreen);
gameRoot.addEventListener("pointerdown", handlePointerStart);
gameRoot.addEventListener("pointerup", handlePointerEnd);
gameRoot.addEventListener("touchstart", handleTouchStart, { passive: true });
gameRoot.addEventListener("touchend", handleTouchEnd);

nextLevelButton.addEventListener("click", () => {
  if (levelIndex < levels.length - 1) {
    loadLevel(levelIndex + 1, levels[levelIndex + 1].name);
    return;
  }
  loadLevel(0, "Find goal");
});

overlayRestartButton.addEventListener("click", () => resetLevel("Restart"));

avatarButtons.forEach((button) => {
  button.addEventListener("click", () => setAvatar(button.dataset.avatar));
});

const noorButton = avatarButtons.find((button) => button.dataset.avatar === "noor");
if (noorButton) {
  noorButton.disabled = true;
  noorButton.querySelector("[aria-hidden='true']").textContent = "●";
}

function loadNoorModel(showStatus = false) {
  if (noorReady || noorLoading) return;
  noorLoading = true;
  if (showStatus) setLoadingMessage("Loading Noor...");
  if (noorButton) {
    noorButton.disabled = true;
    noorButton.querySelector("[aria-hidden='true']").textContent = "●";
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    noorModelUrl,
    (gltf) => {
      noorModel = gltf.scene;
      noorModel.rotation.y = 0;
      noorModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(noorModel);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = maxDimension > 0 ? 1.35 / maxDimension : 1;
      noorModel.scale.setScalar(scale);
      noorModel.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      noorBody.add(noorModel);
      if (gltf.animations.length > 0) {
        noorMixer = new THREE.AnimationMixer(noorModel);
        const jumpClip =
          gltf.animations.find((clip) => /jump|hop|run|walk/i.test(clip.name)) || gltf.animations[0];
        noorHopAction = noorMixer.clipAction(jumpClip);
        noorHopAction.timeScale = jumpClip.duration > 0 ? jumpClip.duration / (hopDuration / 1000) : 1;
      }
      noorReady = true;
      noorLoading = false;
      document.body.dataset.animationCount = String(gltf.animations.length);
      window.CubeHopDebug = {
        get activeAvatar() {
          return activeAvatar;
        },
        get avatarYaw() {
          return avatarYaw;
        },
        setYaw(yaw) {
          avatarYaw = yaw;
          noorAvatar.rotation.y = yaw;
          document.body.dataset.avatarYaw = avatarYaw.toFixed(3);
        },
        animationNames: gltf.animations.map((clip) => clip.name || "Unnamed"),
        noorForwardOffset,
      };
      if (noorButton) {
        noorButton.disabled = false;
        noorButton.querySelector("[aria-hidden='true']").textContent = "●";
      }
      if (queuedNoorSelection) {
        queuedNoorSelection = false;
        setAvatar("noor");
      }
      setLoadingMessage("");
      applyDevQuery();
    },
    undefined,
    () => {
      noorLoading = false;
      if (noorButton) {
        noorButton.disabled = true;
        noorButton.querySelector("[aria-hidden='true']").textContent = "!";
      }
      setLoadingMessage("Could not load Noor model.", true);
      window.setTimeout(() => setLoadingMessage(""), 2400);
    }
  );
}

loadLevel(0, "Find goal");
setLoadingMessage("");
setCameraMode(getPreferredCameraMode(), false);
applyDevQuery();
window.setTimeout(() => loadNoorModel(false), 900);
requestAnimationFrame(animate);
