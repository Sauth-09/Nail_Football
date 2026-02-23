/**
 * aiStrategy.js
 * AI atışlarını puanlamak ve stratejik olarak seçmek için kullanılan sınıf.
 */

'use strict';

class AIStrategy {
    constructor(difficulty) {
        this.difficulty = difficulty; // 'easy' | 'medium' | 'hard'

        // Zorluğa göre tarama detayları
        this.scanConfig = {
            easy: { angleStep: 15, powerLevels: [0.3, 0.6, 0.9] },
            medium: { angleStep: 5, powerLevels: [0.2, 0.4, 0.6, 0.8, 1.0] },
            hard: { angleStep: 2, powerLevels: [0.15, 0.25, 0.4, 0.55, 0.7, 0.8, 0.9, 1.0] }
        };

        // Puanlama ağırlıkları
        this.weights = {
            easy: { goal: 1000, ownGoal: -800, proximity: 80, safety: 40, position: 20 },
            medium: { goal: 1000, ownGoal: -1500, proximity: 150, safety: 80, position: 40 },
            hard: { goal: 1000, ownGoal: -2000, proximity: 200, safety: 120, position: 60 }
        };

        // Hata oranları (Daha sonra Humanization fazında da kullanılabilir)
        this.errorConfig = {
            easy: { angleError: 25, powerError: 0.25 },
            medium: { angleError: 10, powerError: 0.12 },
            hard: { angleError: 3, powerError: 0.05 }
        };
    }

    /**
     * Belirtilen saha ve duruma göre simülasyonları döndürür
     */
    async evaluateAllShots(simulator, ballPos, field, scores, targetGoal, ownGoal) {
        const config = this.scanConfig[this.difficulty];
        const results = [];
        const combinations = [];

        for (let angleDeg = 0; angleDeg < 360; angleDeg += config.angleStep) {
            const angleRad = angleDeg * Math.PI / 180;
            for (const power of config.powerLevels) {
                combinations.push({ angleRad, power });
            }
        }

        // Chunking the processing to avoid blocking the main thread
        const CHUNK_SIZE = 20;

        for (let i = 0; i < combinations.length; i += CHUNK_SIZE) {
            const end = Math.min(i + CHUNK_SIZE, combinations.length);
            for (let j = i; j < end; j++) {
                const { angleRad, power } = combinations[j];
                const simResult = simulator.simulate(ballPos, angleRad, power);
                const score = this.scoreShot(simResult, field, targetGoal, ownGoal, scores);

                results.push({
                    angle: angleRad,
                    power: power,
                    score: score,
                    simResult: simResult
                });
            }
            // Yield to main thread
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Puanı yüksekten düşüğe sırala
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Bir atışın skorunu hesaplar
     */
    scoreShot(simResult, field, targetGoal, ownGoal, scores) {
        const w = this.weights[this.difficulty];
        let score = 0;

        const goalTop = (field.fieldHeight - field.goalWidth) / 2;
        const goalCenterY = field.fieldHeight / 2;

        // Kale merkezleri
        const leftGoalCenter = { x: 0, y: goalCenterY };
        const rightGoalCenter = { x: field.fieldWidth, y: goalCenterY };
        const goals = { left: leftGoalCenter, right: rightGoalCenter };

        // 1. Gol puanı
        if (simResult.isGoal && simResult.goalSide === targetGoal) {
            score += w.goal;
        }

        // 2. Kendi kalesine gol cezası
        if (simResult.isGoal && simResult.goalSide === ownGoal) {
            score += w.ownGoal;
        }

        const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const maxDist = Math.sqrt(Math.pow(field.fieldWidth, 2) + Math.pow(field.fieldHeight, 2)); // Yaklaşık köşegen

        // 3. Hedefe Yakınlık
        const distToGoal = getDistance(simResult.finalPosition, goals[targetGoal]);
        score += w.proximity * (1 - distToGoal / maxDist);

        // 4. Güvenlik (Kendi kalesinden uzaklık)
        const distFromOwn = getDistance(simResult.finalPosition, goals[ownGoal]);
        score += w.safety * (distFromOwn / maxDist);

        // 5. Basit Pozisyon Avantajı (Merkeze ne kadar yakın)
        const fieldCenter = { x: field.fieldWidth / 2, y: field.fieldHeight / 2 };
        const distFromCenter = getDistance(simResult.finalPosition, fieldCenter);
        score += w.position * (1 - distFromCenter / maxDist);

        // 6. Predictability Ceza: Ne kadar çok çiviye çarparsa hesap o kadar saptı demektir
        score += -2 * simResult.nailHitCount;

        // Taktiksel Skora Göre Ayarlama (Medium ve Hard için)
        if (this.difficulty !== 'easy' && scores) {
            const aiScore = scores.ai;
            const opScore = scores.player;
            if (aiScore < opScore) {
                score += w.proximity * 0.3 * (1 - distToGoal / maxDist); // Agresifleş
            } else if (aiScore > opScore) {
                score += w.safety * 0.3 * (distFromOwn / maxDist); // Defansifleş
            }
        }

        return score;
    }

    /**
     * Algoritmik seçme (Hata/Humanization da entegre)
     */
    selectShot(sortedShots) {
        if (!sortedShots || sortedShots.length === 0) return null;

        let selected = null;
        switch (this.difficulty) {
            case 'easy':
                if (Math.random() < 0.4) {
                    const pool = sortedShots.slice(0, Math.max(1, Math.floor(sortedShots.length / 2)));
                    selected = pool[Math.floor(Math.random() * pool.length)];
                } else {
                    selected = sortedShots[Math.floor(Math.random() * Math.min(5, sortedShots.length))];
                }
                break;
            case 'medium':
                if (Math.random() < 0.2) {
                    selected = sortedShots[Math.floor(Math.random() * Math.min(5, sortedShots.length))];
                } else {
                    selected = sortedShots[Math.floor(Math.random() * Math.min(3, sortedShots.length))];
                }
                break;
            case 'hard':
                if (Math.random() < 0.9) {
                    selected = sortedShots[0];
                } else {
                    selected = sortedShots[Math.floor(Math.random() * Math.min(2, sortedShots.length))];
                }
                break;
        }

        return selected || sortedShots[0];
    }

    /**
     * Seçilen atışa kasıtlı sapma uygular
     */
    addError(shot) {
        if (!shot) return { angle: 0, power: 0 };

        const config = this.errorConfig[this.difficulty];
        const gaussRandom = () => (Math.random() + Math.random() + Math.random()) / 3;
        const sign = () => Math.random() < 0.5 ? -1 : 1;

        const angleErrorParams = sign() * gaussRandom() * config.angleError * (Math.PI / 180);
        const powerErrorParams = (Math.random() - 0.5) * 2 * config.powerError;

        return {
            angle: shot.angle + angleErrorParams,
            power: Math.max(0.1, Math.min(1.0, shot.power + powerErrorParams))
        };
    }
}
