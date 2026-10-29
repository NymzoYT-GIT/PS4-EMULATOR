
"use strict";

const tiles = Array.from(document.querySelectorAll(".tile"));
const panel = document.getElementById("contentPanel");
const homeScreen = document.getElementById("homeScreen");
const playScreen = document.getElementById("playScreen");
const message = document.getElementById("gameMessage");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let selected = 0;
let currentPage = "library";
let gameStarted = false;
let gameOver = false;
let playerX = 70;
let playerY = 275;
let velocityY = 0;
let score = 0;
let obstacles = [];
let lastObstacle = 0;
let lastFrame = 0;
const keys = new Set();

function updateClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
}
updateClock();
setInterval(updateClock, 15000);

function selectTile(index) {
  selected = (index + tiles.length) % tiles.length;
  tiles.forEach((tile, i) => {
    tile.classList.toggle("active", i === selected);
    tile.setAttribute("aria-current", i === selected ? "true" : "false");
  });
}

function renderPage(page) {
  currentPage = page;

  if (page === "library") {
    panel.innerHTML = `
      <p class="eyebrow">GAME LIBRARY</p>
      <h2>Your games</h2>
      <p>This starter version includes a playable browser demo.
      It does not yet load or emulate PS4 game files.</p>
      <div class="game-card">
        <div class="cover demo-cover">PIXEL<br>RUNNER</div>
        <div class="game-info">
          <h3>Pixel Runner</h3>
          <p>An original mini-game included with this project.</p>
          <button class="primary" id="launchDemo">Play Demo</button>
        </div>
      </div>`;
  } else if (page === "settings") {
    panel.innerHTML = `
      <p class="eyebrow">CONSOLE SETTINGS</p>
      <h2>Keyboard controls</h2>
      <p>Navigate the home screen using these controls.</p>
      <div class="game-controls">
        <span>↑ ↓ ← → : Navigate tiles</span>
        <span>ENTER : Select</span>
        <span>ESC : Return home</span>
        <span>F : Toggle fullscreen</span>
        <span>In Pixel Runner: A/D or ←/→ to move</span>
        <span>SPACE or ↑ : Jump</span>
        <span>R : Restart demo</span>
      </div>
      <p>Keyboard controls are active while this page is focused.</p>`;
  } else if (page === "about") {
    panel.innerHTML = `
      <p class="eyebrow">ABOUT THIS PROJECT</p>
      <h2>PS4 EMULATOR — Browser Edition</h2>
      <p>This is an original console-style web interface built with
      HTML, CSS, and JavaScript.</p>
      <p><strong>Current status:</strong> UI prototype with a built-in
      browser mini-game. It is not a PlayStation 4 emulator and
      cannot execute PS4 game files.</p>
      <p>Hosted through GitHub Pages.</p>`;
  }
}

function openPage(page) {
  if (page === "play") {
    startDemo();
    return;
  }
  renderPage(page);
}

tiles.forEach((tile, index) => {
  tile.addEventListener("click", () => {
    selectTile(index);
    openPage(tile.dataset.page);
  });
});

panel.addEventListener("click", event => {
  if (event.target.closest("#launchDemo")) startDemo();
});

function startDemo() {
  homeScreen.classList.add("hidden");
  playScreen.classList.remove("hidden");
  resetDemo();
  canvas.focus();
}

function returnHome() {
  playScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  keys.clear();
}

document.getElementById("backHome").addEventListener("click", returnHome);

function resetDemo() {
  playerX = 70;
  playerY = 275;
  velocityY = 0;
  score = 0;
  obstacles = [];
  lastObstacle = 0;
  gameStarted = false;
  gameOver = false;
  keys.clear();
  message.textContent = "Press Space or ↑ to start.";
  drawScene();
}

