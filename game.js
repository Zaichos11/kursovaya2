// Shadow Slayer - Roguelike Survival Game

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (game.isRunning && game.entities.player) {
    game.entities.player.x = Math.min(
      Math.max(game.entities.player.x, 16),
      canvas.width - 16
    );
    game.entities.player.y = Math.min(
      Math.max(game.entities.player.y, 16),
      canvas.height - 16
    );
  }
});

const game = {
  isRunning: false,
  isPaused: false,
  score: 0,
  time: 0,
  crystals: 0,
  wave: 1,
  waveTimer: 0,
  waveDuration: 30 * 60,
  breakDuration: 5 * 60,
  isBreak: false,
  entities: {
    player: null,
    enemies: [],
    projectiles: [],
    particles: [],
    pickups: [],
    obstacles: [],
  },
  lastTimestamp: 0,
  upgradeScreen: {
    isActive: false,
    options: [],
  },
};

const assets = {
  images: {},
  sounds: {},
  loaded: 0,
  required: 0,

  loadImage: function (name, src) {
    this.required++;
    this.images[name] = new Image();
    this.images[name].src = src;
    this.images[name].onload = () => {
      this.loaded++;
      if (this.loaded === this.required) {
        initGame();
      }
    };
  },

  loadSound: function (name, src) {
    this.required++;
    this.sounds[name] = new Audio();
    this.sounds[name].src = src;
    this.sounds[name].oncanplaythrough = () => {
      this.loaded++;
      if (this.loaded === this.required) {
        initGame();
      }
    };
  },
};

const input = {
  keys: {},
  mouse: { x: 0, y: 0, isDown: false },

  init: function () {
    window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mousedown", () => (this.mouse.isDown = true));
    canvas.addEventListener("mouseup", () => (this.mouse.isDown = false));
  },

  isKeyDown: function (code) {
    return !!this.keys[code];
  },
};

