/**
 * aiSimulator.js
 * AI için ekrana çizim yapmayan, sadece sonuç döndüren "sessiz" fizik simülatörü.
 * physicsClient.js'deki mantığı kullanır ancak animasyon/fps beklemez.
 */

'use strict';

class AISimulator {
    constructor(fieldParams) {
        // fieldParams: gameRenderer veya server üzerinden gelen currentField objesi
        this.field = fieldParams;
        this.DT = 1 / 60;
        this.MAX_FRAMES = 600;
        this.MIN_SPEED = 5;
    }

    /**
     * @param {Object} ballPos Seçilen açıda topun başlangıç konumu {x, y}
     * @param {number} angle Radyan cinsinden açı
     * @param {number} power Atış gücü (0.0 - 1.0)
     * @returns {Object} { finalPosition, isGoal, goalSide, nailHitCount, wallHitCount }
     */
    simulate(ballPos, angle, power) {
        const ball = {
            x: ballPos.x,
            y: ballPos.y,
            vx: Math.cos(angle) * power * this.field.maxShotPower,
            vy: Math.sin(angle) * power * this.field.maxShotPower,
            radius: this.field.ballRadius
        };

        const goalTop = (this.field.fieldHeight - this.field.goalWidth) / 2;
        const goalBottom = (this.field.fieldHeight + this.field.goalWidth) / 2;

        let isGoal = false;
        let goalSide = null;
        let nailHitCount = 0;
        let wallHitCount = 0;
        let frame = 0;

        while (frame < this.MAX_FRAMES) {
            frame++;

            // Velocity uygula
            ball.x += ball.vx * this.DT;
            ball.y += ball.vy * this.DT;

            // Duvar Çarpışmaları (Sessiz)
            let hitWall = false;

            // Üst/Alt duvarlar
            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius;
                ball.vy = -ball.vy * this.field.wallRestitution;
                hitWall = true;
            }
            if (ball.y + ball.radius > this.field.fieldHeight) {
                ball.y = this.field.fieldHeight - ball.radius;
                ball.vy = -ball.vy * this.field.wallRestitution;
                hitWall = true;
            }

            // Sol/Sağ duvarlar (Kalede değilse)
            if (ball.x - ball.radius < 0) {
                if (ball.y < goalTop || ball.y > goalBottom) {
                    ball.x = ball.radius;
                    ball.vx = -ball.vx * this.field.wallRestitution;
                    hitWall = true;
                }
            }
            if (ball.x + ball.radius > this.field.fieldWidth) {
                if (ball.y < goalTop || ball.y > goalBottom) {
                    ball.x = this.field.fieldWidth - ball.radius;
                    ball.vx = -ball.vx * this.field.wallRestitution;
                    hitWall = true;
                }
            }

            if (hitWall) wallHitCount++;

            // Gol Kontrolü
            if (ball.x < this.field.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
                isGoal = true;
                goalSide = 'left';
                break;
            }
            if (ball.x > this.field.fieldWidth - this.field.goalDepth && ball.y > goalTop && ball.y < goalBottom) {
                isGoal = true;
                goalSide = 'right';
                break;
            }

            // Çivi Çarpışmaları
            for (let i = 0; i < this.field.nails.length; i++) {
                const nail = this.field.nails[i];
                const dx = ball.x - nail.x;
                const dy = ball.y - nail.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = ball.radius + this.field.nailRadius;

                if (distance < minDist && distance > 0) {
                    nailHitCount++;
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const dvn = ball.vx * nx + ball.vy * ny;

                    if (dvn < 0) {
                        ball.vx -= (1 + this.field.nailRestitution) * dvn * nx;
                        ball.vy -= (1 + this.field.nailRestitution) * dvn * ny;
                    }

                    const overlap = minDist - distance;
                    ball.x += nx * overlap;
                    ball.y += ny * overlap;
                }
            }

            // Sürtünme
            ball.vx *= this.field.friction;
            ball.vy *= this.field.friction;

            // Durma durumu check
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (speed < this.MIN_SPEED) {
                ball.vx = 0;
                ball.vy = 0;
                break;
            }
        }

        return {
            finalPosition: { x: ball.x, y: ball.y },
            isGoal: isGoal,
            goalSide: goalSide,
            nailHitCount: nailHitCount,
            wallHitCount: wallHitCount
        };
    }
}
