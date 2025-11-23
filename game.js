// ================== БАЗОВОЕ СОСТОЯНИЕ И УТИЛИТЫ ==================

const state = {
  currentScreen: "menu",
  selectedGame: null,
  players: [],

  pirate: {
    idx: 0,            // индекс текущего игрока
    situationIdx: 0    // номер текущей ситуации
  },

  roulette: {
    alive: [],         // список игроков с флагом alive
    bulletIndex: 0,
    currentIdx: 0
  },

  clicker: {
    scores: [],
    duration: 10,       // длина раунда кликера (сек)
    timer: null,
    countdownTimer: null,
    phase: "idle"
  }
};

// сокращённый доступ к элементам
function $(id) { return document.getElementById(id); }

// ссылки на экраны
const screens = {
  menu: $("screen-menu"),
  players: $("screen-players"),
  pirate: $("screen-pirate"),
  roulette: $("screen-roulette"),
  clicker: $("screen-clicker")
};

// переключение видимого экрана
function showScreen(name) {
  Object.keys(screens).forEach(k => {
    screens[k].classList.toggle("hidden", k !== name);
  });
  state.currentScreen = name;
}

// ================== ПИРАТСКИЕ СИТУАЦИИ (ТЕКСТ + ЗАДАНИЯ) ==================
// Легко редактировать: просто добавляй/меняй объекты в этом массиве.

const pirateSituations = [
  {
    text: "{player}, твой корабль приплыл к таинственному острову в форме черепа. На берегу три пещеры: из одной слышны крики, из второй — хрюканье, из третьей — подозрительная тишина. Куда лезешь?",
    options: [
      {
        label: "В ПЕЩЕРУ С КРИКАМИ",
        taskText: "Задание: изобрази самый страшный пиратский крик в радиусе комнаты. Если кто‑то испугался — ты капитан страха. Остальные ставят тебе +1 к уважению (вслух, как минимум)."
      },
      {
        label: "В ТИХУЮ ПЕЩЕРУ",
        taskText: "Задание: замри на 10 секунд как каменная статуя пирата. Если за это время хоть раз шевельнёшься или заговоришь — все зовут тебя 'Шумный Риф'."
      }
    ]
  },
  {
    text: "{player}, на палубе нашли карту сокровищ, но половина её сожрана крысой‑анархистом. Остались только странные значки и стрелки. Как будешь её 'читать'?",
    options: [
      {
        label: "ПРИТВОРИТЬСЯ, ЧТО ВСЁ ПОНИМАЕШЬ",
        taskText: "Задание: покажи остальным руками маршрут по воображаемой карте на столе или полу. Жестикулируй максимально уверенно, как будто реально знаешь, куда плывёшь."
      },
      {
        label: "ДАТЬ КАРТУ ПОПУГАЮ",
        taskText: "Задание: говори в течение 15 секунд только пиратским попугайским языком: 'КАРРР', 'ЙО‑ХО‑ХО', 'ДАВАЙ ЗОЛОТО'. Нормальные слова запрещены."
      }
    ]
  },
  // ... (сюда просто копируешь остальные ситуации из прошлой версии)
  // Я их не дублирую полностью, чтобы не забивать ответ.
];

// Подготовка массива индексов ситуаций и перемешивание,
// чтобы шли в рандомном порядке (можно выключить, если не нужно).
let pirateOrder = pirateSituations.map((_, i) => i);

function shufflePirateOrder() {
  for (let i = pirateOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pirateOrder[i], pirateOrder[j]] = [pirateOrder[j], pirateOrder[i]];
  }
}

// ================== ГЛАВНОЕ МЕНЮ ==================

document.querySelectorAll(".sign-button[data-game]").forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    const audio = $("sfx-hover");
    if (audio && audio.play) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  });

  btn.addEventListener("click", () => {
    const game = btn.getAttribute("data-game");
    state.selectedGame = game;

    $("mode-label").textContent =
      game === "pirate" ? "Режим: Пиратский бухЕч" :
      game === "roulette" ? "Режим: Русская рулетка" :
      "Режим: Кликер‑бабос";

    setupPlayersScreen();
    showScreen("players");
  });
});

$("btn-back-to-menu").addEventListener("click", () => {
  showScreen("menu");
});

// ================== ЭКРАН ВЫБОРА ИГРОКОВ ==================

const countInput = $("players-count");
const nicksContainer = $("nicks-container");
const warningEl = $("players-warning");

