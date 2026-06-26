"use strict";

// ===============================
// INDIZI E SOLUZIONI
// Modifica solo questo array per creare un nuovo cruciverba.
// ===============================
const WORDS = [
  { clue: "Così la Sottero chiamava te e Mirta", answer: "RARO" },
  { clue: "Persona sulla quale sei inciampata a Trapani", answer: "UN NERO" },
  { clue: "Chi arriva a salvarti quando sei in pericolo?", answer: "RAMBA" },
  { clue: "Può cadere dal pane o trovarsi in riva al mare", answer: "BRICIOLA" },
  { clue: "Nome dato al cane di Mykonos", answer: "ROBBO" },
  { clue: "Sport che ti ha fatto vedere la morte in faccia", answer: "ARRAMPICATA" },
  {
    clue: "Grossolana e pasticciona come chi ti fece il buco all’orecchio storto",
    answer: "CIGNALONA",
  },
  { clue: "In primavera ti si presentano a gruppi da 2 a 10", answer: "STARNUTI" },
  { clue: "“Ho fame” in tedesco", answer: "Ich habe Hunger" },
  { clue: "Superato Badolo, s’era delle", answer: "RINTRONATE" },
  { clue: "Appartieni alla classe", answer: "trail99eil2000" },
  { clue: "Saluto alla proprietaria di casa", answer: "benvenuta" },
  { clue: "A Budapest alla ricerca di …", answer: "Papà Francesco" },
  { clue: "A Napoli il treno senza", answer: "sconto" },
  { clue: "Verso Taylor ma in arrivo a", answer: "magenta" },
  { clue: "“Benzi vieni al …”", answer: "marmo" },
  { clue: "È libero “you can go eh”", answer: "bagno" },
  { clue: "L'ha preso in faccia Gianfi in Sardegna", answer: "un pugno" },
  { clue: "Il nome della padrona", answer: "Marcella" },
];

const DIRECTIONS = {
  ACROSS: "across",
  DOWN: "down",
};

const STORAGE_PREFIX = "lazyCrossword";

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toCellKey(row, col) {
  return `${row},${col}`;
}

