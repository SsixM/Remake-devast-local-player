import { images, state, GAME_SETTINGS, ENTITY_DATA, WORLD_SIZE } from './config.js';
import { resolveCollision } from './utils.js';

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.colRadius = GAME_SETTINGS.player.colRadius;
        this.friction = 0.82; this.accel = GAME_SETTINGS.player.baseSpeed;
        this.angle = 0;
        
        this.hp = 100; this.maxHp = 100;
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
        this.attackTimer = 15;

        // Определяем урон и инструмент в руках
        const equippedData = this.currentEquipped ? GAME_SETTINGS.items[this.currentEquipped] : null;
        const currentDamage = equippedData && equippedData.damage ? equippedData.damage : GAME_SETTINGS.player.unarmedDamage;
        const currentToolTier = equippedData && equippedData.toolTier ? equippedData.toolTier : 'hand';

        for (let i = state.objects.length - 1; i >= 0; i--) {
            const obj = state.objects[i];
            if (Math.abs(obj.x - this.x) > 200 || Math.abs(obj.y - this.y) > 200) continue;

            const d = Math.hypot(obj.x - this.x, obj.y - this.y);
            if (d < 120 + obj.colRadius) {
                
                const dropData = ENTITY_DATA[obj.type];
                // Проверка, правильный ли инструмент
                const isCorrectTool = !dropData.requiredTool || dropData.requiredTool === currentToolTier;

                if (isCorrectTool) {
                    obj.hp -= currentDamage; // Полный урон
                } else {
                    obj.hp -= 1; // Блоки не ломаются легко неправильным инструментом
                }
                
                obj.updateState();
                
                if (obj.hp <= 0) {
                    // Выдаем дроп только если ломали правильным инструментом
                    if (dropData && dropData.drop && isCorrectTool) {
                        const dropCount = Math.floor(Math.random() * (dropData.dropRange[1] - dropData.dropRange[0] + 1)) + dropData.dropRange[0];
                        this.addToInventory(dropData.drop, dropCount);
                    }
                    state.objects.splice(i, 1);
                }
            }
        }
        
        state.greeds.forEach(g => {
            if (Math.hypot(g.x - this.x, g.y - this.y) < 110) {
                g.hp -= currentDamage;
                g.isFleeing = true;
            }
        });
    }

draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Чуть сместил плечи вперед (X: 12), чтобы руки не "тонули" в затылке
        const shoulderLX = 12, shoulderLY = -22;
        const shoulderRX = 12, shoulderRY = 22;
        const armWidth = 22, armHeight = 45; 

        // --- ЛОГИКА ПРАВОЙ РУКИ (БОЕВКА) ---
        let rArmRotation = Math.PI / 2.2; 
        let rArmPullback = 5;

        if (this.attackTimer > 0) {
            const t = 15 - this.attackTimer;
            if (t < 10) { 
                let p = t / 10;
                rArmRotation += p * 0.8;
                rArmPullback = 5 + (p * 10);
            } else if (t < 20) { // Немного растянул фазу удара для плавности
                let p = (t - 10) / 10;
                rArmRotation += 0.8 - (p * 2.2); // Уменьшил размах влево, чтоб не ломать сустав
                rArmPullback = 15 - (p * 25);
            } else {
                let p = (t - 20) / 15;
                let targetRot = Math.PI / 2.2;
                let startRot = Math.PI / 2.2 - 1.4;
                rArmRotation = startRot + (targetRot - startRot) * p;
                rArmPullback = -10 * (1 - p);
            }
        }

        // --- ЛЕВАЯ РУКА (ТЕПЕРЬ НЕ В ПИЗДЕ) ---
        if (images.hand) {
            ctx.save();
            ctx.translate(shoulderLX, shoulderLY);
            // Поворачиваем вперед и чуть вбок, зеркально правой руке
            ctx.rotate(Math.PI / 2.2); 
            ctx.scale(-1, 1);
            // Убрал "пассивное вдавливание" (+5), теперь она видна нормально
            ctx.drawImage(images.hand, -armWidth / 2, -armHeight + 8, armWidth, armHeight);
            ctx.restore();
        }

        // --- ПРАВАЯ РУКА ---
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

        // --- ГОЛОВА ---
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
        
        this.hp = data.maxHp;
        this.maxHp = data.maxHp;
        this.renderRad = data.renderRad;
        this.colRadius = data.colRadius;
        this.textures = [...data.textures].sort((a, b) => b.hp - a.hp);

        this.updateState();
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
            ctx.drawImage(
                img, 
                this.x - this.renderRad, 
                this.y - this.renderRad, 
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
        this.hp = GAME_SETTINGS.greed.hp;
        this.stolenItem = null;
        this.isFleeing = false;
        this.type = 'greed';
        this.currentTexture = 'greed';
        this.trail = [];
        this.attackCooldown = 0;
    }

    update(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        let ax = 0, ay = 0;

        if (this.isFleeing || !state.isNight) {
            const targetX = this.x > WORLD_SIZE / 2 ? WORLD_SIZE * 1.2 : -WORLD_SIZE * 0.2;
            const targetY = this.y > WORLD_SIZE / 2 ? WORLD_SIZE * 1.2 : -WORLD_SIZE * 0.2;
            const angle = Math.atan2(targetY - this.y, targetX - this.x);
            ax = Math.cos(angle);
            ay = Math.sin(angle);
            
            if (this.x < -1000 || this.x > WORLD_SIZE + 1000 || this.y < -1000 || this.y > WORLD_SIZE + 1000) {
                this.hp = 0;
            }
        } else {
            if (dist > 5) {
                ax = dx / dist;
                ay = dy / dist;
            }
            
            if (dist < (this.colRadius + player.colRadius + 10)) {
                resolveCollision(this, player);
                if (this.attackCooldown <= 0) {
                    player.hp -= GAME_SETTINGS.greed.damage;
                    this.attackCooldown = GAME_SETTINGS.greed.attackCooldown;
                    if (Math.random() < 0.2) this.steal(player);
                }
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown--;

        // Продвинутое избегание объектов со скольжением (Tangent Sliding Avoidance)
        const checkDist = 150;
        let avoidAx = 0, avoidAy = 0;

        for (let i = 0; i < state.objects.length; i++) {
            const obj = state.objects[i];
            const odx = this.x - obj.x;
            const ody = this.y - obj.y;
            const odist = Math.hypot(odx, ody);
            
            const minClearance = obj.colRadius + this.colRadius + 15;
            if (odist < minClearance) {
                const repelStrength = 1 - (odist / minClearance);
                
                // Векторное произведение для определения с какой стороны обходить препятствие
                const crossProduct = ax * ody - ay * odx;
                const slideDir = crossProduct > 0 ? 1 : -1;

                // Добавляем отталкивание (прямое)
                avoidAx += (odx / odist) * repelStrength * 1.5;
                avoidAy += (ody / odist) * repelStrength * 1.5;
                
                // Добавляем скольжение (перпендикуляр)
                avoidAx += (-ody / odist) * slideDir * repelStrength * 3.0;
                avoidAy += (odx / odist) * slideDir * repelStrength * 3.0;
            }
        }

        ax += avoidAx;
        ay += avoidAy;

        const mag = Math.hypot(ax, ay);
        if (mag > 0) {
            const speed = (this.isFleeing || !state.isNight) ? GAME_SETTINGS.greed.speedFlee : GAME_SETTINGS.greed.speedNormal;
            this.vx = (ax / mag) * speed;
            this.vy = (ay / mag) * speed;
        }

        this.x += this.vx; this.y += this.vy;

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
        if (images.greed && images.greed.complete) {
            ctx.drawImage(images.greed, this.x - this.renderRad, this.y - this.renderRad, this.renderRad * 2, this.renderRad * 2);
        } else {
            ctx.fillStyle = '#8B008B';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.colRadius, 0, Math.PI * 2); ctx.fill();
        }
        
        if (this.stolenItem && images[this.stolenItem]) {
            ctx.drawImage(images[this.stolenItem], this.x - 15, this.y - 45, 30, 30);
        }
    }
}