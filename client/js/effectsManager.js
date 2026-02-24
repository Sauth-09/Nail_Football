/**
 * effectsManager.js - Oyun Heyecan Efektleri
 * 
 * Kıvılcım, hız izi, ekran sarsıntısı, kale yırtılma,
 * slow-motion, top parlaması, near-miss ve ses varyasyonları.
 * Tüm efektler ayarlardan tek tek açılıp kapatılabilir.
 * 
 * Speed normalization:
 * - Collision event speed = velocity magnitude (0-800)
 * - Frame delta speed = position change per frame (0-15)
 * Two different ranges, normalized separately.
 */

'use strict';

const EffectsManager = (() => {
    // ═══════════════════════════════════════════
    // Ayarlar (hepsi varsayılan açık)
    // ═══════════════════════════════════════════

    const settings = {
        sparks: true,
        speedTrail: true,
        screenShake: true,
        goalNetRip: true,
        goalSlowMo: true,
        ballGlow: true,
        nearMiss: true,
        hitSounds: true
    };

    // Normalize collision speed (velocity: 0-800) to 0-1
    function normCollision(speed) {
        return Math.min(1, speed / 400);
    }

    // Normalize frame-delta speed (0-15) to 0-1
    function normFrame(speed) {
        return Math.min(1, speed / 10);
    }

    // ═══════════════════════════════════════════
    // Hız İzi (Speed Trail)
    // ═══════════════════════════════════════════

    const trail = [];
    const MAX_TRAIL = 18;

    function updateTrail(x, y, speed) {
        if (!settings.speedTrail) { trail.length = 0; return; }
        const n = normFrame(speed);
        if (n < 0.15) {
            // Slowly fade out existing trail
            if (trail.length > 0) trail.shift();
            return;
        }

        trail.push({ x, y, intensity: n });
        while (trail.length > MAX_TRAIL) trail.shift();
    }

    function drawTrail(ctx, scaleX, scaleY) {
        if (!settings.speedTrail || trail.length < 3) return;
        const scale = Math.min(scaleX, scaleY);

        for (let i = 0; i < trail.length; i++) {
            const t = trail[i];
            const progress = i / trail.length;
            const alpha = t.intensity * progress * 0.7;
            const radius = (1 + progress * 6) * scale / 5;

            ctx.beginPath();
            ctx.arc(t.x * scaleX, t.y * scaleY, radius, 0, Math.PI * 2);

            // Gradient: cool blue → hot orange based on intensity
            const r = Math.floor(100 + t.intensity * 155);
            const g = Math.floor(80 + (1 - t.intensity) * 100);
            const b = Math.floor(200 * (1 - t.intensity));
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fill();
        }

        // Draw connecting line for smoother trail
        if (trail.length > 2) {
            ctx.beginPath();
            ctx.moveTo(trail[0].x * scaleX, trail[0].y * scaleY);
            for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x * scaleX, trail[i].y * scaleY);
            }
            const lastIntensity = trail[trail.length - 1].intensity;
            ctx.strokeStyle = `rgba(255, 180, 50, ${lastIntensity * 0.3})`;
            ctx.lineWidth = 2 * scale / 5;
            ctx.stroke();
        }
    }

    function clearTrail() {
        trail.length = 0;
    }

    // ═══════════════════════════════════════════
    // Kıvılcım (Sparks)
    // ═══════════════════════════════════════════

    function triggerSparks(x, y, speed) {
        if (!settings.sparks) return;
        const n = normCollision(speed);
        if (n < 0.2) return;

        const count = Math.floor(3 + n * 12);
        const sparkSpeed = 1.5 + n * 5;
        const life = 15 + n * 20;
        const colors = ['#FFD700', '#FFA500', '#FF6347', '#FFFF00', '#FF4500'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        AnimationManager.spawnParticles(x, y, color, count, sparkSpeed, life);

        // Extra bright flash at impact point for strong hits
        if (n > 0.6) {
            AnimationManager.spawnParticles(x, y, '#FFFFFF', 2, 1, 8);
        }
    }

    // ═══════════════════════════════════════════
    // Ekran Sarsıntısı
    // ═══════════════════════════════════════════

    function triggerShake(speed) {
        if (!settings.screenShake) return;
        const n = normCollision(speed);
        if (n < 0.3) return;

        AnimationManager.startShake(
            Math.floor(2 + n * 6),
            Math.floor(6 + n * 12)
        );
    }

    // ═══════════════════════════════════════════
    // Top Parlaması (Ball Glow)
    // ═══════════════════════════════════════════

    let currentBallGlow = 0;

    function updateBallGlow(speed) {
        if (!settings.ballGlow) { currentBallGlow = 0; return; }
        const target = normFrame(speed);
        currentBallGlow += (target - currentBallGlow) * 0.15;
    }

    function getBallGlow() {
        return settings.ballGlow ? currentBallGlow : 0;
    }

    function drawBallGlow(ctx, x, y, radius, scaleX, scaleY) {
        if (!settings.ballGlow || currentBallGlow < 0.05) return;

        const cx = x * scaleX;
        const cy = y * scaleY;
        const r = radius * Math.min(scaleX, scaleY);
        const glowRadius = r * (1.5 + currentBallGlow * 4);

        const gradient = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowRadius);
        gradient.addColorStop(0, `rgba(255, 200, 50, ${currentBallGlow * 0.5})`);
        gradient.addColorStop(0.4, `rgba(255, 120, 20, ${currentBallGlow * 0.25})`);
        gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');

        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    // ═══════════════════════════════════════════
    // Kale Ağı Yırtılma
    // ═══════════════════════════════════════════

    const netRip = {
        active: false,
        timer: 0,
        duration: 90,
        x: 0, y: 0, side: ''
    };

    function triggerNetRip(side, fieldWidth, fieldHeight) {
        if (!settings.goalNetRip) return;
        netRip.active = true;
        netRip.timer = netRip.duration;
        netRip.side = side;
        netRip.x = side === 'left' ? 0 : fieldWidth;
        netRip.y = fieldHeight / 2;
    }

    function updateNetRip() {
        if (!netRip.active) return;
        netRip.timer--;
        if (netRip.timer <= 0) netRip.active = false;
    }

    function drawNetRip(ctx, scaleX, scaleY) {
        if (!netRip.active || !settings.goalNetRip) return;

        const progress = 1 - netRip.timer / netRip.duration;
        const cx = netRip.x * scaleX;
        const cy = netRip.y * scaleY;
        const scale = Math.min(scaleX, scaleY);

        // Expanding shockwave
        const maxRadius = 60 * scale;
        const radius = progress * maxRadius;
        const alpha = Math.max(0, 1 - progress) * 0.8;

        ctx.save();

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1, 4 * (1 - progress));
        ctx.stroke();

        // Second ring
        if (progress < 0.7) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.6})`;
            ctx.lineWidth = Math.max(1, 2 * (1 - progress));
            ctx.stroke();
        }

        // Central flash
        if (progress < 0.25) {
            const flashAlpha = (1 - progress / 0.25) * 0.8;
            const fRadius = maxRadius * 0.4 * (1 - progress / 0.25);
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, fRadius);
            gradient.addColorStop(0, `rgba(255, 255, 220, ${flashAlpha})`);
            gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
            ctx.beginPath();
            ctx.arc(cx, cy, fRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Tear lines radiating from center
        if (progress < 0.5) {
            const tearAlpha = Math.max(0, 1 - progress / 0.5) * 0.7;
            ctx.strokeStyle = `rgba(255, 255, 255, ${tearAlpha})`;
            ctx.lineWidth = 2;
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI * 2 * i / 10) + progress * 1.5;
                const innerR = 5 * scale;
                const outerR = (15 + progress * 50) * scale;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
                ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ═══════════════════════════════════════════
    // Slow-Motion
    // ═══════════════════════════════════════════

    let slowMo = { active: false, factor: 1.0, timer: 0, duration: 0 };

    function triggerSlowMo(duration = 60, factor = 0.25) {
        if (!settings.goalSlowMo) return;
        slowMo.active = true;
        slowMo.factor = factor;
        slowMo.timer = duration;
        slowMo.duration = duration;
    }

    function updateSlowMo() {
        if (!slowMo.active) return;
        slowMo.timer--;
        // Ease back to normal in last 40%
        if (slowMo.timer < slowMo.duration * 0.4) {
            const t = slowMo.timer / (slowMo.duration * 0.4);
            slowMo.factor = 0.25 + (1.0 - 0.25) * (1 - t);
        }
        if (slowMo.timer <= 0) {
            slowMo.active = false;
            slowMo.factor = 1.0;
        }
    }

    function getSlowMoFactor() {
        return slowMo.active ? slowMo.factor : 1.0;
    }

    function isSlowMoActive() {
        return slowMo.active;
    }

    // ═══════════════════════════════════════════
    // Near-Miss
    // ═══════════════════════════════════════════

    const nearMissState = {
        active: false,
        timer: 0,
        duration: 70
    };

    function checkNearMiss(ballX, ballY, field) {
        if (!settings.nearMiss || !field || nearMissState.active) return;

        const goalDepth = field.goalDepth || 30;
        const goalW = field.goalWidth || 120;
        const goalTop = (field.fieldHeight - goalW) / 2;
        const goalBottom = (field.fieldHeight + goalW) / 2;
        const margin = 25; // Detection margin

        // Near left goal post (top or bottom)
        if (ballX < goalDepth + margin) {
            if ((ballY > goalTop - margin && ballY < goalTop + 5) ||
                (ballY > goalBottom - 5 && ballY < goalBottom + margin)) {
                fireNearMiss();
            }
        }
        // Near right goal post
        if (ballX > field.fieldWidth - goalDepth - margin) {
            if ((ballY > goalTop - margin && ballY < goalTop + 5) ||
                (ballY > goalBottom - 5 && ballY < goalBottom + margin)) {
                fireNearMiss();
            }
        }
    }

    function fireNearMiss() {
        if (nearMissState.active) return;
        nearMissState.active = true;
        nearMissState.timer = nearMissState.duration;
    }

    function updateNearMiss() {
        if (!nearMissState.active) return;
        nearMissState.timer--;
        if (nearMissState.timer <= 0) nearMissState.active = false;
    }

    function drawNearMiss(ctx, scaleX, scaleY, canvasWidth, canvasHeight) {
        if (!nearMissState.active || !settings.nearMiss) return;

        const progress = 1 - nearMissState.timer / nearMissState.duration;
        // Fade in fast, stay, fade out
        let alpha;
        if (progress < 0.15) alpha = progress / 0.15;
        else if (progress < 0.6) alpha = 1;
        else alpha = Math.max(0, 1 - (progress - 0.6) / 0.4);

        const bounce = Math.sin(progress * Math.PI * 3) * (1 - progress) * 5;
        const scaleAnim = 1 + Math.sin(progress * Math.PI) * 0.15;

        ctx.save();
        const cx = canvasWidth / 2;
        const cy = canvasHeight * 0.35 + bounce;

        const fontSize = Math.floor(28 * scaleAnim * Math.min(scaleX, scaleY) / 3);
        ctx.font = `900 ${fontSize}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer glow
        ctx.shadowColor = 'rgba(255, 200, 0, 0.6)';
        ctx.shadowBlur = 15;

        // Text stroke
        ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
        ctx.lineWidth = 3;
        ctx.strokeText('YAKINNN!', cx, cy);

        // Main text with gradient
        ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
        ctx.fillText('YAKINNN!', cx, cy);

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ═══════════════════════════════════════════
    // Çarpma Ses Varyasyonları
    // ═══════════════════════════════════════════

    function playHitSound(type, speed) {
        if (!settings.hitSounds) {
            if (type === 'nail') SoundManager.playNailHit();
            else if (type === 'wall') SoundManager.playWallHit();
            else if (type === 'goalkeeper') SoundManager.playWallHit(); // Fallback
            return;
        }

        const n = normCollision(speed);

        if (type === 'nail') {
            const baseFreq = 500 + n * 800;
            const volume = 0.1 + n * 0.2;
            SoundManager.playTone(baseFreq, baseFreq * 0.6, 0.03 + n * 0.05, 'square', volume);
            if (n > 0.5) {
                SoundManager.playTone(1200 + Math.random() * 600, 600, 0.02, 'sawtooth', 0.06);
            }
        } else if (type === 'wall') {
            const baseFreq = 120 + n * 130;
            const volume = 0.12 + n * 0.18;
            SoundManager.playTone(baseFreq, baseFreq * 0.3, 0.06 + n * 0.08, 'sine', volume);
        } else if (type === 'goalkeeper') {
            // Metallic THUD sound
            const baseFreq = 150 + n * 100;
            const volume = 0.2 + n * 0.2;
            SoundManager.playTone(baseFreq, baseFreq * 0.4, 0.08 + n * 0.1, 'square', volume);
            if (n > 0.4) {
                // Secondary metallic ring
                SoundManager.playTone(800 + Math.random() * 200, 400, 0.05, 'sine', 0.05);
            }
        }
    }

    // ═══════════════════════════════════════════
    // Slow-Mo Frame Counter (deterministic)
    // ═══════════════════════════════════════════

    let slowMoAccum = 0;

    function shouldAdvanceFrame() {
        if (!slowMo.active) return true;
        slowMoAccum += slowMo.factor;
        if (slowMoAccum >= 1.0) {
            slowMoAccum -= 1.0;
            return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════
    // Public Update/Draw
    // ═══════════════════════════════════════════

    function update() {
        updateNetRip();
        updateSlowMo();
        updateNearMiss();
    }

    function draw(ctx, scaleX, scaleY, canvasWidth, canvasHeight) {
        drawNetRip(ctx, scaleX, scaleY);
        drawNearMiss(ctx, scaleX, scaleY, canvasWidth || 800, canvasHeight || 500);
    }

    function drawBeforeBall(ctx, ballX, ballY, ballRadius, scaleX, scaleY) {
        drawTrail(ctx, scaleX, scaleY);
        drawBallGlow(ctx, ballX, ballY, ballRadius, scaleX, scaleY);
    }

    // ═══════════════════════════════════════════
    // Settings
    // ═══════════════════════════════════════════

    function setSetting(key, value) {
        if (key in settings) settings[key] = value;
    }

    function getSetting(key) {
        return settings[key];
    }

    function getSettings() {
        return { ...settings };
    }

    return {
        setSetting, getSetting, getSettings,
        update, draw, drawBeforeBall,
        updateTrail, clearTrail,
        triggerSparks, triggerShake,
        updateBallGlow, getBallGlow,
        triggerNetRip,
        triggerSlowMo, getSlowMoFactor, isSlowMoActive, shouldAdvanceFrame,
        checkNearMiss,
        playHitSound
    };
})();
