
const chooseButton = document.getElementById("choose");
const fileInput = document.getElementById("files");
const games = document.getElementById("games");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const connection = document.getElementById("connection");

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }
  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function addFileCard(file) {
  const card = document.createElement("article");
  card.className = "game";

  const symbol = document.createElement("div");
  symbol.className = "game-symbol";
  symbol.textContent = "◇";

  const title = document.createElement("h3");
  title.textContent = file.name;

  const details = document.createElement("p");
  details.textContent =
    formatSize(file.size) + " · " +
    (file.name.split(".").pop() || "unknown").toUpperCase();

  const status = document.createElement("p");
  status.textContent = "Added to this session · Not launched";

  card.append(symbol, title, details, status);
  games.appendChild(card);
}

chooseButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  for (const file of fileInput.files) {
    addFileCard(file);
  }

  const total = games.children.length;
  count.textContent = total + (total === 1 ? " FILE" : " FILES");
  empty.hidden = total > 0;

  // Allow selecting the same file again if needed.
  fileInput.value = "";
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      connection.textContent = "PWA READY";
    } catch (error) {
      connection.textContent = "WEB MODE";
      console.error("Offline setup failed:", error);
    }
  });
} else {
  connection.textContent = "WEB MODE";
}