// Player class
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 32;
    this.speed = 3;
    this.health = 100;
    this.maxHealth = 100;
    this.weapon = "staff";
    this.attackSpeed = 60;
    this.attackTimer = 0;
    this.attackRange = 200;
    this.damage = 20;
    this.direction = "down";
    this.regen = 0;
    this.critChance = 0;
    this.frameX = 0;
    this.frameY = 0;
    this.maxFrames = 4;
    this.animationSpeed = 10;
    this.animationTimer = 0;
    this.isMoving = false;
  }

  update() {
    this.isMoving = false;
    let dx = 0;
    let dy = 0;

    if (input.isKeyDown("KeyW") || input.isKeyDown("ArrowUp")) {
      dy -= this.speed;
      this.direction = "up";
      this.isMoving = true;
    }
    if (input.isKeyDown("KeyS") || input.isKeyDown("ArrowDown")) {
      dy += this.speed;
      this.direction = "down";
      this.isMoving = true;
    }
    if (input.isKeyDown("KeyA") || input.isKeyDown("ArrowLeft")) {
      dx -= this.speed;
      this.direction = "left";
      this.isMoving = true;
    }
    if (input.isKeyDown("KeyD") || input.isKeyDown("ArrowRight")) {
      dx += this.speed;
      this.direction = "right";
      this.isMoving = true;
    }

    if (dx !== 0 && dy !== 0) {
      const factor = 1 / Math.sqrt(2);
      dx *= factor;
      dy *= factor;
    }

    const newX = Math.max(
      this.width / 2,
      Math.min(canvas.width - this.width / 2, this.x + dx)
    );
    const newY = Math.max(
      this.height / 2,
      Math.min(canvas.height - this.height / 2, this.y + dy)
    );

    let canMoveX = true;
    let canMoveY = true;

    for (const obstacle of game.entities.obstacles) {
      if (this.checkCollision(obstacle, newX, this.y)) {
        canMoveX = false;
        if (dx > 0) this.x = obstacle.x - obstacle.width / 2 - this.width / 2;
        else if (dx < 0)
          this.x = obstacle.x + obstacle.width / 2 + this.width / 2;
      }
      if (this.checkCollision(obstacle, this.x, newY)) {
        canMoveY = false;
        if (dy > 0) this.y = obstacle.y - obstacle.height / 2 - this.height / 2;
        else if (dy < 0)
          this.y = obstacle.y + obstacle.height / 2 + this.height / 2;
      }
    }

    if (canMoveX) this.x = newX;
    if (canMoveY) this.y = newY;

    if (this.isMoving) {
      this.animationTimer++;
      if (this.animationTimer >= this.animationSpeed) {
        this.frameX = (this.frameX + 1) % this.maxFrames;
        this.animationTimer = 0;
      }
    } else {
      this.frameX = 0;
    }

    switch (this.direction) {
      case "down":
        this.frameY = 0;
        break;
      case "left":
        this.frameY = 1;
        break;
      case "right":
        this.frameY = 2;
        break;
      case "up":
        this.frameY = 3;
        break;
    }

    if (this.regen > 0 && game.time % 60 === 0) {
      // Regen 1 HP per second (60 frames)
      this.health = Math.min(this.maxHealth, this.health + this.regen);
    }

    this.attackTimer++;
    if (this.attackTimer >= this.attackSpeed) {
      this.attack();
      this.attackTimer = 0;
    }
  }

  checkCollision(obstacle, newX, newY) {
    return (
      newX - this.width / 2 < obstacle.x + obstacle.width / 2 &&
      newX + this.width / 2 > obstacle.x - obstacle.width / 2 &&
      newY - this.height / 2 < obstacle.y + obstacle.height / 2 &&
      newY + this.height / 2 > obstacle.y - obstacle.height / 2
    );
  }

  attack() {
    let target = this.findTarget();
    if (!target) return;

    const crit = Math.random() < this.critChance;
    const finalDamage = crit ? this.damage * 2 : this.damage;

    switch (this.weapon) {
      case "sword":
        createCircularAttack(this.x, this.y, finalDamage, 90); // Increase duration to 90 frames (50% slower)
        break;
      case "staff":
        createProjectile(
          this.x,
          this.y,
          target.x,
          target.y,
          "magic",
          finalDamage
        );
        break;
      case "crossbow":
        createProjectile(
          this.x,
          this.y,
          target.x,
          target.y,
          "arrow",
          finalDamage
        );
        break;
      case "axe":
        createCircularAttack(
          this.x,
          this.y,
          finalDamage * 1.5,
          90,
          Math.PI / 2
        );
        break;
      case "wand":
        for (let i = -1; i <= 1; i++) {
          createProjectile(
            this.x,
            this.y,
            target.x + i * 20,
            target.y,
            "magic",
            finalDamage * 0.7
          );
        }
        break;
    }
  }

  findTarget() {
    let closestEnemy = null;
    let closestDistance = Infinity;

    for (const enemy of game.entities.enemies) {
      const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (distance < closestDistance && distance <= this.attackRange) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    }

    return closestEnemy;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    const gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      5,
      this.x,
      this.y,
      this.width / 2
    );
    gradient.addColorStop(0, "#3498db");
    gradient.addColorStop(1, "#1f618d");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add a slight glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#3498db";
    ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2 + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    createParticles(this.x, this.y, "blood", 5);
    if (this.health <= 0) {
      gameOver();
    }
  }
}

