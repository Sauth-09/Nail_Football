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
            intro: [
                "İlk defa oynuyorum, lütfen yavaş at!",
                "Çiviler ne işe yarıyor? Süs mü bunlar?",
                "Umarım top kendi kaleme gitmez... Hangi kale benimdi?",
                "Hadi başlayalım, ama çok sert vurmak yok tamam mı?",
                "Matematik notum hep çok iyiydi, bakalım futbolda işe yarayacak mı?"
            ],
            score_goal: [
                "Şans eseri oldu galiba! Gördün mü?",
                "Aman tanrım! O atışı ben mi yaptım?",
                "Vay canına, gol oldu! Nasıl yaptım bilmiyorum.",
                "Gözlerimi kapatıp vurdum, harika bir taktikmiş!",
                "Bak işte, çivilere çarptırmadan atabiliyormuşum!"
            ],
            concede_goal: [
                "Ah be! Öğrenicem bu oyunu.",
                "Vay be! O top çivilerden nasıl geçti öyle?",
                "Bir dahakine kalenin önüne etten duvar öreceğim.",
                "Şanslıydın bence, rüzgar yardım etti.",
                "Hile var! Top oradan geçemezdi fizik kurallarına göre!"
            ],
            win: [
                "İnanılmaz! Ben kazandım! Hemen annemi aramalıyım!",
                "Acemi şansı dedikleri bu olsa gerek.",
                "Çok eğlenceliydi, bana bilerek mi yenildin?",
                "Kazandım! Acaba profesyonel esporcu mu olsam?"
            ],
            loss: [
                "Zaten yeni öğreniyorum... Normal yani.",
                "Çok çalıştın galiba, tebrikler. Bütün gün bunu mu oynuyorsun?",
                "Bir dahaki sefere daha iyi olacağım. Pratik yapmalıyım.",
                "Şanslı günündeydin diyelim geçelim."
            ]
        }
    },
    medium: {
        id: 'medium',
        name: 'Usta Hasan',
        title: 'Deneyimli Dayı',
        emoji: '🧐',
        quotes: {
            intro: [
                "Oyun başlasın bakalım yeğenim.",
                "Ben bu oyunu kahvede tahta masalarda oynardım.",
                "Şansını fazla zorlama istersen, tecrübe konuşacak.",
                "Çayımı yudumlarken sana bir iki numara öğreteyim.",
                "Acele etme genç, futbol zeka işidir."
            ],
            score_goal: [
                "Tecrübe konuşuyor!",
                "Gördün mü yeğenim, bilardo gibi hesaplayacaksın bantları.",
                "Çivileri iyi okumak lazım. Rastgele vurulmaz.",
                "Nasıl astım ama köşeye? Ustaya saygı!",
                "İşte eski toprak taktiği, defansın ortasından delip geçtim."
            ],
            concede_goal: [
                "İyi atıştı, hakkını vermek lazım.",
                "Bir anlık dalgınlığıma geldi, çayımı soğuttun.",
                "Oyunu okumayı biliyorsun, fena değil.",
                "Şansın yaver gitti ufaklık, bir daha yemem.",
                "O çivi orada mıydı yahu? Gözlüğümü değiştirmeliyim."
            ],
            win: [
                "Güzel maçtı, eline sağlık. Gelişiyorsun.",
                "Tecrübe her zaman kazanır, unutma.",
                "Bir fincan çay iyi giderdi şimdi. Hesaplar senden!",
                "Daha yiyecek çok fırın ekmeğin var genç."
            ],
            loss: [
                "Bugün günümde değilim anlaşılan.",
                "Gençlik işte, enerjin bitmiyor. Yoruldum.",
                "Tebrikler, iyi oyundu. Boynuz kulağı geçiyor yavaş yavaş.",
                "Pes ediyorum, romatizmalarım tuttu."
            ]
        }
    },
    hard: {
        id: 'hard',
        name: 'Kral Kerem',
        title: 'Profesyonel Şampiyon',
        emoji: '😎',
        quotes: {
            intro: [
                "Ağlamaya hazır mısın?",
                "Sadece geometri ve fizik. Başka bir şey değil.",
                "Hadi çabuk ol, vaktim değerli.",
                "Simülasyonlarım beni 10 hamle önceden kazandırıyor.",
                "Lütfen bu maçı çabuk bitirelim, kod derlemem lazım."
            ],
            score_goal: [
                "Açı, hız ve sekme kusursuzca hesaplandı.",
                "Bunu bekliyordun değil mi? Nereye kaçabilirdin ki?",
                "Kurtarılması matematiksel olarak imkansız bir atış.",
                "Bilgisayarlar insanlardan üstündür, işte kanıtı.",
                "O çiviye 45.3 derece ile çarptırmak tam bir sanat."
            ],
            concede_goal: [
                "Şanslıydın. Algoritmamda bir anomali oluştu.",
                "İlginç bir açı, bunu veri tabanıma kaydetmeliyim.",
                "Beklenmedik insan mantıksızlığı... Bir daha o şutu atamazsın.",
                "Demek bir donanım gecikmesi yaşadım...",
                "Hatasız kul olmaz derler, botlar için de geçerli sanırım."
            ],
            win: [
                "Beklenen sonuç. Makine her zaman kazanır.",
                "Matematik asla yalan söylemez.",
                "Karşılaşma verilerimi optimize edeyim bari.",
                "Eğer beynine biraz RAM takviyesi yaparsan belki yenersin."
            ],
            loss: [
                "İmkansız! Simülasyonlarımda ciddi bir bug olmalı!",
                "Bu... kabul edilemez. Üstünlüğümü nasıl alt edebilirsin?",
                "Sadece istatistiksel bir hataydı. Asla tekrarlanmayacak.",
                "Sunucumda ping var eminim hile yaptın! Geliştiricimi arayacağım!"
            ]
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
