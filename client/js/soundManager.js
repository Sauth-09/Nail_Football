/**
 * soundManager.js - Ses Efektleri Yönetimi
 * 
 * Web Audio API kullanarak tüm sesleri programatik olarak üretir.
 * Harici ses dosyası kullanılmaz - tüm sesler synthesize edilir.
 * 
 * Ses Efektleri:
 * - kick: Vuruş sesi
 * - nail_hit: Çivi çarpma sesi
 * - wall_hit: Duvar çarpma sesi
 * - goal: Gol sesi
 * - click: Buton tıklama
 * - turn: Sıra değişimi
 * - start: Oyun başlangıç düdüğü
 * - end: Oyun sonu düdüğü
 */

'use strict';

const SoundManager = (() => {
    /** @type {AudioContext|null} */
    let audioContext = null;

    /** @type {GainNode|null} */
    let masterGain = null;

    /** @type {number} Master volume (0-1) */
    let masterVolume = 0.7;

    /** @type {boolean} Sound effects enabled */
    let sfxEnabled = true;

    /**
     * Initializes the audio context (must be called after user interaction)
     */
    function init() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioContext.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(audioContext.destination);
            console.log('[INFO] SoundManager başlatıldı');
        } catch (error) {
            console.error('[ERROR] AudioContext oluşturulamadı:', error);
        }
    }

    /**
     * Resumes audio context if suspended (mobile browsers)
     */
    function resume() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    /**
     * Sets master volume
     * @param {number} volume - Volume level (0-100)
     */
    function setVolume(volume) {
        masterVolume = Math.max(0, Math.min(1, volume / 100));
        if (masterGain) {
            masterGain.gain.value = masterVolume;
        }
    }

    /**
     * Enables or disables sound effects
     * @param {boolean} enabled
     */
    function setSfxEnabled(enabled) {
        sfxEnabled = enabled;
    }

    /**
     * Creates an oscillator with envelope
     * @param {number} frequency - Start frequency
     * @param {number} endFrequency - End frequency
     * @param {number} duration - Duration in seconds
     * @param {string} type - Oscillator type ('sine', 'square', 'triangle', 'sawtooth')
     * @param {number} volume - Volume (0-1)
     */
    function playTone(frequency, endFrequency, duration, type = 'sine', volume = 0.3) {
        if (!audioContext || !sfxEnabled) return;
        resume();

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        if (endFrequency !== frequency) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(endFrequency, 20), audioContext.currentTime + duration
            );
        }

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    /**
     * Plays the kick/shoot sound
     * @param {number} power - Shot power (0-1) affects volume
     */
    function playKick(power = 0.5) {
        if (!audioContext || !sfxEnabled) return;
        resume();
        const vol = 0.2 + power * 0.3;
        playTone(150, 50, 0.1, 'sine', vol);
    }

    /**
     * Plays the nail hit sound
     */
    function playNailHit() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        playTone(800, 600, 0.03, 'square', 0.15);
    }

    /**
     * Plays the wall hit sound
     */
    function playWallHit() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        playTone(200, 80, 0.08, 'sine', 0.2);
    }

    /**
     * Plays the goal sound (3-note melody + boom)
     */
    function playGoal() {
        if (!audioContext || !sfxEnabled) return;
        resume();

        // Low boom
        playTone(80, 30, 0.5, 'sine', 0.4);

        // Melody: C5, E5, G5
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                playTone(freq, freq, 0.15, 'square', 0.25);
            }, i * 150);
        });
    }

    /**
     * Plays the button click sound
     */
    function playClick() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        playTone(600, 400, 0.02, 'sine', 0.1);
    }

    /**
     * Plays the turn change sound (two-tone beep)
     */
    function playTurnChange() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        playTone(262, 262, 0.1, 'square', 0.15);
        setTimeout(() => {
            playTone(392, 392, 0.1, 'square', 0.15);
        }, 120);
    }

    /**
     * Plays the game start whistle
     */
    function playStart() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        playTone(500, 1500, 0.5, 'sine', 0.3);
    }

    /**
     * Plays the game end whistle (3 short whistles)
     */
    function playEnd() {
        if (!audioContext || !sfxEnabled) return;
        resume();
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                playTone(1000, 1200, 0.15, 'sine', 0.25);
            }, i * 250);
        }
    }

    return {
        init,
        resume,
        setVolume,
        setSfxEnabled,
        playKick,
        playNailHit,
        playWallHit,
        playGoal,
        playClick,
        playTurnChange,
        playStart,
        playEnd
    };
})();
