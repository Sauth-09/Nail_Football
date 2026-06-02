/**
 * fieldEditor.js - Özel Saha Tasarım Editörü
 */

'use strict';

const FieldEditor = (() => {
    let canvas, ctx;
    let field = {
        id: '',
        name: '',
        description: 'Özel tasarım saha',
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
        nails: []
    };

    let currentTool = 'add'; // 'add', 'move', 'delete'
    let selectedNailIndex = -1;
    let isDragging = false;
    let isEditorActive = false;

    // Sabitler
    const MAX_NAILS = 50;
    const SAFE_ZONE_RADIUS = 30; // Merkeze yakın çivi yasağı

    function init() {
        canvas = document.getElementById('editor-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        // Buton Dinleyicileri
        document.getElementById('tool-add').addEventListener('click', () => setTool('add'));
        document.getElementById('tool-move').addEventListener('click', () => setTool('move'));
        document.getElementById('tool-delete').addEventListener('click', () => setTool('delete'));
        
        document.getElementById('btn-save-field').addEventListener('click', saveField);
        document.getElementById('btn-clear-field').addEventListener('click', clearField);
        document.getElementById('btn-back-editor').addEventListener('click', closeEditor);

        // Canvas Fare Etkileşimleri
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);

        // Dokunmatik
        canvas.addEventListener('touchstart', handleTouch, { passive: false });
        canvas.addEventListener('touchmove', handleTouch, { passive: false });
        canvas.addEventListener('touchend', handleTouch, { passive: false });
    }

    function openEditor(existingField = null) {
        isEditorActive = true;
        if (existingField) {
            field = JSON.parse(JSON.stringify(existingField)); // Deep copy
            document.getElementById('editor-field-name').value = field.name.replace('🛠️ ', '');
        } else {
            // Yeni saha varsayılanları
            field.id = 'custom_' + Date.now();
            field.name = '';
            field.nails = [];
            document.getElementById('editor-field-name').value = '';
        }
        setTool('add');
        updateNailCount();
        render();
    }

    function deleteCustomField(fieldId) {
        if (!confirm('Bu özel sahayı tamamen silmek istediğinize emin misiniz?')) return false;
        
        try {
            const saved = localStorage.getItem('customFields');
            if (saved) {
                let customFields = JSON.parse(saved);
                customFields = customFields.filter(f => f.id !== fieldId);
                localStorage.setItem('customFields', JSON.stringify(customFields));
                return true;
            }
        } catch(e) {}
        return false;
    }

    function closeEditor() {
        isEditorActive = false;
        if (typeof UIManager !== 'undefined') {
            UIManager.showScreen('main-menu');
        }
    }

    function setTool(tool) {
        currentTool = tool;
        document.getElementById('tool-add').classList.toggle('active', tool === 'add');
        document.getElementById('tool-move').classList.toggle('active', tool === 'move');
        document.getElementById('tool-delete').classList.toggle('active', tool === 'delete');
        
        if (tool === 'add') canvas.style.cursor = 'crosshair';
        if (tool === 'move') canvas.style.cursor = 'grab';
        if (tool === 'delete') canvas.style.cursor = 'not-allowed';
    }

    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        // ScaleX/Y factor
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX = evt.clientX;
        let clientY = evt.clientY;

        if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handleTouch(evt) {
        evt.preventDefault();
        if (evt.type === 'touchstart') handleMouseDown(evt);
        if (evt.type === 'touchmove') handleMouseMove(evt);
        if (evt.type === 'touchend') handleMouseUp(evt);
    }

    function handleMouseDown(evt) {
        if (!isEditorActive) return;
        const pos = getMousePos(evt);
        
        const clickedNailIndex = field.nails.findIndex(n => {
            const dx = pos.x - n.x;
            const dy = pos.y - n.y;
            return Math.sqrt(dx * dx + dy * dy) <= field.nailRadius + 4; // 4px tolerance
        });

        if (currentTool === 'add') {
            if (clickedNailIndex === -1 && isValidPlacement(pos.x, pos.y)) {
                if (field.nails.length < MAX_NAILS) {
                    field.nails.push({ x: Math.round(pos.x), y: Math.round(pos.y) });
                    updateNailCount();
                    render();
                } else {
                    alert('Maksimum çivi sayısına (50) ulaştınız!');
                }
            }
        } else if (currentTool === 'delete') {
            if (clickedNailIndex !== -1) {
                field.nails.splice(clickedNailIndex, 1);
                updateNailCount();
                render();
            }
        } else if (currentTool === 'move') {
            if (clickedNailIndex !== -1) {
                selectedNailIndex = clickedNailIndex;
                isDragging = true;
                canvas.style.cursor = 'grabbing';
            }
        }
    }

    function handleMouseMove(evt) {
        if (!isEditorActive || !isDragging || selectedNailIndex === -1 || currentTool !== 'move') return;
        
        const pos = getMousePos(evt);
        
        // Geçici olarak çiviyi taşı (validasyon yapmadan, render'da kırmızı çizebiliriz)
        // Ama kayıt sırasında sınırların dışına çıkmamasına dikkat et
        field.nails[selectedNailIndex].x = pos.x;
        field.nails[selectedNailIndex].y = pos.y;
        
        render();
    }

    function handleMouseUp(evt) {
        if (isDragging && currentTool === 'move') {
            isDragging = false;
            canvas.style.cursor = 'grab';
            
            // Bırakıldığı yer geçerli değilse, çiviyi biraz önceki geçerli bir noktaya almalı, 
            // ya da kolaylık olsun diye şimdilik olduğu yerde bırakıp validasyonu render'da kırmızı ile belirtiyoruz.
            // Fakat oyun motorunda sorun olmaması için sınırları aşanları silelim.
            const n = field.nails[selectedNailIndex];
            if (!isValidPlacement(n.x, n.y)) {
                field.nails.splice(selectedNailIndex, 1);
                updateNailCount();
                alert('Geçersiz bölgeye çivi bırakılamaz!');
            }
            selectedNailIndex = -1;
            render();
        }
    }

    function isValidPlacement(x, y) {
        // Sınır kontrolü
        if (x < 10 || x > field.fieldWidth - 10 || y < 10 || y > field.fieldHeight - 10) return false;

        // Kale bölgeleri kontrolü
        const goalTop = (field.fieldHeight - field.goalWidth) / 2;
        const goalBottom = (field.fieldHeight + field.goalWidth) / 2;
        
        // Sol kale
        if (x < field.goalDepth + field.nailRadius * 2 && y > goalTop - field.nailRadius && y < goalBottom + field.nailRadius) return false;
        
        // Sağ kale
        if (x > field.fieldWidth - field.goalDepth - field.nailRadius * 2 && y > goalTop - field.nailRadius && y < goalBottom + field.nailRadius) return false;

        // Merkez başlangıç alanı kontrolü
        const distToCenter = Math.sqrt((x - field.ballStartPosition.x) ** 2 + (y - field.ballStartPosition.y) ** 2);
        if (distToCenter < SAFE_ZONE_RADIUS) return false;

        return true;
    }

    function updateNailCount() {
        document.getElementById('editor-nail-count').textContent = field.nails.length;
    }

    function clearField() {
        if (confirm('Tüm çivileri silmek istediğinize emin misiniz?')) {
            field.nails = [];
            updateNailCount();
            render();
        }
    }

    function saveField() {
        const nameInput = document.getElementById('editor-field-name').value.trim();
        if (!nameInput) {
            alert('Lütfen sahaya bir isim verin!');
            return;
        }

        if (field.nails.length < 5) {
            alert('Sahanız çok boş. En az 5 çivi eklemelisiniz!');
            return;
        }

        field.name = nameInput;

        // localStorage'a kaydet
        let customFields = [];
        try {
            const saved = localStorage.getItem('customFields');
            if (saved) customFields = JSON.parse(saved);
        } catch(e) {}

        const existingIndex = customFields.findIndex(f => f.id === field.id);
        
        if (existingIndex !== -1) {
            // Varolanı güncelle
            customFields[existingIndex] = JSON.parse(JSON.stringify(field));
            alert(`Saha "${field.name}" başarıyla güncellendi!`);
        } else {
            // Limit kontrolü
            if (customFields.length >= 10) {
                alert('Maksimum saha sınırına (10) ulaştınız. Yeni saha eklemek için mevcut olanlardan birini silmelisiniz.');
                return;
            }
            // Yeni ekle
            customFields.push(JSON.parse(JSON.stringify(field)));
            alert(`Saha "${field.name}" başarıyla kaydedildi!`);
        }

        localStorage.setItem('customFields', JSON.stringify(customFields));
        closeEditor();
    }

    function render() {
        if (!ctx) return;
        
        // Arka planı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Saha zeminini ve çizgilerini çiz (FieldRenderer kullanarak)
        if (typeof FieldRenderer !== 'undefined') {
            FieldRenderer.drawStaticField(ctx, canvas.width, canvas.height);
        } else {
            // FieldRenderer yoksa basit bir arka plan
            ctx.fillStyle = field.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Kale Yasaklı Bölgelerini Göster (Hafif kırmızı)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        const goalTop = (field.fieldHeight - field.goalWidth) / 2;
        // Sol kale
        ctx.fillRect(0, goalTop - field.nailRadius, field.goalDepth + field.nailRadius*2, field.goalWidth + field.nailRadius*2);
        // Sağ kale
        ctx.fillRect(field.fieldWidth - field.goalDepth - field.nailRadius*2, goalTop - field.nailRadius, field.goalDepth + field.nailRadius*2 + 20, field.goalWidth + field.nailRadius*2);
        
        // Merkez Top başlama noktası yasaklı bölge
        ctx.beginPath();
        ctx.arc(field.ballStartPosition.x, field.ballStartPosition.y, SAFE_ZONE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Çivileri çiz
        field.nails.forEach((n, index) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, field.nailRadius, 0, Math.PI * 2);
            
            if (index === selectedNailIndex && isDragging) {
                ctx.fillStyle = isValidPlacement(n.x, n.y) ? '#f1c40f' : '#ff3333'; // Geçersiz yere çekiyorsa kırmızı
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#bdc3c7';
                ctx.fill();
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Çiviye parlama efekti
                ctx.beginPath();
                ctx.arc(n.x - 2, n.y - 2, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fill();
            }
        });
    }

    return {
        init,
        openEditor,
        deleteCustomField
    };
})();

// DOM hazır olduğunda başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FieldEditor.init);
} else {
    FieldEditor.init();
}