// подготовить экран (по умолчанию 2 игрока)
function setupPlayersScreen() {
  countInput.value = 2;
  renderNickInputs(2);
  warningEl.textContent = "";
}

// нарисовать поля ников
function renderNickInputs(count) {
  nicksContainer.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement("div");
    wrap.className = "nick-row";

    const label = document.createElement("span");
    label.textContent = `Отброс #${i + 1}, представься:`;
    wrap.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 16;
    input.value = `Гоблин_${i + 1}`;
    input.dataset.index = i;
    wrap.appendChild(input);

    nicksContainer.appendChild(wrap);
  }
}

// при изменении количества игроков
countInput.addEventListener("change", () => {
  let v = parseInt(countInput.value || "2", 10);
  if (isNaN(v)) v = 2;
  if (v < 2) v = 2;
  if (v > 6) v = 6;
  countInput.value = v;
  renderNickInputs(v);
});

// запуск игры после ввода ников
$("btn-start-game").addEventListener("click", () => {
  const count = parseInt(countInput.value || "2", 10);
  if (isNaN(count) || count < 2 || count > 6) {
    warningEl.textContent = "Ты либо слишком одинок, либо вас слишком много. Нужны от 2 до 6.";
    return;
  }

  const inputs = nicksContainer.querySelectorAll("input[type='text']");
  const players = [];
  inputs.forEach((inp, i) => {
    let nick = (inp.value || "").trim();
    if (!nick) nick = `Гоблин_${i + 1}`;
    players.push({
      name: nick,
      id: i,
      alive: true
    });
  });

  state.players = players;
  warningEl.textContent = "";

  if (state.selectedGame === "pirate") {
    startPirate();
  } else if (state.selectedGame === "roulette") {
    startRoulette();
  } else if (state.selectedGame === "clicker") {
    startClicker();
  }
});

// ================== ПИРАТСКИЙ БУХЕЧ: ЛОГИКА ==================

const pirateSitEl = $("pirate-situation");
const pirateRoundLabel = $("pirate-round-label");
const pirateCurrentPlayer = $("pirate-current-player");
const pirateSitCounter = $("pirate-sit-counter");
const pirateMinigame = $("pirate-minigame");
const pirateSpeech = $("pirate-speech");
const pirateLog = $("pirate-log");
const pirateBtn1 = $("pirate-btn-1");
const pirateBtn2 = $("pirate-btn-2");

let pirateMiniRunning = false;

function startPirate() {
  state.pirate.idx = 0;
  state.pirate.situationIdx = 0;

  // Перемешиваем порядок ситуаций, чтобы каждый запуск был разный
  shufflePirateOrder();

  showScreen("pirate");
  nextPirateTurn();
}

$("btn-back-from-pirate").addEventListener("click", () => {
  showScreen("menu");
});

// показать следующую ситуацию
function nextPirateTurn() {
  pirateMiniRunning = false;

  const p = state.players[state.pirate.idx];
  // берём индекс ситуации из перемешанного списка
  const orderIndex = state.pirate.situationIdx % pirateSituations.length;
  const sitIdx = pirateOrder[orderIndex];
  const situation = pirateSituations[sitIdx];

  pirateRoundLabel.textContent = "Раунд " + (state.pirate.situationIdx + 1);
  pirateCurrentPlayer.textContent = p.name;
  pirateSitCounter.textContent = (orderIndex + 1) + " / " + pirateSituations.length;

  const text = situation.text.replace(/{player}/g, p.name);
  pirateSitEl.textContent = text;

  // Обновляем подписи на кнопках (первый <span> внутри)
  pirateBtn1.querySelector("span").textContent = situation.options[0].label;
  pirateBtn2.querySelector("span").textContent = situation.options[1].label;

  pirateSpeech.style.display = "none";
  pirateSpeech.textContent = "";
  pirateLog.textContent = "Выбери вариант, затем выполняй задание как честный пират‑кринжан.";
}

// перейти к следующему игроку / ситуации
function advancePiratePlayer() {
  state.pirate.idx = (state.pirate.idx + 1) % state.players.length;
  state.pirate.situationIdx++;
  setTimeout(() => {
    nextPirateTurn();
  }, 500);
}

// обработчики кнопок выбора варианта
pirateBtn1.addEventListener("click", () => {
  if (pirateMiniRunning) return;
  pirateMiniRunning = true;

  const orderIndex = state.pirate.situationIdx % pirateSituations.length;
  const sitIdx = pirateOrder[orderIndex];
  const situation = pirateSituations[sitIdx];

  pirateSpeech.style.display = "block";
  pirateSpeech.textContent = situation.options[0].taskText.replace(/{player}/g, state.players[state.pirate.idx].name);
  pirateLog.textContent = "Выполняй задание, потом игра сама включит следующего бедолагу.";

  // даём время на выполнение задания
  setTimeout(() => {
    pirateMiniRunning = false;
    advancePiratePlayer();
  }, 8000);
});

