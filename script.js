const select = (s) => document.querySelector(s);
const selectAll = (s) => document.querySelectorAll(s);

// State
let solvedBoard = [];
let userBoard = [];
let selectedCell = null; // {r, c}
let moveHistory = [];
let autoCandidatesEnabled = false;
let lastModified = [];
let moveCount = 0;

let timerInterval = null;
let secondsElapsed = 0;
let currentDifficulty = 'medium';

const difficulties = {
    easy: 30, // cells to remove
    medium: 45,
    hard: 55
};

// DOM Elements
const boardEl = select('#sudoku-board');
const numpadEl = select('#numpad');

function initGame() {
    currentDifficulty = select('#difficulty-select').value;
    generatePuzzle();
    renderBoard();
    resetTimer();
    startTimer();
    updateHighScoreDisplay();
    moveHistory = [];
    lastModified = Array(9).fill(null).map(() => Array(9).fill(0));
    moveCount = 0;
    autoCandidatesEnabled = false;
    select('#btn-auto-candidates').classList.remove('active');
    updateNumberPad();
    checkDuplicates();
    select('#win-overlay').classList.add('hidden');
}

// Sudoku Generator
function generatePuzzle() {
    solvedBoard = Array(9).fill(null).map(() => Array(9).fill(0));
    fillBoard(solvedBoard);

    initialPuzzle = JSON.parse(JSON.stringify(solvedBoard));
    removeCells(initialPuzzle, difficulties[currentDifficulty]);

    userBoard = JSON.parse(JSON.stringify(initialPuzzle));
}

function fillBoard(board) {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        if (board[r][c] === 0) {
            shuffle(nums);
            for (let num of nums) {
                if (isValid(board, r, c, num)) {
                    board[r][c] = num;
                    if (fillBoard(board)) return true;
                    board[r][c] = 0;
                }
            }
            return false;
        }
    }
    return true;
}

function isValid(board, r, c, num) {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === num && i !== c) return false;
        if (board[i][c] === num && i !== r) return false;
    }
    const startR = Math.floor(r / 3) * 3;
    const startC = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[startR + i][startC + j] === num && (startR + i !== r || startC + j !== c)) return false;
        }
    }
    return true;
}

function removeCells(board, count) {
    let attempts = count;
    while (attempts > 0) {
        let r = Math.floor(Math.random() * 9);
        let c = Math.floor(Math.random() * 9);
        while (board[r][c] === 0) {
            r = Math.floor(Math.random() * 9);
            c = Math.floor(Math.random() * 9);
        }
        board[r][c] = 0;
        attempts--;
    }
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Rendering
function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;

            const val = userBoard[r][c];
            if (val !== 0) {
                cell.textContent = val;
                if (initialPuzzle[r][c] === 0) {
                    cell.classList.add('user-input');
                }
            }

            cell.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent losing focus
                selectCell(r, c);
            });
            boardEl.appendChild(cell);
        }
    }
    selectedCell = null;
}

function selectCell(r, c) {
    selectedCell = { r, c };
    updateHighlights();
}

function updateHighlights() {
    const cells = selectAll('.cell');
    cells.forEach(cell => {
        // Only clear active, related, and match. We leave the error classes (error-highlight, related-error) to persist.
        cell.classList.remove('active', 'related', 'match');
    });

    const overlay = select('#box-highlight-overlay');

    if (!selectedCell) {
        if (overlay) overlay.classList.add('hidden');
        return;
    }

    const { r, c } = selectedCell;
    const selectedVal = userBoard[r][c];

    // Position 3x3 Overlay
    if (overlay) {
        const topR = Math.floor(r / 3) * 3;
        const topC = Math.floor(c / 3) * 3;
        const topLeftCell = select(`.cell[data-r="${topR}"][data-c="${topC}"]`);
        const bottomRightCell = select(`.cell[data-r="${topR + 2}"][data-c="${topC + 2}"]`);
        const container = select('.board-container');

        if (topLeftCell && bottomRightCell && container) {
            const containerRect = container.getBoundingClientRect();
            const tlRect = topLeftCell.getBoundingClientRect();
            const brRect = bottomRightCell.getBoundingClientRect();

            overlay.style.top = `${tlRect.top - containerRect.top - 2}px`;
            overlay.style.left = `${tlRect.left - containerRect.left - 2}px`;
            overlay.style.width = `${brRect.right - tlRect.left + 4}px`;
            overlay.style.height = `${brRect.bottom - tlRect.top + 4}px`;
            overlay.classList.remove('hidden');
        }
    }

    cells.forEach(cell => {
        const cr = parseInt(cell.dataset.r);
        const cc = parseInt(cell.dataset.c);

        // Active cell
        if (cr === r && cc === c) {
            cell.classList.add('active');
        }
        // Related cells (row, col, box)
        else if (cr === r || cc === c || (Math.floor(cr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3))) {
            cell.classList.add('related');
        }

        // Match val
        if (selectedVal !== 0 && userBoard[cr][cc] === selectedVal && !(cr === r && cc === c)) {
            // Do not override user errors with generic match highlights
            if (!cell.classList.contains('error-highlight') && !cell.classList.contains('related-error')) {
                cell.classList.add('match');
            }
        }
    });
}

