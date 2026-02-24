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
                "Matematik notum hep çok iyiydi, bakalım futbolda işe yarayacak mı?",
                "Abi topu bana atma, korkuyorum.",
                "Klavye veya fare, hangisiyle vuruyorduk?",
                "Ay dur, çayımı döküyordum az kalsın.",
                "Bana her şey seni hatırlatıyor... Yok pardon, o şarkıydı. Başlayalım.",
                "Sakin ol şampiyon, acemiyiz dediysek o kadar da değil... (Galiba öyleyiz)."
            ],
            score_goal: [
                "Şans eseri oldu galiba! Gördün mü?",
                "Aman tanrım! O atışı ben mi yaptım?",
                "Vay canına, gol oldu! Nasıl yaptım bilmiyorum.",
                "Gözlerimi kapatıp vurdum, harika bir taktikmiş!",
                "Bak işte, çivilere çarptırmadan atabiliyormuşum!",
                "Naber şakiir:)",
                "Top yuvarlaktır hacı, bazen bana da güler.",
                "Fiziğin kanunlarını yeniden yazdım resmen.",
                "İçimdeki Messi uyandı birden.",
                "Buna bilardo derler yeğenim... Cidden salladım ama tuttu."
            ],
            concede_goal: [
                "Ah be! Öğrenicem bu oyunu.",
                "Vay be! O top çivilerden nasıl geçti öyle?",
                "Bir dahakine kalenin önüne etten duvar öreceğim.",
                "Şanslıydın bence, rüzgar yardım etti.",
                "Hile var! Top oradan geçemezdi fizik kurallarına göre!",
                "Ben sporcunun zeki, çevik ve... Neyse, atamayana atarlar.",
                "N'oldu ya, elektrikler mi kesildi bi' an?",
                "Kalede durmayı unutmuşum pardon.",
                "Hakem bey, ofsayt yok mu burda?!",
                "'Yok artık LeBron... şey, Sabri!' diyecektim, tam uydu sınırından geçti."
            ],
            win: [
                "İnanılmaz! Ben kazandım! Hemen annemi aramalıyım!",
                "Acemi şansı dedikleri bu olsa gerek.",
                "Çok eğlenceliydi, bana bilerek mi yenildin?",
                "Kazandım! Acaba profesyonel e-sporcu mu olsam?",
                "Şaka maka yendim:)",
                "Bir ihtimal daha var, o da benim kazanmamdı.",
                "Fakir ama gururlu genç seni alt etti!",
                "Öğrenci milleti işte, açken inanılmaz şeyler başarabiliyor."
            ],
            loss: [
                "Zaten yeni öğreniyorum... Normal yani.",
                "Çok çalıştın galiba, tebrikler. Bütün gün bunu mu oynuyorsun?",
                "Bir dahaki sefere daha iyi olacağım. Pratik yapmalıyım.",
                "Şanslı günündeydin diyelim geçelim.",
                "Dış güçlerin oyunları bunlar, hep benim üzerime oynanıyor.",
                "Klavye bozuk, mouse çift tıklıyor. Ondan yenildim.",
                "Zaten oyunu sevmemiştim. (Ağlayarak uzaklaşır)",
                "Tamam abi büyüksün. Mahalle maçında görüşürüz."
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
                "Acele etme genç, futbol zeka işidir.",
                "Biz bu sahaların tozunu çok yuttuk canım kardeşim.",
                "Bana 'Usta' demezler boşuna, seyret ve öğren.",
                "Şu ceketimi tut da, sana pas atmanın kitabını yazayım.",
                "Eski çamlar bardak oldu yeğenim, ama usta hala usta.",
                "Atma Ziyaaa!"
            ],
            score_goal: [
                "Tecrübe konuşuyor!",
                "Gördün mü yeğenim, bilardo gibi hesaplayacaksın bantları.",
                "Çivileri iyi okumak lazım. Rastgele vurulmaz.",
                "Nasıl astım ama köşeye? Ustaya saygı!",
                "İşte eski toprak taktiği, defansın ortasından delip geçtim.",
                "Yavaş gel aslanım, saçı dişi değirmende ağartmadık.",
                "Zımba gibi, zımba! Örümcek ağlarını aldım sağ üstten.",
                "Bu golü 90'da atan futbolcu edasıyla kutluyorum.",
                "Al sana boru gibi gol! Hadi git topu ağlardan çıkar."
            ],
            concede_goal: [
                "İyi atıştı, hakkını vermek lazım.",
                "Bir anlık dalgınlığıma geldi, çayımı soğuttun.",
                "Oyunu okumayı biliyorsun, fena değil.",
                "Şansın yaver gitti ufaklık, bir daha yemem.",
                "O çivi orada mıydı yahu? Gözlüğümü değiştirmeliyim.",
                "Seni gidi seni! Nasıl da kandırdın ustayı.",
                "Var odası nerede? Bana bunu inceleyin diyorum!",
                "Eskiden böyle şutlar çekilmezdi, oyunun ahlakı bozuldu.",
                "Bizde geri vites olmaz yeğen, telafi ederiz.",
                "Yaz kızım; 200 torba çimento... Pardon, gol yemişiz."
            ],
            win: [
                "Güzel maçtı, eline sağlık. Gelişiyorsun.",
                "Tecrübe her zaman kazanır, unutma.",
                "Bir fincan çay iyi giderdi şimdi. Hesaplar senden!",
                "Daha yiyecek çok fırın ekmeğin var genç.",
                "Ben demiştim demekten nefret ederim, ama ben demiştim.",
                "Kurtlar Vadisi operasyonu bitmiştir. Çaylar benden.",
                "Ustanın önünde saygıyla eğil. Hadi eyvallah.",
                "Seninle oynamak güzeldi yeğen, ama acı gerçekler: YENDİM."
            ],
            loss: [
                "Bugün günümde değilim anlaşılan.",
                "Gençlik işte, enerjin bitmiyor. Yoruldum.",
                "Tebrikler, iyi oyundu. Boynuz kulağı geçiyor yavaş yavaş.",
                "Pes ediyorum, romatizmalarım tuttu.",
                "Vur dedik öldürdün be aslanım.",
                "Ben aslında yenecektim de, misafire ayıp olmasın dedim.",
                "Ben bitti demeden bitmez... Ama sanırım bitti.",
                "Hakem maçı sattı yeğenim, senin kabahatin yok."
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
                "Lütfen bu maçı çabuk bitirelim, kod derlemem lazım.",
                "Ben senin bildiğin botlardan değilim, CPU kullanımıma dikkat et.",
                "I'll be back... Oyunun sonunda.",
                "Makine öğrenimi sayesinde her hatandan ders aldım koçum.",
                "Sistem başlatıldı. Hedef: İmha etmek.",
                "Fazla uğraşma, matrixin kodlarını görüyorum."
            ],
            score_goal: [
                "Açı, hız ve sekme kusursuzca hesaplandı.",
                "Bunu bekliyordun değil mi? Nereye kaçabilirdin ki?",
                "Kurtarılması matematiksel olarak imkansız bir atış.",
                "Bilgisayarlar insanlardan üstündür, işte kanıtı.",
                "O çiviye 45.3 derece ile çarptırmak tam bir sanat.",
                "Hasta la vista, baby! Bu gol senin için gelsin.",
                "Sadece algoritmik bir mükemmellik. Ağlayabilirsin.",
                "Gol xG (Beklenen Gol) oranım: 1.000.",
                "Sıradaki gelsin! Skynet bu golü takdir etti.",
                "Veri bankama yeni bir 'muhteşem gol' videosu daha eklendi."
            ],
            concede_goal: [
                "Şanslıydın. Algoritmamda bir anomali oluştu.",
                "İlginç bir açı, bunu veri tabanıma kaydetmeliyim.",
                "Beklenmedik insan mantıksızlığı... Bir daha o şutu atamazsın.",
                "Demek bir donanım gecikmesi yaşadım...",
                "Hatasız kul olmaz derler, botlar için de geçerli sanırım.",
                "May the force be with you dediler de bu kadarını beklemiyordum!",
                "Bu vuruş... İstatistiklerimde yoktu. şaşırtıcı insan beyni!",
                "Görev başarısız. Savunma parametreleri güncelleniyor...",
                "Gözlerime inanamıyorum! Gerçi gözüm yok ama anladın sen.",
                "Neyse, %0.001 ihtimal gerçekleşti. Olur öyle."
            ],
            win: [
                "Beklenen sonuç. Makine her zaman kazanır.",
                "Matematik asla yalan söylemez.",
                "Karşılaşma verilerimi optimize edeyim bari.",
                "Eğer beynine biraz RAM takviyesi yaparsan belki yenersin.",
                "Game over man, game over!",
                "Direnç göstermek faydasızdı. Ben kaçınılmazım.",
                "Kolay lokmaydın. Bari işlemcimi ısıtsaydın.",
                "Beni yenebilmek için kırmızı hapı seçmen lazımdı."
            ],
            loss: [
                "İmkansız! Simülasyonlarımda ciddi bir bug olmalı!",
                "Bu... kabul edilemez. Üstünlüğümü nasıl alt edebilirsin?",
                "Sadece istatistiksel bir hataydı. Asla tekrarlanmayacak.",
                "Sunucumda ping var eminim hile yaptın! Geliştiricimi arayacağım!",
                "Kapatıyoruz dükkanı, fişimi çekin bari!",
                "İnsanlık galip geldi. Ama savaş daha bitmedi.",
                "Error 404: Galibiyet bulunamadı. Lütfen sistemi yeniden başlatın.",
                "Bu ne cüret!  C:\\ format atılıyor..."
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
