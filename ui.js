import { state, GAME_SETTINGS, images } from './config.js';

let currentCategory = 'weapons';

export function initUI() {
    const craftModal = document.getElementById('craft-modal');
    document.getElementById('craft-btn').addEventListener('click', () => {
        craftModal.style.display = craftModal.style.display === 'flex' ? 'none' : 'flex';
        renderCrafting();
    });
    document.getElementById('close-craft').addEventListener('click', () => craftModal.style.display = 'none');

    document.querySelectorAll('.slot').forEach((slot) => {
        slot.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !state.player) return;
            const index = parseInt(slot.dataset.index);
            state.player.selectSlot(index);
            updateUI();
        });
    });
}

export function renderCrafting() {
    const craftNav = document.getElementById('craft-nav');
    const craftList = document.getElementById('craft-list');
    
    craftNav.innerHTML = '';
    Object.keys(GAME_SETTINGS.crafting).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `craft-tab sketch-text ${cat === currentCategory ? 'active' : ''}`;
        
        const titles = { 'weapons': 'ОРУЖИЕ', 'tools': 'ИНСТРУМЕНТЫ' };
        btn.innerText = titles[cat] || cat.toUpperCase();
        
        btn.onclick = () => { currentCategory = cat; renderCrafting(); };
        craftNav.appendChild(btn);
    });

    craftList.innerHTML = '';
    GAME_SETTINGS.crafting[currentCategory].forEach(recipe => {
        const div = document.createElement('div');
        div.className = 'craft-item';
        
        let costStr = Object.entries(recipe.cost).map(([id, amt]) => `${GAME_SETTINGS.items[id].name}: ${amt}`).join(', ');
        const canCraft = state.player && Object.entries(recipe.cost).every(([id, amt]) => state.player.countItem(id) >= amt);
        
        div.innerHTML = `
            <div>
                <strong style="font-size: 18px; color: #000;">${recipe.name}</strong><br>
                <span style="font-size: 14px; color: #333;">${costStr}</span>
            </div>
            <button class="craft-do sketch-text" ${!canCraft ? 'disabled' : ''}>СОЗДАТЬ</button>
        `;
        
        div.querySelector('.craft-do').onclick = () => {
            if (canCraft) {
                Object.entries(recipe.cost).forEach(([id, amt]) => state.player.removeFromInventory(id, amt));
                state.player.addToInventory(recipe.id, 1);
                renderCrafting();
            }
        };
        craftList.appendChild(div);
    });
}

export function updateUI() {
    if (!state.player) return;
    
    // 1. Обновляем полоски статов (ширину)
    const hpPct = Math.max(0, (state.player.hp / state.player.maxHp) * 100);
    const stamPct = Math.max(0, (state.player.stamina / state.player.maxStamina) * 100);
    const waterPct = Math.max(0, (state.player.water / state.player.maxWater) * 100);

    document.getElementById('fill-hp').style.width = hpPct + '%';
    document.getElementById('fill-stamina').style.width = stamPct + '%';
    document.getElementById('fill-water').style.width = waterPct + '%';

    // 2. Обновляем текст поверх полосок (текущее/макс)
    document.getElementById('text-hp').innerText = `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`;
    document.getElementById('text-stamina').innerText = `${Math.ceil(state.player.stamina)} / ${state.player.maxStamina}`;
    document.getElementById('text-water').innerText = `${Math.ceil(state.player.water)} / ${state.player.maxWater}`;

    // 3. Обновляем инвентарь (теперь 6 слотов)
    state.player.inventory.forEach((slotData, index) => {
        const slotEl = document.querySelectorAll('.slot')[index];
        // Предотвращаем ошибку, если в конфиге инвентарь больше 6
        if (!slotEl) return; 

        const imgEl = document.getElementById(`img-${index}`);
        const countEl = document.getElementById(`cnt-${index}`);
        
        if (index === state.player.selectedSlot) {
            slotEl.classList.add('selected');
        } else {
            slotEl.classList.remove('selected');
        }

        if (slotData.type) {
            imgEl.src = images[slotData.type] ? images[slotData.type].src : '';
            imgEl.style.opacity = '1';
            countEl.innerText = slotData.count > 1 ? slotData.count : '';
        } else {
            countEl.innerText = '';
            imgEl.style.opacity = '0';
        }
    });

    // 4. Обновляем стрелку времени (Гаусс)
    // Угол от -90 (утро) до +90 (вечер). Полдень (середина) = 0.
    const dayProgress = state.time / GAME_SETTINGS.dayNightCycle;
    const angle = (dayProgress * 180) - 90;
    document.getElementById('time-needle').style.transform = `translateX(-50%) rotate(${angle}deg)`;

    // 5. Полоса применения предмета
    const actionBar = document.getElementById('action-bar-container');
    if (state.player.actionTimer > 0) {
        actionBar.style.display = 'block';
        document.getElementById('action-fill').style.width = `${100 - (state.player.actionTimer / state.player.actionTotal) * 100}%`;
        document.getElementById('action-text').innerText = state.player.actionType === 'eat' ? 'ПОЕДАНИЕ...' : 'ЭКИПИРОВКА...';
    } else {
        actionBar.style.display = 'none';
    }
}