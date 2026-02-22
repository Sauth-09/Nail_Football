/**
 * fieldConfigs.js - Saha Haritaları ve Çivi Düzenleri
 * 
 * Bu dosya tüm saha tanımlarını içerir. Her saha:
 * - Benzersiz ID ve isim
 * - Çivi koordinatları (orantılı hesaplanmış)
 * - Fizik parametreleri (sürtünme, enerji kaybı vb.)
 * - Kale ve top başlangıç pozisyonları
 * 
 * Çivi yerleşim kuralları:
 * - Kale bölgesi içinde çivi yok
 * - Sahanın orta noktasında (top başlangıç) çivi yok
 * - Çiviler arası minimum mesafe: nailRadius * 3
 */

'use strict';

/**
 * Generates random nail positions for the "Rastgele" field
 * @param {number} fieldWidth - Field width in pixels
 * @param {number} fieldHeight - Field height in pixels
 * @param {number} goalWidth - Goal width in pixels
 * @param {number} goalDepth - Goal depth in pixels
 * @param {number} nailRadius - Nail radius in pixels
 * @returns {Array<{x: number, y: number}>} Array of nail positions
 */
function generateRandomNails(fieldWidth, fieldHeight, goalWidth, goalDepth, nailRadius) {
    const nailCount = Math.floor(Math.random() * 21) + 15; // 15-35
    const minDistance = nailRadius * 3;
    const nails = [];
    const centerX = fieldWidth / 2;
    const centerY = fieldHeight / 2;
    const goalTop = (fieldHeight - goalWidth) / 2;
    const goalBottom = (fieldHeight + goalWidth) / 2;
    const safeZoneRadius = nailRadius * 5; // Ball start safe zone

    let attempts = 0;
    const maxAttempts = 1000;

    while (nails.length < nailCount && attempts < maxAttempts) {
        attempts++;
        const x = Math.random() * (fieldWidth - nailRadius * 4) + nailRadius * 2;
        const y = Math.random() * (fieldHeight - nailRadius * 4) + nailRadius * 2;

        // Skip if in left goal area
        if (x < goalDepth + nailRadius * 2 && y > goalTop - nailRadius && y < goalBottom + nailRadius) {
            continue;
        }

        // Skip if in right goal area
        if (x > fieldWidth - goalDepth - nailRadius * 2 && y > goalTop - nailRadius && y < goalBottom + nailRadius) {
            continue;
        }

        // Skip if too close to ball start position (center)
        const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distToCenter < safeZoneRadius) {
            continue;
        }

        // Skip if too close to another nail
        let tooClose = false;
        for (const nail of nails) {
            const dist = Math.sqrt((x - nail.x) ** 2 + (y - nail.y) ** 2);
            if (dist < minDistance) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        nails.push({ x: Math.round(x), y: Math.round(y) });
    }

    return nails;
}