pirateBtn2.addEventListener("click", () => {
  if (pirateMiniRunning) return;
  pirateMiniRunning = true;

  const orderIndex = state.pirate.situationIdx % pirateSituations.length;
  const sitIdx = pirateOrder[orderIndex];
  const situation = pirateSituations[sitIdx];

  pirateSpeech.style.display = "block";
  pirateSpeech.textContent = situation.options[1].taskText.replace(/{player}/g, state.players[state.pirate.idx].name);
  pirateLog.textContent = "Не халтурь, выполняй задание. Дальше будет ещё хуже, обещаем.";

  setTimeout(() => {
    pirateMiniRunning = false;
    advancePiratePlayer();
  }, 8000);
});

// ================== РУССКАЯ РУЛЕТКА ==================

const roulettePlayersWrap = $("roulette-players");
const chamberEl = $("revolver-chamber");
const bangOverlay = $("bang-overlay");
const rouletteFireBtn = $("roulette-fire");
const rouletteAliveCount = $("roulette-alive-count");
const rouletteResult = $("roulette-result");
const rouletteNote = $("roulette-note");

$("btn-back-from-roulette").addEventListener("click", () => {
  showScreen("menu");
});

function startRoulette() {
  showScreen("roulette");
  rouletteResult.textContent = "";
  rouletteNote.textContent = "";
  state.roulette.alive = state.players.map(p => ({ ...p }));
  state.roulette.currentIdx = 0;
  state.roulette.bulletIndex = Math.floor(Math.random() * 6);
  setupChamber();
  renderRoulettePlayers();
  updateRouletteUI();
}

// рисуем барабан
function setupChamber() {
  chamberEl.innerHTML = "";
  const radius = 36;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const hole = document.createElement("div");
    hole.className = "bullet-hole";
    const cx = 55 + Math.cos(angle) * radius;
    const cy = 55 + Math.sin(angle) * radius;
    hole.style.left = (cx - 10) + "px";
    hole.style.top = (cy - 10) + "px";
    if (i === state.roulette.bulletIndex) {
      hole.classList.add("loaded");
    }
    chamberEl.appendChild(hole);
  }
}

// расставляем игроков по кругу
function renderRoulettePlayers() {
  roulettePlayersWrap.innerHTML = "";
  const alive = state.roulette.alive;
  const n = alive.length;
  const centerX = 50;
  const centerY = 50;
  const radius = 35;

  alive.forEach((p, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const el = document.createElement("div");
    el.className = "roulette-player";
    el.id = "roulette-player-" + i;
    el.style.left = x + "%";
    el.style.top = y + "%";
    el.style.transform = "translate(-50%, -50%)";

    const name = document.createElement("div");
    name.textContent = p.name;
    name.style.position = "relative";
    name.style.zIndex = "2";
    el.appendChild(name);

    const bruise = document.createElement("div");
    bruise.className = "bruise";
    bruise.id = "bruise-" + i;
    el.appendChild(bruise);

    roulettePlayersWrap.appendChild(el);
  });
}

// обновляем подсветку текущего и счётчик живых
function updateRouletteUI() {
  const alive = state.roulette.alive.filter(p => p.alive);
  rouletteAliveCount.textContent = alive.length;
  state.roulette.alive.forEach((p, i) => {
    const el = $("roulette-player-" + i);
    if (!el) return;
    el.classList.toggle("current", p.alive && i === state.roulette.currentIdx);
    el.classList.toggle("dead", !p.alive);
  });
}

rouletteFireBtn.addEventListener("click", () => {
  fireRoulette();
});

