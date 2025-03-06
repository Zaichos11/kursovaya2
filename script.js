document.addEventListener("DOMContentLoaded", () => {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;

  const COLORS = [
    null,
    "#FF0055", // I
    "#00AAFF", // O
    "#00FF66", // T
    "#FF00FF", // J
    "#FF8000", // L
    "#FFFF00", // S
    "#4444FF", // Z
  ];

  const GRADIENTS = [
    null,
    ["#FF0055", "#FF5599"],
    ["#00AAFF", "#66CCFF"],
    ["#00FF66", "#66FFAA"],
    ["#FF00FF", "#FF66FF"],
    ["#FF8000", "#FFAA44"],
    ["#FFFF00", "#FFFF99"],
    ["#4444FF", "#8888FF"],
  ];

  const SHAPES = [
    [],
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]], // J
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]], // L
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
  ];

  const canvas = document.getElementById("tetris");
  const ctx = canvas.getContext("2d");
  const nextPieceCanvas = document.getElementById("next-piece");
  const nextPieceCtx = nextPieceCanvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const linesElement = document.getElementById("lines");
  const levelElement = document.getElementById("level");
  const pauseBtn = document.getElementById("pause-btn");
  const newGameBtn = document.getElementById("new-game-btn");
  const restartBtn = document.getElementById("restart-btn");
  const gameMessage = document.getElementById("game-message");
  const finalScoreElement = document.getElementById("final-score");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const keyIndicator = document.getElementById("key-indicator");

  const mobileLeft = document.getElementById("mobile-left");
  const mobileRight = document.getElementById("mobile-right");
  const mobileRotate = document.getElementById("mobile-rotate");
  const mobileDown = document.getElementById("mobile-down");
  const mobileDrop = document.getElementById("mobile-drop");

  const authOverlay = document.getElementById("auth-overlay");
  const authForm = document.getElementById("auth-form");
  const usernameInput = document.getElementById("username");

  let underlayCanvas, underlayCtx, particlesCanvas, particlesCtx;
  let board = createMatrix(COLS, ROWS);
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let activeShape = null;
  let nextShape = null;
  let isFullscreen = false;
  let currentBlockSize = BLOCK_SIZE;
  let particles = [];
  let underlayEffects = [];
  let lastLandingPosition = null;
  let lastKeyPressed = "";
  let keyTimeout = null;
  let username = null;
  let highScores = loadHighScores();

  function loadHighScores() {
    const scores = localStorage.getItem("tetrisHighScores");
    return scores ? JSON.parse(scores) : {};
  }

  function saveHighScores() {
    localStorage.setItem("tetrisHighScores", JSON.stringify(highScores));
  }

  function updateHighScore() {
    if (!username) return;
    const currentHighScore = highScores[username] || 0;
    if (score > currentHighScore) {
      highScores[username] = score;
      saveHighScores();
    }
  }

  function initializeEffects() {
    if (isFullscreen) return;

    underlayCanvas = document.createElement("canvas");
    underlayCanvas.id = "underlay";
    underlayCanvas.width = canvas.width;
    underlayCanvas.height = canvas.height;
    canvas.parentElement.appendChild(underlayCanvas);
    underlayCtx = underlayCanvas.getContext("2d");

    particlesCanvas = document.createElement("canvas");
    particlesCanvas.id = "particles-canvas";
    particlesCanvas.width = canvas.width;
    particlesCanvas.height = canvas.height;
    canvas.parentElement.appendChild(particlesCanvas);
    particlesCtx = particlesCanvas.getContext("2d");

    underlayCanvas.style.position = "absolute";
    underlayCanvas.style.top = "0";
    underlayCanvas.style.left = "0";
    underlayCanvas.style.zIndex = "1";
    underlayCanvas.style.pointerEvents = "none";

    particlesCanvas.style.position = "absolute";
    particlesCanvas.style.top = "0";
    particlesCanvas.style.left = "0";
    particlesCanvas.style.zIndex = "3";
    particlesCanvas.style.pointerEvents = "none";

    canvas.style.zIndex = "2";
  }

  function removeEffects() {
    if (underlayCanvas) {
      underlayCanvas.remove();
      underlayCanvas = null;
      underlayCtx = null;
    }
    if (particlesCanvas) {
      particlesCanvas.remove();
      particlesCanvas = null;
      particlesCtx = null;
    }
    particles = [];
    underlayEffects = [];
  }

  class UnderlayEffect {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.radius = 0;
      this.maxRadius = currentBlockSize * 2.5;
      this.opacity = 1;
      this.waveCount = 0;
      this.maxWaves = 4;
      this.pulse = 0;
    }

    update() {
      this.radius += currentBlockSize * 0.1;
      this.opacity = Math.max(0, 1 - this.radius / this.maxRadius);
      this.pulse = Math.sin(Date.now() / 80) * 0.3 + 0.7;
      if (this.radius >= this.maxRadius) {
        this.waveCount++;
        this.radius = 0;
        this.opacity = 1;
      }
    }

    draw() {
      underlayCtx.save();
      underlayCtx.globalAlpha = this.opacity * 0.7;

      const gradient = underlayCtx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.radius
      );
      gradient.addColorStop(
        0,
        `${this.color}${Math.floor(this.pulse * 255).toString(16)}`
      );
      gradient.addColorStop(1, "transparent");

      underlayCtx.beginPath();
      underlayCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      underlayCtx.fillStyle = gradient;
      underlayCtx.fill();

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const sparkX = this.x + Math.cos(angle) * this.radius * 0.8;
        const sparkY = this.y + Math.sin(angle) * this.radius * 0.8;
        underlayCtx.beginPath();
        underlayCtx.arc(sparkX, sparkY, currentBlockSize * 0.1, 0, Math.PI * 2);
        underlayCtx.fillStyle = lightenColor(this.color, 50);
        underlayCtx.fill();
      }

      underlayCtx.restore();
    }

    isFinished() {
      return this.waveCount >= this.maxWaves;
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * currentBlockSize * 0.5 + currentBlockSize * 0.1;
      this.speedX = (Math.random() * 0.3 - 0.15) * currentBlockSize;
      this.speedY = (Math.random() * -0.5 - 0.15) * currentBlockSize;
      this.gravity = 0.01 * currentBlockSize;
      this.color = color;
      this.alpha = 1;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = Math.random() * 0.03 - 0.015;
      this.shape = Math.floor(Math.random() * 4);
    }

    update() {
      this.speedY += this.gravity;
      this.x += this.speedX;
      this.y += this.speedY;
      this.size *= 0.95;
      this.alpha -= 0.015;
      this.rotation += this.rotationSpeed;
    }

    draw() {
      particlesCtx.save();
      particlesCtx.globalAlpha = this.alpha;

      const gradient = particlesCtx.createLinearGradient(
        this.x,
        this.y,
        this.x - this.speedX * 2,
        this.y - this.speedY * 2
      );
      gradient.addColorStop(0, `${this.color}66`);
      gradient.addColorStop(1, "transparent");

      particlesCtx.beginPath();
      particlesCtx.moveTo(this.x, this.y);
      particlesCtx.lineTo(this.x - this.speedX * 2, this.y - this.speedY * 2);
      particlesCtx.strokeStyle = gradient;
      particlesCtx.lineWidth = this.size / 2;
      particlesCtx.stroke();

      particlesCtx.translate(this.x, this.y);
      particlesCtx.rotate(this.rotation);

      particlesCtx.fillStyle = this.color;
      particlesCtx.strokeStyle = lightenColor(this.color, 20);
      particlesCtx.lineWidth = currentBlockSize * 0.05;

      if (this.shape === 0) {
        particlesCtx.beginPath();
        particlesCtx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        particlesCtx.fill();
        particlesCtx.stroke();
      } else if (this.shape === 1) {
        particlesCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        particlesCtx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      } else if (this.shape === 2) {
        particlesCtx.beginPath();
        particlesCtx.moveTo(0, -this.size / 2);
        particlesCtx.lineTo(this.size / 2, this.size / 2);
        particlesCtx.lineTo(-this.size / 2, this.size / 2);
        particlesCtx.closePath();
        particlesCtx.fill();
        particlesCtx.stroke();
      } else {
        particlesCtx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5;
          const outerX = (Math.cos(angle) * this.size) / 2;
          const outerY = (Math.sin(angle) * this.size) / 2;
          const innerX = (Math.cos(angle + Math.PI / 5) * this.size) / 4;
          const innerY = (Math.sin(angle + Math.PI / 5) * this.size) / 4;
          particlesCtx.lineTo(outerX, outerY);
          particlesCtx.lineTo(innerX, innerY);
        }
        particlesCtx.closePath();
        particlesCtx.fill();
        particlesCtx.stroke();
      }

      particlesCtx.restore();
    }
  }

  function createMatrix(width, height) {
    const matrix = [];
    while (height--) {
      matrix.push(new Array(width).fill(0));
    }
    return matrix;
  }

  function createShape() {
    const shapeType = Math.floor(Math.random() * 7) + 1;
    const shape = {
      type: shapeType,
      matrix: SHAPES[shapeType].map(row => [...row]),
      pos: {
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[shapeType][0].length / 2),
        y: 0
      },
      colors: []
    };

    for (let y = 0; y < shape.matrix.length; y++) {
      shape.colors[y] = [];
      for (let x = 0; x < shape.matrix[y].length; x++) {
        if (shape.matrix[y][x] !== 0) {
          shape.colors[y][x] = shapeType;
          shape.matrix[y][x] = shapeType;
        } else {
          shape.colors[y][x] = 0;
        }
      }
    }
    return shape;
  }

  function clearCanvas(context, width, height) {
    context.fillStyle = "#2a2a3a";
    context.fillRect(0, 0, width, height);
  }

  function createGradient(context, x, y, colorIndex) {
    if (!colorIndex || !GRADIENTS[colorIndex]) return COLORS[colorIndex];
    const gradient = context.createLinearGradient(x, y, x + 1, y + 1);
    gradient.addColorStop(0, GRADIENTS[colorIndex][0]);
    gradient.addColorStop(1, GRADIENTS[colorIndex][1]);
    return gradient;
  }

  function drawMatrix(matrix, offset, context) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const xPos = x + offset.x;
          const yPos = y + offset.y;
          context.fillStyle = createGradient(context, xPos, yPos, value);
          context.fillRect(xPos, yPos, 1, 1);
          context.fillStyle = lightenColor(COLORS[value], 20);
          context.fillRect(xPos, yPos, 1, 0.15);
          context.fillRect(xPos, yPos, 0.15, 1);
          context.fillStyle = darkenColor(COLORS[value], 20);
          context.fillRect(xPos + 0.85, yPos, 0.15, 1);
          context.fillRect(xPos, yPos + 0.85, 1, 0.15);
          context.strokeStyle = "#2a2a3a";
          context.lineWidth = 0.05;
          context.strokeRect(xPos + 0.05, yPos + 0.05, 0.9, 0.9);
        }
      });
    });
  }

  function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
  }

  function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return "#" + (0x1000000 + (R > 0 ? (R > 255 ? 255 : R) : 0) * 0x10000 + (G > 0 ? (G > 255 ? 255 : G) : 0) * 0x100 + (B > 0 ? (B > 255 ? 255 : B) : 0)).toString(16).slice(1);
  }

  function drawGrid() {
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = 0.025;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, ROWS);
      ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(COLS, i);
      ctx.stroke();
    }
  }

  function draw() {
    clearCanvas(ctx, COLS, ROWS);
    drawGrid();
    drawMatrix(board, { x: 0, y: 0 }, ctx);
    if (activeShape) {
      drawGhostPiece();
      drawMatrix(activeShape.matrix, activeShape.pos, ctx);
    }
  }

  function drawNextPiece() {
    if (!nextShape) return;

    nextPieceCtx.setTransform(1, 0, 0, 1, 0, 0);
    nextPieceCtx.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

    const blockScale = BLOCK_SIZE / 1.5;
    const canvasWidthInPixels = nextPieceCanvas.width;
    const canvasHeightInPixels = nextPieceCanvas.height;
    const matrix = nextShape.matrix;

    const offsetX = (canvasWidthInPixels - matrix[0].length * blockScale) / 2;
    const offsetY = (canvasHeightInPixels - matrix.length * blockScale) / 2;

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          nextPieceCtx.fillStyle = createGradient(nextPieceCtx, x, y, value);
          nextPieceCtx.fillRect(offsetX + x * blockScale, offsetY + y * blockScale, blockScale - 1, blockScale - 1);
          nextPieceCtx.fillStyle = lightenColor(COLORS[value], 20);
          nextPieceCtx.fillRect(offsetX + x * blockScale, offsetY + y * blockScale, blockScale - 1, blockScale * 0.15);
          nextPieceCtx.fillRect(offsetX + x * blockScale, offsetY + y * blockScale, blockScale * 0.15, blockScale - 1);
          nextPieceCtx.fillStyle = darkenColor(COLORS[value], 20);
          nextPieceCtx.fillRect(offsetX + x * blockScale + blockScale * 0.85, offsetY + y * blockScale, blockScale * 0.15, blockScale - 1);
          nextPieceCtx.fillRect(offsetX + x * blockScale, offsetY + y * blockScale + blockScale * 0.85, blockScale - 1, blockScale * 0.15);
        }
      });
    });
  }

  function drawGhostPiece() {
    if (!activeShape) return;
    const ghostPiece = {
      matrix: activeShape.matrix.map(row => [...row]),
      pos: { x: activeShape.pos.x, y: activeShape.pos.y }
    };
    while (!checkCollision(ghostPiece)) {
      ghostPiece.pos.y++;
    }
    ghostPiece.pos.y--;
    ctx.globalAlpha = 0.2;
    drawMatrix(ghostPiece.matrix, ghostPiece.pos, ctx);
    ctx.globalAlpha = 1;
  }

  function mergeShape() {
    lastLandingPosition = {
      matrix: activeShape.matrix.map(row => [...row]),
      pos: { ...activeShape.pos }
    };

    activeShape.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          board[y + activeShape.pos.y][x + activeShape.pos.x] = value;
        }
      });
    });

    if (!isFullscreen) createLandingParticles();
  }

  function checkCollision(shape) {
    const matrix = shape.matrix;
    const pos = shape.pos;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          const newY = y + pos.y;
          const newX = x + pos.x;
          if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && board[newY][newX] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function rotateMatrix(matrix) {
    const n = matrix.length;
    const rotated = matrix.map(row => [...row]);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        rotated[x][n - 1 - y] = matrix[y][x];
      }
    }
    return rotated;
  }

  function moveShape(dx, dy) {
    activeShape.pos.x += dx;
    activeShape.pos.y += dy;
    if (checkCollision(activeShape)) {
      activeShape.pos.x -= dx;
      activeShape.pos.y -= dy;
      return false;
    }
    return true;
  }

  function rotateShape() {
    const oldMatrix = activeShape.matrix;
    activeShape.matrix = rotateMatrix(activeShape.matrix);
    if (checkCollision(activeShape)) {
      activeShape.matrix = oldMatrix;
    }
  }

  function dropShape() {
    if (!moveShape(0, 1)) {
      mergeShape();
      clearLines();
      spawnShape();
    }
  }

  function instantDrop() {
    while (moveShape(0, 1)) {}
    dropShape();
  }

  function clearLines() {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] === 0) {
          continue outer;
        }
      }
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(0));
      linesCleared++;
      y++;
    }
    if (linesCleared > 0) {
      lines += linesCleared;
      score += [0, 40, 100, 300, 1200][linesCleared] * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = 1000 / level;
      updateStats();
      if (!isFullscreen) createLineClearParticles(linesCleared);
    }
  }

  function createLineClearParticles(linesCleared) {
    const particleCount = linesCleared * 20;
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * canvas.width;
      const y = canvas.height - Math.random() * (linesCleared * currentBlockSize);
      const color = COLORS[Math.floor(Math.random() * (COLORS.length - 1)) + 1];
      const particle = new Particle(x, y, color);
      particles.push(particle);
    }
  }

  function spawnShape() {
    activeShape = nextShape || createShape();
    nextShape = createShape();
    drawNextPiece();
    if (checkCollision(activeShape)) {
      gameOver = true;
      updateHighScore();
      showGameOver();
    }
    lastLandingPosition = null;
  }

  function updateStats() {
    scoreElement.textContent = score;
    linesElement.textContent = lines;
    levelElement.textContent = level;
  }

  function showGameOver() {
    gameMessage.innerHTML = `
      <h2>Game Over</h2>
      <div>Score: <span id="final-score">${score}</span></div>
      <div>Best Score: <span>${highScores[username] || 0}</span></div>
      <div class="buttons">
        <button id="restart-btn">Restart</button>
      </div>
    `;
    gameMessage.classList.add("visible");
    document.getElementById("restart-btn").addEventListener("click", resetGame);
  }

  function resetGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    gameOver = false;
    paused = false;
    particles = [];
    underlayEffects = [];
    gameMessage.classList.remove("visible");
    activeShape = null;
    nextShape = null;
    updateStats();
    spawnShape();
    pauseBtn.textContent = "Pause";
    removeEffects();
    if (!isFullscreen) initializeEffects();
    lastTime = 0;
    dropCounter = 0;
    update();
  }

  function createLandingParticles() {
    if (!lastLandingPosition || isFullscreen) return;

    const { matrix, pos } = lastLandingPosition;

    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          const blockX = (x + pos.x + 0.5) * currentBlockSize;
          const blockY = (y + pos.y + 0.5) * currentBlockSize;
          const colorIndex = matrix[y][x];
          const color = COLORS[colorIndex];

          underlayEffects.push(new UnderlayEffect(blockX, blockY, color));

          const particleCount = Math.floor(Math.random() * 12) + 10;
          for (let i = 0; i < particleCount; i++) {
            const offsetX = (Math.random() - 0.5) * currentBlockSize;
            const offsetY = (Math.random() - 0.5) * currentBlockSize;
            const particle = new Particle(blockX + offsetX, blockY + offsetY, color);
            particles.push(particle);
          }
        }
      }
    }
  }

  function updateUnderlayEffects() {
    if (!underlayCtx || isFullscreen) return;
    underlayCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = underlayEffects.length - 1; i >= 0; i--) {
      underlayEffects[i].update();
      underlayEffects[i].draw();
      if (underlayEffects[i].isFinished()) {
        underlayEffects.splice(i, 1);
      }
    }
  }

  function updateParticles() {
    if (!particlesCtx || isFullscreen) return;
    particlesCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].alpha <= 0 || particles[i].size <= 0.01) {
        particles.splice(i, 1);
      }
    }
  }

  function showKey(key) {
    lastKeyPressed = key;
    keyIndicator.textContent = key;
    keyIndicator.classList.add("active");
    clearTimeout(keyTimeout);
    keyTimeout = setTimeout(() => {
      keyIndicator.classList.remove("active");
    }, 300);
  }

  function resizeCanvas() {
    if (isFullscreen) {
      const maxWidth = window.innerWidth * 0.6;
      const maxHeight = window.innerHeight * 0.9;
      const scale = Math.min(maxWidth / COLS, maxHeight / ROWS);
      currentBlockSize = scale;
      canvas.width = COLS * scale;
      canvas.height = ROWS * scale;
      removeEffects();
    } else {
      currentBlockSize = BLOCK_SIZE;
      canvas.width = COLS * BLOCK_SIZE;
      canvas.height = ROWS * BLOCK_SIZE;
      removeEffects();
      initializeEffects();
      if (underlayCanvas) {
        underlayCanvas.width = canvas.width;
        underlayCanvas.height = canvas.height;
      }
      if (particlesCanvas) {
        particlesCanvas.width = canvas.width;
        particlesCanvas.height = canvas.height;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(currentBlockSize, currentBlockSize);
  }

  function update(time = 0) {
    if (paused || gameOver) {
      if (!isFullscreen) {
        updateUnderlayEffects();
        updateParticles();
      }
      draw();
      requestAnimationFrame(update);
      return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
      dropShape();
      dropCounter = 0;
    }

    if (!isFullscreen) {
      updateUnderlayEffects();
      updateParticles();
    }
    draw();
    requestAnimationFrame(update);
  }

  document.addEventListener("keydown", (event) => {
    if (gameOver || paused) return;
    switch (event.key) {
      case "ArrowLeft":
        moveShape(-1, 0);
        showKey("←");
        break;
      case "ArrowRight":
        moveShape(1, 0);
        showKey("→");
        break;
      case "ArrowDown":
        dropShape();
        showKey("↓");
        break;
      case "ArrowUp":
        rotateShape();
        showKey("↑");
        break;
      case "r":
      case "R":
        instantDrop();
        showKey("R");
        break;
      case "p":
      case "P":
        togglePause();
        showKey("P");
        break;
      case "f":
      case "F":
        toggleFullscreen();
        showKey("F");
        break;
    }
    if (!paused) draw();
  });

  pauseBtn.addEventListener("click", togglePause);
  newGameBtn.addEventListener("click", resetGame);

  fullscreenBtn.addEventListener("click", toggleFullscreen);

  mobileLeft.addEventListener("click", () => {
    if (!gameOver && !paused) {
      moveShape(-1, 0);
      showKey("←");
      draw();
    }
  });
  mobileRight.addEventListener("click", () => {
    if (!gameOver && !paused) {
      moveShape(1, 0);
      showKey("→");
      draw();
    }
  });
  mobileRotate.addEventListener("click", () => {
    if (!gameOver && !paused) {
      rotateShape();
      showKey("↑");
      draw();
    }
  });
  mobileDown.addEventListener("click", () => {
    if (!gameOver && !paused) {
      dropShape();
      showKey("↓");
      draw();
    }
  });
  mobileDrop.addEventListener("click", () => {
    if (!gameOver && !paused) {
      instantDrop();
      showKey("⤓");
      draw();
    }
  });

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "Continue" : "Pause";
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    document.body.classList.toggle("fullscreen", isFullscreen);
    resizeCanvas();
    draw();
    drawNextPiece();
    fullscreenBtn.textContent = isFullscreen ? "⛶" : "⛶";
  }

  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    username = usernameInput.value.trim();
    if (username) {
      authOverlay.style.display = "none";
      resetGame();
    } else {
      alert("Пожалуйста, введите имя!");
    }
  });

  authOverlay.style.display = "flex";
  resizeCanvas();
});