// Interactions
function setNumber(num) {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    if (initialPuzzle[r][c] !== 0) return; // Fixed cell

    if (userBoard[r][c] !== num) {
        moveHistory.push({ r, c, prevVal: userBoard[r][c] });
    }

    userBoard[r][c] = num;
    lastModified[r][c] = ++moveCount;
    const cellEl = select(`.cell[data-r="${r}"][data-c="${c}"]`);

    // Auto Candidates overwrite clear if any
    cellEl.innerHTML = num === 0 ? '' : num;
    if (num !== 0) {
        cellEl.classList.add('user-input');
    } else {
        cellEl.classList.remove('user-input');
    }

    if (autoCandidatesEnabled) {
        refreshAllCandidates();
    }

    updateHighlights();
    checkDuplicates();
    updateNumberPad();
    checkWinCondition();
}

function clearCell() {
    setNumber(0);
}

function undoMove() {
    if (moveHistory.length === 0) return;
    const lastMove = moveHistory.pop();
    const { r, c, prevVal } = lastMove;

    userBoard[r][c] = prevVal;
    const cellEl = select(`.cell[data-r="${r}"][data-c="${c}"]`);

    cellEl.innerHTML = prevVal === 0 ? '' : prevVal;
    if (prevVal !== 0) {
        cellEl.classList.add('user-input');
    } else {
        cellEl.classList.remove('user-input');
    }

    if (autoCandidatesEnabled) {
        refreshAllCandidates();
    }

    // Select the cell that was undone
    selectCell(r, c);
    checkDuplicates();
    updateNumberPad();
}

function checkDuplicates() {
    const cells = selectAll('.cell');
    // We only remove error-highlight if it's currently used for duplicates. Check puzzle also uses it.
    cells.forEach(cell => cell.classList.remove('error-highlight', 'related-error'));

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const val = userBoard[r][c];
            if (val === 0) continue;

            let conflicts = [];

            // Check row and column
            for (let i = 0; i < 9; i++) {
                if (i !== c && userBoard[r][i] === val) conflicts.push({ r: r, c: i });
                if (i !== r && userBoard[i][c] === val) conflicts.push({ r: i, c: c });
            }
            // Check 3x3 box
            const startR = Math.floor(r / 3) * 3;
            const startC = Math.floor(c / 3) * 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if ((startR + i !== r || startC + j !== c) && userBoard[startR + i][startC + j] === val) {
                        conflicts.push({ r: startR + i, c: startC + j });
                    }
                }
            }

            if (conflicts.length > 0) {
                let isNewestDup = true;
                for (let conf of conflicts) {
                    if (lastModified[conf.r][conf.c] > lastModified[r][c]) {
                        isNewestDup = false;
                    }
                }
                const classToAdd = isNewestDup ? 'error-highlight' : 'related-error';
                select(`.cell[data-r="${r}"][data-c="${c}"]`).classList.add(classToAdd);
            }
        }
    }
}

function updateNumberPad() {
    for (let num = 1; num <= 9; num++) {
        let count = 0;
        let allCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (userBoard[r][c] === num) {
                    count++;
                    if (solvedBoard[r][c] !== num) {
                        allCorrect = false;
                    }
                }
            }
        }

        const btn = select(`.num-btn[data-val="${num}"]`);
        if (btn) {
            if (count === 9 && allCorrect) {
                btn.classList.add('hidden');
            } else {
                btn.classList.remove('hidden');
            }
        }
    }
}

