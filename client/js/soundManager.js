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

    /** @type {boolean} Commentator/cheer sounds enabled */
    let commentatorEnabled = true;

    /** @type {AudioBufferSourceNode|null} Currently playing anthem source node */
    let activeAnthemSource = null;

    /** @type {GainNode|null} Currently playing anthem gain node */
    let activeAnthemGain = null;

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
    function playGoal(scorerTeamId) {
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

        // Play team anthem if provided
        if (scorerTeamId) {
            playTeamAnthem(scorerTeamId);
        }

        // Commentator and crowd sounds
        if (commentatorEnabled) {
            setTimeout(() => playCommentatorGoal(), 300);
            setTimeout(() => playGoalCheer(), 600);
        }
    }

    /**
     * Stops the currently playing team anthem if there is one
     */
    function stopActiveAnthem() {
        if (activeAnthemSource) {
            try {
                activeAnthemSource.stop();
            } catch (e) {
                // Already stopped or not started
            }
            activeAnthemSource = null;
        }
        if (activeAnthemGain) {
            activeAnthemGain = null;
        }
    }

    /**
     * Helper to check and load a specific audio file URL
     * Returns the AudioBuffer or null if not found
     */
    async function fetchAndDecodeAudio(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            return null;
        }
    }

    /**
     * Plays a team specific anthem with dynamic duration, fallback paths, and randomized selection
     * @param {string} teamId - The ID of the scoring team
     */
    async function playTeamAnthem(teamId) {
        if (!audioContext || !sfxEnabled || !teamId) return;
        resume();

        // Stop any currently playing anthem to prevent overlapping
        stopActiveAnthem();

        // Normalize teamId to lowercase to prevent case-sensitivity issues on Linux production servers
        const cleanTeamId = teamId.toLowerCase();

        // 1. Try randomized anthems (1, 2, 3) and fallback to classic [cleanTeamId].mp3
        const nums = [1, 2, 3];
        // Shuffle nums to randomize the order we try them in
        const randomOrder = nums.sort(() => Math.random() - 0.5);
        
        let audioBuffer = null;
        let loadedUrl = '';

        for (const num of randomOrder) {
            const url = `/assets/sounds/anthems/${cleanTeamId}${num}.mp3`;
            audioBuffer = await fetchAndDecodeAudio(url);
            if (audioBuffer) {
                loadedUrl = url;
                break;
            }
        }

        // If no numbered files are found, fallback to the classic unnumbered anthem file
        if (!audioBuffer) {
            const fallbackUrl = `/assets/sounds/anthems/${cleanTeamId}.mp3`;
            audioBuffer = await fetchAndDecodeAudio(fallbackUrl);
            if (audioBuffer) {
                loadedUrl = fallbackUrl;
            }
        }

        if (!audioBuffer) {
            console.warn(`[SoundManager] No anthem files found for team: ${teamId} (tried lowercase: ${cleanTeamId})`);
            return;
        }

        // Re-check if another anthem started while decoding
        if (activeAnthemSource) {
            stopActiveAnthem();
        }

        try {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = audioContext.createGain();
            // Start at comfortable volume, connected to masterGain
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);

            // Fetch dynamic anthem duration from global settings, default to 15s
            const settings = (typeof UIManager !== 'undefined') ? UIManager.getSettings() : { anthemDuration: 15 };
            const configuredDuration = settings.anthemDuration || 15;

            // Ensure we do not play beyond the audio buffer's real duration to avoid silence or errors
            const playDuration = Math.min(configuredDuration, audioBuffer.duration);
            const fadeOutDuration = Math.min(2, playDuration * 0.2);

            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + playDuration - fadeOutDuration);
            gainNode.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + playDuration);

            source.connect(gainNode);
            gainNode.connect(masterGain);

            activeAnthemSource = source;
            activeAnthemGain = gainNode;

            source.start(audioContext.currentTime);
            source.stop(audioContext.currentTime + playDuration);

            // Clean up reference when playback finishes naturally
            source.onended = () => {
                if (activeAnthemSource === source) {
                    activeAnthemSource = null;
                    activeAnthemGain = null;
                }
            };

            console.log(`[SoundManager] Playing team anthem (${playDuration.toFixed(1)}s): ${loadedUrl}`);
        } catch (error) {
            console.error(`[SoundManager] Error playing anthem for team ${teamId}:`, error);
        }
    }

    /**
     * Plays the commentator "GOOOL!" sound
     * Only plays if user has added a goal.mp3 file
     */
    async function playCommentatorGoal() {
        if (!audioContext || !sfxEnabled) return;
        resume();

        try {
            // Play a real human sound if the user added it
            const response = await fetch('/assets/sounds/goal.mp3');
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(masterGain);
                source.start(0);
            }
        } catch (e) {
            // No external sound file — stay silent
        }
    }

    /**
     * Internal helper to load an audio buffer
     */
    async function loadAudioBuffer(url) {
        if (!audioContext) return null;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            return null;
        }
    }

    /**
     * Plays crowd cheering sound (white noise with bandpass filter)
     */
    function playGoalCheer() {
        if (!audioContext || !sfxEnabled) return;
        resume();

        const duration = 2.0;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // Generate noise with crowd-like modulation
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin(t / duration * Math.PI) * 0.8;
            const wave = (Math.random() * 2 - 1) * envelope;
            // Add low-frequency modulation for crowd "wave" effect
            const mod = 1 + 0.3 * Math.sin(t * 3.5 * Math.PI);
            data[i] = wave * mod;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        // Bandpass filter to simulate crowd frequency range
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.8;

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, audioContext.currentTime + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(audioContext.currentTime);
        source.stop(audioContext.currentTime + duration);
    }

    /**
     * Enables or disables commentator/cheer sounds
     * @param {boolean} enabled
     */
    function setCommentatorEnabled(enabled) {
        commentatorEnabled = enabled;
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
        setCommentatorEnabled,
        playTone,
        playKick,
        playNailHit,
        playWallHit,
        playGoal,
        playCommentatorGoal,
        playGoalCheer,
        playClick,
        playTurnChange,
        playStart,
        playEnd,
        stopActiveAnthem,
        playTeamAnthem
    };
})();
