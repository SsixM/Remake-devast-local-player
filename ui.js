import { state, GAME_SETTINGS, images } from './config.js';

export const HUD_CONFIG = {
    colors: {
        text: '#000',
        hpFill: 'rgba(119, 221, 119, 0.25)', 
        waterFill: 'rgba(119, 170, 255, 0.25)', 
        staminaFill: 'rgba(255, 187, 85, 0.25)',
        stroke: '#000000',
        modalStroke: '#000000',
        slotBg: 'rgba(250, 245, 230, 0.85)',
        slotHighlight: 'rgba(255, 215, 0, 0.6)',
        dayLight: '#fffaaa'
    }
};

let isCraftModalOpen = false;
let currentCraftCategory = 'weapons';

let clickZones = {
    slots: [], craftBtn: null, modalClose: null, modalTabs: [], modalRecipes: [], modalBody: null
};

function inRect(x, y, rect) {
    if (!rect) return false;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function roundRect(ctx, x, y, w, h, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}

export function handleUIClick(x, y) {
    if (!state.player) return false;
    if (isCraftModalOpen) {
        if (inRect(x, y, clickZones.modalClose)) { isCraftModalOpen = false; return true; }
        for (let i = 0; i < clickZones.modalTabs.length; i++) {
            if (inRect(x, y, clickZones.modalTabs[i])) { currentCraftCategory = clickZones.modalTabs[i].cat; return true; }
        }
        for (let i = 0; i < clickZones.modalRecipes.length; i++) {
            let zone = clickZones.modalRecipes[i];
            if (inRect(x, y, zone) && zone.canCraft) {
                Object.entries(zone.recipe.cost).forEach(([id, amt]) => state.player.removeFromInventory(id, amt));
                state.player.addToInventory(zone.recipe.id, 1); return true;
            }
        }
        if (inRect(x, y, clickZones.modalBody)) return true;
    }
    if (inRect(x, y, clickZones.craftBtn)) { isCraftModalOpen = !isCraftModalOpen; return true; }
    for (let i = 0; i < clickZones.slots.length; i++) {
        if (inRect(x, y, clickZones.slots[i])) { state.player.selectSlot(i); return true; }
    }
    return false;
}

export function drawUI(ctx, canvasWidth, canvasHeight) {
    if (!state.player) return;

    const uiScale = Math.max(0.65, Math.min(1.1, canvasWidth / 1440));
    const slotSize = 70 * uiScale;
    const slotGap = 8 * uiScale;
    const craftBtnSize = 80 * uiScale;
    
    const gaugeW = 270 * uiScale;
    const gaugeH = gaugeW * (191 / 675);
    const statsW = 540 * uiScale;
    const statsH = statsW * (464 / 2284);

    const paddingX = 12 * uiScale;
    const paddingY = 12 * uiScale;
    const inventoryWidth = (3 * slotSize) + (2 * slotGap) + (paddingX * 2);
    const invBgH = (2 * slotSize) + (1 * slotGap) + (paddingY * 2);

    const gapPanels = 25 * uiScale;
    const bottomOffset = 20 * uiScale;

    const totalHudWidth = gaugeW + gapPanels + statsW + gapPanels + inventoryWidth;
    const startX = canvasWidth / 2 - totalHudWidth / 2;
    const hudBottomY = canvasHeight - bottomOffset;

    clickZones.slots = []; clickZones.modalTabs = []; clickZones.modalRecipes = [];

    // --- ПОЛОСА ДЕЙСТВИЯ ---
    if (state.player.actionTimer > 0) {
        const barW = 200 * uiScale, barH = 10 * uiScale;
        const barX = canvasWidth / 2 - barW / 2;
        const barY = canvasHeight / 2 + 120 * uiScale;
        const pct = 1 - (state.player.actionTimer / state.player.actionTotal);
        ctx.fillStyle = '#fff'; ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = HUD_CONFIG.colors.stroke; ctx.lineWidth = 2; ctx.strokeRect(barX, barY, barW, barH);
        ctx.fillStyle = HUD_CONFIG.colors.text; ctx.fillRect(barX, barY, barW * pct, barH);
        ctx.font = `700 ${14 * uiScale}px "Comic Neue", cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(state.player.actionType === 'eat' ? 'ПОЕДАНИЕ...' : 'ЭКИПИРОВКА...', canvasWidth / 2, barY - 5);
    }

    // --- ПАНЕЛЬ СУТОК ---
    const gaugeX = startX; const gaugeY = hudBottomY - gaugeH;
    if (images.gauge?.complete) ctx.drawImage(images.gauge, gaugeX, gaugeY, gaugeW, gaugeH);

    const dayProgress = state.time / GAME_SETTINGS.dayNightCycle;
    const angle = (dayProgress * Math.PI) - (Math.PI / 2); 
    const pivotX = gaugeX + gaugeW / 2; const pivotY = gaugeY + gaugeH * 0.86; 
    const vectorW = 16 * uiScale; const vectorH = vectorW * (110 / 38);

    ctx.save(); ctx.translate(pivotX, pivotY); ctx.rotate(angle);
    if (images.gaugevector?.complete) ctx.drawImage(images.gaugevector, -vectorW / 2, -vectorH + (vectorW * 0.4), vectorW, vectorH);
    ctx.restore();

    // --- ПАНЕЛЬ СТАТОВ ---
    const statsX = gaugeX + gaugeW + gapPanels; const statsY = hudBottomY - statsH;

    // Сначала рисуем чистую рамку без хромакея из stat0
    if (images['stat0_clean']) {
        ctx.drawImage(images['stat0_clean'], statsX, statsY, statsW, statsH);
    }

    const statRows = [
        { val: state.player.hp, max: state.player.maxHp, color: HUD_CONFIG.colors.hpFill },
        { val: state.player.water, max: state.player.maxWater, color: HUD_CONFIG.colors.waterFill },
        { val: state.player.stamina, max: state.player.maxStamina, color: HUD_CONFIG.colors.staminaFill }
    ];

    const barRelativeX = 0.165; const barRelativeW = 0.81; const barRelativeH = 0.22;  
    const barRelativeYPositions = [0.08, 0.39, 0.70]; 

    statRows.forEach((stat, i) => {
        const barX = statsX + statsW * barRelativeX;
        const barY = statsY + statsH * barRelativeYPositions[i];
        const barW = statsW * barRelativeW;
        const barH = statsH * barRelativeH;
        const pct = Math.max(0, Math.min(1, stat.val / stat.max));

        // Рисуем задний полупрозрачный фон для пустого места шкалы
        ctx.fillStyle = 'rgba(40, 40, 40, 0.25)';
        ctx.fillRect(barX + (barW * pct), barY, barW * (1 - pct), barH);

        // Попроцентно вырезаем заполненную шкалу из исходного hudstat.jpg
        if (pct > 0 && images.hudstat?.complete) {
            const imgW = images.hudstat.width;
            const imgH = images.hudstat.height;

            const sx = imgW * barRelativeX;
            const sy = imgH * barRelativeYPositions[i];
            const sw = imgW * barRelativeW * pct;
            const sh = imgH * barRelativeH;

            ctx.drawImage(images.hudstat, sx, sy, sw, sh, barX, barY, barW * pct, barH);
        }

        // Мягкий цветовой оверлей поверх текстуры
        ctx.fillStyle = stat.color;
        ctx.fillRect(barX, barY, barW * pct, barH);

        // Текст
        ctx.fillStyle = HUD_CONFIG.colors.text;
        ctx.font = `700 ${15 * uiScale}px "Comic Neue", cursive`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(stat.val)} / ${stat.max}`, barX + barW / 2, barY + barH / 2 + 1);
    });

    // --- ИНВЕНТАРЬ И КНОПКА КРАФТА ---
    const rightBlockX = statsX + statsW + gapPanels; const invBgY = hudBottomY - invBgH;
    const btnX = rightBlockX + paddingX + (slotSize / 2) - (craftBtnSize / 2);
    const btnY = invBgY - craftBtnSize - 8 * uiScale;

    clickZones.craftBtn = { x: btnX, y: btnY, w: craftBtnSize, h: craftBtnSize };
    if (images.craft?.complete) ctx.drawImage(images.craft, btnX, btnY, craftBtnSize, craftBtnSize);

    ctx.fillStyle = HUD_CONFIG.colors.slotBg; roundRect(ctx, rightBlockX, invBgY, inventoryWidth, invBgH, 12 * uiScale); ctx.fill();
    ctx.strokeStyle = HUD_CONFIG.colors.stroke; ctx.lineWidth = Math.max(2, 3 * uiScale); ctx.stroke();

    for (let i = 0; i < state.player.inventory.length; i++) {
        if (i >= 6) break;
        const col = i % 3; const row = Math.floor(i / 3);
        const slotX = rightBlockX + paddingX + col * (slotSize + slotGap);
        const slotY = invBgY + paddingY + row * (slotSize + slotGap);

        clickZones.slots.push({ x: slotX, y: slotY, w: slotSize, h: slotSize });

        ctx.save();
        if (i === state.player.selectedSlot) {
            ctx.shadowColor = HUD_CONFIG.colors.slotHighlight; ctx.shadowBlur = 10 * uiScale; ctx.translate(0, -4 * uiScale);
        }

        if (images.slot?.complete) ctx.drawImage(images.slot, slotX, slotY, slotSize, slotSize);
        ctx.shadowBlur = 0;

        const slotData = state.player.inventory[i];
        if (slotData?.type) {
            const img = images[slotData.type];
            if (img?.complete) {
                const itemPadding = slotSize * 0.15;
                ctx.drawImage(img, slotX + itemPadding, slotY + itemPadding, slotSize - itemPadding * 2, slotSize - itemPadding * 2);
            }
            if (slotData.count > 1) {
                ctx.fillStyle = HUD_CONFIG.colors.text; ctx.font = `700 ${14 * uiScale}px "Comic Neue", cursive`;
                ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
                ctx.fillText(slotData.count, slotX + slotSize - 6 * uiScale, slotY + slotSize - 4 * uiScale);
            }
        }
        ctx.restore();
    }

    if (isCraftModalOpen) drawCraftModal(ctx, canvasWidth, canvasHeight, uiScale);

    if (state.isNight) {
        const halfDay = GAME_SETTINGS.dayNightCycle / 2;
        const nightProgress = (state.time - halfDay) / halfDay;
        let hudNightOpacity = 0.30; 
        if (nightProgress < 0.1) hudNightOpacity = (nightProgress / 0.1) * 0.30;
        if (nightProgress > 0.9) hudNightOpacity = ((1 - nightProgress) / 0.1) * 0.30;
        ctx.save(); ctx.fillStyle = `rgba(5, 5, 25, ${hudNightOpacity})`; ctx.fillRect(0, 0, canvasWidth, canvasHeight); ctx.restore();
    }
}

