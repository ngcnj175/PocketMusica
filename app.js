/**
 * Pocket Musica - Main Application v10
 * Copy/Paste, 6 octaves, play selection
 */

class PocketMusica {
    constructor() {
        this.bpm = 120;
        this.currentStep = 0;
        this.selectedStep = 0;
        this.isPlaying = false;
        this.isRecording = false;
        this.playInterval = null;
        this.currentTrack = 0;
        this.currentPage = 0;

        this.tracks = [
            { pattern: this.createEmptyPattern(), soundType: 'pulse1', volume: 100, muted: false, division: 16, length: 16, loop: true },
            { pattern: this.createEmptyPattern(), soundType: 'pulse2', volume: 100, muted: false, division: 16, length: 16, loop: true },
            { pattern: this.createEmptyPattern(), soundType: 'triangle', volume: 100, muted: false, division: 16, length: 16, loop: true },
            { pattern: this.createEmptyPattern(), soundType: 'noise', volume: 100, muted: false, division: 16, length: 16, loop: true }
        ];

        this.soundLabels = {
            pulse1: 'PULSE',
            pulse2: 'PULSE',
            triangle: 'TRI',
            noise: 'NOISE'
        };

        // Keyboard: 6 octaves starting from C1
        this.keyboardStartOctave = 1;
        this.keyboardOctaves = 6;
        this.keyboardOffset = 0;
        this.maxKeyboardOffset = 0;

        // Key dimensions (match CSS)
        this.whiteKeyWidth = 44;
        this.blackKeyWidth = 28;

        this.longPressTimer = null;
        this.longPressTrack = null;
        this.delLongPressTimer = null;

        this.lastTapTime = 0;
        this.lastTapStep = -1;

        this.mixerTouchStart = {};
        this.mixerDoubleTapTime = {};

        this.trackCounters = [0, 0, 0, 0];
        this.trackPositions = [0, 0, 0, 0];

        this.scrollBarDragging = false;

        // Copy/Paste
        this.clipboard = [];
        this.selectionStart = -1;
        this.selectionEnd = -1;
        this.isSelecting = false;
        this.stepLongPressTimer = null;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderKeyboard();
        this.renderGrid();
        this.loadFromStorage();
        this.updateDisplay();
        this.preventTextSelection();

        console.log('🎹 Pocket Musica v10 initialized');
    }

