import { WORLD_SIZE, state, loadTextures, GAME_SETTINGS, ENTITY_DATA, TILE_SIZE, images } from './config.js';
import { Player, GameObject, Greed } from './entities.js';
import { drawUI, handleUIClick } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); 

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

state.player = new Player(WORLD_SIZE / 2, WORLD_SIZE / 2);

window.addEventListener('keydown', e => state.keys[e.code] = true);
window.addEventListener('keyup', e => state.keys[e.code] = false);
window.addEventListener('mousemove', e => { state.mouse.x = e.clientX; state.mouse.y = e.clientY; });

window.addEventListener('mousedown', e => {
    if (e.button === 0) {
        const uiClicked = handleUIClick(e.clientX, e.clientY);
        if (!uiClicked && state.player) state.player.attack();
    }
});

function generateWorld() {
    const keys = Object.keys(ENTITY_DATA);
    for (let i = 0; i < 700; i++) {
        const x = Math.random() * WORLD_SIZE; const y = Math.random() * WORLD_SIZE;
        const dx = x - state.player.x;
        const dy = y - state.player.y;
        if (dx * dx + dy * dy < 160000) continue; 
        let totalWeight = keys.reduce((sum, key) => sum + ENTITY_DATA[key].weight, 0);
        let rand = Math.random() * totalWeight; let selectedId = keys[0];
        for (let key of keys) { if (rand < ENTITY_DATA[key].weight) { selectedId = key; break; } rand -= ENTITY_DATA[key].weight; }
        state.objects.push(new GameObject(x, y, selectedId));
    }
}

const renderList = []; 
const sortEntities = (a, b) => a.y - b.y; 

let lastTime = performance.now();
let fps = 0;
let frameTime = 0;
let fpsUpdateTimer = 0;
const fpsBuffer = [];

let accumulator = 0;
const TICK_TIME = 1000 / 60; 