function drawCraftModal(ctx, cw, ch, uiScale) {
    const modW = 650 * uiScale, modH = 460 * uiScale;
    const modX = cw / 2 - modW / 2; const modY = ch / 2 - modH / 2;
    clickZones.modalBody = { x: modX, y: modY, w: modW, h: modH };

    if (images.hudstat?.complete) ctx.drawImage(images.hudstat, modX, modY, modW, modH);

    const closeR = 15 * uiScale; const closeX = modX + modW - 30 * uiScale; const closeY = modY + 30 * uiScale;
    clickZones.modalClose = { x: closeX - closeR, y: closeY - closeR, w: closeR * 2, h: closeR * 2 };

    ctx.beginPath(); ctx.arc(closeX, closeY, closeR, 0, Math.PI * 2);
    ctx.strokeStyle = HUD_CONFIG.colors.modalStroke; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${16 * uiScale}px "Comic Neue", cursive`;
    ctx.fillStyle = HUD_CONFIG.colors.text; ctx.fillText('X', closeX, closeY + 1);

    let tabX = modX + 35 * uiScale; const tabY = modY + 30 * uiScale;
    const categories = Object.keys(GAME_SETTINGS.crafting);

    categories.forEach(cat => {
        const title = cat === 'weapons' ? 'ОРУЖИЕ' : 'ИНСТРУМЕНТЫ';
        ctx.font = `700 ${15 * uiScale}px "Comic Neue", cursive`;
        const textW = ctx.measureText(title).width;
        const tabW = textW + 30 * uiScale; const tabH = 35 * uiScale;

        clickZones.modalTabs.push({ x: tabX, y: tabY, w: tabW, h: tabH, cat: cat });
        ctx.fillStyle = currentCraftCategory === cat ? HUD_CONFIG.colors.dayLight : '#fff';
        roundRect(ctx, tabX, tabY, tabW, tabH, 8 * uiScale); ctx.fill(); ctx.stroke();
        ctx.fillStyle = HUD_CONFIG.colors.text; ctx.fillText(title, tabX + tabW / 2, tabY + tabH / 2 + 1);
        tabX += tabW + 12 * uiScale;
    });

    ctx.beginPath(); ctx.moveTo(modX + 35 * uiScale, tabY + 48 * uiScale); ctx.lineTo(modX + modW - 35 * uiScale, tabY + 48 * uiScale); ctx.stroke();

    const recipes = GAME_SETTINGS.crafting[currentCraftCategory];
    let recY = tabY + 65 * uiScale;

    recipes.forEach(recipe => {
        const recH = 70 * uiScale; const recW = modW - 70 * uiScale;
        ctx.fillStyle = '#fff'; roundRect(ctx, modX + 35 * uiScale, recY, recW, recH, 12 * uiScale); ctx.fill(); ctx.stroke();

        ctx.textAlign = 'left'; ctx.fillStyle = HUD_CONFIG.colors.text; ctx.font = `700 ${18 * uiScale}px "Comic Neue", cursive`;
        ctx.fillText(recipe.name, modX + 50 * uiScale, recY + 22 * uiScale);

        let costStr = Object.entries(recipe.cost).map(([id, amt]) => `${GAME_SETTINGS.items[id].name}: ${amt}`).join(', ');
        ctx.font = `700 ${13 * uiScale}px "Comic Neue", cursive`; ctx.fillStyle = '#444';
        ctx.fillText(costStr, modX + 50 * uiScale, recY + 48 * uiScale);

        const canCraft = state.player && Object.entries(recipe.cost).every(([id, amt]) => state.player.countItem(id) >= amt);
        const btnW = 100 * uiScale, btnH = 40 * uiScale;
        const btnX = modX + 35 * uiScale + recW - btnW - 15 * uiScale; const btnY = recY + (recH - btnH) / 2;

        clickZones.modalRecipes.push({ x: btnX, y: btnY, w: btnW, h: btnH, canCraft: canCraft, recipe: recipe });

        ctx.save(); if (!canCraft) ctx.globalAlpha = 0.45;
        if (images.craft?.complete) { ctx.drawImage(images.craft, btnX, btnY, btnW, btnH); } else {
            ctx.fillStyle = HUD_CONFIG.colors.dayLight; roundRect(ctx, btnX, btnY, btnW, btnH, 8 * uiScale); ctx.fill(); ctx.stroke();
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = HUD_CONFIG.colors.text; ctx.font = `700 ${13 * uiScale}px "Comic Neue", cursive`;
        ctx.fillText('СОЗДАТЬ', btnX + btnW / 2, btnY + btnH / 2 + 1); ctx.restore();

        recY += recH + 12 * uiScale;
    });
}