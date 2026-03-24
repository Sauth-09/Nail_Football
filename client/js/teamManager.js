/**
 * teamManager.js - Team Selection & Data Manager
 * 
 * Manages team definitions (colors, names, emblems) and
 * player team selections for fan rendering.
 */

'use strict';

const TeamManager = (() => {
    // ═══════════════════════════════════════════
    // Team Definitions
    // ═══════════════════════════════════════════

    /** @type {Object} All available teams */
    const TEAMS = {
        galatasaray: {
            name: 'Galatasaray',
            short: 'GS',
            colors: ['#FFC72C', '#A50034'],
            emoji: '🦁',
            fanColors: ['#FFC72C', '#A50034', '#FF8C00', '#C8102E']
        },
        fenerbahce: {
            name: 'Fenerbahçe',
            short: 'FB',
            colors: ['#FFED00', '#002F5F'],
            emoji: '🐦',
            fanColors: ['#FFED00', '#002F5F', '#FFD700', '#003DA5']
        },
        besiktas: {
            name: 'Beşiktaş',
            short: 'BJK',
            colors: ['#000000', '#FFFFFF'],
            emoji: '🦅',
            fanColors: ['#000000', '#FFFFFF', '#333333', '#E0E0E0']
        },
        trabzonspor: {
            name: 'Trabzonspor',
            short: 'TS',
            colors: ['#6B1D2A', '#003DA5'],
            emoji: '⚓',
            fanColors: ['#6B1D2A', '#003DA5', '#8B2E3B', '#1A5BBF']
        },
        milliTakim: {
            name: 'Milli Takım',
            short: 'TR',
            colors: ['#E30A17', '#FFFFFF'],
            emoji: '🇹🇷',
            fanColors: ['#E30A17', '#FFFFFF', '#FF1A2B', '#F5F5F5']
        }
    };

    /** @type {Object} Player team selections { 1: teamId|null, 2: teamId|null } */
    let selections = { 1: null, 2: null };

    // ═══════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════

    /**
     * Returns all available teams
     * @returns {Object}
     */
    function getTeams() {
        return TEAMS;
    }

    /**
     * Sets a player's team selection
     * @param {number} player - 1 or 2
     * @param {string|null} teamId - Team key or null to deselect
     */
    function selectTeam(player, teamId) {
        if (teamId && !TEAMS[teamId]) {
            console.warn(`[TeamManager] Unknown team: ${teamId}`);
            return;
        }
        selections[player] = teamId;
        console.log(`[TeamManager] Player ${player} selected: ${teamId || 'none'}`);
    }

    /**
     * Gets a player's selected team data
     * @param {number} player - 1 or 2
     * @returns {Object|null} Team data or null if no team selected
     */
    function getTeam(player) {
        const teamId = selections[player];
        return teamId ? { id: teamId, ...TEAMS[teamId] } : null;
    }

    /**
     * Gets a player's selected team ID
     * @param {number} player - 1 or 2
     * @returns {string|null}
     */
    function getTeamId(player) {
        return selections[player];
    }

    /**
     * Checks if any team is selected (for fan rendering)
     * @returns {boolean}
     */
    function hasAnyTeamSelected() {
        return selections[1] !== null || selections[2] !== null;
    }

    /**
     * Resets all team selections
     */
    function resetSelection() {
        selections = { 1: null, 2: null };
    }

    return {
        getTeams,
        selectTeam,
        getTeam,
        getTeamId,
        hasAnyTeamSelected,
        resetSelection
    };
})();
