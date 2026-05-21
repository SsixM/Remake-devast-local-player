import { state, GAME_SETTINGS, images } from './config.js';

// ==========================================
// ГЛОБАЛЬНЫЕ НАСТРОЙКИ ИНТЕРФЕЙСА
// ==========================================
export const HUD_CONFIG = {
    colors: {
        text: '#000',
        hpFill: 'rgba(119, 221, 119, 0.85)', 
        waterFill: 'rgba(119, 170, 255, 0.85)', 
        staminaFill: 'rgba(255, 187, 85, 0.85)',
        stroke: '#000000',
        modalStroke: '#000000',
        slotBg: 'rgba(250, 245, 230, 0.85)',
        slotHighlight: 'rgba(255, 215, 0, 0.6)',
        dayLight: '#fffaaa'
    }
};

// Состояния UI
let isCraftModalOpen = false;
let currentCraftCategory = 'weapons';

// Интерактивные зоны для кликов
let clickZones = {
    slots: [],
    craftBtn: null,
    modalClose: null,
    modalTabs: [],
    modalRecipes: [],
    modalBody: null
};

function inRect(x, y, rect) {
    if (!rect) return false;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function roundRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

export function handleUIClick(x, y) {
    if (!state.player) return false;

    if (isCraftModalOpen) {
        if (inRect(x, y, clickZones.modalClose)) {
            isCraftModalOpen = false; return true;
        }
        for (let i = 0; i < clickZones.modalTabs.length; i++) {
            if (inRect(x, y, clickZones.modalTabs[i])) {
                currentCraftCategory = clickZones.modalTabs[i].cat; return true;
            }
        }
        for (let i = 0; i < clickZones.modalRecipes.length; i++) {
            let zone = clickZones.modalRecipes[i];
            if (inRect(x, y, zone) && zone.canCraft) {
                Object.entries(zone.recipe.cost).forEach(([id, amt]) => state.player.removeFromInventory(id, amt));
                state.player.addToInventory(zone.recipe.id, 1);
                return true;
            }
        }
        if (inRect(x, y, clickZones.modalBody)) return true;
    }

    if (inRect(x, y, clickZones.craftBtn)) {
        isCraftModalOpen = !isCraftModalOpen;
        return true;
    }

    for (let i = 0; i < clickZones.slots.length; i++) {
        if (inRect(x, y, clickZones.slots[i])) {
            state.player.selectSlot(i);
            return true;
        }
    }

    return false;
}

export function drawUI(ctx, canvasWidth, canvasHeight) {
    if (!state.player) return;

    // Динамический расчет масштаба интерфейса под любое разрешение экрана
    const uiScale = Math.max(0.65, Math.min(1.1, canvasWidth / 1440));

    // Размеры элементов с учетом скейла
    const slotSize = 70 * uiScale;
    const slotGap = 8 * uiScale;
    const craftBtnSize = 80 * uiScale;
    
    // Пропорции текстуры gauge (675x191)
    const gaugeW = 270 * uiScale;
    const gaugeH = gaugeW * (191 / 675);

    // Пропорции текстуры hudstat (2284x464)
    const statsW = 540 * uiScale;
    const statsH = statsW * (464 / 2284);

    const paddingX = 12 * uiScale;
    const paddingY = 12 * uiScale;
    const inventoryWidth = (3 * slotSize) + (2 * slotGap) + (paddingX * 2);
    const invBgH = (2 * slotSize) + (1 * slotGap) + (paddingY * 2);

    // Расстояния между блоками интерфейса
    const gapPanels = 25 * uiScale;
    const bottomOffset = 20 * uiScale;

    const totalHudWidth = gaugeW + gapPanels + statsW + gapPanels + inventoryWidth;
    const startX = canvasWidth / 2 - totalHudWidth / 2;
    const hudBottomY = canvasHeight - bottomOffset;

    // Очистка интерактивных зон
    clickZones.slots = [];
    clickZones.modalTabs = [];
    clickZones.modalRecipes = [];

    // --- ПОЛОСА ДЕЙСТВИЯ (EAT / EQUIP) ---
    if (state.player.actionTimer > 0) {
        const barW = 200 * uiScale, barH = 10 * uiScale;
        const barX = canvasWidth / 2 - barW / 2;
        const barY = canvasHeight / 2 + 120 * uiScale;
        const pct = 1 - (state.player.actionTimer / state.player.actionTotal);

        ctx.fillStyle = '#fff';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = HUD_CONFIG.colors.stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = HUD_CONFIG.colors.text;
        ctx.fillRect(barX, barY, barW * pct, barH);

        ctx.font = `700 ${14 * uiScale}px "Comic Neue", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(state.player.actionType === 'eat' ? 'ПОЕДАНИЕ...' : 'ЭКИПИРОВКА...', canvasWidth / 2, barY - 5);
    }

    // --- 1. ПАНЕЛЬ СУТОК (GAUGE) ---
    const gaugeX = startX;
    const gaugeY = hudBottomY - gaugeH; // Выравнивание по нижней линии HUD

    if (images.gauge && images.gauge.complete) {
        ctx.drawImage(images.gauge, gaugeX, gaugeY, gaugeW, gaugeH);
    }

    // Логика и отрисовка стрелки часов
    const dayProgress = state.time / GAME_SETTINGS.dayNightCycle;
    const angle = (dayProgress * Math.PI) - (Math.PI / 2); 
    
    // Точка пивота стрелки привязана к нижней центральной части подложки
    const pivotX = gaugeX + gaugeW / 2;
    const pivotY = gaugeY + gaugeH * 0.86; 

    // Пропорции стрелки gaugevector (38x110)
    const vectorW = 16 * uiScale;
    const vectorH = vectorW * (110 / 38);

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    if (images.gaugevector && images.gaugevector.complete) {
        // Смещение вверх относительно точки вращения, чтобы пин совпал
        ctx.drawImage(images.gaugevector, -vectorW / 2, -vectorH + (vectorW * 0.4), vectorW, vectorH);
    } else {
        ctx.fillStyle = '#000'; ctx.fillRect(-2, -gaugeH * 0.7, 4, gaugeH * 0.7);
    }
    ctx.restore();

    // --- 2. ПАНЕЛЬ СТАТОВ (HUDSTAT) ---
    const statsX = gaugeX + gaugeW + gapPanels;
    const statsY = hudBottomY - statsH;

    if (images.hudstat && images.hudstat.complete) {
        ctx.drawImage(images.hudstat, statsX, statsY, statsW, statsH);
    }

    const statRows = [
        { val: state.player.hp, max: state.player.maxHp, color: HUD_CONFIG.colors.hpFill },
        { val: state.player.water, max: state.player.maxWater, color: HUD_CONFIG.colors.waterFill },
        { val: state.player.stamina, max: state.player.maxStamina, color: HUD_CONFIG.colors.staminaFill }
    ];

    // Геометрические проценты расположения полосок внутри текстуры 2284x464
    const barRelativeX = 0.165; 
    const barRelativeW = 0.81;  
    const barRelativeH = 0.22;  
    const barRelativeYPositions = [0.08, 0.39, 0.70]; // HP, WATER, STAMINA соответственно

    statRows.forEach((stat, i) => {
        const barX = statsX + statsW * barRelativeX;
        const barY = statsY + statsH * barRelativeYPositions[i];
        const barW = statsW * barRelativeW;
        const barH = statsH * barRelativeH;
        const pct = Math.max(0, Math.min(1, stat.val / stat.max));

        // Рендерим только внутреннее заполнение (без кастомных черных рамок)
        ctx.fillStyle = stat.color;
        ctx.fillRect(barX, barY, barW * pct, barH);

        // Текст с цифрами поверх текстурных статус-баров
        ctx.fillStyle = HUD_CONFIG.colors.text;
        ctx.font = `700 ${15 * uiScale}px "Comic Neue", cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(stat.val)} / ${stat.max}`, barX + barW / 2, barY + barH / 2 + 1);
    });

    // --- 3. ИНВЕНТАРЬ И КНОПКА КРАФТА ---
    const rightBlockX = statsX + statsW + gapPanels;
    const invBgY = hudBottomY - invBgH;

    // Смещение кнопки крафта "M" строго над первым слотом
    const btnX = rightBlockX + paddingX + (slotSize / 2) - (craftBtnSize / 2);
    const btnY = invBgY - craftBtnSize - 8 * uiScale;

    clickZones.craftBtn = { x: btnX, y: btnY, w: craftBtnSize, h: craftBtnSize };

    if (images.craft && images.craft.complete) {
        ctx.drawImage(images.craft, btnX, btnY, craftBtnSize, craftBtnSize);
    } else {
        ctx.fillStyle = '#ccc'; roundRect(ctx, btnX, btnY, craftBtnSize, craftBtnSize, 10); ctx.fill();
    }

    // Подложка инвентаря
    ctx.fillStyle = HUD_CONFIG.colors.slotBg;
    roundRect(ctx, rightBlockX, invBgY, inventoryWidth, invBgH, 12 * uiScale);
    ctx.fill();
    ctx.strokeStyle = HUD_CONFIG.colors.stroke;
    ctx.lineWidth = Math.max(2, 3 * uiScale);
    ctx.stroke();

    // Сетка слотов (3х2)
    for (let i = 0; i < state.player.inventory.length; i++) {
        if (i >= 6) break;

        const col = i % 3;
        const row = Math.floor(i / 3);
        const slotX = rightBlockX + paddingX + col * (slotSize + slotGap);
        const slotY = invBgY + paddingY + row * (slotSize + slotGap);

        clickZones.slots.push({ x: slotX, y: slotY, w: slotSize, h: slotSize });

        ctx.save();
        if (i === state.player.selectedSlot) {
            ctx.shadowColor = HUD_CONFIG.colors.slotHighlight;
            ctx.shadowBlur = 10 * uiScale;
            ctx.translate(0, -4 * uiScale); // Эффект прыжка выбранного слота
        }

        if (images.slot && images.slot.complete) {
            ctx.drawImage(images.slot, slotX, slotY, slotSize, slotSize);
        } else {
            ctx.fillStyle = '#ddd'; ctx.fillRect(slotX, slotY, slotSize, slotSize);
            ctx.strokeRect(slotX, slotY, slotSize, slotSize);
        }

        ctx.shadowBlur = 0;

        // Предмет внутри слота
        const slotData = state.player.inventory[i];
        if (slotData && slotData.type) {
            const img = images[slotData.type];
            if (img && img.complete) {
                const itemPadding = slotSize * 0.15;
                ctx.drawImage(img, slotX + itemPadding, slotY + itemPadding, slotSize - itemPadding * 2, slotSize - itemPadding * 2);
            }
            if (slotData.count > 1) {
                ctx.fillStyle = HUD_CONFIG.colors.text;
                ctx.font = `700 ${14 * uiScale}px "Comic Neue", cursive`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(slotData.count, slotX + slotSize - 6 * uiScale, slotY + slotSize - 4 * uiScale);
            }
        }
        ctx.restore();
    }

    // --- 4. МОДАЛКА КРАФТА ---
    if (isCraftModalOpen) {
        drawCraftModal(ctx, canvasWidth, canvasHeight, uiScale);
    }

    // --- 5. НОЧНОЕ ЗАТЕМНЕНИЕ ХУДА ---
    if (state.isNight) {
        const halfDay = GAME_SETTINGS.dayNightCycle / 2;
        const nightProgress = (state.time - halfDay) / halfDay;
        
        // Максимальное приглушение яркости интерфейса ночью — 30% (чтобы оставался читаемым)
        let hudNightOpacity = 0.30; 
        if (nightProgress < 0.1) hudNightOpacity = (nightProgress / 0.1) * 0.30;
        if (nightProgress > 0.9) hudNightOpacity = ((1 - nightProgress) / 0.1) * 0.30;

        ctx.save();
        ctx.fillStyle = `rgba(5, 5, 25, ${hudNightOpacity})`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
    }
}

function drawCraftModal(ctx, cw, ch, uiScale) {
    const modW = 650 * uiScale, modH = 460 * uiScale;
    const modX = cw / 2 - modW / 2;
    const modY = ch / 2 - modH / 2;

    clickZones.modalBody = { x: modX, y: modY, w: modW, h: modH };

    if (images.hudstat && images.hudstat.complete) {
        ctx.drawImage(images.hudstat, modX, modY, modW, modH);
    }

    // Кнопка закрытия окна (Х)
    const closeR = 15 * uiScale;
    const closeX = modX + modW - 30 * uiScale;
    const closeY = modY + 30 * uiScale;
    clickZones.modalClose = { x: closeX - closeR, y: closeY - closeR, w: closeR * 2, h: closeR * 2 };

    ctx.beginPath(); ctx.arc(closeX, closeY, closeR, 0, Math.PI * 2);
    ctx.strokeStyle = HUD_CONFIG.colors.modalStroke; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
    ctx.font = `700 ${16 * uiScale}px "Comic Neue", cursive`;
    ctx.fillStyle = HUD_CONFIG.colors.text; ctx.fillText('X', closeX, closeY + 1);

    // Вкладки категорий крафта
    let tabX = modX + 35 * uiScale;
    const tabY = modY + 30 * uiScale;
    const categories = Object.keys(GAME_SETTINGS.crafting);

    categories.forEach(cat => {
        const title = cat === 'weapons' ? 'ОРУЖИЕ' : 'ИНСТРУМЕНТЫ';
        ctx.font = `700 ${15 * uiScale}px "Comic Neue", cursive`;
        const textW = ctx.measureText(title).width;
        const tabW = textW + 30 * uiScale;
        const tabH = 35 * uiScale;

        clickZones.modalTabs.push({ x: tabX, y: tabY, w: tabW, h: tabH, cat: cat });

        ctx.fillStyle = currentCraftCategory === cat ? HUD_CONFIG.colors.dayLight : '#fff';
        roundRect(ctx, tabX, tabY, tabW, tabH, 8 * uiScale); ctx.fill(); ctx.stroke();

        ctx.fillStyle = HUD_CONFIG.colors.text;
        ctx.fillText(title, tabX + tabW / 2, tabY + tabH / 2 + 1);

        tabX += tabW + 12 * uiScale;
    });

    // Разделительная черта
    ctx.beginPath(); 
    ctx.moveTo(modX + 35 * uiScale, tabY + 48 * uiScale); 
    ctx.lineTo(modX + modW - 35 * uiScale, tabY + 48 * uiScale); 
    ctx.stroke();

    // Список доступных рецептов
    const recipes = GAME_SETTINGS.crafting[currentCraftCategory];
    let recY = tabY + 65 * uiScale;

    recipes.forEach(recipe => {
        const recH = 70 * uiScale;
        const recW = modW - 70 * uiScale;

        ctx.fillStyle = '#fff';
        roundRect(ctx, modX + 35 * uiScale, recY, recW, recH, 12 * uiScale); ctx.fill(); ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = HUD_CONFIG.colors.text;
        ctx.font = `700 ${18 * uiScale}px "Comic Neue", cursive`;
        ctx.fillText(recipe.name, modX + 50 * uiScale, recY + 22 * uiScale);

        let costStr = Object.entries(recipe.cost).map(([id, amt]) => `${GAME_SETTINGS.items[id].name}: ${amt}`).join(', ');
        ctx.font = `700 ${13 * uiScale}px "Comic Neue", cursive`;
        ctx.fillStyle = '#444';
        ctx.fillText(costStr, modX + 50 * uiScale, recY + 48 * uiScale);

        const canCraft = state.player && Object.entries(recipe.cost).every(([id, amt]) => state.player.countItem(id) >= amt);

        const btnW = 100 * uiScale, btnH = 40 * uiScale;
        const btnX = modX + 35 * uiScale + recW - btnW - 15 * uiScale;
        const btnY = recY + (recH - btnH) / 2;

        clickZones.modalRecipes.push({ x: btnX, y: btnY, w: btnW, h: btnH, canCraft: canCraft, recipe: recipe });

        ctx.save();
        if (!canCraft) ctx.globalAlpha = 0.45;
        
        if (images.craft && images.craft.complete) {
            ctx.drawImage(images.craft, btnX, btnY, btnW, btnH);
        } else {
            ctx.fillStyle = HUD_CONFIG.colors.dayLight;
            roundRect(ctx, btnX, btnY, btnW, btnH, 8 * uiScale); ctx.fill(); ctx.stroke();
        }

        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.fillStyle = HUD_CONFIG.colors.text; 
        ctx.font = `700 ${13 * uiScale}px "Comic Neue", cursive`;
        ctx.fillText('СОЗДАТЬ', btnX + btnW / 2, btnY + btnH / 2 + 1);
        ctx.restore();

        recY += recH + 12 * uiScale;
    });
}