/** @type {Array<Object>} Field configurations */
const FIELD_CONFIGS = [
    // ═══════════════════════════════════════════════
    // 1. Klasik 4-4-2
    // ═══════════════════════════════════════════════
    {
        id: 'classic_442',
        name: 'Klasik 4-4-2',
        description: 'Geleneksel futbol dizilişi',
        difficulty: 3,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: [
            // Sol takım (savunma hattı - 4 çivi)
            { x: 150, y: 100 },
            { x: 150, y: 200 },
            { x: 150, y: 300 },
            { x: 150, y: 400 },
            // Sol takım (orta saha - 4 çivi)
            { x: 280, y: 80 },
            { x: 280, y: 190 },
            { x: 280, y: 310 },
            { x: 280, y: 420 },
            // Sol takım (forvet - 2 çivi)
            { x: 380, y: 170 },
            { x: 380, y: 330 },
            // Sağ takım (forvet - 2 çivi)
            { x: 520, y: 170 },
            { x: 520, y: 330 },
            // Sağ takım (orta saha - 4 çivi)
            { x: 620, y: 80 },
            { x: 620, y: 190 },
            { x: 620, y: 310 },
            { x: 620, y: 420 },
            // Sağ takım (savunma hattı - 4 çivi)
            { x: 750, y: 100 },
            { x: 750, y: 200 },
            { x: 750, y: 300 },
            { x: 750, y: 400 }
        ]
    },

    // ═══════════════════════════════════════════════
    // 2. Labirent
    // ═══════════════════════════════════════════════
    {
        id: 'labyrinth',
        name: 'Labirent',
        description: 'Doğru yolu bul!',
        difficulty: 5,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: [
            // Sol duvar koridoru
            { x: 100, y: 60 }, { x: 100, y: 100 }, { x: 100, y: 140 },
            { x: 100, y: 250 }, { x: 100, y: 290 }, { x: 100, y: 330 },
            { x: 100, y: 400 }, { x: 100, y: 440 },
            // İç duvar 1
            { x: 180, y: 140 }, { x: 180, y: 180 }, { x: 180, y: 220 },
            { x: 180, y: 330 }, { x: 180, y: 370 },
            // İç duvar 2
            { x: 260, y: 60 }, { x: 260, y: 100 },
            { x: 260, y: 250 }, { x: 260, y: 290 },
            { x: 260, y: 400 }, { x: 260, y: 440 },
            // Orta bölge çiviler
            { x: 340, y: 120 }, { x: 340, y: 160 },
            { x: 340, y: 310 }, { x: 340, y: 350 }, { x: 340, y: 390 },
            // Merkez koridoru
            { x: 410, y: 80 }, { x: 410, y: 140 },
            { x: 490, y: 360 }, { x: 490, y: 420 },
            // İç duvar 3
            { x: 490, y: 80 }, { x: 490, y: 120 },
            { x: 490, y: 160 },
            // İç duvar 4
            { x: 560, y: 250 }, { x: 560, y: 290 },
            { x: 560, y: 330 }, { x: 560, y: 400 }, { x: 560, y: 440 },
            // İç duvar 5
            { x: 640, y: 60 }, { x: 640, y: 100 }, { x: 640, y: 140 },
            { x: 640, y: 180 }, { x: 640, y: 330 }, { x: 640, y: 370 },
            // Sağ duvar koridoru
            { x: 720, y: 120 }, { x: 720, y: 250 },
            { x: 720, y: 290 }, { x: 720, y: 400 }, { x: 720, y: 440 },
            // Ek koridor çiviler
            { x: 800, y: 60 }, { x: 800, y: 100 },
            { x: 800, y: 330 }, { x: 800, y: 370 }
        ]
    },

    // ═══════════════════════════════════════════════
    // 3. Elmas
    // ═══════════════════════════════════════════════
    {
        id: 'diamond',
        name: 'Elmas',
        description: 'Geometrik baklava deseni',
        difficulty: 3,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: [
            // Dış elmas
            { x: 450, y: 60 },   // Üst
            { x: 550, y: 130 },
            { x: 650, y: 200 },
            { x: 700, y: 250 },  // Sağ
            { x: 650, y: 300 },
            { x: 550, y: 370 },
            { x: 450, y: 440 },  // Alt
            { x: 350, y: 370 },
            { x: 250, y: 300 },
            { x: 200, y: 250 },  // Sol
            { x: 250, y: 200 },
            { x: 350, y: 130 },
            // İç elmas
            { x: 450, y: 140 },  // Üst
            { x: 540, y: 195 },
            { x: 580, y: 250 },  // Sağ
            { x: 540, y: 305 },
            { x: 450, y: 360 },  // Alt
            { x: 360, y: 305 },
            { x: 320, y: 250 },  // Sol
            { x: 360, y: 195 },
            // Köşe çiviler
            { x: 150, y: 80 },
            { x: 750, y: 80 },
            { x: 150, y: 420 },
            { x: 750, y: 420 },
            // Merkez çapraz
            { x: 450, y: 200 }
        ]
    },

    // ═══════════════════════════════════════════════
    // 4. Boş Alan
    // ═══════════════════════════════════════════════
    {
        id: 'open_field',
        name: 'Boş Alan',
        description: 'Az çivi, hızlı oyun!',
        difficulty: 1,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: [
            // Stratejik 8 çivi
            { x: 200, y: 150 },
            { x: 200, y: 350 },
            { x: 350, y: 120 },
            { x: 350, y: 380 },
            { x: 550, y: 120 },
            { x: 550, y: 380 },
            { x: 700, y: 150 },
            { x: 700, y: 350 }
        ]
    },

    // ═══════════════════════════════════════════════
    // 5. Kalabalık
    // ═══════════════════════════════════════════════
    {
        id: 'crowded',
        name: 'Kalabalık',
        description: 'Çok çivi, çok zorluk!',
        difficulty: 5,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 5,
        ballRadius: 7,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.2,
        ballStartPosition: { x: 450, y: 250 },
        nails: (() => {
            const nails = [];
            const spacingX = 60;
            const spacingY = 45;
            const offsetX = 90;
            const offsetY = 40;
            const centerX = 450;
            const centerY = 250;
            const goalTop = (500 - 120) / 2;
            const goalBottom = (500 + 120) / 2;
            const safeRadius = 30;

            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 14; col++) {
                    const x = offsetX + col * spacingX + (row % 2 === 1 ? spacingX / 2 : 0);
                    const y = offsetY + row * spacingY;

                    // Skip if out of bounds
                    if (x < 50 || x > 850 || y < 30 || y > 470) continue;

                    // Skip if in left goal area
                    if (x < 65 && y > goalTop - 10 && y < goalBottom + 10) continue;

                    // Skip if in right goal area
                    if (x > 835 && y > goalTop - 10 && y < goalBottom + 10) continue;

                    // Skip if too close to center
                    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    if (dist < safeRadius) continue;

                    nails.push({ x: Math.round(x), y: Math.round(y) });
                }
            }
            return nails;
        })()
    },

    // ═══════════════════════════════════════════════
    // 6. Spiral
    // ═══════════════════════════════════════════════
    {
        id: 'spiral',
        name: 'Spiral',
        description: 'Sarmal düzenli çiviler',
        difficulty: 4,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: (() => {
            const nails = [];
            const centerX = 450;
            const centerY = 250;
            const goalTop = (500 - 120) / 2;
            const goalBottom = (500 + 120) / 2;
            const totalNails = 30;
            const maxRadius = 200;
            const minRadius = 40;

            for (let i = 0; i < totalNails; i++) {
                const t = i / totalNails;
                const angle = t * Math.PI * 4; // 2 full spirals
                const radius = minRadius + t * (maxRadius - minRadius);
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                // Skip if out of bounds
                if (x < 50 || x > 850 || y < 30 || y > 470) continue;

                // Skip if in goal areas
                if (x < 65 && y > goalTop - 10 && y < goalBottom + 10) continue;
                if (x > 835 && y > goalTop - 10 && y < goalBottom + 10) continue;

                // Skip if too close to center
                const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distToCenter < 25) continue;

                nails.push({ x: Math.round(x), y: Math.round(y) });
            }
            return nails;
        })()
    },

    // ═══════════════════════════════════════════════
    // 7. Rastgele
    // ═══════════════════════════════════════════════
    {
        id: 'random',
        name: 'Rastgele',
        description: 'Her oyunda farklı düzen!',
        difficulty: 3,
        fieldWidth: 900,
        fieldHeight: 500,
        backgroundColor: '#2d5a1b',
        lineColor: '#ffffff',
        nailRadius: 6,
        ballRadius: 8,
        goalWidth: 120,
        goalDepth: 30,
        friction: 0.985,
        wallRestitution: 0.88,
        nailRestitution: 0.92,
        maxShotPower: 800,
        powerBarSpeed: 1.5,
        ballStartPosition: { x: 450, y: 250 },
        nails: [], // Generated at runtime
        isRandom: true
    }
];

/**
 * Gets a field config by ID
 * @param {string} fieldId - Field ID
 * @returns {Object|null} Field configuration or null
 */
function getFieldById(fieldId) {
    const field = FIELD_CONFIGS.find(f => f.id === fieldId);
    if (!field) return null;

    // Generate random nails for random field
    if (field.isRandom) {
        const copy = JSON.parse(JSON.stringify(field));
        copy.nails = generateRandomNails(
            copy.fieldWidth, copy.fieldHeight,
            copy.goalWidth, copy.goalDepth,
            copy.nailRadius
        );
        return copy;
    }

    return JSON.parse(JSON.stringify(field));
}

/**
 * Gets all field configs (for field selection screen)
 * @returns {Array<Object>} All field configurations
 */
function getAllFields() {
    return FIELD_CONFIGS.map(field => ({
        id: field.id,
        name: field.name,
        description: field.description,
        difficulty: field.difficulty,
        nailCount: field.isRandom ? '15-35' : field.nails.length,
        isRandom: field.isRandom || false
    }));
}

module.exports = { FIELD_CONFIGS, getFieldById, getAllFields, generateRandomNails };