// выстрел
function fireRoulette() {
  const players = state.roulette.alive;
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length <= 1) return;

  const currentIndex = state.roulette.currentIdx;
  const current = players[currentIndex];
  if (!current.alive) {
    nextRoulettePlayer();
    return;
  }

  rouletteFireBtn.disabled = true;
  rouletteFireBtn.textContent = "Крутится‑вертится талант судьбы...";
  chamberEl.style.animationName = "spinChamber";

  setTimeout(() => {
    const bulletWillFire = Math.random() < 1 / (alivePlayers.length + 1);
    const audio = $("sfx-bdysh");

    if (bulletWillFire) {
      current.alive = false;
      if (audio && audio.play) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      const bruise = $("bruise-" + currentIndex);
      if (bruise) bruise.classList.add("show");
      bangOverlay.classList.add("show");
      setTimeout(() => bangOverlay.classList.remove("show"), 700);

      rouletteResult.textContent = current.name + " словил БДЫЩЬ и вылетел из треш‑патИ.";
      rouletteNote.textContent = "Ему вручается медаль 'За отвагу и глупость' (посмертно).";

      setTimeout(() => {
        checkRouletteWinner();
      }, 900);
    } else {
      rouletteResult.textContent = current.name + " выжил и теперь должен пересмотреть жизненные приоритеты.";
      rouletteNote.textContent = "Русская рулетка — это не совет, а предупреждение.";
      nextRoulettePlayer();
    }
    chamberEl.style.animationName = "";
    rouletteFireBtn.disabled = false;
    rouletteFireBtn.textContent = "НАЖМИ СПУСК";
    updateRouletteUI();
  }, 850);
}

// переход хода
function nextRoulettePlayer() {
  const players = state.roulette.alive;
  let idx = state.roulette.currentIdx;
  for (let attempts = 0; attempts < players.length; attempts++) {
    idx = (idx + 1) % players.length;
    if (players[idx].alive) {
      state.roulette.currentIdx = idx;
      break;
    }
  }
  updateRouletteUI();
}

// проверка победителя
function checkRouletteWinner() {
  const alive = state.roulette.alive.filter(p => p.alive);
  if (alive.length === 1) {
    const winner = alive[0];
    rouletteResult.textContent = "Победитель: " + winner.name + ". Ты жив... пока что!";
    rouletteNote.textContent = "Тебе дарят купон на бесплатную психотерапию (невоспользованный).";
    spawnConfetti();
  } else if (alive.length === 0) {
    rouletteResult.textContent = "Все решили сыграть до конца и таки доигрались. ГГ ВП.";
    rouletteNote.textContent = "Победила статистика.";
  } else {
    nextRoulettePlayer();
  }
}

// ================== КОНФЕТТИ (общая функция) ==================

function spawnConfetti() {
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    const colors = ["#fffa00", "#ff00e1", "#00f7ff", "#ff6b00", "#7fff00"];
    piece.style.background = colors[i % colors.length];
    piece.style.left = Math.random() * 100 + "vw";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1600);
  }
}

// ================== КЛИКЕР-БАБОС ==================

const clickerArea = $("clicker-area");
const clickerCountdown = $("clicker-countdown");
const clickerResult = $("clicker-result");
const clickerNote = $("clicker-note");

$("btn-back-from-clicker").addEventListener("click", () => {
  stopClickerTimers();
  showScreen("menu");
});

function startClicker() {
  showScreen("clicker");
  clickerResult.textContent = "";
  state.clicker.scores = state.players.map(() => 0);
  state.clicker.phase = "idle";
  renderClickerColumns();
  startClickerCountdown();
}

// рисуем зоны игроков
function renderClickerColumns() {
  clickerArea.innerHTML = "";
  const colors = [
    "linear-gradient(135deg,#ff0080,#ffec00)",
    "linear-gradient(135deg,#00ffea,#7f00ff)",
    "linear-gradient(135deg,#ff6b00,#ffeb3b)",
    "linear-gradient(135deg,#00e676,#00b0ff)",
    "linear-gradient(135deg,#ff4081,#b388ff)",
    "linear-gradient(135deg,#cddc39,#ff9800)"
  ];

  state.players.forEach((p, i) => {
    const col = document.createElement("div");
    col.className = "clicker-column";
    col.style.background = colors[i % colors.length];

    const note = document.createElement("div");
    note.className = "clicker-note";
    note.textContent = p.name;
    col.appendChild(note);

    const scoreEl = document.createElement("div");
    scoreEl.className = "clicker-score";
    scoreEl.id = "clicker-score-" + i;
    scoreEl.textContent = "0 хрюблей";
    col.appendChild(scoreEl);

    const bill = document.createElement("div");
    bill.className = "bill";
    bill.id = "bill-" + i;

    // лягушка
    const frog = document.createElement("div");
    frog.className = "frog-face";
    const eyeL = document.createElement("div");
    eyeL.className = "frog-eye left";
    frog.appendChild(eyeL);
    const eyeR = document.createElement("div");
    eyeR.className = "frog-eye right";
    frog.appendChild(eyeR);
    const mouth = document.createElement("div");
    mouth.className = "frog-mouth";
    frog.appendChild(mouth);

    bill.appendChild(frog);

    bill.addEventListener("click", () => {
      if (state.clicker.phase !== "play") return;
      state.clicker.scores[i]++;
      updateClickerScore(i);
      const audio = $("sfx-click");
      if (audio && audio.play) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    });

    col.appendChild(bill);

    const nameLabel = document.createElement("div");
    nameLabel.className = "clicker-name";
    nameLabel.textContent = p.name + " · будущий олигарх";
    col.appendChild(nameLabel);

    clickerArea.appendChild(col);
  });
}

