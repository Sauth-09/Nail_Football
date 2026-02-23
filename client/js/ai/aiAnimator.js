/**
 * aiAnimator.js
 * Handles UI animations for the AI to make it look like a human is playing.
 */

'use strict';

class AIAnimator {
    constructor(difficulty) {
        this.difficulty = difficulty;
        this.config = this.getAnimatorConfig(difficulty);
        this.thinkInterval = null;
    }

    getAnimatorConfig(difficulty) {
        switch (difficulty) {
            case 'easy':
                return {
                    thinkTimeMin: 1500,
                    thinkTimeMax: 3000,
                    aimSpeed: 0.05,
                    powerOscillations: 2, // Kaç kere güç barı git-gel yapacak
                    powerSpeed: 0.02
                };
            case 'medium':
                return {
                    thinkTimeMin: 1000,
                    thinkTimeMax: 2000,
                    aimSpeed: 0.08,
                    powerOscillations: 1,
                    powerSpeed: 0.03
                };
            case 'hard':
                return {
                    thinkTimeMin: 500,
                    thinkTimeMax: 1000,
                    aimSpeed: 0.12,
                    powerOscillations: 0, // Hedefine çabuk karar verir ve durur
                    powerSpeed: 0.04
                };
            default:
                return { thinkTimeMin: 1000, thinkTimeMax: 2000, aimSpeed: 0.08, powerOscillations: 1, powerSpeed: 0.03 };
        }
    }

    /**
     * Düşünme süresini ve nokta (...) animasyonunu simüle eder.
     */
    async simulateThinking() {
        const thinkTime = this.config.thinkTimeMin + Math.random() * (this.config.thinkTimeMax - this.config.thinkTimeMin);

        // Show indicator in UI
        if (typeof UIManager !== 'undefined') {
            const indicator = document.getElementById('turn-text');
            if (indicator) {
                const originalText = indicator.textContent;
                const baseText = originalText.includes('-') ? originalText.split('-')[0].trim() : originalText;

                let dots = 0;
                this.thinkInterval = setInterval(() => {
                    dots = (dots + 1) % 4;
                    indicator.textContent = `${baseText} - Düşünüyor${'.'.repeat(dots)}`;
                }, 400);
            }
        }

        await this.wait(thinkTime);

        if (this.thinkInterval) {
            clearInterval(this.thinkInterval);
            this.thinkInterval = null;
        }
    }

    /**
     * Yön okunun hedef açıya doğru insansı bir şekilde dönmesini sağlar.
     */
    async animateAiming(targetAngle) {
        if (typeof GameRenderer === 'undefined') return;

        return new Promise(resolve => {
            // Hedefe yakın rastgele bir başlangıç açısı
            let currentAngle = targetAngle + (Math.random() * 2 - 1);

            const animate = () => {
                const diff = targetAngle - currentAngle;

                // Farkı -PI ile PI arasında normalize et
                let normalizedDiff = diff;
                while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
                while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;

                if (Math.abs(normalizedDiff) < this.config.aimSpeed) {
                    currentAngle = targetAngle;
                    GameRenderer.setDirectionArrow(currentAngle);
                    // Bekleme süresi ekleyip işlemi bitir
                    setTimeout(resolve, 300);
                } else {
                    currentAngle += Math.sign(normalizedDiff) * this.config.aimSpeed;

                    // currentAngle'ı normalize et
                    while (currentAngle > Math.PI) currentAngle -= 2 * Math.PI;
                    while (currentAngle < -Math.PI) currentAngle += 2 * Math.PI;

                    GameRenderer.setDirectionArrow(currentAngle);
                    requestAnimationFrame(animate);
                }
            };
            requestAnimationFrame(animate);
        });
    }

    /**
     * Güç çubuğunun dolmasını ve sallanmasını simüle eder.
     */
    async animatePower(targetPower) {
        if (typeof UIManager === 'undefined') return;

        UIManager.showPowerBar(true);

        return new Promise(resolve => {
            let currentPower = 0;
            let direction = 1;
            let oscillationsDone = 0;
            const targetOscillations = this.config.powerOscillations;

            const animate = () => {
                currentPower += direction * this.config.powerSpeed;

                if (currentPower >= 1) {
                    currentPower = 1;
                    direction = -1;
                    oscillationsDone++;
                } else if (currentPower <= 0) {
                    currentPower = 0;
                    direction = 1;
                    oscillationsDone++;
                }

                UIManager.updatePowerBar(currentPower);

                // Yeterince gidip geldiyse hedef güce kilitlen
                if (oscillationsDone >= targetOscillations) {
                    const distToTarget = targetPower - currentPower;
                    // Yanına gelince dur
                    if (Math.sign(distToTarget) !== direction && Math.abs(distToTarget) < this.config.powerSpeed * 2) {
                        currentPower = targetPower;
                        UIManager.updatePowerBar(currentPower);
                        UIManager.lockPowerBar(currentPower);

                        setTimeout(resolve, 300);
                        return;
                    }
                }

                requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        });
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
