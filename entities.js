import { images, state, GAME_SETTINGS, ENTITY_DATA, WORLD_SIZE } from './config.js';
import { resolveCollision } from './utils.js';

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.colRadius = GAME_SETTINGS.player.colRadius;
        this.friction = 0.82; this.accel = GAME_SETTINGS.player.baseSpeed;
        this.angle = 0;
        
        // Стандарт здоровья изменен на 255
        this.hp = 255; this.maxHp = 255;
        this.stamina = 100; this.maxStamina = 100;
        this.water = 100; this.maxWater = 100;
        
        this.inventory = Array.from({length: 6}, () => ({type: null, count: 0}));
        this.selectedSlot = 0;
        this.currentEquipped = null;
        
        this.actionTimer = 0;
        this.actionTotal = 0;
        this.actionType = null;
        this.attackTimer = 0;
        this.targetSlot = 0;
    }

    selectSlot(index) {
        if (this.actionTimer > 0 || this.selectedSlot === index) return;
        const itemType = this.inventory[index].type;
        
        if (itemType && !GAME_SETTINGS.items[itemType].equippable) return;

        if (itemType && GAME_SETTINGS.items[itemType].heal > 0) {
            this.actionType = 'eat';
            this.actionTotal = GAME_SETTINGS.player.eatTime;
        } else {
            this.actionType = 'equip';
            this.actionTotal = GAME_SETTINGS.player.equipTime;
        }
        this.actionTimer = this.actionTotal;
        this.targetSlot = index;
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
                if (slot.count >= remaining) {
                    slot.count -= remaining;
                    if (slot.count === 0) slot.type = null;
                    return true;
                } else {
                    remaining -= slot.count;
                    slot.count = 0;
                    slot.type = null;
                }
            }
        }
        return false;
    }

    countItem(type) {
        return this.inventory.filter(s => s.type === type).reduce((sum, s) => sum + s.count, 0);
    }

    update() {
        let ax = 0, ay = 0;
        if (state.keys['KeyW']) ay -= 1;
        if (state.keys['KeyS']) ay += 1;
        if (state.keys['KeyA']) ax -= 1;
        if (state.keys['KeyD']) ax += 1;

        const speedMult = state.keys['ShiftLeft'] && this.stamina > 0 ? GAME_SETTINGS.player.sprintMultiplier : 1;
        if (ax !== 0 || ay !== 0) {
            const mag = Math.hypot(ax, ay);
            this.vx += (ax / mag) * this.accel * speedMult;
            this.vy += (ay / mag) * this.accel * speedMult;
            if (state.keys['ShiftLeft']) this.stamina -= 0.35;
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 0.6);
        }

        this.vx *= this.friction; this.vy *= this.friction;
        this.x = Math.max(this.colRadius, Math.min(WORLD_SIZE - this.colRadius, this.x + this.vx));
        this.y = Math.max(this.colRadius, Math.min(WORLD_SIZE - this.colRadius, this.y + this.vy));
        
        this.hp = Math.min(this.maxHp, this.hp + GAME_SETTINGS.player.passiveHpRegen);
        
        const checkDist = 150;
        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i];
            if (Math.abs(obj.x - this.x) < checkDist && Math.abs(obj.y - this.y) < checkDist) {
                resolveCollision(this, obj);
            }
        }

        this.angle = Math.atan2(state.mouse.worldY - this.y, state.mouse.worldX - this.x);

        if (this.actionTimer > 0) {
            this.actionTimer--;
            if (this.actionTimer <= 0) {
                if (this.actionType === 'equip') {
                    this.selectedSlot = this.targetSlot;
                    this.currentEquipped = this.inventory[this.selectedSlot].type;
                } else if (this.actionType === 'eat') {
                    const item = this.inventory[this.targetSlot];
                    if (item.type) {
                        this.hp = Math.min(this.maxHp, this.hp + GAME_SETTINGS.items[item.type].heal);
                        item.count--;
                        if (item.count <= 0) {
                            item.type = null;
                            if (this.selectedSlot === this.targetSlot) this.currentEquipped = null;
                        }
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
            if (Math.abs(obj.x - this.x) > 160 || Math.abs(obj.y - this.y) > 160) continue;

            const d = Math.hypot(obj.x - this.x, obj.y - this.y);
            const angleToObj = Math.atan2(obj.y - this.y, obj.x - this.x);
            let diffAngle = Math.atan2(Math.sin(angleToObj - this.angle), Math.cos(angleToObj - this.angle));

            if (d < 75 + obj.colRadius && Math.abs(diffAngle) < Math.PI / 2.2) {
                const dropData = ENTITY_DATA[obj.type];
                const isCorrectTool = !dropData.requiredTool || dropData.requiredTool === currentToolTier;

                if (isCorrectTool) {
                    obj.hp -= currentDamage;
                } else {
                    obj.hp -= 15; // Неправильный инструмент наносит уменьшенный урон, но ломает строения
                }
                
                const pushForce = 14; 
                obj.offsetX = Math.cos(angleToObj) * pushForce;
                obj.offsetY = Math.sin(angleToObj) * pushForce;

                obj.updateState();
                
                if (obj.hp <= 0) {
                    if (dropData && dropData.drop && isCorrectTool) {
                        const dropCount = Math.floor(Math.random() * (dropData.dropRange[1] - dropData.dropRange[0] + 1)) + dropData.dropRange[0];
                        this.addToInventory(dropData.drop, dropCount);
                    }
                    state.objects.splice(i, 1);
                }
            }
        }
        
        state.greeds.forEach(g => {
            const d = Math.hypot(g.x - this.x, g.y - this.y);
            const angleToGreed = Math.atan2(g.y - this.y, g.x - this.x);
            let diffAngle = Math.atan2(Math.sin(angleToGreed - this.angle), Math.cos(angleToGreed - this.angle));

            if (d < 85 && Math.abs(diffAngle) < Math.PI / 2.2) {
                g.hp -= currentDamage;
                g.isFleeing = true;

                const pushForce = 20; 
                g.offsetX = Math.cos(angleToGreed) * pushForce;
                g.offsetY = Math.sin(angleToGreed) * pushForce;
            }
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const shoulderLX = 12, shoulderLY = -22;
        const shoulderRX = 12, shoulderRY = 22;
        const armWidth = 22, armHeight = 45; 

        let rArmRotation = Math.PI / 2.2; 
        let rArmPullback = 5;
        let playerSquashX = 1;

        if (this.attackTimer > 0) {
            const t = 12 - this.attackTimer; 
            if (t < 3) { 
                const p = t / 3;
                rArmRotation = Math.PI / 2.2 - p * 0.6;
                rArmPullback = 5 - p * 16;
                playerSquashX = 1.04;
            } else { 
                const p = (t - 3) / 9;
                rArmRotation = (Math.PI / 2.2 - 0.6) + p * 0.6;
                rArmPullback = -11 + p * 16;
                playerSquashX = 1.04 - p * 0.04;
            }
        }

        ctx.scale(playerSquashX, 1 / playerSquashX);

        if (images.hand) {
            ctx.save();
            ctx.translate(shoulderLX, shoulderLY);
            ctx.rotate(Math.PI / 2.2); 
            ctx.scale(-1, 1);
            ctx.drawImage(images.hand, -armWidth / 2, -armHeight + 8, armWidth, armHeight);
            ctx.restore();
        }

        if (images.hand) {
            ctx.save();
            ctx.translate(shoulderRX, shoulderRY);
            ctx.rotate(rArmRotation);
            ctx.drawImage(images.hand, -armWidth / 2, -armHeight + rArmPullback, armWidth, armHeight);

            if (this.currentEquipped && images[this.currentEquipped]) {
                ctx.save();
                ctx.translate(0, -armHeight + rArmPullback + 5);
                ctx.rotate(-Math.PI / 2);
                ctx.drawImage(images[this.currentEquipped], -15, -25, 30, 30);
                ctx.restore();
            }
            ctx.restore();
        }

        if (images.player) {
            ctx.save();
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(images.player, -30, -35, 60, 60);
            ctx.restore();
        }
        ctx.restore();
    }
}

export class GameObject {
    constructor(x, y, dataId) {
        const data = ENTITY_DATA[dataId];
        this.x = x;
        this.y = y;
        this.type = dataId;
        
        this.offsetX = 0;
        this.offsetY = 0;

        // Стандарт 255 ХП и длительность жизни 255 секунд
        this.hp = 255;
        this.maxHp = 255;
        this.lifetime = 255 * 60; // Перевод секунд в фреймы

        this.renderRad = data.renderRad;
        this.colRadius = data.colRadius;
        this.textures = [...data.textures].sort((a, b) => b.hp - a.hp);

        this.updateState();
    }

    update() {
        if (this.lifetime > 0) this.lifetime--;
    }

    updateState() {
        const hpPercent = (this.hp / this.maxHp) * 100;
        this.currentTexture = this.textures[0].src;
        
        for (let i = 0; i < this.textures.length; i++) {
            if (hpPercent <= this.textures[i].hp) {
                this.currentTexture = this.textures[i].src;
            }
        }
    }

    draw(ctx) {
        const img = images[this.currentTexture];
        if (img?.complete) {
            this.offsetX *= 0.82;
            this.offsetY *= 0.82;
            if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0;
            if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;

            ctx.drawImage(
                img, 
                this.x + this.offsetX - this.renderRad, 
                this.y + this.offsetY - this.renderRad, 
                this.renderRad * 2, 
                this.renderRad * 2
            );
        }
    }
}

export class Greed {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.colRadius = GAME_SETTINGS.greed.colRadius;
        this.renderRad = GAME_SETTINGS.greed.renderRad;
        
        // Стандарт 255 ХП и длительность жизни 255 секунд
        this.hp = 255;
        this.lifetime = 255 * 60;

        this.stolenItem = null;
        this.isFleeing = false;
        this.type = 'greed';
        this.currentTexture = 'greed';
        this.trail = [];
        this.attackCooldown = 0;

        this.offsetX = 0;
        this.offsetY = 0;
    }

    update(player) {
        if (this.lifetime > 0) this.lifetime--;

        let targetX = player.x;
        let targetY = player.y;

        if (this.isFleeing || !state.isNight) {
            targetX = this.x > WORLD_SIZE / 2 ? WORLD_SIZE * 1.5 : -WORLD_SIZE * 0.5;
            targetY = this.y > WORLD_SIZE / 2 ? WORLD_SIZE * 1.5 : -WORLD_SIZE * 0.5;
            if (this.x < -1000 || this.x > WORLD_SIZE + 1000 || this.y < -1000 || this.y > WORLD_SIZE + 1000) {
                this.hp = 0;
            }
        }

        // --- ИИ АЛГОРИТМ: CONTEXT STEERING (8 НАПРАВЛЕНИЙ ПРЕДВИДЕНИЯ ПРЕПЯТСТВИЙ) ---
        const numDirs = 8;
        const danger = new Array(numDirs).fill(0);
        const interest = new Array(numDirs).fill(0);

        const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);

        // Расчет векторов интереса к цели
        for (let i = 0; i < numDirs; i++) {
            const dirAngle = (i * Math.PI * 2) / numDirs;
            const cosDiff = Math.cos(dirAngle - targetAngle);
            interest[i] = Math.max(0, cosDiff);
        }

        // Сканирование окружения на наличие маски опасности
        const lookAheadDist = 130; 
        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i];
            const dx = obj.x - this.x;
            const dy = obj.y - this.y;
            const dist = Math.hypot(dx, dy);
            const minDist = obj.colRadius + this.colRadius + 25;

            if (dist < lookAheadDist + minDist) {
                const objAngle = Math.atan2(dy, dx);
                const dangerFactor = 1.0 - Math.max(0, (dist - minDist) / lookAheadDist);

                for (let j = 0; j < numDirs; j++) {
                    const dirAngle = (j * Math.PI * 2) / numDirs;
                    const cosDiff = Math.cos(dirAngle - objAngle);
                    if (cosDiff > 0) {
                        danger[j] = Math.max(danger[j], cosDiff * dangerFactor * 1.5);
                    }
                }
            }
        }

        // Выбор лучшего безопасного вектора движения
        let bestDirIndex = -1;
        let maxWeight = -Infinity;
        for (let i = 0; i < numDirs; i++) {
            const weight = interest[i] - danger[i];
            if (weight > maxWeight) {
                maxWeight = weight;
                bestDirIndex = i;
            }
        }

        let finalAngle = targetAngle;
        if (bestDirIndex !== -1 && danger[bestDirIndex] > 0.1) {
            finalAngle = (bestDirIndex * Math.PI * 2) / numDirs;
        }

        const speed = (this.isFleeing || !state.isNight) ? GAME_SETTINGS.greed.speedFlee : GAME_SETTINGS.greed.speedNormal;
        
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer > 5 || this.isFleeing) {
            this.vx = Math.cos(finalAngle) * speed;
            this.vy = Math.sin(finalAngle) * speed;
        } else {
            this.vx = 0; this.vy = 0;
        }

        this.x += this.vx; 
        this.y += this.vy;

        // Твердая физическая разгрузка коллизий (финальный бэкап безопасности)
        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i];
            if (Math.abs(obj.x - this.x) < 110 && Math.abs(obj.y - this.y) < 110) {
                resolveCollision(this, obj);
            }
        }

        if (!this.isFleeing && state.isNight && distToPlayer < (this.colRadius + player.colRadius + 12)) {
            resolveCollision(this, player);
            if (this.attackCooldown <= 0) {
                player.hp -= GAME_SETTINGS.greed.damage;
                this.attackCooldown = GAME_SETTINGS.greed.attackCooldown;
                if (Math.random() < 0.2) this.steal(player);
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;

        if (state.time % 2 === 0) {
            this.trail.push({x: this.x, y: this.y});
            if (this.trail.length > 50) this.trail.shift();
        }
    }

    steal(player) {
        const validSlots = player.inventory.filter(s => s.count > 0);
        if (validSlots.length > 0) {
            const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
            const stolenAmount = Math.max(1, Math.floor(slot.count * 0.25));
            slot.count -= stolenAmount;
            this.stolenItem = slot.type;
            if (slot.count <= 0) {
                slot.type = null;
                if (player.inventory[player.selectedSlot] === slot) player.currentEquipped = null;
            }
            this.isFleeing = true;
        }
    }

    draw(ctx) {
        this.offsetX *= 0.82;
        this.offsetY *= 0.82;
        if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0;
        if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;

        const renderX = this.x + this.offsetX;
        const renderY = this.y + this.offsetY;

        if (images.greed && images.greed.complete) {
            ctx.drawImage(images.greed, renderX - this.renderRad, renderY - this.renderRad, this.renderRad * 2, this.renderRad * 2);
        } else {
            ctx.fillStyle = '#8B008B';
            ctx.beginPath(); ctx.arc(renderX, renderY, this.colRadius, 0, Math.PI * 2); ctx.fill();
        }
        
        if (this.stolenItem && images[this.stolenItem]) {
            ctx.drawImage(images[this.stolenItem], renderX - 15, renderY - 45, 30, 30);
        }
    }
}