// Enemy class
class Enemy {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 32;
    this.health = 0;
    this.damage = 0;
    this.speed = 0;
    this.scoreValue = 0;
    this.crystalValue = 0;
    this.hasHitPlayer = false;
    this.frameX = 0;
    this.frameY = 0;
    this.maxFrames = 4;
    this.animationSpeed = 10;
    this.animationTimer = 0;
    this.behaviorTimer = 0;
    this.behaviorCooldown = 0;
    this.init();
  }

  init() {
    switch (this.type) {
      case "skeleton":
        this.health = 40;
        this.damage = 10;
        this.speed = 1;
        this.scoreValue = 5;
        this.crystalValue = 1;
        break;
      case "bat":
        this.health = 20;
        this.damage = 5;
        this.speed = 2;
        this.scoreValue = 10;
        this.crystalValue = 2;
        this.behaviorCooldown = 120;
        break;
      case "ghost":
        this.health = 30;
        this.damage = 15;
        this.speed = 0.8;
        this.scoreValue = 15;
        this.crystalValue = 3;
        break;
    }
  }

  update() {
    const player = game.entities.player;

    switch (this.type) {
      case "skeleton":
        this.moveTowardsPlayer();
        break;
      case "bat":
        this.behaviorTimer++;
        if (this.behaviorTimer >= this.behaviorCooldown) {
          this.speed = 6;
          this.behaviorTimer = 0;
        } else if (this.behaviorTimer >= 20) {
          this.speed = 1;
        }
        this.moveTowardsPlayer();
        break;
      case "ghost":
        this.moveTowardsPlayer();
        break;
    }

    this.animationTimer++;
    if (this.animationTimer >= this.animationSpeed) {
      this.frameX = (this.frameX + 1) % this.maxFrames;
      this.animationTimer = 0;
    }

    if (this.checkCollision(player) && !this.hasHitPlayer) {
      player.takeDamage(this.damage);
      createParticles(player.x, player.y, "hit", 10);
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      player.x += Math.cos(angle) * 10;
      player.y += Math.sin(angle) * 10;
      this.hasHitPlayer = true;
      setTimeout(() => (this.hasHitPlayer = false), 500);
    }
  }

  moveTowardsPlayer() {
    const player = game.entities.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angle = Math.atan2(dy, dx);
    const speedX = Math.cos(angle) * this.speed;
    const speedY = Math.sin(angle) * this.speed;

    let newX = this.x + speedX;
    let newY = this.y + speedY;

    if (this.type !== "ghost") {
      for (const obstacle of game.entities.obstacles) {
        if (this.checkCollision(obstacle, newX, this.y)) {
          newX = this.x;
        }
        if (this.checkCollision(obstacle, this.x, newY)) {
          newY = this.y;
        }
        if (this.checkCollision(obstacle, newX, newY)) {
          const offsetAngle = Math.random() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
          newX = this.x + Math.cos(angle + offsetAngle) * this.speed;
          newY = this.y + Math.sin(angle + offsetAngle) * this.speed;
        }
      }
    }

    this.x = newX;
    this.y = newY;
  }

  checkCollision(entity, newX = this.x, newY = this.y) {
    return (
      newX - this.width / 2 < entity.x + entity.width / 2 &&
      newX + this.width / 2 > entity.x - entity.width / 2 &&
      newY - this.height / 2 < entity.y + entity.height / 2 &&
      newY + this.height / 2 > entity.y - entity.height / 2
    );
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    createParticles(this.x, this.y, "hit", 5);
    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    game.score += this.scoreValue;
    createParticles(this.x, this.y, "death", 10);
    if (Math.random() < 0.90) { // Reduced from 0.8 to 0.2 (20% chance)
      createCrystal(this.x, this.y, this.crystalValue);
    }
    if (Math.random() < 0.1) { // Reduced from 0.3 to 0.05 (5% chance)
      createPickup(this.x, this.y, "health");
    }
    const index = game.entities.enemies.indexOf(this);
    if (index !== -1) {
      game.entities.enemies.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    let gradient;
    switch (this.type) {
      case "skeleton":
        gradient = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, this.width / 2);
        gradient.addColorStop(0, "#f1c40f");
        gradient.addColorStop(1, "#d4ac0d");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case "bat":
        gradient = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, this.width / 2);
        gradient.addColorStop(0, "#9b59b6");
        gradient.addColorStop(1, "#7d3c98");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "ghost":
        gradient = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, this.width / 2);
        gradient.addColorStop(0, "rgba(41, 128, 185, 0.8)");
        gradient.addColorStop(1, "rgba(41, 128, 185, 0.4)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    // Fixed glow effect
    ctx.shadowBlur = 20;
    switch (this.type) {
      case "skeleton": ctx.shadowColor = "#f1c40f"; break;
      case "bat": ctx.shadowColor = "#9b59b6"; break;
      case "ghost": ctx.shadowColor = "rgba(41, 128, 185, 0.8)"; break;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2 + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  
    const healthWidth = 30;
    const healthHeight = 4;
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(
      this.x - healthWidth / 2,
      this.y - this.height / 2 - 10,
      healthWidth * (this.health / this.getMaxHealth()),
      healthHeight
    );
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(
      this.x - healthWidth / 2,
      this.y - this.height / 2 - 10,
      healthWidth,
      healthHeight
    );
  }

  getMaxHealth() {
    switch (this.type) {
      case "skeleton":
        return 40;
      case "bat":
        return 20;
      case "ghost":
        return 30;
      default:
        return 100;
    }
  }
}