function updateClickerScore(i) {
  const score = state.clicker.scores[i];
  const el = $("clicker-score-" + i);
  if (el) {
    el.textContent = score + " хрюблей";
  }
}

// обратный отсчёт перед стартом
function startClickerCountdown() {
  stopClickerTimers();
  state.clicker.phase = "countdown";
  let counter = 3;
  clickerCountdown.textContent = "3...";
  const timer = setInterval(() => {
    counter--;
    if (counter > 0) {
      clickerCountdown.textContent = counter + "...";
    } else if (counter === 0) {
      clickerCountdown.textContent = "ВОРУЙ!";
      clearInterval(timer);
      state.clicker.countdownTimer = null;
      startClickerPlay();
    }
  }, 800);
  state.clicker.countdownTimer = timer;
}

// сам раунд кликов
function startClickerPlay() {
  state.clicker.phase = "play";
  clickerResult.textContent = "";
  clickerNote.textContent = "Тапай‑тапай, пока бухгалтерия не проснулась!";
  spawnBoosters();
  const start = Date.now();
  const timer = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    const left = Math.max(0, state.clicker.duration - elapsed);
    clickerCountdown.textContent = left.toFixed(1) + " сек.";
    if (left <= 0.1) {
      clearInterval(timer);
      state.clicker.timer = null;
      finishClicker();
    }
  }, 80);
  state.clicker.timer = timer;
}

// окончание раунда, подсчёт победителя
function finishClicker() {
  state.clicker.phase = "done";
  clickerCountdown.textContent = "СТОП, карманы полные!";
  const scores = state.clicker.scores;
  let max = -1;
  let winnerIdxs = [];
  scores.forEach((s, i) => {
    if (s > max) {
      max = s;
      winnerIdxs = [i];
    } else if (s === max) {
      winnerIdxs.push(i);
    }
  });

  if (winnerIdxs.length === 1) {
    const w = state.players[winnerIdxs[0]];
    clickerResult.textContent = `Главный Хрюнематик: ${w.name} с добычей ${max} хрюблей!`;
    clickerNote.textContent = "Все остальные пусть утешатся виртуальной корочкой хлеба.";
    spawnConfetti();
  } else {
    const names = winnerIdxs.map(i => state.players[i].name).join(", ");
    clickerResult.textContent = `Ничья кринжа! Делите бабосы: ${names} (${max} хрюблей у каждого).`;
    clickerNote.textContent = "Главное — участие, а не финансовая грамотность.";
  }
}

// бабушки‑бустеры
function spawnBoosters() {
  const spawnOne = () => {
    if (state.clicker.phase !== "play") return;
    const booster = document.createElement("div");
    booster.className = "booster";
    booster.textContent = "Возьми пирожок!";
    const startX = Math.random() * 100;
    booster.style.left = startX + "vw";
    booster.style.animationName = "boosterFly";
    booster.addEventListener("click", () => {
      if (state.clicker.phase !== "play") return;
      const lucky = Math.floor(Math.random() * state.players.length);
      state.clicker.scores[lucky] += 10;
      updateClickerScore(lucky);
      booster.remove();
    });
    document.body.appendChild(booster);
    setTimeout(() => booster.remove(), 3000);
  };

  const int = setInterval(() => {
    if (state.clicker.phase !== "play") {
      clearInterval(int);
      return;
    }
    if (Math.random() < 0.7) spawnOne();
  }, 1300);
}

// остановка таймеров при выходе
function stopClickerTimers() {
  if (state.clicker.timer) {
    clearInterval(state.clicker.timer);
    state.clicker.timer = null;
  }
  if (state.clicker.countdownTimer) {
    clearInterval(state.clicker.countdownTimer);
    state.clicker.countdownTimer = null;
  }
}

// ================== СТАРТ ПРИ ЗАГРУЗКЕ ==================

showScreen("menu");