function drawOptimizedSlimeTrail(ctx, greed) {
    if (greed.trailLength < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    ctx.strokeStyle = 'rgba(100, 0, 150, 0.6)';
    ctx.beginPath();
    let ptr = (greed.trailPtr - greed.trailLength * 2 + 100) % 100;
    ctx.moveTo(greed.trail[ptr], greed.trail[ptr + 1]);
    
    for (let i = 1; i < greed.trailLength; i++) {
        ptr = (ptr + 2) % 100;
        ctx.lineWidth = (i / greed.trailLength) * 22;
        ctx.lineTo(greed.trail[ptr], greed.trail[ptr + 1]);
    }
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(139, 0, 139, 0.3)';
    ctx.beginPath();
    ptr = (greed.trailPtr - greed.trailLength * 2 + 100) % 100;
    ctx.moveTo(greed.trail[ptr], greed.trail[ptr + 1]);
    
    for (let i = 1; i < greed.trailLength; i++) {
        ptr = (ptr + 2) % 100;
        ctx.lineWidth = (i / greed.trailLength) * 30;
        ctx.lineTo(greed.trail[ptr], greed.trail[ptr + 1]);
    }
    ctx.stroke();
    ctx.restore();
}

function loop() {
    const now = performance.now();
    frameTime = now - lastTime;
    lastTime = now;

    fpsBuffer.push(1000 / frameTime);
    if (fpsBuffer.length > 15) fpsBuffer.shift();
    
    fpsUpdateTimer++;
    if (fpsUpdateTimer >= 10) {
        const sum = fpsBuffer.reduce((a, b) => a + b, 0);
        fps = Math.round(sum / fpsBuffer.length);
        fpsUpdateTimer = 0;
    }

    accumulator += frameTime;
    if (accumulator > 250) accumulator = 250; 

    while (accumulator >= TICK_TIME) {
        state.time = (state.time + 1) % GAME_SETTINGS.dayNightCycle;
        
        state.player.update();
        if (state.outzoneSpawnCooldown > 0) state.outzoneSpawnCooldown--;

        const playerInDanger = state.player.x < 0 || state.player.x > WORLD_SIZE || state.player.y < 0 || state.player.y > WORLD_SIZE;

        if (playerInDanger) {
            if (state.outzoneSpawnCooldown <= 0 && state.greeds.length < 5) {
                const spawnCount = Math.min(5 - state.greeds.length, Math.floor(Math.random() * 2) + 2);
                for (let i = 0; i < spawnCount; i++) {
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnDist = 900 + Math.random() * 200;
                    const greedX = state.player.x + Math.cos(spawnAngle) * spawnDist;
                    const greedY = state.player.y + Math.sin(spawnAngle) * spawnDist;

                    const newGreed = new Greed(greedX, greedY);
                    newGreed.isOutzoneGreed = true;
                    state.greeds.push(newGreed);
                }
                state.outzoneSpawnCooldown = GAME_SETTINGS.outzone.spawnInterval;
            }
        } else {
            for (let i = 0; i < state.greeds.length; i++) {
                if (state.greeds[i].isOutzoneGreed) state.greeds[i].isFleeing = true;
            }
        }

        for (let i = state.objects.length - 1; i >= 0; i--) {
            state.objects[i].update();
            if (state.objects[i].lifetime <= 0) {
                state.objects[i] = state.objects[state.objects.length - 1];
                state.objects.pop();
            }
        }
        
        if (Math.random() < 0.015 && state.objects.length < 850) {
            const spawnX = Math.random() * WORLD_SIZE; const spawnY = Math.random() * WORLD_SIZE;
            const dx = spawnX - state.player.x;
            const dy = spawnY - state.player.y;
            if (dx * dx + dy * dy > 202500) { 
                const keys = Object.keys(ENTITY_DATA);
                let totalWeight = keys.reduce((sum, key) => sum + ENTITY_DATA[key].weight, 0);
                let rand = Math.random() * totalWeight; let selectedId = keys[0];
                for (let key of keys) { if (rand < ENTITY_DATA[key].weight) { selectedId = key; break; } rand -= ENTITY_DATA[key].weight; }
                state.objects.push(new GameObject(spawnX, spawnY, selectedId));
            }
        }

        if (state.isNight && Math.random() < 0.003 && state.greeds.length < 5) {
            const angle = Math.random() * Math.PI * 2;
            state.greeds.push(new Greed(state.player.x + Math.cos(angle) * 1200, state.player.y + Math.sin(angle) * 1200));
        }

        for (let i = state.greeds.length - 1; i >= 0; i--) {
            state.greeds[i].update(state.player);
            if (state.greeds[i].hp <= 0 || state.greeds[i].lifetime <= 0) {
                if (state.greeds[i].hp <= 0 && state.greeds[i].stolenItem) state.player.addToInventory('greed_dust', 1);
                state.greeds[i] = state.greeds[state.greeds.length - 1];
                state.greeds.pop();
            }
        }

        for (let i = state.particles.length - 1; i >= 0; i--) {
            let p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= 0.03;
            if (p.life <= 0) {
                state.particles[i] = state.particles[state.particles.length - 1];
                state.particles.pop();
            }
        }

        accumulator -= TICK_TIME;
    }

    state.camera.x = state.player.x - canvas.width / 2;
    state.camera.y = state.player.y - canvas.height / 2;
    state.mouse.worldX = state.mouse.x + state.camera.x;
    state.mouse.worldY = state.mouse.y + state.camera.y;

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    // 1. СЛОЙ АУТЗОНЫ: Тайлим строго по её собственным размерам (на весь экран под низ)
    const outzoneImg = images['outzone'];
    if (outzoneImg && outzoneImg.complete) {
        const oW = outzoneImg.width || 512;
        const oH = outzoneImg.height || 512;

        const startOutX = Math.floor(state.camera.x / oW);
        const endOutX = Math.floor((state.camera.x + canvas.width) / oW);
        const startOutY = Math.floor(state.camera.y / oH);
        const endOutY = Math.floor((state.camera.y + canvas.height) / oH);

        for (let tx = startOutX; tx <= endOutX; tx++) {
            for (let ty = startOutY; ty <= endOutY; ty++) {
                ctx.drawImage(outzoneImg, tx * oW, ty * oH, oW, oH);
            }
        }
    } else {
        ctx.fillStyle = '#2b1d1d';
        ctx.fillRect(state.camera.x, state.camera.y, canvas.width, canvas.height);
    }

    // 2. СЛОЙ ТРАВЫ: Рисуем поверх аутзоны строго в границах 0..WORLD_SIZE по её собственным размерам
    const floorImg = images['floor'];
    if (floorImg && floorImg.complete) {
        const fW = floorImg.width || 512;
        const fH = floorImg.height || 512;

        const startFloorX = Math.floor(Math.max(0, state.camera.x) / fW);
        const endFloorX = Math.floor(Math.min(WORLD_SIZE, state.camera.x + canvas.width) / fW);
        const startFloorY = Math.floor(Math.max(0, state.camera.y) / fH);
        const endFloorY = Math.floor(Math.min(WORLD_SIZE, state.camera.y + canvas.height) / fH);

        for (let tx = startFloorX; tx <= endFloorX; tx++) {
            for (let ty = startFloorY; ty <= endFloorY; ty++) {
                ctx.drawImage(floorImg, tx * fW, ty * fH, fW, fH);
            }
        }
    }

    renderList.length = 0;
    
    const padding = 200;
    let activeStaticObjects = 0;
    for (let i = 0; i < state.objects.length; i++) {
        const ent = state.objects[i];
        if (ent.x + padding > state.camera.x && ent.x - padding < state.camera.x + canvas.width &&
            ent.y + padding > state.camera.y && ent.y - padding < state.camera.y + canvas.height) { 
            renderList.push(ent);
            activeStaticObjects++;
        }
    }
    for (let i = 0; i < state.greeds.length; i++) renderList.push(state.greeds[i]);
    renderList.push(state.player);

    renderList.sort(sortEntities);
    
    for (let i = 0; i < state.greeds.length; i++) {
        drawOptimizedSlimeTrail(ctx, state.greeds[i]);
    }
    
    for (let i = 0; i < renderList.length; i++) {
        renderList[i].draw(ctx);
    }

    for (let i = 0; i < state.particles.length; i++) {
        let p = state.particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); 
    }
    ctx.globalAlpha = 1.0; 

    ctx.restore();

    const halfDay = GAME_SETTINGS.dayNightCycle / 2;
    state.isNight = state.time > halfDay;
    if (state.isNight) {
        const nightProgress = (state.time - halfDay) / halfDay; let opacity = 0.65;
        if (nightProgress < 0.1) opacity = (nightProgress / 0.1) * 0.65; if (nightProgress > 0.9) opacity = ((1 - nightProgress) / 0.1) * 0.65;
        ctx.fillStyle = `rgba(5, 5, 25, ${opacity})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawUI(ctx, canvas.width, canvas.height);

    // ДЕБАГ ОВЕРЛЕЙ
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 26, 0.85)';
    ctx.fillRect(15, 15, 280, 175);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(15, 15, 280, 175);
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';

    let debugY = 25;
    const debugLines = [
        `FPS         : ${fps}`,
        `Frame Time  : ${frameTime.toFixed(1)} ms`,
        `Obj (Total) : ${state.objects.length}`,
        `Obj (Render): ${activeStaticObjects}`,
        `Greeds(Mobs): ${state.greeds.length}`,
        `Particles   : ${state.particles.length}`,
        `Coordinates : X:${Math.round(state.player.x)} Y:${Math.round(state.player.y)}`
    ];

    for (let i = 0; i < debugLines.length; i++) {
        ctx.fillText(debugLines[i], 25, debugY);
        debugY += 22;
    }
    ctx.restore();

    requestAnimationFrame(loop);
}

loadTextures(ctx, () => { generateWorld(); loop(); });