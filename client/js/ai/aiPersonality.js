/**
 * aiPersonality.js
 * Defines the personalities, avatars, and specific situational quotes for each AI difficulty level.
 */

'use strict';

const AI_PERSONALITIES = {
    easy: {
        id: 'easy',
        name: 'Acemi Ali',
        title: 'Çaylak Çırak',
        emoji: '😅',
        quotes: {
            intro: ["İlk defa oynuyorum, lütfen yavaş at!", "Çiviler ne işe yarıyor?", "Umarım top kendi kaleme gitmez..."],
            score_goal: ["Şans eseri oldu galiba!", "Gördün mü? Ben de atabiliyorum!", "Vay canına, gol oldu!"],
            concede_goal: ["Ah be! Öğrenicem bu oyunu.", "Çok hızlıydı göremedim bile!", "Bir dahakine tutacağım."],
            win: ["İnanılmaz! Ben kazandım!", "Acemi şansı dedikleri bu olsa gerek.", "Çok eğlenceliydi, tekrar oynayalım!"],
            loss: ["Zaten yeni öğreniyorum...", "Çok çalıştın galiba, tebrikler.", "Bir dahaki sefere daha iyi olacağım."]
        }
    },
    medium: {
        id: 'medium',
        name: 'Usta Hasan',
        title: 'Deneyimli Dayı',
        emoji: '🧐',
        quotes: {
            intro: ["Oyun başlasın bakalım yeğenim.", "Ben bu oyunu yıllardır oynarım.", "Şansını fazla zorlama istersen."],
            score_goal: ["Tecrübe konuşuyor!", "İşte böyle köşeye bırakacaksın.", "Çivileri iyi okumak lazım."],
            concede_goal: ["İyi atıştı, hakkını vermek lazım.", "Bir anlık dalgınlığıma geldi.", "Oyunu okumayı biliyorsun."],
            win: ["Güzel maçtı, eline sağlık.", "Tecrübe her zaman kazanır.", "Bir fincan çay iyi giderdi şimdi."],
            loss: ["Bugün günümde değilim anlaşılan.", "Gençlik işte, enerjin bitmiyor.", "Tebrikler, iyi oyundu."]
        }
    },
    hard: {
        id: 'hard',
        name: 'Kral Kerem',
        title: 'Profesyonel Şampiyon',
        emoji: '😎',
        quotes: {
            intro: ["Kaybetmeye hazır mısın?", "Sadece matematik ve fizik. Başka bir şey değil.", "Hadi çabuk ol, vaktim değerli."],
            score_goal: ["Açı ve hız mükemmel hesaptı.", "Bunu bekliyordun değil mi?", "Kurtarılması imkansız bir atış."],
            concede_goal: ["Şanslıydın.", "İlginç bir açı, not almalıyım.", "Bir daha o şutu atamazsın."],
            win: ["Beklenen sonuç.", "Matematik asla yalan söylemez.", "Daha çok çalışman gerek."],
            loss: ["İmkansız! Simülasyonlarımda bir hata olmalı!", "Bu... kabul edilemez.", "Sadece şanstı, rövanş istiyorum!"]
        }
    }
};

class AIPersonality {
    constructor(difficulty) {
        this.data = AI_PERSONALITIES[difficulty];
    }

    getQuote(event) {
        if (!this.data || !this.data.quotes[event]) return "";
        const quotesArray = this.data.quotes[event];
        const randomIndex = Math.floor(Math.random() * quotesArray.length);
        return quotesArray[randomIndex];
    }
}
