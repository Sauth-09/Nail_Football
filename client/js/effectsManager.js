/**
 * effectsManager.js - Oyun Heyecan Efektleri
 * 
 * Kıvılcım, hız izi, ekran sarsıntısı, kale yırtılma,
 * slow-motion, top parlaması, near-miss ve ses varyasyonları.
 * Tüm efektler ayarlardan tek tek açılıp kapatılabilir.
 */

'use strict';

const EffectsManager = (() => {
    // ═══════════════════════════════════════════
    // Ayarlar (hepsi varsayılan açık)
    // ═══════════════════════════════════════════

    const settings = {
        sparks: true,        // Çivi kıvılcımları
        speedTrail: true,    // Hız izi
        screenShake: true,   // Ekran sarsıntısı
        goalNetRip: true,    // Kale ağı yırtılma
        goalSlowMo: true,    // Gol slow-motion
        ballGlow: true,      // Top parlaması
        nearMiss: true,      // Yakın kaçış yazısı
        hitSounds: true      // Çarpma ses varyasyonları
    };

    // ═══════════════════════════════════════════
    // Hız İzi (Speed Trail)
    // ═══════════════════════════════════════════

    const trail = [];
    const MAX_TRAIL = 12;

    function updateTrail(x, y, speed) {
        if (!settings.speedTrail) { trail.length = 0; return; }
        if (speed < 2) { trail.length = 0; return; }

        trail.push({ x, y, alpha: Math.min(1, speed / 8) });
        while (trail.length > MAX_TRAIL) trail.shift();
    }

    function drawTrail(ctx, scaleX, scaleY) {
        if (!settings.speedTrail || trail.length < 2) return;

        for (let i = 0; i < trail.length - 1; i++) {
            const t = trail[i];
            const progress = i / trail.length;
            const alpha = t.alpha * progress * 0.5;

            ctx.beginPath();
            ctx.arc(t.x * scaleX, t.y * scaleY, (2 + progress * 4) * Math.min(scaleX, scaleY) / 10, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 180, 50, ${alpha})`;
            ctx.fill();
        }
    }

    function clearTrail() {
        trail.length = 0;
    }

    // ═══════════════════════════════════════════
    // Kıvılcım (Sparks) — güçlü çivi çarpması
    // ═══════════════════════════════════════════

    function triggerSparks(x, y, speed) {
        if (!settings.sparks) return;
        const intensity = Math.min(1, speed / 8);
        if (intensity < 0.3) return; // Yavaş çarpmada kıvılcım yok

        const count = Math.floor(4 + intensity * 10);
        const sparkSpeed = 2 + intensity * 5;
        const colors = ['#FFD700', '#FFA500', '#FF6347', '#FFFF00'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        AnimationManager.spawnParticles(x, y, color, count, sparkSpeed, 20 + intensity * 15);
    }

    // ═══════════════════════════════════════════
    // Ekran Sarsıntısı — güçlü çarpmalar
    // ═══════════════════════════════════════════

    function triggerShake(speed) {
        if (!settings.screenShake) return;
        const intensity = Math.min(1, speed / 8);
        if (intensity < 0.4) return;

        AnimationManager.startShake(
            Math.floor(1 + intensity * 5),
            Math.floor(5 + intensity * 15)
        );
    }

    // ═══════════════════════════════════════════
    // Top Parlaması (Ball Glow)
    // ═══════════════════════════════════════════

    let currentBallGlow = 0;

    function updateBallGlow(speed) {
        if (!settings.ballGlow) { currentBallGlow = 0; return; }
        const target = Math.min(1, speed / 7);
        // Smooth interpolation
        currentBallGlow += (target - currentBallGlow) * 0.15;
    }

    function getBallGlow() {
        return settings.ballGlow ? currentBallGlow : 0;
    }

    function drawBallGlow(ctx, x, y, radius, scaleX, scaleY) {
        if (!settings.ballGlow || currentBallGlow < 0.1) return;

        const cx = x * scaleX;
        const cy = y * scaleY;
        const r = radius * Math.min(scaleX, scaleY);
        const glowRadius = r * (2 + currentBallGlow * 3);

        const gradient = ctx.createRadialGradient(cx, cy, r, cx, cy, glowRadius);
        gradient.addColorStop(0, `rgba(255, 200, 50, ${currentBallGlow * 0.4})`);
        gradient.addColorStop(0.5, `rgba(255, 120, 20, ${currentBallGlow * 0.15})`);
        gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');

        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    // ═══════════════════════════════════════════
    // Kale Ağı Yırtılma (Goal Net Rip)
    // ═══════════════════════════════════════════

    const netRip = {
        active: false,
        timer: 0,
        duration: 90,
        x: 0,
        y: 0,
        side: '' // 'left' or 'right'
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

        // Expanding shockwave ring
        const maxRadius = 80 * Math.min(scaleX, scaleY);
        const radius = progress * maxRadius;
        const alpha = Math.max(0, 1 - progress) * 0.7;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3 * (1 - progress);
        ctx.stroke();

        // Inner flash
        if (progress < 0.3) {
            const flashAlpha = (1 - progress / 0.3) * 0.6;
            const flashGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.8);
            flashGradient.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
            flashGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = flashGradient;
            ctx.fill();
        }

        // Torn net lines
        if (progress < 0.6) {
            const tearAlpha = Math.max(0, 1 - progress / 0.6) * 0.5;
            ctx.strokeStyle = `rgba(255, 255, 255, ${tearAlpha})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i / 8) + progress * 0.5;
                const len = 10 + progress * 40;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * len * scaleX / 3, cy + Math.sin(angle) * len * scaleY / 3);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ═══════════════════════════════════════════
    // Slow-Motion (Gol Anı)
    // ═══════════════════════════════════════════

    let slowMo = { active: false, factor: 1.0, timer: 0, duration: 0 };

    function triggerSlowMo(duration = 45, factor = 0.3) {
        if (!settings.goalSlowMo) return;
        slowMo.active = true;
        slowMo.factor = factor;
        slowMo.timer = duration;
        slowMo.duration = duration;
    }

    function updateSlowMo() {
        if (!slowMo.active) return;
        slowMo.timer--;
        // Ease back to normal speed in last third
        if (slowMo.timer < slowMo.duration / 3) {
            slowMo.factor += (1.0 - slowMo.factor) * 0.1;
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
    // Near-Miss (Yakın Kaçış)
    // ═══════════════════════════════════════════

    const nearMissState = {
        active: false,
        timer: 0,
        duration: 60,
        text: 'YAKINNN!',
        x: 0,
        y: 0
    };

    function checkNearMiss(ballX, ballY, field) {
        if (!settings.nearMiss || !field) return;

        const goalWidth = field.goalDepth || 15;
        const goalTop = field.fieldHeight / 2 - (field.goalWidth || 60) / 2;
        const goalBottom = field.fieldHeight / 2 + (field.goalWidth || 60) / 2;
        const margin = 15;

        // Near left goal
        if (ballX < goalWidth + margin && ballX > goalWidth - 5) {
            if (ballY > goalTop - margin && ballY < goalTop) {
                fireNearMiss(ballX, ballY);
            } else if (ballY > goalBottom && ballY < goalBottom + margin) {
                fireNearMiss(ballX, ballY);
            }
        }
        // Near right goal
        const rightGoalX = field.fieldWidth - goalWidth;
        if (ballX > rightGoalX - margin && ballX < rightGoalX + 5) {
            if (ballY > goalTop - margin && ballY < goalTop) {
                fireNearMiss(ballX, ballY);
            } else if (ballY > goalBottom && ballY < goalBottom + margin) {
                fireNearMiss(ballX, ballY);
            }
        }
    }

    function fireNearMiss(x, y) {
        if (nearMissState.active) return; // Don't spam
        nearMissState.active = true;
        nearMissState.timer = nearMissState.duration;
        nearMissState.x = x;
        nearMissState.y = y;
    }

    function updateNearMiss() {
        if (!nearMissState.active) return;
        nearMissState.timer--;
        if (nearMissState.timer <= 0) nearMissState.active = false;
    }

    function drawNearMiss(ctx, scaleX, scaleY) {
        if (!nearMissState.active || !settings.nearMiss) return;

        const progress = 1 - nearMissState.timer / nearMissState.duration;
        const alpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
        const yOffset = -20 * progress;
        const scale = 0.8 + progress * 0.4;

        ctx.save();
        const cx = nearMissState.x * scaleX;
        const cy = nearMissState.y * scaleY + yOffset * scaleY;

        ctx.font = `bold ${Math.floor(20 * scale * Math.min(scaleX, scaleY) / 5)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
        ctx.fillText(nearMissState.text, cx + 2, cy + 2);

        // Main text
        ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
        ctx.fillText(nearMissState.text, cx, cy);

        ctx.restore();
    }

    // ═══════════════════════════════════════════
    // Çarpma Ses Varyasyonları
    // ═══════════════════════════════════════════

    function playHitSound(type, speed) {
        if (!settings.hitSounds) {
            // Varsayılan sesler
            if (type === 'nail') SoundManager.playNailHit();
            else if (type === 'wall') SoundManager.playWallHit();
            return;
        }

        const intensity = Math.min(1, speed / 8);

        if (type === 'nail') {
            // Frekansı hıza göre değiştir
            const baseFreq = 600 + intensity * 600;
            const volume = 0.1 + intensity * 0.2;
            SoundManager.playTone(baseFreq, baseFreq * 0.7, 0.03 + intensity * 0.04, 'square', volume);

            // Güçlü çarpmada ek metalik ses
            if (intensity > 0.6) {
                SoundManager.playTone(1200 + Math.random() * 400, 800, 0.02, 'sawtooth', 0.08);
            }
        } else if (type === 'wall') {
            const baseFreq = 150 + intensity * 100;
            const volume = 0.15 + intensity * 0.15;
            SoundManager.playTone(baseFreq, baseFreq * 0.4, 0.06 + intensity * 0.06, 'sine', volume);
        }
    }

    // ═══════════════════════════════════════════
    // Public Update/Draw (game loop'tan çağrılır)
    // ═══════════════════════════════════════════

    function update() {
        updateNetRip();
        updateSlowMo();
        updateNearMiss();
    }

    function draw(ctx, scaleX, scaleY) {
        drawNetRip(ctx, scaleX, scaleY);
        drawNearMiss(ctx, scaleX, scaleY);
    }

    function drawBeforeBall(ctx, ballX, ballY, ballRadius, scaleX, scaleY) {
        drawTrail(ctx, scaleX, scaleY);
        drawBallGlow(ctx, ballX, ballY, ballRadius, scaleX, scaleY);
    }

    // ═══════════════════════════════════════════
    // Settings
    // ═══════════════════════════════════════════

    function setSetting(key, value) {
        if (key in settings) {
            settings[key] = value;
        }
    }

    function getSetting(key) {
        return settings[key];
    }

    function getSettings() {
        return { ...settings };
    }

    return {
        // Settings
        setSetting,
        getSetting,
        getSettings,

        // Per-frame updates
        update,
        draw,
        drawBeforeBall,

        // Trail
        updateTrail,
        clearTrail,

        // Sparks
        triggerSparks,

        // Shake
        triggerShake,

        // Ball glow
        updateBallGlow,
        getBallGlow,

        // Net rip
        triggerNetRip,

        // Slow-mo
        triggerSlowMo,
        getSlowMoFactor,
        isSlowMoActive,

        // Near-miss
        checkNearMiss,

        // Sound
        playHitSound
    };
})();