// Candidates
function toggleAutoCandidates() {
    autoCandidatesEnabled = !autoCandidatesEnabled;
    const btn = select('#btn-auto-candidates');
    if (autoCandidatesEnabled) {
        btn.classList.add('active');
        refreshAllCandidates();
    } else {
        btn.classList.remove('active');
        clearAllCandidates();
    }
}

function refreshAllCandidates() {
    const cells = selectAll('.cell');
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (userBoard[r][c] === 0) {
                const possible = [];
                for (let num = 1; num <= 9; num++) {
                    // Only add candidate if placing it wouldn't create a duplication rule break
                    if (isValid(userBoard, r, c, num)) {
                        possible.push(num);
                    }
                }
                const cellEl = select(`.cell[data-r="${r}"][data-c="${c}"]`);
                cellEl.innerHTML = `<div class="candidates">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<div class="candidate">${possible.includes(n) ? n : ''}</div>`).join('')}
                </div>`;
            }
        }
    }
}

function clearAllCandidates() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (userBoard[r][c] === 0) {
                const cellEl = select(`.cell[data-r="${r}"][data-c="${c}"]`);
                cellEl.innerHTML = '';
            }
        }
    }
}

// Checking and Winning
function checkPuzzle() {
    let hasError = false;
    const cells = selectAll('.cell');
    cells.forEach(cell => cell.classList.remove('error-highlight'));

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (userBoard[r][c] !== 0) {
                if (userBoard[r][c] !== solvedBoard[r][c]) {
                    hasError = true;
                    select(`.cell[data-r="${r}"][data-c="${c}"]`).classList.add('error-highlight');
                }
            }
        }
    }
    return !hasError;
}

function checkWinCondition() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (userBoard[r][c] === 0) return;
        }
    }
    if (checkPuzzle()) {
        winGame();
    }
}

function winGame() {
    stopTimer();
    const timeStr = formatTime(secondsElapsed);
    select('#final-time').textContent = timeStr;

    const bestKey = `sudoku-best-${currentDifficulty}`;
    const bestTime = localStorage.getItem(bestKey);
    const newRecordMsg = select('#new-record-msg');

    if (!bestTime || secondsElapsed < parseInt(bestTime)) {
        localStorage.setItem(bestKey, secondsElapsed);
        newRecordMsg.classList.remove('hidden');
    } else {
        newRecordMsg.classList.add('hidden');
    }

    select('#win-overlay').classList.remove('hidden');
    updateHighScoreDisplay();
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        secondsElapsed++;
        select('#timer').textContent = formatTime(secondsElapsed);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function resetTimer() {
    stopTimer();
    secondsElapsed = 0;
    select('#timer').textContent = "00:00";
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

function updateHighScoreDisplay() {
    const bestKey = `sudoku-best-${currentDifficulty}`;
    const bestTime = localStorage.getItem(bestKey);
    select('#high-score').textContent = bestTime ? formatTime(parseInt(bestTime)) : '--:--';
}


// Theme setup
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const btn = select('#theme-toggle');
    if (isDark) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" class="moon-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" class="sun-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    select('#btn-new-game').addEventListener('click', initGame);
    select('#btn-check').addEventListener('click', checkPuzzle);
    select('#btn-undo').addEventListener('click', undoMove);
    select('#btn-auto-candidates').addEventListener('click', toggleAutoCandidates);
    select('#btn-clear').addEventListener('click', clearCell);
    select('#theme-toggle').addEventListener('click', toggleTheme);
    select('#overlay-new-game').addEventListener('click', initGame);
    select('#difficulty-select').addEventListener('change', () => {
        initGame();
    });

    selectAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = parseInt(e.target.dataset.val);
            setNumber(val);
        });
    });

    document.addEventListener('keydown', (e) => {
        // Handle Undo (Ctrl+Z or Cmd+Z)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoMove();
            return;
        }

        if (e.key >= '1' && e.key <= '9') {
            setNumber(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            clearCell();
        } else if (e.key.startsWith('Arrow')) {
            if (!selectedCell) return;
            let { r, c } = selectedCell;
            if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
            if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
            if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
            if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
            selectCell(r, c);
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.cell') && !e.target.closest('.controls-panel') && !e.target.closest('.numpad') && !e.target.closest('header')) {
            selectedCell = null;
            updateHighlights();
        }
    });

    initGame();
});
