import { state } from './config.js';

export function resolveCollision(entity, other) {
    const dx = entity.x - other.x;
    const dy = entity.y - other.y;
    const dist = Math.hypot(dx, dy);
    const minDist = entity.colRadius + (other.colRadius || 0);
    
    if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
    }
}

export function drawSlimeTrail(ctx, points) {
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 0, 150, 0.6)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineWidth = (i / points.length) * 22;
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(139, 0, 139, 0.3)';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineWidth = (i / points.length) * 30;
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
}

export function createParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
        state.particles.push({
            x, y, 
            vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
            life: 1, size: Math.random() * 5 + 2, color
        });
    }
}