// Projectile class
class Projectile {
  constructor(x, y, targetX, targetY, type, damage) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.type = type;
    this.damage = damage;
    this.speed = type === "arrow" ? 10 : 6;
    const angle = Math.atan2(targetY - y, targetX - x);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.angle = angle;
    this.range = type === "arrow" ? 300 : 250;
    this.distanceTraveled = 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.distanceTraveled += this.speed;

    if (
      this.distanceTraveled >= this.range ||
      this.x < 0 ||
      this.x > canvas.width ||
      this.y < 0 ||
      this.y > canvas.height
    ) {
      this.remove();
      return;
    }

    for (const enemy of game.entities.enemies) {
      if (this.checkCollision(enemy)) {
        enemy.takeDamage(this.damage);
        createParticles(
          this.x,
          this.y,
          this.type === "magic" ? "magic" : "hit",
          5
        );
        this.remove();
        return;
      }
    }

    if (this.type !== "magic") {
      for (const obstacle of game.entities.obstacles) {
        if (this.checkCollision(obstacle)) {
          createParticles(this.x, this.y, "impact", 3);
          this.remove();
          return;
        }
      }
    }
  }

  checkCollision(entity) {
    return (
      this.x - this.width / 2 < entity.x + entity.width / 2 &&
      this.x + this.width / 2 > entity.x - entity.width / 2 &&
      this.y - this.height / 2 < entity.y + entity.height / 2 &&
      this.y + this.height / 2 > entity.y - entity.height / 2
    );
  }

  remove() {
    const index = game.entities.projectiles.indexOf(this);
    if (index !== -1) {
      game.entities.projectiles.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === "magic") {
      ctx.fillStyle = "#3498db";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#3498db";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(52, 152, 219, 0.5)";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#996633";
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = "#7f7f7f";
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.fill();
    }

    ctx.restore();
  }
}

// CircularAttack class
class CircularAttack {
  constructor(x, y, damage, duration, angleRange = Math.PI * 2) {
    this.x = x;
    this.y = y;
    this.radius = 50;
    this.damage = damage;
    this.duration = duration;
    this.angleRange = angleRange;
    this.timer = 0;
    this.hitEnemies = new Set();
  }

  update() {
    this.timer++;

    for (const enemy of game.entities.enemies) {
      if (!this.hitEnemies.has(enemy) && this.checkCollision(enemy)) {
        enemy.takeDamage(this.damage);
        createParticles(enemy.x, enemy.y, "hit", 3);
        this.hitEnemies.add(enemy);
      }
    }

    if (this.timer >= this.duration) {
      this.remove();
    }
  }

  checkCollision(entity) {
    const distance = Math.hypot(entity.x - this.x, entity.y - this.y);
    const angleToEntity = Math.atan2(entity.y - this.y, entity.x - this.x);
    const playerAngle = Math.atan2(
      game.entities.player.y - this.y,
      game.entities.player.x - this.x
    );
    const angleDiff = Math.abs(angleToEntity - playerAngle);
    return (
      distance < this.radius + entity.width / 2 &&
      angleDiff < this.angleRange / 2
    );
  }

  remove() {
    const index = game.entities.projectiles.indexOf(this);
    if (index !== -1) {
      game.entities.projectiles.splice(index, 1);
    }
  }

  draw() {
    const alpha = 1 - this.timer / this.duration;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(
      this.x,
      this.y,
      this.radius,
      -this.angleRange / 2,
      this.angleRange / 2
    );
    ctx.lineTo(this.x, this.y);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      this.x,
      this.y,
      this.radius,
      -this.angleRange / 2,
      this.angleRange / 2
    );
    ctx.stroke();
    ctx.restore();
  }
}

