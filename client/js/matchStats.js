/**
 * matchStats.js - Match Statistics Tracker
 * 
 * Collects per-player statistics during a match:
 * shots, goals, own goals, collisions (nail/wall/goalkeeper),
 * joker usage, power averages, and max power.
 * 
 * Provides a summary report for the game-over screen.
 */

'use strict';

const MatchStats = (() => {
    // ═══════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════

    /** @returns {Object} Fresh stats object for one player */
    const createEmptyStats = () => ({
        shots: 0,
        goals: 0,
        ownGoals: 0,
        nailHits: 0,
        wallHits: 0,
        goalkeeperHits: 0,
        jokerUsed: null, // null = not used, string = joker type id
        totalPower: 0,   // Sum of all shot powers (for average calculation)
        maxPower: 0,
        maxSpeed: 0       // Fastest ball speed recorded from collision events
    });

    /** @type {Object} Per-player stats { 1: {...}, 2: {...} } */
    let stats = { 1: createEmptyStats(), 2: createEmptyStats() };

    /** @type {number|null} Tracks which player is currently shooting */
    let currentShooter = null;

    // ═══════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════

    /**
     * Resets all statistics (call at game start)
     */
    function reset() {
        stats = { 1: createEmptyStats(), 2: createEmptyStats() };
        currentShooter = null;
        console.log('[MatchStats] Reset');
    }

    /**
     * Records a shot by a player
     * @param {number} player - 1 or 2
     * @param {number} power - Shot power (0-1)
     */
    function recordShot(player, power) {
        if (!stats[player]) return;

        stats[player].shots++;
        stats[player].totalPower += power;
        stats[player].maxPower = Math.max(stats[player].maxPower, power);
        currentShooter = player;

        console.log(`[MatchStats] P${player} shot #${stats[player].shots}, power: ${(power * 100).toFixed(0)}%`);
    }

    /**
     * Records a collision event during ball playback
     * @param {number} player - The player who made the current shot
     * @param {string} type - 'nail' | 'wall' | 'goalkeeper'
     * @param {number} [speed] - Ball speed at collision
     */
    function recordCollision(player, type, speed = 0) {
        if (!stats[player]) return;

        switch (type) {
            case 'nail':
                stats[player].nailHits++;
                break;
            case 'wall':
                stats[player].wallHits++;
                break;
            case 'goalkeeper':
                stats[player].goalkeeperHits++;
                break;
        }

        if (speed > stats[player].maxSpeed) {
            stats[player].maxSpeed = speed;
        }
    }

    /**
     * Records a goal scored
     * @param {number} scorer - The player who benefits from the goal (1 or 2)
     * @param {boolean} isOwnGoal - Whether this was an own goal by the shooter
     * @param {number} shooter - The player who took the shot
     */
    function recordGoal(scorer, isOwnGoal, shooter) {
        if (!stats[scorer]) return;

        stats[scorer].goals++;

        if (isOwnGoal && stats[shooter]) {
            stats[shooter].ownGoals++;
        }
    }

    /**
     * Records joker usage
     * @param {number} player - 1 or 2
     * @param {string} jokerType - Joker type key (e.g. 'flamingBall')
     */
    function recordJokerUsed(player, jokerType) {
        if (!stats[player]) return;
        stats[player].jokerUsed = jokerType;
        console.log(`[MatchStats] P${player} used joker: ${jokerType}`);
    }

    /**
     * Returns the current shooter player number
     * @returns {number|null}
     */
    function getCurrentShooter() {
        return currentShooter;
    }

    /**
     * Returns compiled statistics for both players
     * @returns {Object} { p1: { ... }, p2: { ... } }
     */
    function getStats() {
        const compile = (playerStats) => {
            const avgPower = playerStats.shots > 0
                ? playerStats.totalPower / playerStats.shots
                : 0;

            return {
                shots: playerStats.shots,
                goals: playerStats.goals,
                ownGoals: playerStats.ownGoals,
                nailHits: playerStats.nailHits,
                wallHits: playerStats.wallHits,
                goalkeeperHits: playerStats.goalkeeperHits,
                totalCollisions: playerStats.nailHits + playerStats.wallHits + playerStats.goalkeeperHits,
                jokerUsed: playerStats.jokerUsed,
                avgPower: Math.round(avgPower * 100),    // as percentage
                maxPower: Math.round(playerStats.maxPower * 100),
                maxSpeed: Math.round(playerStats.maxSpeed),
                accuracy: playerStats.shots > 0
                    ? Math.round((playerStats.goals / playerStats.shots) * 100)
                    : 0
            };
        };

        return {
            p1: compile(stats[1]),
            p2: compile(stats[2])
        };
    }

    return {
        reset,
        recordShot,
        recordCollision,
        recordGoal,
        recordJokerUsed,
        getCurrentShooter,
        getStats
    };
})();