    preventTextSelection() {
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('selectstart', (e) => e.preventDefault());
            btn.addEventListener('contextmenu', (e) => e.preventDefault());
        });
    }

    cacheElements() {
        this.bpmDisplay = document.getElementById('bpm-value');
        this.tempoDownBtn = document.getElementById('tempo-down');
        this.tempoUpBtn = document.getElementById('tempo-up');
        this.clearBtn = document.getElementById('btn-clear');
        this.loadBtn = document.getElementById('btn-load');
        this.saveBtn = document.getElementById('btn-save');
        this.fileInput = document.getElementById('file-input');

        this.trackTabs = document.getElementById('track-tabs');
        this.soundSelector = document.getElementById('sound-selector');

        this.keyboardWrapper = document.getElementById('keyboard-wrapper');
        this.keyboard = document.getElementById('keyboard');
        this.scrollBar = document.getElementById('keyboard-scroll-bar');
        this.scrollIndicator = document.getElementById('scroll-indicator');

        this.delBtn = document.getElementById('btn-del');
        this.restBtn = document.getElementById('btn-rest');
        this.tieBtn = document.getElementById('btn-tie');
        this.recBtn = document.getElementById('btn-rec');
        this.playStopBtn = document.getElementById('btn-play-stop');

        this.stepGrid = document.getElementById('step-grid');
        this.lenButtons = document.querySelectorAll('.len-btn');
        this.divButtons = document.querySelectorAll('.div-btn');
        this.loopBtn = document.getElementById('btn-loop');
        this.pageButtons = document.querySelectorAll('.page-btn');

        this.mixer = document.getElementById('mixer');
        this.trackMixers = document.querySelectorAll('.track-mixer');
    }

    bindEvents() {
        this.addTouchEvent(this.tempoDownBtn, () => this.changeTempo(-1));
        this.addTouchEvent(this.tempoUpBtn, () => this.changeTempo(1));

        this.addTouchEvent(this.clearBtn, () => this.clearAll());
        this.addTouchEvent(this.loadBtn, () => this.fileInput.click());
        this.addTouchEvent(this.saveBtn, () => this.saveToFile());
        this.fileInput.addEventListener('change', (e) => this.loadFromFile(e));

        this.trackTabs.querySelectorAll('.track-tab').forEach((tab, index) => {
            tab.addEventListener('mousedown', (e) => this.onTrackTabDown(index, e));
            tab.addEventListener('touchstart', (e) => { e.preventDefault(); this.onTrackTabDown(index, e); }, { passive: false });
            tab.addEventListener('mouseup', () => this.onTrackTabUp(index));
            tab.addEventListener('touchend', () => this.onTrackTabUp(index));
            tab.addEventListener('mouseleave', () => this.cancelLongPress());
            tab.addEventListener('touchcancel', () => this.cancelLongPress());
        });

        this.soundSelector.querySelectorAll('.sound-option').forEach(btn => {
            this.addTouchEvent(btn, () => this.selectSound(btn.dataset.sound));
        });

        document.addEventListener('click', (e) => {
            if (!this.soundSelector.contains(e.target) && !e.target.closest('.track-tab')) {
                this.soundSelector.classList.remove('visible');
            }
        });

        this.addTouchEvent(this.restBtn, () => this.insertRest());
        this.addTouchEvent(this.tieBtn, () => this.insertTie());
        this.addTouchEvent(this.recBtn, () => this.toggleRecording());
        this.addTouchEvent(this.playStopBtn, () => this.togglePlay());
        this.addTouchEvent(this.delBtn, () => this.handleDelete());

        this.delBtn.addEventListener('mousedown', () => this.startDelLongPress());
        this.delBtn.addEventListener('touchstart', () => this.startDelLongPress(), { passive: true });
        this.delBtn.addEventListener('mouseup', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('touchend', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('mouseleave', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('touchcancel', () => this.cancelDelLongPress());

        this.lenButtons.forEach(btn => {
            this.addTouchEvent(btn, () => this.changeLength(parseInt(btn.dataset.length)));
        });
        this.divButtons.forEach(btn => {
            this.addTouchEvent(btn, () => this.changeDivision(parseInt(btn.dataset.division)));
        });
        this.addTouchEvent(this.loopBtn, () => this.toggleLoop());

        this.pageButtons.forEach(btn => {
            this.addTouchEvent(btn, () => this.switchPage(parseInt(btn.dataset.page)));
        });

        this.scrollBar.addEventListener('mousedown', (e) => this.onScrollBarStart(e));
        this.scrollBar.addEventListener('touchstart', (e) => this.onScrollBarStart(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.onScrollBarMove(e));
        document.addEventListener('touchmove', (e) => this.onScrollBarMove(e), { passive: true });
        document.addEventListener('mouseup', () => this.onScrollBarEnd());
        document.addEventListener('touchend', () => this.onScrollBarEnd());

        this.trackMixers.forEach((mixer, index) => {
            mixer.addEventListener('touchstart', (e) => this.onMixerTouchStart(index, e), { passive: false });
            mixer.addEventListener('touchmove', (e) => this.onMixerTouchMove(index, e), { passive: true });
            mixer.addEventListener('touchend', (e) => this.onMixerTouchEnd(index, e));
            mixer.addEventListener('mousedown', (e) => this.onMixerMouseDown(index, e));
        });

        // Grid swipe events for copy selection
        this.stepGrid.addEventListener('mousedown', (e) => this.onGridMouseDown(e));
        this.stepGrid.addEventListener('touchstart', (e) => this.onGridTouchStart(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.onGridMouseMove(e));
        document.addEventListener('touchmove', (e) => this.onGridTouchMove(e), { passive: true });
        document.addEventListener('mouseup', (e) => this.onGridMouseUp(e));
        document.addEventListener('touchend', (e) => this.onGridTouchEnd(e));

        const initAudioHandler = async () => {
            await this.initAudio();
            document.removeEventListener('touchstart', initAudioHandler);
            document.removeEventListener('touchend', initAudioHandler);
            document.removeEventListener('click', initAudioHandler);
        };

        document.addEventListener('touchstart', initAudioHandler, { passive: true });
        document.addEventListener('touchend', initAudioHandler, { passive: true });
        document.addEventListener('click', initAudioHandler);
    }

    addTouchEvent(element, handler) {
        let touchHandled = false;

        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchHandled = true;
            handler();
            setTimeout(() => { touchHandled = false; }, 300);
        }, { passive: false });

        element.addEventListener('click', (e) => {
            if (!touchHandled) {
                handler();
            }
        });
    }

    async initAudio() {
        await audioEngine.init();
    }

    createEmptyPattern() {
        return Array(64).fill(null).map(() => ({
            note: null,
            type: 'empty'
        }));
    }

    // ==================== Header ====================

    clearAll() {
        if (confirm('全てのデータを初期化しますか？')) {
            this.tracks = [
                { pattern: this.createEmptyPattern(), soundType: 'pulse1', volume: 100, muted: false, division: 16, length: 16, loop: true },
                { pattern: this.createEmptyPattern(), soundType: 'pulse2', volume: 100, muted: false, division: 16, length: 16, loop: true },
                { pattern: this.createEmptyPattern(), soundType: 'triangle', volume: 100, muted: false, division: 16, length: 16, loop: true },
                { pattern: this.createEmptyPattern(), soundType: 'noise', volume: 100, muted: false, division: 16, length: 16, loop: true }
            ];
            this.bpm = 120;
            this.selectedStep = 0;
            this.currentTrack = 0;
            this.currentPage = 0;

            this.updateDisplay();
            this.renderGrid();
            this.showToast('🗑️ 初期化しました');
        }
    }

    saveToFile() {
        const defaultName = `pocket_musica_${new Date().toISOString().slice(0, 10)}`;
        const fileName = prompt('ファイル名を入力:', defaultName);

        if (fileName) {
            const data = {
                version: 10,
                bpm: this.bpm,
                tracks: this.tracks,
                savedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('💾 保存しました');
        }
    }

    loadFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.bpm = data.bpm || 120;
                this.tracks = data.tracks || this.tracks;
                this.selectedStep = 0;

                this.updateDisplay();
                this.renderGrid();
                this.showToast('📂 ロードしました');
            } catch (err) {
                this.showToast('❌ 読み込み失敗');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // ==================== Track Tabs ====================

    onTrackTabDown(index, e) {
        this.longPressTrack = index;
        this.longPressTimer = setTimeout(() => {
            this.showSoundSelector(index);
        }, 500);
    }

    onTrackTabUp(index) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;

            if (!this.soundSelector.classList.contains('visible')) {
                this.switchTrack(index);
            }
        }
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    showSoundSelector(trackIndex) {
        this.longPressTrack = trackIndex;
        this.soundSelector.classList.add('visible');
    }

    selectSound(soundType) {
        if (this.longPressTrack !== null) {
            this.tracks[this.longPressTrack].soundType = soundType;
            this.updateTrackTabs();
            this.soundSelector.classList.remove('visible');
            this.autoSave();
        }
    }

    switchTrack(index) {
        this.currentTrack = index;
        this.selectedStep = Math.min(this.selectedStep, this.tracks[index].length - 1);
        this.updateTrackTabs();
        this.updateControlButtons();
        this.updatePageButtons();
        this.renderGrid();
    }

    updateTrackTabs() {
        this.trackTabs.querySelectorAll('.track-tab').forEach((tab, index) => {
            tab.classList.toggle('active', index === this.currentTrack);
            tab.querySelector('.track-type').textContent = this.soundLabels[this.tracks[index].soundType];
        });
    }

    updateControlButtons() {
        const track = this.tracks[this.currentTrack];

        this.lenButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.length) === track.length);
        });

        this.divButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.division) === track.division);
        });

        this.loopBtn.classList.toggle('active', track.loop);
    }

    updatePageButtons() {
        const track = this.tracks[this.currentTrack];

        this.pageButtons.forEach(btn => {
            const page = parseInt(btn.dataset.page);
            btn.classList.toggle('active', page === this.currentPage);

            if (page === 1) {
                btn.classList.toggle('disabled', track.length <= 32);
            }
        });
    }

    switchPage(page) {
        const track = this.tracks[this.currentTrack];
        if (page === 1 && track.length <= 32) return;

        this.currentPage = page;
        this.updatePageButtons();
        this.renderGrid();
    }

    // ==================== Keyboard ====================

    renderKeyboard() {
        this.keyboard.innerHTML = '';

        const whiteKeyWidth = this.whiteKeyWidth;
        const blackKeyWidth = this.blackKeyWidth;

        const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackKeyData = [
            { note: 'C#', afterWhiteIndex: 0 },
            { note: 'D#', afterWhiteIndex: 1 },
            { note: 'F#', afterWhiteIndex: 3 },
            { note: 'G#', afterWhiteIndex: 4 },
            { note: 'A#', afterWhiteIndex: 5 }
        ];

        // Create white keys first
        for (let oct = this.keyboardStartOctave; oct < this.keyboardStartOctave + this.keyboardOctaves; oct++) {
            const octaveIndex = oct - this.keyboardStartOctave;

            whiteNotes.forEach((note, i) => {
                const key = document.createElement('button');
                key.className = 'key';
                key.textContent = `${note}${oct}`;
                key.dataset.note = note;
                key.dataset.octave = oct;
                key.dataset.fullNote = `${note}${oct}`;

                const leftPos = (octaveIndex * 7 + i) * whiteKeyWidth;
                key.style.left = `${leftPos}px`;

                this.addKeyEvents(key);
                this.keyboard.appendChild(key);
            });
        }

        // Create black keys
        for (let oct = this.keyboardStartOctave; oct < this.keyboardStartOctave + this.keyboardOctaves; oct++) {
            const octaveIndex = oct - this.keyboardStartOctave;

            blackKeyData.forEach(({ note, afterWhiteIndex }) => {
                const key = document.createElement('button');
                key.className = 'key black';
                key.textContent = `${note.replace('#', '♯')}${oct}`;
                key.dataset.note = note;
                key.dataset.octave = oct;
                key.dataset.fullNote = `${note}${oct}`;

                const whiteKeyPosition = octaveIndex * 7 + afterWhiteIndex;
                const leftPos = (whiteKeyPosition + 1) * whiteKeyWidth - (blackKeyWidth / 2);
                key.style.left = `${leftPos}px`;

                this.addKeyEvents(key);
                this.keyboard.appendChild(key);
            });
        }

        const totalWhiteKeys = this.keyboardOctaves * 7;
        const totalWidth = totalWhiteKeys * whiteKeyWidth;

        this.keyboard.style.width = `${totalWidth}px`;

        // Calculate scroll range and set initial position to C3
        setTimeout(() => {
            const viewWidth = this.keyboardWrapper?.offsetWidth || 340;
            this.maxKeyboardOffset = Math.max(0, totalWidth - viewWidth);

            // Start at C3: C3 is at octave index 2 (from C1), so offset = 2 * 7 * whiteKeyWidth
            const c3Offset = 2 * 7 * whiteKeyWidth;
            this.setKeyboardScroll(c3Offset);
        }, 50);
    }

    addKeyEvents(key) {
        const startNote = async () => {
            await audioEngine.init();
            await audioEngine.resume();

            const fullNote = key.dataset.fullNote;
            const soundType = this.tracks[this.currentTrack].soundType;
            audioEngine.startNote(fullNote, soundType, this.currentTrack);
            key.classList.add('active');

            if (this.isRecording) {
                this.insertNote(fullNote);
            }
        };

        const stopNote = () => {
            const fullNote = key.dataset.fullNote;
            audioEngine.stopNote(fullNote, this.currentTrack);
            key.classList.remove('active');
        };

        key.addEventListener('mousedown', startNote);
        key.addEventListener('touchstart', (e) => { e.preventDefault(); startNote(); }, { passive: false });
        key.addEventListener('mouseup', stopNote);
        key.addEventListener('touchend', stopNote);
        key.addEventListener('mouseleave', stopNote);
        key.addEventListener('touchcancel', stopNote);
    }

    onScrollBarStart(e) {
        e.preventDefault();
        this.scrollBarDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        this.scrollBarStartX = clientX;
        this.scrollBarStartOffset = this.keyboardOffset;
    }

    onScrollBarMove(e) {
        if (!this.scrollBarDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const barWidth = this.scrollBar.offsetWidth;
        const indicatorWidth = this.scrollIndicator.offsetWidth;
        const deltaX = clientX - this.scrollBarStartX;

        const scrollableWidth = barWidth - indicatorWidth;
        const ratio = this.maxKeyboardOffset / scrollableWidth;

        const newOffset = this.scrollBarStartOffset + (deltaX * ratio);
        this.setKeyboardScroll(newOffset);
    }

    onScrollBarEnd() {
        this.scrollBarDragging = false;
    }

    setKeyboardScroll(offset) {
        this.keyboardOffset = Math.max(0, Math.min(this.maxKeyboardOffset, offset));
        this.keyboard.style.transform = `translateX(-${this.keyboardOffset}px)`;

        const barWidth = this.scrollBar.offsetWidth;
        const indicatorWidth = this.scrollIndicator.offsetWidth;
        const scrollableWidth = barWidth - indicatorWidth;
        const indicatorPos = this.maxKeyboardOffset > 0
            ? (this.keyboardOffset / this.maxKeyboardOffset) * scrollableWidth
            : 0;
        this.scrollIndicator.style.left = `${indicatorPos}px`;
    }

    // ==================== Grid Copy/Paste ====================

    getStepIndexFromElement(element) {
        const stepEl = element.closest('.step');
        if (!stepEl) return -1;

        const steps = Array.from(this.stepGrid.children);
        const localIndex = steps.indexOf(stepEl);
        if (localIndex === -1) return -1;

        return this.currentPage * 32 + localIndex;
    }

    onGridMouseDown(e) {
        const stepIndex = this.getStepIndexFromElement(e.target);
        if (stepIndex === -1) return;

        const track = this.tracks[this.currentTrack];
        if (stepIndex >= track.length) return;

        this.isSelecting = true;
        this.selectionStart = stepIndex;
        this.selectionEnd = stepIndex;

        // Start long press timer for paste
        this.stepLongPressTimer = setTimeout(() => {
            if (this.clipboard.length > 0) {
                this.pasteAtStep(stepIndex);
            }
            this.isSelecting = false;
        }, 600);
    }

    onGridTouchStart(e) {
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const stepIndex = this.getStepIndexFromElement(element);
        if (stepIndex === -1) return;

        const track = this.tracks[this.currentTrack];
        if (stepIndex >= track.length) return;

        this.isSelecting = true;
        this.selectionStart = stepIndex;
        this.selectionEnd = stepIndex;

        // Start long press timer for paste
        this.stepLongPressTimer = setTimeout(() => {
            if (this.clipboard.length > 0) {
                this.pasteAtStep(stepIndex);
            }
            this.isSelecting = false;
        }, 600);
    }

    onGridMouseMove(e) {
        if (!this.isSelecting) return;

        // Cancel long press if moving
        if (this.stepLongPressTimer) {
            clearTimeout(this.stepLongPressTimer);
            this.stepLongPressTimer = null;
        }

        const stepIndex = this.getStepIndexFromElement(e.target);
        if (stepIndex === -1) return;

        const track = this.tracks[this.currentTrack];
        if (stepIndex >= track.length) return;

        this.selectionEnd = stepIndex;
        this.renderGrid();
    }

    onGridTouchMove(e) {
        if (!this.isSelecting) return;

        // Cancel long press if moving
        if (this.stepLongPressTimer) {
            clearTimeout(this.stepLongPressTimer);
            this.stepLongPressTimer = null;
        }

        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const stepIndex = this.getStepIndexFromElement(element);
        if (stepIndex === -1) return;

        const track = this.tracks[this.currentTrack];
        if (stepIndex >= track.length) return;

        this.selectionEnd = stepIndex;
        this.renderGrid();
    }

    onGridMouseUp(e) {
        if (this.stepLongPressTimer) {
            clearTimeout(this.stepLongPressTimer);
            this.stepLongPressTimer = null;
        }

        if (!this.isSelecting) return;
        this.isSelecting = false;

        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);

        if (start === end) {
            // Single tap - just select
            this.selectedStep = start;
            this.selectionStart = -1;
            this.selectionEnd = -1;

            const track = this.tracks[this.currentTrack];
            const step = track.pattern[start];
            if (step.type === 'note' && step.note) {
                audioEngine.resume();
                audioEngine.playNote(step.note, track.soundType, 0.2, this.currentTrack);
            }
        } else {
            // Range selection - copy
            this.copyRange(start, end);
        }

        this.renderGrid();
    }

    onGridTouchEnd(e) {
        if (this.stepLongPressTimer) {
            clearTimeout(this.stepLongPressTimer);
            this.stepLongPressTimer = null;
        }

        if (!this.isSelecting) return;
        this.isSelecting = false;

        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);

        if (start === end) {
            // Single tap - just select
            this.selectedStep = start;
            this.selectionStart = -1;
            this.selectionEnd = -1;

            const track = this.tracks[this.currentTrack];
            const step = track.pattern[start];
            if (step.type === 'note' && step.note) {
                audioEngine.resume();
                audioEngine.playNote(step.note, track.soundType, 0.2, this.currentTrack);
            }
        } else {
            // Range selection - copy
            this.copyRange(start, end);
        }

        this.renderGrid();
    }

    copyRange(start, end) {
        const track = this.tracks[this.currentTrack];
        this.clipboard = [];

        for (let i = start; i <= end; i++) {
            this.clipboard.push({ ...track.pattern[i] });
        }

        this.selectionStart = -1;
        this.selectionEnd = -1;
        this.showToast(`📋 ${this.clipboard.length}ステップをコピー`);
    }

    pasteAtStep(startIndex) {
        if (this.clipboard.length === 0) return;

        const track = this.tracks[this.currentTrack];

        for (let i = 0; i < this.clipboard.length; i++) {
            const targetIndex = startIndex + i;
            if (targetIndex >= track.length) break;
            track.pattern[targetIndex] = { ...this.clipboard[i] };
        }

        this.selectionStart = -1;
        this.selectionEnd = -1;
        this.renderGrid();
        this.autoSave();
        this.showToast(`📋 ${this.clipboard.length}ステップを貼り付け`);
    }

    // ==================== Pattern Input ====================

    insertNote(note) {
        const track = this.tracks[this.currentTrack];
        track.pattern[this.selectedStep] = { note, type: 'note' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    insertRest() {
        const track = this.tracks[this.currentTrack];
        track.pattern[this.selectedStep] = { note: null, type: 'rest' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    insertTie() {
        const track = this.tracks[this.currentTrack];
        track.pattern[this.selectedStep] = { note: null, type: 'tie' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    handleDelete() {
        const track = this.tracks[this.currentTrack];
        const step = track.pattern[this.selectedStep];

        if (step.type !== 'empty') {
            track.pattern[this.selectedStep] = { note: null, type: 'empty' };
        } else {
            if (this.selectedStep > 0) {
                this.selectedStep--;
            } else {
                this.selectedStep = track.length - 1;
            }
            track.pattern[this.selectedStep] = { note: null, type: 'empty' };
        }

        this.currentPage = Math.floor(this.selectedStep / 32);
        this.updatePageButtons();
        this.renderGrid();
        this.autoSave();
    }

    startDelLongPress() {
        this.delLongPressTimer = setTimeout(() => {
            this.clearCurrentTrack();
        }, 800);
    }

    cancelDelLongPress() {
        if (this.delLongPressTimer) {
            clearTimeout(this.delLongPressTimer);
            this.delLongPressTimer = null;
        }
    }

    clearCurrentTrack() {
        this.tracks[this.currentTrack].pattern = this.createEmptyPattern();
        this.selectedStep = 0;
        this.currentPage = 0;
        this.updatePageButtons();
        this.renderGrid();
        this.autoSave();
        this.showToast(`🗑️ トラック ${this.currentTrack + 1} クリア`);
    }

    advanceStep() {
        const track = this.tracks[this.currentTrack];
        this.selectedStep = (this.selectedStep + 1) % track.length;
        this.currentPage = Math.floor(this.selectedStep / 32);
        this.updatePageButtons();
    }

    toggleRecording() {
        this.isRecording = !this.isRecording;
        this.recBtn.classList.toggle('active', this.isRecording);
    }

    // ==================== Grid ====================

    renderGrid() {
        this.stepGrid.innerHTML = '';
        const track = this.tracks[this.currentTrack];
        const pattern = track.pattern;

        const startStep = this.currentPage * 32;
        const endStep = startStep + 32;

        const selStart = Math.min(this.selectionStart, this.selectionEnd);
        const selEnd = Math.max(this.selectionStart, this.selectionEnd);

        for (let i = startStep; i < endStep; i++) {
            const step = pattern[i];
            const stepEl = document.createElement('div');
            stepEl.className = 'step';
            stepEl.dataset.index = i;

            if (step.type === 'note') stepEl.classList.add('has-note');
            if (step.type === 'rest') stepEl.classList.add('rest');
            if (step.type === 'tie') stepEl.classList.add('tie');
            if (i >= track.length) stepEl.classList.add('out-of-range');
            if (i === this.trackPositions[this.currentTrack] && this.isPlaying) stepEl.classList.add('current');
            if (i === this.selectedStep && i < track.length) stepEl.classList.add('selected');

            // Selection range highlight
            if (this.selectionStart !== -1 && i >= selStart && i <= selEnd && i < track.length) {
                stepEl.classList.add('in-selection');
            }

            const numEl = document.createElement('span');
            numEl.className = 'step-number';
            numEl.textContent = i + 1;
            stepEl.appendChild(numEl);

            const noteEl = document.createElement('span');
            noteEl.className = 'step-note';
            if (step.type === 'note' && step.note) {
                noteEl.textContent = step.note;
            } else if (step.type === 'rest') {
                noteEl.textContent = '𝄽';
            } else if (step.type === 'tie') {
                noteEl.textContent = '―';
            }
            stepEl.appendChild(noteEl);

            this.stepGrid.appendChild(stepEl);
        }
    }

    // ==================== Playback ====================

    async togglePlay() {
        if (this.isPlaying) {
            this.stop();
        } else {
            await this.play();
        }
    }

    async play() {
        await audioEngine.init();
        await audioEngine.resume();

        this.isPlaying = true;
        this.playStopBtn.classList.add('playing');

        this.trackPositions = [0, 0, 0, 0];
        this.trackCounters = [0, 0, 0, 0];

        const baseStepDuration = 60 / this.bpm / 8;

        this.playInterval = setInterval(() => {
            for (let t = 0; t < 4; t++) {
                const track = this.tracks[t];
                const pos = this.trackPositions[t];

                const ticksPerStep = 32 / track.division;
                this.trackCounters[t]++;

                if (this.trackCounters[t] >= ticksPerStep) {
                    this.trackCounters[t] = 0;

                    if (pos < track.length || track.loop) {
                        const actualPos = pos % track.length;
                        const step = track.pattern[actualPos];

                        let noteDuration = baseStepDuration * ticksPerStep;
                        if (step.type === 'note') {
                            let tieCount = 0;
                            for (let i = actualPos + 1; i < track.length; i++) {
                                if (track.pattern[i].type === 'tie') {
                                    tieCount++;
                                } else {
                                    break;
                                }
                            }
                            noteDuration *= (1 + tieCount);
                        }

                        if (step.type !== 'tie') {
                            audioEngine.playStep(step, track.soundType, noteDuration, t);
                        }

                        if (track.loop) {
                            this.trackPositions[t] = (pos + 1) % track.length;
                        } else {
                            this.trackPositions[t] = pos + 1;
                        }
                    }
                }
            }

            this.renderGrid();
        }, baseStepDuration * 1000);
    }

    stop() {
        this.isPlaying = false;
        this.playStopBtn.classList.remove('playing');
        this.trackPositions = [0, 0, 0, 0];
        this.trackCounters = [0, 0, 0, 0];

        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }

        audioEngine.stopAllNotes();
        this.renderGrid();
    }

    // ==================== Controls ====================

    changeTempo(delta) {
        this.bpm = Math.max(40, Math.min(300, this.bpm + delta));
        this.updateDisplay();

        if (this.isPlaying) {
            this.stop();
            this.play();
        }
        this.autoSave();
    }

    changeLength(newLength) {
        const track = this.tracks[this.currentTrack];
        track.length = newLength;

        this.lenButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.length) === newLength);
        });

        if (this.selectedStep >= newLength) {
            this.selectedStep = 0;
            this.currentPage = 0;
        }

        this.updatePageButtons();
        this.renderGrid();
        this.autoSave();
    }

    changeDivision(newDivision) {
        const track = this.tracks[this.currentTrack];
        track.division = newDivision;

        this.divButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.division) === newDivision);
        });

        this.autoSave();
    }

    toggleLoop() {
        const track = this.tracks[this.currentTrack];
        track.loop = !track.loop;
        this.loopBtn.classList.toggle('active', track.loop);
        this.autoSave();
    }

    // ==================== Mixer ====================

    onMixerTouchStart(index, e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.mixerTouchStart[index] = {
            y: touch.clientY,
            volume: this.tracks[index].volume,
            time: Date.now()
        };
    }

    onMixerTouchMove(index, e) {
        if (!this.mixerTouchStart[index]) return;

        const touch = e.touches[0];
        const deltaY = this.mixerTouchStart[index].y - touch.clientY;
        const deltaVolume = Math.round(deltaY / 1.5);

        const newVolume = Math.max(1, Math.min(127, this.mixerTouchStart[index].volume + deltaVolume));
        this.setTrackVolume(index, newVolume);
    }

    onMixerTouchEnd(index, e) {
        if (!this.mixerTouchStart[index]) return;

        const now = Date.now();
        const duration = now - this.mixerTouchStart[index].time;

        if (duration < 200) {
            if (this.mixerDoubleTapTime[index] && now - this.mixerDoubleTapTime[index] < 300) {
                this.toggleMute(index);
                this.mixerDoubleTapTime[index] = null;
            } else {
                this.mixerDoubleTapTime[index] = now;
            }
        }

        delete this.mixerTouchStart[index];
        this.autoSave();
    }

    onMixerMouseDown(index, e) {
        const startY = e.clientY;
        const startVolume = this.tracks[index].volume;

        const onMouseMove = (moveE) => {
            const deltaY = startY - moveE.clientY;
            const deltaVolume = Math.round(deltaY / 1.5);
            const newVolume = Math.max(1, Math.min(127, startVolume + deltaVolume));
            this.setTrackVolume(index, newVolume);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.autoSave();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setTrackVolume(trackIndex, volume) {
        this.tracks[trackIndex].volume = volume;
        audioEngine.setTrackVolume(trackIndex, volume / 127);
        this.updateMixerDisplay();
    }

    toggleMute(trackIndex) {
        const muted = audioEngine.toggleMute(trackIndex);
        this.tracks[trackIndex].muted = muted;
        this.updateMixerDisplay();
        this.autoSave();
    }

    updateMixerDisplay() {
        this.trackMixers.forEach((mixer, index) => {
            const track = this.tracks[index];
            mixer.classList.toggle('muted', track.muted);
            mixer.querySelector('.mixer-volume').textContent = track.volume;
        });
    }

    updateDisplay() {
        this.bpmDisplay.textContent = this.bpm;
        this.updateTrackTabs();
        this.updateControlButtons();
        this.updatePageButtons();
        this.updateMixerDisplay();
    }

    // ==================== Storage ====================

    autoSave() {
        const data = {
            version: 10,
            bpm: this.bpm,
            tracks: this.tracks,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('pocketmusica_song', JSON.stringify(data));
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('pocketmusica_song');
            if (!saved) return;

            const data = JSON.parse(saved);

            this.bpm = data.bpm || 120;

            if (data.tracks) {
                this.tracks = data.tracks.map((t) => ({
                    pattern: t.pattern || this.createEmptyPattern(),
                    soundType: t.soundType || 'pulse1',
                    volume: t.volume || 100,
                    muted: t.muted || false,
                    division: t.division || 16,
                    length: t.length || 16,
                    loop: t.loop !== undefined ? t.loop : true
                }));
            }

            console.log('📂 Loaded saved song');
        } catch (error) {
            console.error('Load failed:', error);
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 240, 255, 0.9);
            color: #000;
            padding: 8px 16px;
            border-radius: 16px;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            z-index: 1000;
            animation: fadeInOut 2s ease-in-out forwards;
        `;
        toast.textContent = message;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            style.remove();
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new PocketMusica();
});