function jump() {
  if (!gameStarted) {
    gameStarted = true;
    message.textContent = "Go! Avoid the blocks.";
  }
  if (gameOver) {
    resetDemo();
    gameStarted = true;
    message.textContent = "Go! Avoid the blocks.";
    return;
  }
  if (playerY >= 274) velocityY = -470;
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, "#70c9f5");
  sky.addColorStop(1, "#e2f5ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 800, 360);

  ctx.fillStyle = "rgba(255,255,255,.7)";
  [[120,65,32],[150,65,23],[550,90,35],[580,90,25]].forEach(c => {
    ctx.beginPath();
    ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#80d49a";
  ctx.fillRect(0, 300, 800, 60);
  ctx.fillStyle = "#399c68";
  ctx.fillRect(0, 300, 800, 7);

  ctx.fillStyle = "#1d4f9c";
  ctx.fillRect(playerX, playerY, 28, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(playerX + 17, playerY + 6, 5, 5);

  obstacles.forEach(ob => {
    ctx.fillStyle = "#e35b69";
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    ctx.fillStyle = "#ff9a9f";
    ctx.fillRect(ob.x + 4, ob.y + 4, ob.w - 8, 5);
  });

  ctx.fillStyle = "#102b4c";
  ctx.font = "bold 20px Arial";
  ctx.fillText("SCORE: " + score, 22, 35);

  if (!gameStarted || gameOver) {
    ctx.fillStyle = "rgba(4, 20, 43, .72)";
    ctx.fillRect(170, 115, 460, 100);
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.fillText(gameOver ? "GAME OVER" : "PIXEL RUNNER", 400, 155);
    ctx.font = "15px Arial";
    ctx.fillText(
      gameOver ? "Press Space or R to retry" : "Press Space or ↑ to begin",
      400, 184
    );
    ctx.textAlign = "left";
  }
}

function updateGame(time) {
  const dt = Math.min((time - (lastFrame || time)) / 1000, 0.035);
  lastFrame = time;

  if (playScreen.classList.contains("hidden")) {
    requestAnimationFrame(updateGame);
    return;
  }

  if (gameStarted && !gameOver) {
    if (keys.has("arrowleft") || keys.has("a")) playerX -= 230 * dt;
    if (keys.has("arrowright") || keys.has("d")) playerX += 230 * dt;

    playerX = Math.max(0, Math.min(772, playerX));

    playerY += velocityY * dt;
    velocityY += 1100 * dt;

    if (playerY >= 275) {
      playerY = 275;
      velocityY = 0;
    }

    if (time - lastObstacle > 1250) {
      const height = 25 + Math.random() * 25;
      obstacles.push({
        x: 810,
        y: 300 - height,
        w: 20 + Math.random() * 18,
        h: height
      });
      lastObstacle = time;
    }

    obstacles.forEach(ob => ob.x -= 260 * dt);
    obstacles = obstacles.filter(ob => ob.x + ob.w > 0);

    for (const ob of obstacles) {
      const hit =
        playerX < ob.x + ob.w &&
        playerX + 28 > ob.x &&
        playerY < ob.y + ob.h &&
        playerY + 28 > ob.y;

      if (hit) {
        gameOver = true;
        message.textContent = "Game over! Press Space or R to try again.";
        break;
      }
    }

    score += Math.floor(30 * dt);
  }

  drawScene();
  requestAnimationFrame(updateGame);
}

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "f" && !event.repeat) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    return;
  }

  if (!playScreen.classList.contains("hidden")) {
    keys.add(key);

    if (key === " " || key === "arrowup") jump();
    if (key === "r" && !event.repeat) {
      resetDemo();
    }
    if (key === "escape") returnHome();
    return;
  }

  if (key === "arrowright" || key === "arrowdown") {
    selectTile(selected + 1);
  } else if (key === "arrowleft" || key === "arrowup") {
    selectTile(selected - 1);
  } else if (key === "enter" || key === " ") {
    openPage(tiles[selected].dataset.page);
  }
});

document.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => keys.clear());

drawScene();
requestAnimationFrame(updateGame);