// Crystal class
class Crystal {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.value = value;
    this.angle = 0;
    this.scale = 1;
    this.pulseDirection = 0.02;
  }

  update() {
    this.angle += 0.05;
    this.y += Math.sin(this.angle) * 0.3;
    this.scale += this.pulseDirection;
    if (this.scale > 1.2 || this.scale < 0.8) {
      this.pulseDirection *= -1;
    }

    const player = game.entities.player;
    if (this.checkCollision(player)) {
      this.collect();
    }
  }

  checkCollision(entity) {
    return (
      this.x - this.width / 2 < entity.x + entity.width / 2 &&
      this.x + this.width / 2 > entity.x - entity.width / 2 &&
      this.y - this.height / 2 < entity.y + entity.height / 2 &&
      this.y + this.height / 2 > entity.y - entity.height / 2
    );
  }

  collect() {
    game.crystals += this.value;
    if (game.crystals >= 10) {
      game.crystals -= 10;
      showUpgradeScreen();
    }
    createParticles(this.x, this.y, "crystal", 5);
    const index = game.entities.pickups.indexOf(this);
    if (index !== -1) {
      game.entities.pickups.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    ctx.fillStyle = "#9b59b6";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "#9b59b6";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "rgba(155, 89, 182, 0.5)";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Pickup class (new loot)
class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.type = type; // "health", "damage"
    this.angle = 0;
    this.scale = 1;
    this.pulseDirection = 0.02;
  }

  update() {
    this.angle += 0.05;
    this.y += Math.sin(this.angle) * 0.3;
    this.scale += this.pulseDirection;
    if (this.scale > 1.2 || this.scale < 0.8) {
      this.pulseDirection *= -1;
    }

    const player = game.entities.player;
    if (this.checkCollision(player)) {
      this.collect();
    }
  }

  checkCollision(entity) {
    return (
      this.x - this.width / 2 < entity.x + entity.width / 2 &&
      this.x + this.width / 2 > entity.x - entity.width / 2 &&
      this.y - this.height / 2 < entity.y + entity.height / 2 &&
      this.y + this.height / 2 > entity.y - entity.height / 2
    );
  }

  collect() {
    const player = game.entities.player;
    switch (this.type) {
      case "health":
        player.health = Math.min(player.maxHealth, player.health + 20);
        createParticles(this.x, this.y, "heal", 5);
        break;
      case "damage":
        player.damage *= 1.1; // 10% damage boost
        createParticles(this.x, this.y, "power", 5);
        break;
    }
    const index = game.entities.pickups.indexOf(this);
    if (index !== -1) {
      game.entities.pickups.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    switch (this.type) {
      case "health":
        ctx.fillStyle = "#2ecc71";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "#2ecc71";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "rgba(46, 204, 113, 0.5)";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "damage":
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-6, 4);
        ctx.lineTo(6, 4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "rgba(231, 76, 60, 0.5)";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

// Particle system
class Particle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = Math.random() * 5 + 3;
    this.lifespan = 30;
    this.alpha = 1;
    const speed = Math.random() * 3 + 1;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.lifespan--;
    this.alpha = this.lifespan / 30;
    this.size *= 0.95;
    if (this.lifespan <= 0) {
      this.remove();
    }
  }

  remove() {
    const index = game.entities.particles.indexOf(this);
    if (index !== -1) {
      game.entities.particles.splice(index, 1);
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    switch (this.type) {
      case "blood":
        ctx.fillStyle = "#c0392b";
        break;
      case "hit":
        ctx.fillStyle = "#e67e22";
        break;
      case "death":
        ctx.fillStyle = "#7f8c8d";
        break;
      case "magic":
        ctx.fillStyle = "#3498db";
        ctx.shadowColor = "#3498db";
        ctx.shadowBlur = 5;
        break;
      case "crystal":
        ctx.fillStyle = "#9b59b6";
        ctx.shadowColor = "#9b59b6";
        ctx.shadowBlur = 5;
        break;
      case "impact":
        ctx.fillStyle = "#95a5a6";
        break;
      case "heal":
        ctx.fillStyle = "#2ecc71";
        ctx.shadowColor = "#2ecc71";
        ctx.shadowBlur = 5;
        break;
      case "power":
        ctx.fillStyle = "#e74c3c";
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 5;
        break;
      default:
        ctx.fillStyle = "#fff";
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Obstacle class
class Obstacle {
  constructor(x, y, width, height, type) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    switch (this.type) {
      case "rock":
        const rockGradient = ctx.createRadialGradient(
          this.x,
          this.y,
          this.width / 4,
          this.x,
          this.y,
          this.width / 2
        );
        rockGradient.addColorStop(0, "#95a5a6");
        rockGradient.addColorStop(1, "#7f8c8d");
        ctx.fillStyle = rockGradient;
        ctx.beginPath();
        ctx.moveTo(this.x - this.width / 2, this.y);
        ctx.lineTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case "tree":
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(this.x - 8, this.y, 16, 32);
        const foliageGradient = ctx.createRadialGradient(
          this.x,
          this.y - 20,
          10,
          this.x,
          this.y - 20,
          24
        );
        foliageGradient.addColorStop(0, "#27ae60");
        foliageGradient.addColorStop(1, "#2ecc71");
        ctx.fillStyle = foliageGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 20, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "#27ae60";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "rgba(46, 204, 113, 0.3)";
        ctx.beginPath();
        ctx.arc(this.x, this.y - 20, 28, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }
}

// Helper functions
function createProjectile(x, y, targetX, targetY, type, damage) {
  const projectile = new Projectile(x, y, targetX, targetY, type, damage);
  game.entities.projectiles.push(projectile);
  return projectile;
}

function createCircularAttack(x, y, damage, duration, angleRange) {
  const attack = new CircularAttack(x, y, damage, duration, angleRange);
  game.entities.projectiles.push(attack);
  return attack;
}

function createCrystal(x, y, value) {
  const crystal = new Crystal(x, y, value);
  game.entities.pickups.push(crystal);
  return crystal;
}

function createPickup(x, y, type) {
  const pickup = new Pickup(x, y, type);
  game.entities.pickups.push(pickup);
  return pickup;
}

function createParticles(x, y, type, count) {
  for (let i = 0; i < count; i++) {
    const particle = new Particle(x, y, type);
    game.entities.particles.push(particle);
  }
}

function spawnEnemy(type, x, y) {
  if (!x || !y) {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        x = Math.random() * canvas.width;
        y = -50;
        break;
      case 1:
        x = canvas.width + 50;
        y = Math.random() * canvas.height;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 50;
        break;
      case 3:
        x = -50;
        y = Math.random() * canvas.height;
        break;
    }
  }
  const enemy = new Enemy(type, x, y);
  game.entities.enemies.push(enemy);
  return enemy;
}

function startWave() {
  game.waveTimer = 0;
  game.isBreak = false;

  const baseEnemies = Math.floor((canvas.width * canvas.height) / 10000);
  const enemiesPerWave = Math.floor(baseEnemies + game.wave * 1.5);

  let types = [];
  if (game.wave < 3) {
    for (let i = 0; i < enemiesPerWave; i++) types.push("skeleton");
  } else if (game.wave < 6) {
    for (let i = 0; i < Math.floor(enemiesPerWave * 0.7); i++)
      types.push("skeleton");
    for (let i = 0; i < Math.floor(enemiesPerWave * 0.3); i++)
      types.push("bat");
  } else {
    for (let i = 0; i < Math.floor(enemiesPerWave * 0.5); i++)
      types.push("skeleton");
    for (let i = 0; i < Math.floor(enemiesPerWave * 0.3); i++)
      types.push("bat");
    for (let i = 0; i < Math.floor(enemiesPerWave * 0.2); i++)
      types.push("ghost");
  }

  types.sort(() => Math.random() - 0.5);

  const spawnInterval = setInterval(() => {
    if (types.length > 0 && !game.isPaused && game.isRunning) {
      spawnEnemy(types.pop());
    } else {
      clearInterval(spawnInterval);
    }
  }, 500);
}

function startBreak() {
  game.isBreak = true;
  game.waveTimer = 0;
}

function showUpgradeScreen() {
  game.isPaused = true;
  game.upgradeScreen.isActive = true;
  game.upgradeScreen.options = generateUpgradeOptions();
  drawUpgradeScreen();
}

function generateUpgradeOptions() {
  const options = [
    {
      type: "weapon",
      name: "Sword",
      description: "Melee circular attacks",
      apply: () => {
        game.entities.player.weapon = "sword";
        game.entities.player.attackSpeed = 90; // Ensure sword speed is set
      },
    },
    {
      type: "weapon",
      name: "Staff",
      description: "Magic projectiles",
      apply: () => {
        game.entities.player.weapon = "staff";
        game.entities.player.attackSpeed = 60;
      },
    },
    {
      type: "weapon",
      name: "Crossbow",
      description: "Fast arrows",
      apply: () => {
        game.entities.player.weapon = "crossbow";
        game.entities.player.attackSpeed = 60;
      },
    },
    {
      type: "weapon",
      name: "Axe",
      description: "Powerful wide swing",
      apply: () => {
        game.entities.player.weapon = "axe";
        game.entities.player.attackSpeed = 60;
      },
    },
    {
      type: "weapon",
      name: "Wand",
      description: "Triple magic shots",
      apply: () => {
        game.entities.player.weapon = "wand";
        game.entities.player.attackSpeed = 60;
      },
    },
  ];

  return options.sort(() => Math.random() - 0.5).slice(0, 3);
}function applyUpgrade(index) {
  const upgrade = game.upgradeScreen.options[index];
  if (upgrade) {
    upgrade.apply();
    game.upgradeScreen.isActive = false;
    game.isPaused = false;
  }
}

function drawUpgradeScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Choose an Upgrade", canvas.width / 2, 100);

  const options = game.upgradeScreen.options;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const x = canvas.width / 2;
    const y = 180 + i * 120;
    const width = 300;
    const height = 100;

    ctx.fillStyle = "#34495e";
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    ctx.strokeStyle =
      option.type === "weapon"
        ? "#e74c3c"
        : option.type === "stat"
        ? "#3498db"
        : "#2ecc71";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.fillText(option.name, x, y - 10);
    ctx.font = "14px Arial";
    ctx.fillText(option.description, x, y + 20);

    canvas.addEventListener("click", function handleClick(event) {
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      for (let j = 0; j < options.length; j++) {
        const optY = 180 + j * 120;
        if (
          clickX > x - width / 2 &&
          clickX < x + width / 2 &&
          clickY > optY - height / 2 &&
          clickY < optY + height / 2
        ) {
          canvas.removeEventListener("click", handleClick);
          applyUpgrade(j);
        }
      }
    });
  }
}

function gameOver() {
  game.isRunning = false;

  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 50);
  ctx.font = "24px Arial";
  ctx.fillText(
    `Score: ${game.score}`,
    canvas.width / 2,
    canvas.height / 2 + 10
  );
  ctx.fillText(
    `Survived: ${Math.floor(game.time / 60)} seconds`,
    canvas.width / 2,
    canvas.height / 2 + 50
  );
  ctx.fillText(
    `Waves completed: ${game.wave - 1}`,
    canvas.width / 2,
    canvas.height / 2 + 90
  );

  const buttonWidth = 200;
  const buttonHeight = 50;
  const buttonX = canvas.width / 2 - buttonWidth / 2;
  const buttonY = canvas.height / 2 + 150;

  ctx.fillStyle = "#27ae60";
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Arial";
  ctx.fillText("Play Again", canvas.width / 2, buttonY + buttonHeight / 2 + 7);

  canvas.addEventListener("click", function handleRestart(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    if (
      clickX > buttonX &&
      clickX < buttonX + buttonWidth &&
      clickY > buttonY &&
      clickY < buttonY + buttonHeight
    ) {
      canvas.removeEventListener("click", handleRestart);
      initGame();
    }
  });
}

function drawUI() {
  const gradient = ctx.createLinearGradient(0, 0, 0, 100);
  gradient.addColorStop(0, "rgba(44, 62, 80, 0.9)");
  gradient.addColorStop(1, "rgba(44, 62, 80, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, 100);

  ctx.shadowBlur = 5;
  ctx.shadowColor = "#000000";
  ctx.fillStyle = "#ecf0f1";
  ctx.font = "18px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${game.score}`, 20, 30);
  ctx.shadowBlur = 0;

  ctx.shadowBlur = 10;
  ctx.shadowColor = "#9b59b6";
  ctx.fillStyle = "#9b59b6";
  ctx.fillText(`Crystals: ${game.crystals}/10`, 20, 60);
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  if (game.isBreak) {
    const timeLeft = Math.ceil((game.breakDuration - game.waveTimer) / 60);
    ctx.fillStyle = "#2ecc71";
    ctx.fillText(`Next Wave in ${timeLeft}s`, canvas.width / 2, 30);
  } else {
    ctx.fillStyle = "#e74c3c";
    ctx.fillText(`Wave ${game.wave}`, canvas.width / 2, 30);
  }

  const minutes = Math.floor(game.time / (60 * 60));
  const seconds = Math.floor((game.time / 60) % 60);
  const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Time: ${timeStr}`, canvas.width - 20, 30);

  const player = game.entities.player;
  const healthWidth = 200;
  const healthHeight = 20;
  const healthX = canvas.width - 20 - healthWidth;
  const healthY = 50;

  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(healthX, healthY, healthWidth, healthHeight);

  const healthPercent = player.health / player.maxHealth;
  const healthGradient = ctx.createLinearGradient(
    healthX,
    healthY,
    healthX + healthWidth,
    healthY
  );
  healthGradient.addColorStop(
    0,
    healthPercent > 0.5
      ? "#2ecc71"
      : healthPercent > 0.25
      ? "#f39c12"
      : "#e74c3c"
  );
  healthGradient.addColorStop(1, "#2c3e50");
  ctx.fillStyle = healthGradient;
  ctx.fillRect(healthX, healthY, healthWidth * healthPercent, healthHeight);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(healthX, healthY, healthWidth, healthHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `${Math.ceil(player.health)} / ${player.maxHealth}`,
    healthX + healthWidth / 2,
    healthY + healthHeight / 2 + 5
  );
}

function createObstacles() {
  const minDistance = 32; // Minimum distance between obstacles (player size)
  const maxObstacles = Math.floor((canvas.width * canvas.height) / 50000); // Total obstacles scaled by map size

  function isValidPosition(x, y, width, height, obstacles) {
    for (const obstacle of obstacles) {
      const distX = Math.abs(x - obstacle.x);
      const distY = Math.abs(y - obstacle.y);
      const minDist = Math.max(width, height, obstacle.width, obstacle.height) + minDistance;
      if (distX < minDist && distY < minDist) return false;
    }
    return true;
  }

  const obstacles = [];
  for (let i = 0; i < maxObstacles; i++) {
    let x = Math.random() * (canvas.width - 100) + 50;
    let y = Math.random() * (canvas.height - 100) + 50;
    const isRock = Math.random() < 0.5; // 50% chance for rock, 50% for tree
    const width = isRock ? Math.random() * 20 + 30 : 40;
    const height = isRock ? width : 60;
    const type = isRock ? "rock" : "tree";

    if (isValidPosition(x, y, width, height, obstacles)) {
      obstacles.push(new Obstacle(x, y, width, height, type));
    }
  }

  game.entities.obstacles = obstacles; // Assign the generated obstacles
}

function update(timestamp) {
  const deltaTime = timestamp - game.lastTimestamp;
  game.lastTimestamp = timestamp;

  if (!game.isRunning) return;

  if (game.isPaused) {
    if (game.upgradeScreen.isActive) drawUpgradeScreen();
    requestAnimationFrame(update);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  game.time++;
  game.waveTimer++;

  if (game.isBreak) {
    if (game.waveTimer >= game.breakDuration) {
      game.wave++;
      startWave();
    }
  } else if (
    game.waveTimer >= game.waveDuration &&
    game.entities.enemies.length === 0
  ) {
    startBreak();
  }

  if (game.entities.player) game.entities.player.update();
  game.entities.enemies.forEach((enemy) => enemy.update());
  game.entities.projectiles.forEach((projectile) => projectile.update());
  game.entities.particles.forEach((particle) => particle.update());
  game.entities.pickups.forEach((pickup) => pickup.update());

  game.entities.obstacles.forEach((obstacle) => obstacle.draw());
  if (game.entities.player) game.entities.player.draw();
  game.entities.enemies.forEach((enemy) => enemy.draw());
  game.entities.projectiles.forEach((projectile) => projectile.draw());
  game.entities.particles.forEach((particle) => particle.draw());
  game.entities.pickups.forEach((pickup) => pickup.draw());

  drawUI();

  requestAnimationFrame(update);
}

function initGame() {
  game.isRunning = true;
  game.isPaused = false;
  game.score = 0;
  game.time = 0;
  game.crystals = 0;
  game.wave = 1;
  game.waveTimer = 0;
  game.isBreak = false;
  game.lastTimestamp = 0;
  game.upgradeScreen.isActive = false;
  game.upgradeScreen.options = [];

  game.entities.enemies = [];
  game.entities.projectiles = [];
  game.entities.particles = [];
  game.entities.pickups = [];
  game.entities.obstacles = [];

  game.entities.player = new Player(canvas.width / 2, canvas.height / 2);
  createObstacles();
  startWave();

  requestAnimationFrame(update);
}

input.init();
initGame();

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && game.isRunning && !game.upgradeScreen.isActive) {
    game.isPaused = !game.isPaused;
    if (game.isPaused) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "36px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
      ctx.font = "18px Arial";
      ctx.fillText(
        "Press ESC to continue",
        canvas.width / 2,
        canvas.height / 2 + 40
      );
    }
  }
});

console.log("Shadow Slayer initialized.");
