export const WORLD_SIZE = 5000;
export const TILE_SIZE = 150;

export const TEXTURE_URLS = {
    floor: 'img/BG.png',
    player: 'img/player.png',
    tree: 'img/tree.png',
    stone: 'img/stone.png',
    bush: 'img/bush.png',
    greed: 'img/greed.png',
    lake: 'img/water.png',
    wood: 'https://placehold.co/100x100/8B4513/FFF?text=Wood',
    berries: 'https://placehold.co/100x100/f00/FFF?text=Berry',
    sword: 'https://placehold.co/100x100/777/FFF?text=Sword',
    axe: 'https://placehold.co/100x100/777/FFF?text=Axe',
    pickaxe: 'https://placehold.co/100x100/777/FFF?text=Pick',
    hand: 'img/hand.png'
};

export const ENTITY_DATA = {
    'tree': { 
        maxHp: 300, 
        drop: 'wood', 
        dropRange: [5, 15], 
        renderRad: 80, 
        colRadius: 44, 
        weight: 40,
        requiredTool: 'axe', 
        textures: [
            { hp: 100, src: 'tree' },
            { hp: 50, src: 'tree' } 
        ] 
    },
    'stone': { 
        maxHp: 500, 
        drop: 'stone', 
        dropRange: [3, 10], 
        renderRad: 60, 
        colRadius: 54, 
        weight: 25,
        requiredTool: 'pickaxe', 
        textures: [
            { hp: 100, src: 'stone' }
        ] 
    },
    'bush': { 
        maxHp: 50, 
        drop: 'berries', 
        dropRange: [1, 3], 
        renderRad: 50, 
        colRadius: 25, 
        weight: 30,
        requiredTool: null, 
        textures: [
            { hp: 100, src: 'bush' }
        ] 
    }
};

export const GAME_SETTINGS = {
    dayNightCycle: 12000, 
    player: { 
        equipTime: 60, 
        eatTime: 90, 
        passiveHpRegen: 0.015,
        baseSpeed: 1.4,
        sprintMultiplier: 1.7,
        colRadius: 30,
        unarmedDamage: 10 
    },
    greed: {
        hp: 100,
        colRadius: 20,
        renderRad: 30,
        damage: 8,
        attackCooldown: 60,
        speedNormal: 4.5,
        speedFlee: 6.5
    },
    items: {
        wood: { name: "Дерево", maxStack: 100, heal: 0, equippable: false },
        stone: { name: "Камень", maxStack: 100, heal: 0, equippable: false },
        berries: { name: "Ягоды", maxStack: 20, heal: 15, equippable: true },
        sword: { name: "Меч", maxStack: 1, heal: 0, equippable: true, damage: 60, toolTier: 'sword' },
        axe: { name: "Топор", maxStack: 1, heal: 0, equippable: true, damage: 25, toolTier: 'axe' },
        pickaxe: { name: "Кирка", maxStack: 1, heal: 0, equippable: true, damage: 25, toolTier: 'pickaxe' }
    },
    crafting: {
        weapons: [
            { id: 'sword', name: 'Деревянный меч', cost: { wood: 15, stone: 5 } }
        ],
        tools: [
            { id: 'axe', name: 'Топор', cost: { wood: 10, stone: 2 } },
            { id: 'pickaxe', name: 'Кирка', cost: { wood: 10, stone: 10 } }
        ]
    }
};

export const images = {};
export const shadowCache = {};
export const state = {
    objects: [], particles: [], greeds: [],
    camera: { x: 0, y: 0 },
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
    keys: {},
    time: 0, isNight: false,
    floorPattern: null, player: null
};

export function loadTextures(ctx, callback) {
    let loaded = 0;
    const keys = Object.keys(TEXTURE_URLS);
    keys.forEach(key => {
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        img.src = TEXTURE_URLS[key];
        img.onload = () => {
            images[key] = img;
            
            // Оптимизация: Тени в 4 раза меньше оригинала для FPS
            const shadowSize = 128; 
            const offscreen = document.createElement('canvas');
            const oCtx = offscreen.getContext('2d');
            offscreen.width = shadowSize;
            offscreen.height = shadowSize;
            
            // Рисуем уменьшенный силуэт
            oCtx.drawImage(img, 0, 0, shadowSize, shadowSize);
            oCtx.globalCompositeOperation = 'source-in';
            oCtx.fillStyle = '#000000';
            oCtx.fillRect(0, 0, shadowSize, shadowSize);
            shadowCache[key] = offscreen;

            loaded++;
            if (key === 'floor') state.floorPattern = ctx.createPattern(img, 'repeat');
            if (loaded === keys.length) callback();
        };
        img.onerror = () => { loaded++; if (loaded === keys.length) callback(); };
    });
}