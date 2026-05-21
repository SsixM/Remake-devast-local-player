import { WORLD_SIZE, state, loadTextures, GAME_SETTINGS, ENTITY_DATA } from './config.js';
import { Player, GameObject, Greed } from './entities.js';
import { drawSlimeTrail } from './utils.js';
import { drawUI, handleUIClick } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); 

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

state.player = new Player(WORLD_SIZE / 2, WORLD_SIZE / 2);

window.addEventListener('keydown', e => state.keys[e.code] = true);
window.addEventListener('keyup', e => state.keys[e.code] = false);

window.addEventListener('mousemove', e => {
    state.mouse.x = e.clientX; 
    state.mouse.y = e.clientY;
});

window.addEventListener('mousedown', e => {
    if (e.button === 0) {
        const uiClicked = handleUIClick(e.clientX, e.clientY);
        if (!uiClicked && state.player) {
            state.player.attack();
        }
    }
});

function generateWorld() {
    const keys = Object.keys(ENTITY_DATA);
    for (let i = 0; i < 700; i++) {
        const x = Math.random() * WORLD_SIZE;
        const y = Math.random() * WORLD_SIZE;
        
        if (Math.hypot(x - state.player.x, y - state.player.y) < 400) continue;

        let totalWeight = keys.reduce((sum, key) => sum + ENTITY_DATA[key].weight, 0);
        let rand = Math.random() * totalWeight;
        let selectedId = keys[0];
        
        for (let key of keys) {
            if (rand < ENTITY_DATA[key].weight) {
                selectedId = key; break;
            }
            rand -= ENTITY_DATA[key].weight;
        }
        
        state.objects.push(new GameObject(x, y, selectedId));
    }
}

function loop() {
    state.time = (state.time + 1) % GAME_SETTINGS.dayNightCycle;
    const halfDay = GAME_SETTINGS.dayNightCycle / 2;
    state.isNight = state.time > halfDay;
    
    state.player.update();
    
    // Обновление игровых статических объектов и проверка их времени жизни (Lifetime)
    for (let i = state.objects.length - 1; i >= 0; i--) {
        state.objects[i].update();
        if (state.objects[i].lifetime <= 0) {
            state.objects.splice(i, 1);
        }
    }
    
    if (state.isNight && Math.random() < 0.003 && state.greeds.length < 6) {
        const angle = Math.random() * Math.PI * 2;
        state.greeds.push(new Greed(state.player.x + Math.cos(angle) * 1200, state.player.y + Math.sin(angle) * 1200));
    }

    for (let i = state.greeds.length - 1; i >= 0; i--) {
        state.greeds[i].update(state.player);
        if (state.greeds[i].hp <= 0 || state.greeds[i].lifetime <= 0) {
            if (state.greeds[i].hp <= 0 && state.greeds[i].stolenItem) {
                state.player.addToInventory('greed_dust', 1);
            }
            state.greeds.splice(i, 1);
        }
    }

    state.camera.x = state.player.x - canvas.width / 2;
    state.camera.y = state.player.y - canvas.height / 2;
    state.mouse.worldX = state.mouse.x + state.camera.x;
    state.mouse.worldY = state.mouse.y + state.camera.y;

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    if (state.floorPattern) {
        ctx.fillStyle = state.floorPattern;
        ctx.fillRect(state.camera.x, state.camera.y, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#151515';
        ctx.fillRect(state.camera.x, state.camera.y, canvas.width, canvas.height);
    }

    const padding = 200;
    const renderList = [];
    
    for (let i = 0; i < state.objects.length; i++) {
        const ent = state.objects[i];
        if (ent.x + padding > state.camera.x && ent.x - padding < state.camera.x + canvas.width &&
            ent.y + padding > state.camera.y && ent.y - padding < state.camera.y + canvas.height) {
            renderList.push(ent);
        }
    }
    
    for (let i = 0; i < state.greeds.length; i++) renderList.push(state.greeds[i]);
    renderList.push(state.player);

    renderList.sort((a, b) => a.y - b.y);

    state.greeds.forEach(g => drawSlimeTrail(ctx, g.trail));

    renderList.forEach(ent => ent.draw(ctx));

    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life -= 0.03;
        
        if (p.life > 0) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1.0;
        } else {
            state.particles.splice(i, 1);
        }
    }

    ctx.restore();

    if (state.isNight) {
        const nightProgress = (state.time - halfDay) / halfDay;
        let opacity = 0.65;
        if (nightProgress < 0.1) opacity = (nightProgress / 0.1) * 0.65;
        if (nightProgress > 0.9) opacity = ((1 - nightProgress) / 0.1) * 0.65;
        
        ctx.fillStyle = `rgba(5, 5, 25, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawUI(ctx, canvas.width, canvas.height);

    requestAnimationFrame(loop);
}

loadTextures(ctx, () => {
    generateWorld();
    loop();
});