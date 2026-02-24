/**
 * aiPlayer.js
 * AI Kontrol Sınıfı - Sıra AI'ye geçtiğinde karar mekanizmasını yürütür.
 */

'use strict';

class AIPlayer {
    constructor(difficulty, side) {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard'
        this.side = side;             // 'left' veya 'right' (AI genelde 'right')
        this.targetGoal = (side === 'left') ? 'right' : 'left';
        this.ownGoal = side;

        this.strategy = new AIStrategy(difficulty);
        this.simulator = null; // init()'da bağlanacak

        this.animator = new AIAnimator(difficulty);
        this.personality = new AIPersonality(difficulty);

        this.isThinking = false;
        this.currentState = 'idle';
    }

    getPlayerSide() {
        return this.side;
    }

    init(fieldParams) {
        this.simulator = new AISimulator(fieldParams);

        // Show intro message on init
        setTimeout(() => {
            if (typeof UIManager !== 'undefined') {
                const quote = this.personality.getQuote('intro');
                UIManager.showAIMessage(quote, this.personality.data.emoji, 5000);
            }
        }, 1500);
    }

    /**
     * AI Sırası geldiğinde çağrılacak ana fonksiyon
     */
    async takeTurn(gameState) {
        this.isThinking = true;
        this.currentState = 'thinking';

        // 1. Düşünme Animasyonu
        await this.animator.simulateThinking();

        // 2. Simülasyon
        const shots = await this.strategy.evaluateAllShots(
            this.simulator,
            gameState.ball,
            gameState.field,
            gameState.scores,
            this.targetGoal,
            this.ownGoal,
            gameState.options
        );

        // 3. Seçim ve Hata Ekleme
        const selectedShot = this.strategy.selectShot(shots);
        const finalShot = this.strategy.addError(selectedShot);

        // 4. Hedefleme Animasyonu
        this.currentState = 'aiming';
        await this.animator.animateAiming(finalShot.angle);

        // 5. Güç Ayarlama Animasyonu
        this.currentState = 'power';
        if (typeof UIManager !== 'undefined') {
            UIManager.updateTurnIndicator(this.side === 'left' ? 1 : 2, 'power');
        }
        await this.animator.animatePower(finalShot.power);

        this.isThinking = false;
        this.currentState = 'done';

        return {
            angle: finalShot.angle,
            power: finalShot.power
        };
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