function fromCellKey(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

function directionDelta(direction) {
  return direction === DIRECTIONS.ACROSS ? { row: 0, col: 1 } : { row: 1, col: 0 };
}

function oppositeDirection(direction) {
  return direction === DIRECTIONS.ACROSS ? DIRECTIONS.DOWN : DIRECTIONS.ACROSS;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

class CrosswordGenerator {
  constructor(entries) {
    this.entries = entries;
    this.cells = new Map();
    this.placements = [];
  }

  generate() {
    this.cells.clear();
    this.placements = [];

    const [first, ...rest] = this.entries;
    if (!first) {
      return this.createLayout();
    }

    this.placeWord(first, 0, -Math.floor(first.answer.length / 2), DIRECTIONS.ACROSS);

    for (const entry of shuffle(rest)) {
      const crossing = this.findBestCrossing(entry);
      if (crossing) {
        this.placeWord(entry, crossing.row, crossing.col, crossing.direction);
        continue;
      }

      const nearby = this.findNearbySlot(entry);
      if (nearby) {
        this.placeWord(entry, nearby.row, nearby.col, nearby.direction);
        continue;
      }

      const detached = this.findDetachedSlot(entry);
      this.placeWord(entry, detached.row, detached.col, detached.direction);
    }

    return this.createLayout();
  }

  fromPlacements(records) {
    this.cells.clear();
    this.placements = [];

    for (const record of records) {
      const entry = this.entries.find((item) => item.originalIndex === record.originalIndex);
      if (!entry || !this.canPlace(entry.answer, record.row, record.col, record.direction, false)) {
        throw new Error("Layout salvato non valido.");
      }
      this.placeWord(entry, record.row, record.col, record.direction);
    }

    return this.createLayout();
  }

  placeWord(entry, row, col, direction) {
    const placement = {
      id: `word-${entry.originalIndex}`,
      originalIndex: entry.originalIndex,
      clue: entry.clue,
      answer: entry.answer,
      row,
      col,
      direction,
      number: 0,
      cells: [],
    };

    const delta = directionDelta(direction);
    for (let index = 0; index < entry.answer.length; index += 1) {
      const cellRow = row + delta.row * index;
      const cellCol = col + delta.col * index;
      const key = toCellKey(cellRow, cellCol);
      const existing = this.cells.get(key) || {
        row: cellRow,
        col: cellCol,
        letter: entry.answer[index],
        directions: new Set(),
        words: new Set(),
      };

      existing.letter = entry.answer[index];
      existing.directions.add(direction);
      existing.words.add(placement.id);
      this.cells.set(key, existing);
      placement.cells.push(key);
    }

    this.placements.push(placement);
  }

  findBestCrossing(entry) {
    const candidates = [];

    for (const placed of this.placements) {
      const newDirection = oppositeDirection(placed.direction);
      const placedDelta = directionDelta(placed.direction);
      const newDelta = directionDelta(newDirection);

      for (let placedIndex = 0; placedIndex < placed.answer.length; placedIndex += 1) {
        const letter = placed.answer[placedIndex];
        const matchingIndexes = this.indexesOf(entry.answer, letter);

        for (const entryIndex of matchingIndexes) {
          const crossRow = placed.row + placedDelta.row * placedIndex;
          const crossCol = placed.col + placedDelta.col * placedIndex;
          const row = crossRow - newDelta.row * entryIndex;
          const col = crossCol - newDelta.col * entryIndex;
          const validation = this.canPlace(entry.answer, row, col, newDirection, true);

          if (validation.valid) {
            candidates.push({
              row,
              col,
              direction: newDirection,
              score: validation.intersections * 100 - this.distanceFromOrigin(row, col),
            });
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score)[0] || null;
  }

  findNearbySlot(entry) {
    const bounds = this.getBounds(4);
    const candidates = [];

    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
        for (const direction of [DIRECTIONS.ACROSS, DIRECTIONS.DOWN]) {
          const validation = this.canPlace(entry.answer, row, col, direction, false);
          if (validation.valid) {
            candidates.push({
              row,
              col,
              direction,
              score: validation.intersections * 100 - this.distanceFromOrigin(row, col),
            });
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score)[0] || null;
  }

  findDetachedSlot(entry) {
    const bounds = this.getBounds(0);
    let row = bounds.maxRow + 2;
    let col = bounds.minCol;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (this.canPlace(entry.answer, row, col, DIRECTIONS.ACROSS, false).valid) {
        return { row, col, direction: DIRECTIONS.ACROSS };
      }
      row += 2;
    }

    return { row: bounds.maxRow + 4, col, direction: DIRECTIONS.ACROSS };
  }

  canPlace(answer, row, col, direction, requireIntersection) {
    const delta = directionDelta(direction);
    const beforeKey = toCellKey(row - delta.row, col - delta.col);
    const afterKey = toCellKey(
      row + delta.row * answer.length,
      col + delta.col * answer.length,
    );

    if (this.cells.has(beforeKey) || this.cells.has(afterKey)) {
      return { valid: false, intersections: 0 };
    }

    let intersections = 0;

    for (let index = 0; index < answer.length; index += 1) {
      const cellRow = row + delta.row * index;
      const cellCol = col + delta.col * index;
      const key = toCellKey(cellRow, cellCol);
      const existing = this.cells.get(key);

      if (existing) {
        if (existing.letter !== answer[index] || existing.directions.has(direction)) {
          return { valid: false, intersections: 0 };
        }
        intersections += 1;
        continue;
      }

      const sideKeys =
        direction === DIRECTIONS.ACROSS
          ? [toCellKey(cellRow - 1, cellCol), toCellKey(cellRow + 1, cellCol)]
          : [toCellKey(cellRow, cellCol - 1), toCellKey(cellRow, cellCol + 1)];

      if (sideKeys.some((sideKey) => this.cells.has(sideKey))) {
        return { valid: false, intersections: 0 };
      }
    }

    if (requireIntersection && intersections === 0) {
      return { valid: false, intersections: 0 };
    }

    return { valid: true, intersections };
  }

  indexesOf(answer, letter) {
    const indexes = [];
    for (let index = 0; index < answer.length; index += 1) {
      if (answer[index] === letter) {
        indexes.push(index);
      }
    }
    return indexes;
  }

  distanceFromOrigin(row, col) {
    return Math.abs(row) + Math.abs(col);
  }

  getBounds(padding) {
    if (this.cells.size === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }

    const rows = [...this.cells.values()].map((cell) => cell.row);
    const cols = [...this.cells.values()].map((cell) => cell.col);
    return {
      minRow: Math.min(...rows) - padding,
      maxRow: Math.max(...rows) + padding,
      minCol: Math.min(...cols) - padding,
      maxCol: Math.max(...cols) + padding,
    };
  }

  createLayout() {
    this.assignNumbers();
    const bounds = this.getBounds(0);
    return {
      bounds,
      cells: new Map(this.cells),
      placements: [...this.placements].sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        return a.direction.localeCompare(b.direction);
      }),
    };
  }

  assignNumbers() {
    const starts = [...new Set(this.placements.map((placement) => toCellKey(placement.row, placement.col)))]
      .map(fromCellKey)
      .sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));

    const numbers = new Map();
    starts.forEach((start, index) => {
      numbers.set(toCellKey(start.row, start.col), index + 1);
    });

    for (const placement of this.placements) {
      placement.number = numbers.get(toCellKey(placement.row, placement.col));
    }
  }
}

class CrosswordApp {
  constructor() {
    this.entries = this.prepareEntries();
    this.hash = hashString(JSON.stringify(this.entries.map(({ clue, answer }) => ({ clue, answer }))));
    this.storageKey = `${STORAGE_PREFIX}:${this.hash}`;
    this.layout = null;
    this.values = new Map();
    this.activeCellKey = null;
    this.activePlacementId = null;
    this.checked = false;
    this.checkedPlacements = new Set();
    this.elapsedSeconds = 0;
    this.completed = false;
    this.revealedSolution = false;
    this.timerId = null;
    this.wordTimings = new Map();
    this.lastInputAt = null;
    this.longestPause = 0;
    this.animateNextRender = false;

    this.elements = {
      grid: document.querySelector("#grid"),
      acrossClues: document.querySelector("#across-clues"),
      downClues: document.querySelector("#down-clues"),
      completion: document.querySelector("#completion"),
      timer: document.querySelector("#timer"),
      message: document.querySelector("#message"),
      statsPanel: document.querySelector("#stats-panel"),
      statsList: document.querySelector("#stats-list"),
      checkButton: document.querySelector("#check-button"),
      solveButton: document.querySelector("#solve-button"),
      resetButton: document.querySelector("#reset-button"),
      newButton: document.querySelector("#new-button"),
      themeButton: document.querySelector("#theme-button"),
    };
  }

  init() {
    const saved = this.loadState();
    this.applyTheme(saved?.theme || "light");

    if (saved?.layout) {
      try {
        this.layout = new CrosswordGenerator(this.entries).fromPlacements(saved.layout);
        this.values = new Map(Object.entries(saved.values || {}));
        this.elapsedSeconds = Number(saved.elapsedSeconds || 0);
        this.wordTimings = new Map(Object.entries(saved.wordTimings || {}));
        this.checkedPlacements = new Set(saved.checkedPlacements || []);
        this.lastInputAt = Number.isFinite(saved.lastInputAt) ? saved.lastInputAt : null;
        this.longestPause = Number(saved.longestPause || 0);
        this.revealedSolution = Boolean(saved.revealedSolution);
        this.initializeSelection();
        this.ensureWordTimings();
      } catch (error) {
        this.createNewLayout(false);
      }
    } else {
      this.createNewLayout(false);
    }

    this.bindEvents();
    this.render();
    this.updateProgress();
    this.evaluateCompletion(false);
    this.renderStats(this.completed || this.revealedSolution);
    this.saveState();
    this.startTimer();
  }

  prepareEntries() {
    return WORDS.map((word, originalIndex) => ({
      originalIndex,
      clue: String(word.clue || "").trim(),
      answer: normalizeAnswer(word.answer),
    })).filter((word) => word.clue && word.answer);
  }

  createNewLayout(shouldSave = true) {
    this.layout = new CrosswordGenerator(this.entries).generate();
    this.values = new Map();
    this.checked = false;
    this.checkedPlacements = new Set();
    this.completed = false;
    this.revealedSolution = false;
    this.elapsedSeconds = 0;
    this.resetStats();
    this.initializeSelection();

    if (shouldSave) {
      this.saveState();
    }
  }

  bindEvents() {
    this.elements.checkButton.addEventListener("click", () => this.checkAnswers());
    this.elements.solveButton.addEventListener("click", () => this.solvePuzzle());
    this.elements.resetButton.addEventListener("click", () => this.resetPuzzle());
    this.elements.newButton.addEventListener("click", () => this.newPuzzle());
    this.elements.themeButton.addEventListener("click", () => this.toggleTheme());
  }

  initializeSelection() {
    this.activePlacementId = this.layout.placements[0]?.id || null;
    this.activeCellKey = this.layout.placements[0]?.cells[0] || null;
  }

  resetStats() {
    this.wordTimings = new Map();
    this.lastInputAt = null;
    this.longestPause = 0;
    this.ensureWordTimings();
  }

  ensureWordTimings() {
    const placementIds = new Set(this.layout.placements.map((placement) => placement.id));

    for (const placementId of [...this.wordTimings.keys()]) {
      if (!placementIds.has(placementId)) {
        this.wordTimings.delete(placementId);
      }
    }

    for (const placement of this.layout.placements) {
      if (!this.wordTimings.has(placement.id)) {
        this.wordTimings.set(placement.id, {
          startedAt: null,
          completedAt: null,
          duration: null,
        });
      }
    }
  }

  render() {
    this.renderGrid();
    this.renderClues();
    this.updateProgress();
    this.updateTimer();
    this.focusActiveCell();
  }

  renderGrid() {
    const { grid } = this.elements;
    const { bounds } = this.layout;
    const width = bounds.maxCol - bounds.minCol + 1;
    grid.innerHTML = "";
    grid.style.setProperty("--grid-columns", width);
    grid.classList.toggle("animating", this.animateNextRender);

    let tileIndex = 0;
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
        const key = toCellKey(row, col);
        const cell = this.layout.cells.get(key);

        if (!cell) {
          const black = document.createElement("div");
          black.className = "cell black";
          grid.appendChild(black);
          continue;
        }

        grid.appendChild(this.createCellElement(key, cell, tileIndex));
        tileIndex += 1;
      }
    }

    if (this.animateNextRender) {
      window.setTimeout(() => grid.classList.remove("animating"), 800);
      this.animateNextRender = false;
    }
  }

  createCellElement(key, cell, tileIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = this.cellClassName(key, cell);
    wrapper.dataset.key = key;
    wrapper.style.setProperty("--tile-delay", `${Math.min(tileIndex * 5, 240)}ms`);

    const number = this.getCellNumber(key);
    if (number) {
      const numberElement = document.createElement("span");
      numberElement.className = "number";
      numberElement.textContent = number;
      wrapper.appendChild(numberElement);
    }

    const input = document.createElement("input");
    input.className = "cell-input";
    input.inputMode = "text";
    input.maxLength = 1;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = this.values.get(key) || "";
    input.dataset.key = key;
    input.setAttribute("aria-label", `Casella ${key}`);

    input.addEventListener("focus", () => this.selectCell(key, false));
    input.addEventListener("click", () => this.selectCell(key, false));
    input.addEventListener("dblclick", () => this.selectCell(key, true));
    input.addEventListener("keydown", (event) => this.handleKeydown(event, key));
    input.addEventListener("input", (event) => this.handleInput(event, key));

    wrapper.appendChild(input);
    return wrapper;
  }

  cellClassName(key, cell) {
    const classes = ["cell", "used"];
    if (cell.words.has(this.activePlacementId)) classes.push("selected");
    if (key === this.activeCellKey) classes.push("active");

    const shouldShowCheck =
      this.checked || [...cell.words].some((wordId) => this.checkedPlacements.has(wordId));

    if (shouldShowCheck && this.values.get(key)) {
      classes.push(this.values.get(key) === cell.letter ? "correct" : "wrong");
    }

    return classes.join(" ");
  }

  getCellNumber(key) {
    const placement = this.layout.placements.find((item) => item.cells[0] === key);
    return placement?.number || "";
  }

  renderClues() {
    this.elements.acrossClues.innerHTML = "";
    this.elements.downClues.innerHTML = "";

    for (const placement of this.layout.placements) {
      const list =
        placement.direction === DIRECTIONS.ACROSS
          ? this.elements.acrossClues
          : this.elements.downClues;
      list.appendChild(this.createClueElement(placement));
    }
  }

  createClueElement(placement) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `clue-button${placement.id === this.activePlacementId ? " active" : ""}`;
    button.dataset.placementId = placement.id;

    const number = document.createElement("span");
    number.className = "clue-number";
    number.textContent = placement.number;

    const text = document.createElement("span");
    text.className = "clue-text";
    text.textContent = placement.clue;

    const length = document.createElement("span");
    length.className = "clue-length";
    length.textContent = `(${placement.answer.length})`;

    text.appendChild(document.createTextNode(" "));
    text.appendChild(length);
    button.append(number, text);
    button.addEventListener("click", () => this.selectPlacement(placement.id, true));

    item.appendChild(button);
    return item;
  }

  selectCell(key, canToggle) {
    const cell = this.layout.cells.get(key);
    if (!cell) return;

    let nextPlacementId = this.activePlacementId;
    const wordIds = [...cell.words];

    if (!wordIds.includes(nextPlacementId)) {
      nextPlacementId = wordIds[0];
    } else if (canToggle && key === this.activeCellKey && wordIds.length > 1) {
      const currentIndex = wordIds.indexOf(nextPlacementId);
      nextPlacementId = wordIds[(currentIndex + 1) % wordIds.length];
    }

    this.activeCellKey = key;
    this.activePlacementId = nextPlacementId;
    this.paintSelection();
  }

  selectPlacement(placementId, focusFirstOpen) {
    const placement = this.getPlacement(placementId);
    if (!placement) return;

    this.activePlacementId = placement.id;
    this.activeCellKey =
      (focusFirstOpen && placement.cells.find((key) => !this.values.get(key))) || placement.cells[0];
    this.paintSelection();
    this.focusActiveCell();
  }

  paintSelection() {
    this.refreshCells();

    for (const button of document.querySelectorAll(".clue-button")) {
      button.classList.toggle("active", button.dataset.placementId === this.activePlacementId);
    }
  }

  refreshCells() {
    for (const cellElement of document.querySelectorAll(".cell.used")) {
      const key = cellElement.dataset.key;
      const cell = this.layout.cells.get(key);
      cellElement.className = this.cellClassName(key, cell);
      const input = cellElement.querySelector("input");
      input.value = this.values.get(key) || "";
    }
  }

  handleKeydown(event, key) {
    if (event.key === "Tab") {
      event.preventDefault();
      this.moveByTab(event.shiftKey ? -1 : 1);
      return;
    }

    const arrowMap = {
      ArrowRight: { direction: DIRECTIONS.ACROSS, step: 1 },
      ArrowLeft: { direction: DIRECTIONS.ACROSS, step: -1 },
      ArrowDown: { direction: DIRECTIONS.DOWN, step: 1 },
      ArrowUp: { direction: DIRECTIONS.DOWN, step: -1 },
    };

    if (arrowMap[event.key]) {
      event.preventDefault();
      const { direction, step } = arrowMap[event.key];
      this.moveByArrow(key, direction, step);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      const changedPlacementId = this.activePlacementId;
      this.values.delete(key);
      this.moveWithinActiveWord(-1);
      this.afterValueChange({ changedPlacementId });
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      const changedPlacementId = this.activePlacementId;
      this.values.delete(key);
      this.afterValueChange({ changedPlacementId });
      this.focusActiveCell();
      return;
    }

    const normalized = normalizeAnswer(event.key);
    if (normalized.length === 1) {
      event.preventDefault();
      const changedPlacementId = this.activePlacementId;
      this.values.set(key, normalized);
      this.moveWithinActiveWord(1);
      this.afterValueChange({ changedPlacementId, autoCheck: true });
    }
  }

  handleInput(event, key) {
    const normalized = normalizeAnswer(event.target.value).slice(-1);
    if (!normalized) {
      const changedPlacementId = this.activePlacementId;
      this.values.delete(key);
      this.afterValueChange({ changedPlacementId });
      return;
    }

    const changedPlacementId = this.activePlacementId;
    this.values.set(key, normalized);
    this.moveWithinActiveWord(1);
    this.afterValueChange({ changedPlacementId, autoCheck: true });
  }

  moveByArrow(key, direction, step) {
    const cell = this.layout.cells.get(key);
    const placementId = [...cell.words].find((id) => this.getPlacement(id).direction === direction);

    if (!placementId) return;

    this.activePlacementId = placementId;
    this.moveWithinActiveWord(step);
  }

  moveWithinActiveWord(step) {
    const placement = this.getPlacement(this.activePlacementId);
    if (!placement) return;

    const currentIndex = Math.max(0, placement.cells.indexOf(this.activeCellKey));
    const nextIndex = Math.min(placement.cells.length - 1, Math.max(0, currentIndex + step));
    this.activeCellKey = placement.cells[nextIndex];
    this.paintSelection();
    this.focusActiveCell();
  }

  moveByTab(step) {
    const placements = this.layout.placements;
    const currentIndex = Math.max(
      0,
      placements.findIndex((placement) => placement.id === this.activePlacementId),
    );
    const nextIndex = (currentIndex + step + placements.length) % placements.length;
    this.selectPlacement(placements[nextIndex].id, true);
  }

  recordInputForWord(placementId) {
    const timing = this.wordTimings.get(placementId);
    if (!timing) return;

    const now = this.elapsedSeconds;
    if (this.lastInputAt !== null) {
      this.longestPause = Math.max(this.longestPause, Math.max(0, now - this.lastInputAt));
    }
    this.lastInputAt = now;

    if (timing.startedAt === null || timing.startedAt === undefined) {
      timing.startedAt = now;
    }
  }

  syncCompletedWordTimings() {
    for (const placement of this.layout.placements) {
      const timing = this.wordTimings.get(placement.id);
      if (!timing || timing.completedAt === null || timing.completedAt === undefined) {
        continue;
      }

      if (!this.isPlacementCorrect(placement)) {
        timing.completedAt = null;
        timing.duration = null;
      }
    }
  }

  autoCheckPlacement(placementId) {
    const placement = this.getPlacement(placementId);
    if (!placement || !this.isPlacementFilled(placement)) return;
    this.checkPlacement(placement, false);
  }

  checkActivePlacement() {
    const placement = this.getPlacement(this.activePlacementId);
    if (!placement) return;
    this.checkPlacement(placement, true);
  }

  checkPlacement(placement, showEmptyMessage) {
    if (!this.isPlacementFilled(placement)) {
      if (showEmptyMessage) {
        this.setMessage("Caselle ancora vuote", "warning");
      }
      return;
    }

    this.checkedPlacements.add(placement.id);
    if (this.isPlacementCorrect(placement)) {
      this.markPlacementCompleted(placement.id);
      this.setMessage("Parola corretta", "correct");
    } else {
      this.setMessage("Parola sbagliata", "wrong");
    }
    this.refreshCells();
  }

  isPlacementFilled(placement) {
    return placement.cells.every((key) => Boolean(this.values.get(key)));
  }

  isPlacementCorrect(placement) {
    return placement.cells.every((key, index) => this.values.get(key) === placement.answer[index]);
  }

  markPlacementCompleted(placementId) {
    const timing = this.wordTimings.get(placementId);
    if (!timing || timing.completedAt !== null) return;

    const now = this.elapsedSeconds;
    if (timing.startedAt === null || timing.startedAt === undefined) {
      timing.startedAt = now;
    }
    timing.completedAt = now;
    timing.duration = Math.max(0, now - timing.startedAt);
  }

  markStartedCorrectWordsCompleted() {
    for (const placement of this.layout.placements) {
      const timing = this.wordTimings.get(placement.id);
      if (timing?.startedAt !== null && timing?.startedAt !== undefined && this.isPlacementCorrect(placement)) {
        this.markPlacementCompleted(placement.id);
      }
    }
  }

  setMessage(text, type = "") {
    this.elements.message.className = type ? `message ${type}` : "message";
    this.elements.message.textContent = text;
  }

  afterValueChange({ clearChecked = true, changedPlacementId = null, autoCheck = false } = {}) {
    if (clearChecked) {
      this.checked = false;
    }
    if (clearChecked && !this.revealedSolution) {
      this.setMessage("");
    }
    if (changedPlacementId) {
      this.recordInputForWord(changedPlacementId);
    }
    this.syncCompletedWordTimings();
    this.updateProgress();
    this.refreshCells();
    if (autoCheck && changedPlacementId) {
      this.autoCheckPlacement(changedPlacementId);
    }
    this.saveState();
    this.evaluateCompletion();
  }

  updateProgress() {
    const total = this.layout.cells.size || 1;
    const filled = [...this.layout.cells.keys()].filter((key) => this.values.get(key)).length;
    const percent = Math.round((filled / total) * 100);
    this.elements.completion.textContent = `Completamento: ${percent}%`;
  }

  renderStats(visible) {
    this.elements.statsPanel.hidden = !visible;
    if (!visible) {
      this.elements.statsList.innerHTML = "";
      return;
    }

    const completedWords = this.layout.placements
      .map((placement) => ({
        placement,
        timing: this.wordTimings.get(placement.id),
      }))
      .filter(({ timing }) => Number.isFinite(timing?.duration));

    const average =
      completedWords.length === 0
        ? null
        : Math.round(
            completedWords.reduce((total, { timing }) => total + timing.duration, 0) /
              completedWords.length,
          );
    const fastest = completedWords.reduce((best, item) => {
      if (!best || item.timing.duration < best.timing.duration) {
        return item;
      }
      return best;
    }, null);

    this.elements.statsList.innerHTML = "";
    [
      {
        label: "Tempo medio",
        value: average === null ? "N/D" : formatTime(average),
        detail: `${completedWords.length}/${this.layout.placements.length} risposte completate`,
      },
      {
        label: "Pausa piu lunga",
        value: formatTime(this.longestPause),
        detail: "Intervallo massimo tra due inserimenti",
      },
      {
        label: "Risposta piu veloce",
        value: fastest ? formatTime(fastest.timing.duration) : "N/D",
        detail: fastest ? `${fastest.placement.number}. ${fastest.placement.clue}` : "Nessuna parola completata",
      },
    ].forEach((stat) => this.elements.statsList.appendChild(this.createStatElement(stat)));
  }

  createStatElement(stat) {
    const item = document.createElement("div");
    item.className = "stat-item";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = stat.label;

    const value = document.createElement("span");
    value.className = "stat-value";
    value.textContent = stat.value;

    const detail = document.createElement("span");
    detail.className = "stat-detail";
    detail.textContent = stat.detail;

    item.append(label, value, detail);
    return item;
  }

  checkAnswers() {
    this.checkActivePlacement();
    this.refreshCells();
    this.updateProgress();
    this.evaluateCompletion(false);
    this.saveState();
  }

  solvePuzzle() {
    if (!window.confirm("Mostrare la soluzione completa? Questa azione riempira tutte le caselle.")) {
      return;
    }

    for (const [key, cell] of this.layout.cells.entries()) {
      this.values.set(key, cell.letter);
    }
    this.checked = true;
    this.revealedSolution = true;
    this.completed = true;
    this.elements.message.className = "message success";
    this.elements.message.textContent = "Soluzione mostrata.";
    this.renderStats(true);
    this.afterValueChange({ clearChecked: false });
  }

  resetPuzzle() {
    if (!window.confirm("Svuotare il cruciverba e azzerare il timer?")) {
      return;
    }

    this.values = new Map();
    this.checked = false;
    this.checkedPlacements = new Set();
    this.completed = false;
    this.revealedSolution = false;
    this.elapsedSeconds = 0;
    this.resetStats();
    document.body.classList.remove("celebrating");
    this.elements.message.className = "message";
    this.elements.message.textContent = "";
    this.selectPlacement(this.layout.placements[0]?.id, true);
    this.updateTimer();
    this.renderStats(false);
    this.afterValueChange();
  }

  newPuzzle() {
    this.createNewLayout(true);
    this.animateNextRender = true;
    document.body.classList.remove("celebrating");
    this.elements.message.className = "message";
    this.elements.message.textContent = "";
    this.renderStats(false);
    this.render();
    this.saveState();
  }

  evaluateCompletion(showPartialMessage = false) {
    const allCorrect = [...this.layout.cells.entries()].every(
      ([key, cell]) => this.values.get(key) === cell.letter,
    );

    if (allCorrect) {
      this.completed = true;
      this.markStartedCorrectWordsCompleted();
      this.elements.message.className = "message success";

      if (this.revealedSolution) {
        this.elements.message.textContent = "Soluzione mostrata.";
      } else {
        this.elements.message.textContent =
          "🎉 Complimenti Benzi! Hai completato il cruciverba!";
        document.body.classList.add("celebrating");
      }

      this.renderStats(true);
      this.saveState();
      return;
    }

    this.completed = false;
    document.body.classList.remove("celebrating");
    if (showPartialMessage) {
      this.setMessage("Caselle ancora vuote", "warning");
    }
    if (!this.revealedSolution) {
      this.renderStats(false);
    }
  }

  toggleTheme() {
    const isDark = !document.body.classList.contains("dark");
    this.applyTheme(isDark ? "dark" : "light");
    this.saveState();
  }

  applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    this.elements.themeButton.textContent = isDark ? "Tema chiaro" : "Tema scuro";
    this.elements.themeButton.setAttribute("aria-pressed", String(isDark));
  }

  startTimer() {
    window.clearInterval(this.timerId);
    this.timerId = window.setInterval(() => {
      if (!this.completed) {
        this.elapsedSeconds += 1;
        this.updateTimer();
        this.saveState();
      }
    }, 1000);
  }

  updateTimer() {
    this.elements.timer.textContent = formatTime(this.elapsedSeconds);
  }

  focusActiveCell() {
    if (!this.activeCellKey) return;
    const input = [...document.querySelectorAll("input[data-key]")].find(
      (candidate) => candidate.dataset.key === this.activeCellKey,
    );
    input?.focus({ preventScroll: true });
  }

  getPlacement(placementId) {
    return this.layout.placements.find((placement) => placement.id === placementId);
  }

  saveState() {
    const theme = document.body.classList.contains("dark") ? "dark" : "light";
    const layout = this.layout.placements.map((placement) => ({
      originalIndex: placement.originalIndex,
      row: placement.row,
      col: placement.col,
      direction: placement.direction,
    }));

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          hash: this.hash,
          values: Object.fromEntries(this.values),
          layout,
          elapsedSeconds: this.elapsedSeconds,
          checkedPlacements: [...this.checkedPlacements],
          wordTimings: Object.fromEntries(this.wordTimings),
          lastInputAt: this.lastInputAt,
          longestPause: this.longestPause,
          revealedSolution: this.revealedSolution,
          theme,
        }),
      );
    } catch (error) {
      // Alcuni browser possono bloccare localStorage su file locali o in modalita privata.
    }
  }

  loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      return saved?.hash === this.hash ? saved : null;
    } catch (error) {
      return null;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CrosswordApp().init();
});
