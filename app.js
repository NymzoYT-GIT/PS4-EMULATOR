
"use strict";

const $ = id => document.getElementById(id);

const chooseButton = $("choose");
const fileInput = $("files");
const gamesElement = $("games");
const emptyElement = $("empty");
const countElement = $("count");
const storageStatus = $("storage-status");
const connection = $("connection");
const gamepadName = $("gamepad-name");
const gamepadDetails = $("gamepad-details");

const DB_NAME = "PS4EmulatorLibrary";
const DB_VERSION = 1;
const STORE_NAME = "games";

let db = null;
let memoryOnly = false;
let memoryGames = [];
let lastGamepadSignature = "";
let gamepadTimer = null;

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return "game-" + Date.now() + "-" +
    Math.random().toString(36).slice(2);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });

        store.createIndex("fingerprint", "fingerprint", {
          unique: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      storageStatus.textContent =
        "Close older copies of this app to finish updating the library.";
    };
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || new Error("Transaction cancelled."));
  });
}

async function getAllGames() {
  if (memoryOnly) return [...memoryGames];

  const transaction = db.transaction(STORE_NAME, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(STORE_NAME).getAll();

  const result = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await done;
  return result;
}

async function saveGame(game) {
  if (memoryOnly) {
    const duplicate = memoryGames.some(
      item => item.fingerprint === game.fingerprint
    );

    if (duplicate) return false;

    memoryGames.push(game);
    return true;
  }

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORE_NAME);

  try {
    const existing = await new Promise((resolve, reject) => {
      const request = store.index("fingerprint").get(game.fingerprint);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (existing) {
      await done;
      return false;
    }

    store.add(game);
    await done;
    return true;
  } catch (error) {
    try { transaction.abort(); } catch (_) {}
    throw error;
  }
}

async function deleteGame(id) {
  if (memoryOnly) {
    memoryGames = memoryGames.filter(game => game.id !== id);
    return;
  }

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);

  transaction.objectStore(STORE_NAME).delete(id);
  await done;
}

async function clearGames() {
  if (memoryOnly) {
    memoryGames = [];
    return;
  }

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);

  transaction.objectStore(STORE_NAME).clear();
  await done;
}

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function renderGame(game) {
  const card = document.createElement("article");
  card.className = "game";

  card.appendChild(createText("div", "game-symbol", "◇"));
  card.appendChild(createText("h3", "", game.name));

  card.appendChild(createText(
    "p",
    "",
    formatSize(game.size) + " · " + game.extension.toUpperCase()
  ));

  card.appendChild(createText(
    "p",
    "",
    "Added " + new Date(game.addedAt).toLocaleDateString()
  ));

  card.appendChild(createText(
    "p",
    "game-status",
    "Catalog only — not emulated"
  ));

  card.appendChild(createText(
    "p",
    "",
    "The original file is not stored by this library. Select it again if needed."
  ));

  const removeButton = createText("button", "secondary", "Remove entry");
  removeButton.type = "button";

  removeButton.addEventListener("click", async () => {
    removeButton.disabled = true;

    try {
      await deleteGame(game.id);
      await renderLibrary();
    } catch (error) {
      console.error(error);
      alert("Could not remove this entry. Please try again.");
      removeButton.disabled = false;
    }
  });

  card.appendChild(removeButton);
  return card;
}

async function renderLibrary() {
  const entries = await getAllGames();

  entries.sort((a, b) => b.addedAt - a.addedAt);
  gamesElement.replaceChildren();

  for (const entry of entries) {
    gamesElement.appendChild(renderGame(entry));
  }

  const total = entries.length;
  countElement.textContent = total + (total === 1 ? " GAME" : " GAMES");
  emptyElement.hidden = total !== 0;
}

chooseButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const selectedFiles = Array.from(fileInput.files || []);

  try {
    let added = 0;
    let duplicates = 0;

    for (const file of selectedFiles) {
      const dot = file.name.lastIndexOf(".");
      const extension = dot >= 0
        ? file.name.slice(dot + 1).toLowerCase()
        : "unknown";

      const fingerprint = [
        file.name,
        file.size,
        file.lastModified,
        extension
      ].join("|");

      const game = {
        id: makeId(),
        fingerprint,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        extension,
        addedAt: Date.now()
      };

      if (await saveGame(game)) added++;
      else duplicates++;
    }

    await renderLibrary();

    storageStatus.textContent =
      added + " new entr" + (added === 1 ? "y" : "ies") +
      " saved." +
      (duplicates ? " " + duplicates + " duplicate(s) skipped." : "") +
      (memoryOnly ? " Memory-only mode; entries won't survive a reload." : "");
  } catch (error) {
    console.error(error);
    storageStatus.textContent =
      "Could not save entries. Check browser storage availability.";
  } finally {
    fileInput.value = "";
  }
});

$("refresh").addEventListener("click", async () => {
  try {
    await renderLibrary();
    storageStatus.textContent = "Library refreshed.";
  } catch (error) {
    console.error(error);
    storageStatus.textContent = "Could not refresh the library.";
  }
});

$("clear").addEventListener("click", async () => {
  if (!confirm("Remove every saved library entry? Original game files will not be deleted.")) {
    return;
  }

  try {
    await clearGames();
    await renderLibrary();
    storageStatus.textContent = "Library entries cleared.";
  } catch (error) {
    console.error(error);
    storageStatus.textContent = "Could not clear the library.";
  }
});

$("fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error(error);
    alert("Fullscreen is unavailable in this browser or window.");
  }
});

document.addEventListener("fullscreenchange", () => {
  $("fullscreen").textContent = document.fullscreenElement
    ? "⛶ Exit fullscreen"
    : "⛶ Fullscreen";
});

function updateGamepadStatus() {
  if (!("getGamepads" in navigator)) {
    gamepadName.textContent = "Gamepad API unavailable";
    gamepadDetails.textContent =
      "This browser does not expose controller detection.";
    return;
  }

  const pads = Array.from(navigator.getGamepads()).filter(Boolean);
  const signature = pads.map(pad =>
    pad.index + ":" + pad.id + ":" + pad.connected
  ).join(";");

  if (signature === lastGamepadSignature) return;
  lastGamepadSignature = signature;

  const pad = pads.find(item => item.connected);

  if (!pad) {
    gamepadName.textContent = "No controller detected";
    gamepadDetails.textContent =
      "Connect a USB or Bluetooth controller, then press a button.";
    return;
  }

  gamepadName.textContent = pad.id || "Connected controller";
  gamepadDetails.textContent =
    "Controller " + (pad.index + 1) +
    " · " + pad.buttons.length + " buttons · " +
    pad.axes.length + " analog axes detected.";
}

window.addEventListener("gamepadconnected", updateGamepadStatus);
window.addEventListener("gamepaddisconnected", updateGamepadStatus);
window.addEventListener("focus", updateGamepadStatus);

async function startApp() {
  try {
    db = await openDatabase();
    storageStatus.textContent = "Persistent local library is ready.";
  } catch (error) {
    console.warn("Persistent storage unavailable:", error);
    memoryOnly = true;
    storageStatus.textContent =
      "Persistent storage unavailable. Entries will last only until this page closes.";
  }

  try {
    await renderLibrary();
  } catch (error) {
    console.error(error);
    storageStatus.textContent = "Could not load the library.";
  }

  updateGamepadStatus();
  gamepadTimer = window.setInterval(updateGamepadStatus, 1000);

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    try {
      await navigator.serviceWorker.register("./sw.js");
      connection.textContent = "PWA READY";
    } catch (error) {
      console.warn("Service worker registration failed:", error);
      connection.textContent = "WEB MODE";
    }
  } else {
    connection.textContent = "WEB MODE";
  }
}

window.addEventListener("pagehide", () => {
  if (gamepadTimer !== null) clearInterval(gamepadTimer);
  if (db) db.close();
});

startApp();
