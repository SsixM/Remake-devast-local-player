import { images, state, GAME_SETTINGS, ENTITY_DATA, WORLD_SIZE } from './config.js';
import { resolveCollision } from './utils.js';

const AI_DANGER = new Float32Array(8);
const AI_INTEREST = new Float32Array(8);

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.colRadius = GAME_SETTINGS.player.colRadius;
        this.friction = 0.82; this.accel = GAME_SETTINGS.player.baseSpeed;
        this.angle = 0; this.hp = 255; this.maxHp = 255;
        this.stamina = 100; this.maxStamina = 100;
        this.water = 100; this.maxWater = 100;
        this.inventory = Array.from({length: 6}, () => ({type: null, count: 0}));
        this.selectedSlot = 0; this.currentEquipped = null;
        this.actionTimer = 0; this.actionTotal = 0; this.actionType = null;
        this.attackTimer = 0; this.targetSlot = 0;
    }

    selectSlot(index) {
        if (this.actionTimer > 0 || this.selectedSlot === index) return;
        const itemType = this.inventory[index].type;
        if (itemType && !GAME_SETTINGS.items[itemType].equippable) return;
        if (itemType && GAME_SETTINGS.items[itemType].heal > 0) {
            this.actionType = 'eat'; this.actionTotal = GAME_SETTINGS.player.eatTime;
        } else {
            this.actionType = 'equip'; this.actionTotal = GAME_SETTINGS.player.equipTime;
        }
        this.actionTimer = this.actionTotal; this.targetSlot = index;
    }

    addToInventory(type, count) {
        let s = this.inventory.find(s => s.type === type && s.count < GAME_SETTINGS.items[type].maxStack);
        if (s) { s.count += count; return; }
        let empty = this.inventory.find(s => !s.type);
        if (empty) { empty.type = type; empty.count = count; }
    }

    removeFromInventory(type, count) {
        let remaining = count;
        for (let i = this.inventory.length - 1; i >= 0; i--) {
            let slot = this.inventory[i];
            if (slot.type === type) {
                if (slot.count >= remaining) { slot.count -= remaining; if (slot.count === 0) slot.type = null; return true; }
                else { remaining -= slot.count; slot.count = 0; slot.type = null; }
            }
        }
        return false;
    }

    countItem(type) { return this.inventory.filter(s => s.type === type).reduce((sum, s) => sum + s.count, 0); }

    update() {
        let ax = 0, ay = 0;
        if (state.keys['KeyW']) ay -= 1;
        if (state.keys['KeyS']) ay += 1;
        if (state.keys['KeyA']) ax -= 1;
        if (state.keys['KeyD']) ax += 1;

        const inOutzone = this.x < 0 || this.x > WORLD_SIZE || this.y < 0 || this.y > WORLD_SIZE;
        let currentAccel = this.accel;
        if (inOutzone) {
            currentAccel *= GAME_SETTINGS.outzone.slowMultiplier;
            this.hp = Math.max(0, this.hp - (GAME_SETTINGS.outzone.damagePerSec / 60));
        }

        const speedMult = state.keys['ShiftLeft'] && this.stamina > 0 ? GAME_SETTINGS.player.sprintMultiplier : 1;
        if (ax !== 0 || ay !== 0) {
            const mag = Math.sqrt(ax * ax + ay * ay);
            this.vx += (ax / mag) * currentAccel * speedMult;
            this.vy += (ay / mag) * currentAccel * speedMult;
            if (state.keys['ShiftLeft']) this.stamina -= 0.35;
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 0.6);
        }

        this.vx *= this.friction; this.vy *= this.friction;
        this.x += this.vx; this.y += this.vy;
        
        if (!inOutzone) this.hp = Math.min(this.maxHp, this.hp + GAME_SETTINGS.player.passiveHpRegen);
        
        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i];
            if (Math.abs(obj.x - this.x) < 150 && Math.abs(obj.y - this.y) < 150) resolveCollision(this, obj);
        }

        this.angle = Math.atan2(state.mouse.worldY - this.y, state.mouse.worldX - this.x);

        if (this.actionTimer > 0) {
            this.actionTimer--;
            if (this.actionTimer <= 0) {
                if (this.actionType === 'equip') {
                    this.selectedSlot = this.targetSlot; this.currentEquipped = this.inventory[this.selectedSlot].type;
                } else if (this.actionType === 'eat') {
                    const item = this.inventory[this.targetSlot];
                    if (item.type) {
                        this.hp = Math.min(this.maxHp, this.hp + GAME_SETTINGS.items[item.type].heal);
                        item.count--; if (item.count <= 0) { item.type = null; if (this.selectedSlot === this.targetSlot) this.currentEquipped = null; }
                    }
                }
                this.actionType = null;
            }
        }
        if (this.attackTimer > 0) this.attackTimer--;
    }

    attack() {
        if (this.actionTimer > 0 || this.attackTimer > 0) return;
        this.attackTimer = 12;
        const equippedData = this.currentEquipped ? GAME_SETTINGS.items[this.currentEquipped] : null;
        const currentDamage = equippedData && equippedData.damage ? equippedData.damage : GAME_SETTINGS.player.unarmedDamage;
        const currentToolTier = equippedData && equippedData.toolTier ? equippedData.toolTier : 'hand';

        for (let i = state.objects.length - 1; i >= 0; i--) {
            const obj = state.objects[i];
            const dx = obj.x - this.x;
            if (dx > 160 || dx < -160) continue;
            const dy = obj.y - this.y;
            if (dy > 160 || dy < -160) continue;

            const distSq = dx * dx + dy * dy;
            const maxHitDist = 75 + obj.colRadius;

            if (distSq < maxHitDist * maxHitDist) {
                const angleToObj = Math.atan2(dy, dx);
                let diffAngle = Math.atan2(Math.sin(angleToObj - this.angle), Math.cos(angleToObj - this.angle));

                if (Math.abs(diffAngle) < Math.PI / 2.2) {
                    const dropData = ENTITY_DATA[obj.type];
                    const isCorrectTool = !dropData.requiredTool || dropData.requiredTool === currentToolTier;
                    if (isCorrectTool) obj.hp -= currentDamage; else obj.hp -= 15;
                    obj.offsetX = Math.cos(angleToObj) * 14; obj.offsetY = Math.sin(angleToObj) * 14;
                    obj.updateState();
                    if (obj.hp <= 0) {
                        if (dropData && dropData.drop && isCorrectTool) {
                            const dropCount = Math.floor(Math.random() * (dropData.dropRange[1] - dropData.dropRange[0] + 1)) + dropData.dropRange[0];
                            this.addToInventory(dropData.drop, dropCount);
                        }
                        state.objects[i] = state.objects[state.objects.length - 1];
                        state.objects.pop();
                    }
                }
            }
        }

        for (let i = 0; i < state.greeds.length; i++) {
            const g = state.greeds[i];
            const dx = g.x - this.x;
            const dy = g.y - this.y;
            if (dx * dx + dy * dy < 7225) { 
                const angleToGreed = Math.atan2(dy, dx);
                let diffAngle = Math.atan2(Math.sin(angleToGreed - this.angle), Math.cos(angleToGreed - this.angle));
                if (Math.abs(diffAngle) < Math.PI / 2.2) {
                    g.hp -= currentDamage; g.isFleeing = true;
                    g.offsetX = Math.cos(angleToGreed) * 20; g.offsetY = Math.sin(angleToGreed) * 20;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        const armWidth = 22, armHeight = 45; let rArmRotation = Math.PI / 2.2, rArmPullback = 5, playerSquashX = 1;
        if (this.attackTimer > 0) {
            const t = 12 - this.attackTimer;
            if (t < 3) { const p = t / 3; rArmRotation = Math.PI / 2.2 - p * 0.6; rArmPullback = 5 - p * 16; playerSquashX = 1.04; } 
            else { const p = (t - 3) / 9; rArmRotation = (Math.PI / 2.2 - 0.6) + p * 0.6; rArmPullback = -11 + p * 16; playerSquashX = 1.04 - p * 0.04; }
        }
        ctx.scale(playerSquashX, 1 / playerSquashX);
        if (images.hand) {
            ctx.save(); ctx.translate(12, -22); ctx.rotate(Math.PI / 2.2); ctx.scale(-1, 1); ctx.drawImage(images.hand, -armWidth / 2, -armHeight + 8, armWidth, armHeight); ctx.restore();
            ctx.save(); ctx.translate(12, 22); ctx.rotate(rArmRotation); ctx.drawImage(images.hand, -armWidth / 2, -armHeight + rArmPullback, armWidth, armHeight);
            if (this.currentEquipped && images[this.currentEquipped]) {
                ctx.save(); ctx.translate(0, -armHeight + rArmPullback + 5); ctx.rotate(-Math.PI / 2); ctx.drawImage(images[this.currentEquipped], -15, -25, 30, 30); ctx.restore();
            }
            ctx.restore();
        }
        if (images.player) { ctx.save(); ctx.rotate(Math.PI / 2); ctx.drawImage(images.player, -30, -35, 60, 60); ctx.restore(); }
        ctx.restore();
    }
}

export class GameObject {
    constructor(x, y, dataId) {
        const data = ENTITY_DATA[dataId]; this.x = x; this.y = y; this.type = dataId; this.offsetX = 0; this.offsetY = 0;
        this.hp = 255; this.maxHp = 255;
        this.lifetime = Math.floor((800 + Math.random() * 1400) * 60);
        this.renderRad = data.renderRad; this.colRadius = data.colRadius;
        this.textures = [...data.textures].sort((a, b) => b.hp - a.hp); this.updateState();
        
        // 3. ИСПРАВЛЕНО: Флаг масштабирования для плавного роста при появлении
        this.scale = 0;
    }
    update() { 
        if (this.lifetime > 0) this.lifetime--; 
        // Плавно увеличиваем размер объекта до 1.0 за ~0.75 сек (45 тиков)
        if (this.scale < 1) {
            this.scale += 1 / 45;
            if (this.scale > 1) this.scale = 1;
        }
    }
    updateState() {
        const hpPercent = (this.hp / this.maxHp) * 100; this.currentTexture = this.textures[0].src;
        for (let i = 0; i < this.textures.length; i++) { if (hpPercent <= this.textures[i].hp) this.currentTexture = this.textures[i].src; }
    }
    draw(ctx) {
        const img = images[this.currentTexture];
        if (img?.complete) {
            this.offsetX *= 0.82; this.offsetY *= 0.82;
            if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0; if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;
            
            // Применяем текущий коэффициент плавного масштабирования
            const currentRad = this.renderRad * this.scale;
            ctx.drawImage(img, this.x + this.offsetX - currentRad, this.y + this.offsetY - currentRad, currentRad * 2, currentRad * 2);
        }
    }
}

export class Greed {
    constructor(x, y) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.colRadius = GAME_SETTINGS.greed.colRadius; this.renderRad = GAME_SETTINGS.greed.renderRad;
        this.hp = 255; this.lifetime = 255 * 60;
        this.stolenItem = null; this.isFleeing = false;
        this.isOutzoneGreed = false;
        this.type = 'greed'; this.currentTexture = 'greed';
        this.attackCooldown = 0;
        this.offsetX = 0; this.offsetY = 0;
        
        this.trail = new Float32Array(100); 
        this.trailLength = 0;
        this.trailPtr = 0;
    }

    update(player) {
        if (this.lifetime > 0) this.lifetime--;
        let targetX = player.x; let targetY = player.y;

        const pDx = player.x - this.x;
        const pDy = player.y - this.y;
        const distToPlayerSq = pDx * pDx + pDy * pDy;

        if (this.isFleeing || (!state.isNight && !this.isOutzoneGreed)) {
            targetX = this.x > WORLD_SIZE / 2 ? WORLD_SIZE * 1.5 : -WORLD_SIZE * 0.5;
            targetY = this.y > WORLD_SIZE / 2 ? WORLD_SIZE * 1.5 : -WORLD_SIZE * 0.5;
            
            // 4. ИСПРАВЛЕНО: Жадность пропадает ТОЛЬКО если улетела за фиксированный радиус 1400px от игрока
            // 1400^2 = 1960000
            if (distToPlayerSq > 1960000) {
                this.hp = 0;
            }
        }

        const numDirs = 8;
        AI_DANGER.fill(0); 
        
        const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);

        for (let i = 0; i < numDirs; i++) {
            const dirAngle = (i * Math.PI * 2) / numDirs;
            AI_INTEREST[i] = Math.max(0, Math.cos(dirAngle - targetAngle));
        }

        const lookAheadDist = 130;
        
        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i]; 
            const dx = obj.x - this.x;
            const minDist = obj.colRadius + this.colRadius + 25;
            const maxD = lookAheadDist + minDist;

            if (dx > maxD || dx < -maxD) continue;
            const dy = obj.y - this.y;
            if (dy > maxD || dy < -maxD) continue;

            const distSq = dx * dx + dy * dy;
            if (distSq < maxD * maxD) {
                const dist = Math.sqrt(distSq);
                const objAngle = Math.atan2(dy, dx); 
                const dangerFactor = 1.0 - Math.max(0, (dist - minDist) / lookAheadDist);
                for (let j = 0; j < numDirs; j++) {
                    const dirAngle = (j * Math.PI * 2) / numDirs; 
                    const cosDiff = Math.cos(dirAngle - objAngle);
                    if (cosDiff > 0) AI_DANGER[j] = Math.max(AI_DANGER[j], cosDiff * dangerFactor * 1.5);
                }
            }
        }

        let bestDirIndex = -1; let maxWeight = -Infinity;
        for (let i = 0; i < numDirs; i++) {
            const weight = AI_INTEREST[i] - AI_DANGER[i]; if (weight > maxWeight) { maxWeight = weight; bestDirIndex = i; }
        }

        let finalAngle = targetAngle;
        if (bestDirIndex !== -1 && AI_DANGER[bestDirIndex] > 0.1) finalAngle = (bestDirIndex * Math.PI * 2) / numDirs;
        const speed = (this.isFleeing || !state.isNight) && !this.isOutzoneGreed ? GAME_SETTINGS.greed.speedFlee : GAME_SETTINGS.greed.speedNormal;

        if (distToPlayerSq > 25 || this.isFleeing) {
            this.vx = Math.cos(finalAngle) * speed; this.vy = Math.sin(finalAngle) * speed;
        } else { this.vx = 0; this.vy = 0; }

        this.x += this.vx; this.y += this.vy;

        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i]; 
            if (Math.abs(obj.x - this.x) < 110 && Math.abs(obj.y - this.y) < 110) resolveCollision(this, obj);
        }

        if (!this.isFleeing && distToPlayerSq < ((this.colRadius + player.colRadius + 12) * (this.colRadius + player.colRadius + 12))) {
            resolveCollision(this, player);
            if (this.attackCooldown <= 0) {
                player.hp -= GAME_SETTINGS.greed.damage; this.attackCooldown = GAME_SETTINGS.greed.attackCooldown;
                if (Math.random() < 0.2) this.steal(player);
            }
        }
        if (this.attackCooldown > 0) this.attackCooldown--;
        
        if (state.time % 2 === 0) {
            this.trail[this.trailPtr] = this.x;
            this.trail[this.trailPtr + 1] = this.y;
            this.trailPtr = (this.trailPtr + 2) % 100;
            if (this.trailLength < 50) this.trailLength++;
        }
    }

    steal(player) {
        const validSlots = player.inventory.filter(s => s.count > 0);
        if (validSlots.length > 0) {
            const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
            const stolenAmount = Math.max(1, Math.floor(slot.count * 0.25)); slot.count -= stolenAmount;
            this.stolenItem = slot.type; this.isFleeing = true;
            if (slot.count <= 0) { slot.type = null; if (player.inventory[player.selectedSlot] === slot) player.currentEquipped = null; }
        }
    }

    draw(ctx) {
        this.offsetX *= 0.82; this.offsetY *= 0.82;
        if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0; if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;
        const renderX = this.x + this.offsetX; const renderY = this.y + this.offsetY;
        if (images.greed?.complete) { ctx.drawImage(images.greed, renderX - this.renderRad, renderY - this.renderRad, this.renderRad * 2, this.renderRad * 2); } 
        else { ctx.fillStyle = '#8B008B'; ctx.beginPath(); ctx.arc(renderX, renderY, this.colRadius, 0, Math.PI * 2); ctx.fill(); }
        if (this.stolenItem && images[this.stolenItem]) ctx.drawImage(images[this.stolenItem], renderX - 15, renderY - 45, 30, 30);
    }
}