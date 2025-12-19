/**
 * Pocket Musica - Main Application v3
 * Multi-track chiptune sequencer
 */

class PocketMusica {
    constructor() {
        // State
        this.bpm = 120;
        this.patternLength = 16;
        this.division = 16;
        this.currentStep = 0;
        this.selectedStep = 0;
        this.isPlaying = false;
        this.isRecording = false;
        this.playInterval = null;
        this.currentTrack = 0;

        // Track data
        this.tracks = [
            { pattern: this.createEmptyPattern(), soundType: 'pulse1', volume: 100, muted: false },
            { pattern: this.createEmptyPattern(), soundType: 'pulse2', volume: 100, muted: false },
            { pattern: this.createEmptyPattern(), soundType: 'triangle', volume: 100, muted: false },
            { pattern: this.createEmptyPattern(), soundType: 'noise', volume: 100, muted: false }
        ];

        // Sound type labels
        this.soundLabels = {
            pulse1: 'PULSE',
            pulse2: 'PULSE',
            triangle: 'TRI',
            noise: 'NOISE'
        };

        // Keyboard settings - 4 octaves (C2 to B5)
        this.keyboardStartOctave = 2;
        this.keyboardOctaves = 4;
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Long press handling
        this.longPressTimer = null;
        this.longPressTrack = null;
        this.delLongPressTimer = null;

        // Double tap detection
        this.lastTapTime = 0;
        this.lastTapStep = -1;

        // Mixer swipe handling
        this.mixerTouchStart = {};
        this.mixerDoubleTapTime = {};

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderKeyboard();
        this.renderGrid();
        this.loadFromStorage();
        this.updateDisplay();

        console.log('🎹 Pocket Musica v3 initialized');
    }

    cacheElements() {
        // Header
        this.bpmDisplay = document.getElementById('bpm-value');
        this.tempoDownBtn = document.getElementById('tempo-down');
        this.tempoUpBtn = document.getElementById('tempo-up');
        this.clearBtn = document.getElementById('btn-clear');
        this.loadBtn = document.getElementById('btn-load');
        this.saveBtn = document.getElementById('btn-save');
        this.fileInput = document.getElementById('file-input');

        // Track tabs
        this.trackTabs = document.getElementById('track-tabs');
        this.soundSelector = document.getElementById('sound-selector');

        // Keyboard
        this.keyboardWrapper = document.getElementById('keyboard-wrapper');
        this.keyboard = document.getElementById('keyboard');

        // Seq controls
        this.delBtn = document.getElementById('btn-del');
        this.restBtn = document.getElementById('btn-rest');
        this.tieBtn = document.getElementById('btn-tie');
        this.recBtn = document.getElementById('btn-rec');

        // Grid
        this.stepGrid = document.getElementById('step-grid');
        this.lenButtons = document.querySelectorAll('.len-btn');
        this.divButtons = document.querySelectorAll('.div-btn');

        // Player
        this.playStopBtn = document.getElementById('btn-play-stop');
        this.mixer = document.getElementById('mixer');
        this.trackMixers = document.querySelectorAll('.track-mixer');
    }

    bindEvents() {
        // Tempo (±1)
        this.tempoDownBtn.addEventListener('click', () => this.changeTempo(-1));
        this.tempoUpBtn.addEventListener('click', () => this.changeTempo(1));

        // Header buttons
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.loadBtn.addEventListener('click', () => this.fileInput.click());
        this.saveBtn.addEventListener('click', () => this.saveToFile());
        this.fileInput.addEventListener('change', (e) => this.loadFromFile(e));

        // Track tabs
        this.trackTabs.querySelectorAll('.track-tab').forEach((tab, index) => {
            tab.addEventListener('mousedown', (e) => this.onTrackTabDown(index, e));
            tab.addEventListener('touchstart', (e) => this.onTrackTabDown(index, e));
            tab.addEventListener('mouseup', () => this.onTrackTabUp(index));
            tab.addEventListener('touchend', () => this.onTrackTabUp(index));
            tab.addEventListener('mouseleave', () => this.cancelLongPress());
            tab.addEventListener('touchcancel', () => this.cancelLongPress());
        });

        // Sound selector options
        this.soundSelector.querySelectorAll('.sound-option').forEach(btn => {
            btn.addEventListener('click', () => this.selectSound(btn.dataset.sound));
        });

        // Close sound selector on outside click
        document.addEventListener('click', (e) => {
            if (!this.soundSelector.contains(e.target) && !e.target.closest('.track-tab')) {
                this.soundSelector.classList.remove('visible');
            }
        });

        // Seq controls
        this.restBtn.addEventListener('click', () => this.insertRest());
        this.tieBtn.addEventListener('click', () => this.insertTie());
        this.recBtn.addEventListener('click', () => this.toggleRecording());

        // DEL - short press: delete previous, long press: clear track
        this.delBtn.addEventListener('click', () => this.deletePrevious());
        this.delBtn.addEventListener('mousedown', () => this.startDelLongPress());
        this.delBtn.addEventListener('touchstart', () => this.startDelLongPress());
        this.delBtn.addEventListener('mouseup', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('touchend', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('mouseleave', () => this.cancelDelLongPress());
        this.delBtn.addEventListener('touchcancel', () => this.cancelDelLongPress());

        // Length buttons
        this.lenButtons.forEach(btn => {
            btn.addEventListener('click', () => this.changeLength(parseInt(btn.dataset.length)));
        });

        // Division buttons
        this.divButtons.forEach(btn => {
            btn.addEventListener('click', () => this.changeDivision(parseInt(btn.dataset.division)));
        });

        // Play/Stop
        this.playStopBtn.addEventListener('click', () => this.togglePlay());

        // Mixer - swipe for volume, double tap for mute
        this.trackMixers.forEach((mixer, index) => {
            mixer.addEventListener('touchstart', (e) => this.onMixerTouchStart(index, e));
            mixer.addEventListener('touchmove', (e) => this.onMixerTouchMove(index, e));
            mixer.addEventListener('touchend', (e) => this.onMixerTouchEnd(index, e));

            // Mouse support
            mixer.addEventListener('mousedown', (e) => this.onMixerMouseDown(index, e));
        });

        // Init audio on first interaction
        document.addEventListener('touchstart', () => this.initAudio(), { once: true });
        document.addEventListener('click', () => this.initAudio(), { once: true });
    }

    async initAudio() {
        await audioEngine.init();
    }

    createEmptyPattern() {
        return Array(32).fill(null).map(() => ({
            note: null,
            type: 'empty'
        }));
    }

    // ==================== Header Functions ====================

    clearAll() {
        if (confirm('全てのデータを初期化しますか？')) {
            this.tracks = [
                { pattern: this.createEmptyPattern(), soundType: 'pulse1', volume: 100, muted: false },
                { pattern: this.createEmptyPattern(), soundType: 'pulse2', volume: 100, muted: false },
                { pattern: this.createEmptyPattern(), soundType: 'triangle', volume: 100, muted: false },
                { pattern: this.createEmptyPattern(), soundType: 'noise', volume: 100, muted: false }
            ];
            this.bpm = 120;
            this.patternLength = 16;
            this.division = 16;
            this.currentStep = 0;
            this.selectedStep = 0;
            this.currentTrack = 0;

            this.updateDisplay();
            this.renderGrid();
            this.showToast('🗑️ 初期化しました');
        }
    }

    saveToFile() {
        const defaultName = `pocket_musica_${new Date().toISOString().slice(0, 10)}`;
        const fileName = prompt('ファイル名を入力してください:', defaultName);

        if (fileName) {
            const data = {
                version: 3,
                bpm: this.bpm,
                patternLength: this.patternLength,
                division: this.division,
                tracks: this.tracks,
                savedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.json`;
            a.click();
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
                this.patternLength = data.patternLength || 16;
                this.division = data.division || 16;
                this.tracks = data.tracks || this.tracks;
                this.currentStep = 0;
                this.selectedStep = 0;

                this.updateDisplay();
                this.renderGrid();
                this.showToast('📂 ロードしました');
            } catch (err) {
                this.showToast('❌ ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);

        // Reset input
        event.target.value = '';
    }

    // ==================== Track Tabs ====================

    onTrackTabDown(index, e) {
        e.preventDefault();
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
        this.selectedStep = 0;
        this.updateTrackTabs();
        this.renderGrid();
    }

    updateTrackTabs() {
        this.trackTabs.querySelectorAll('.track-tab').forEach((tab, index) => {
            tab.classList.toggle('active', index === this.currentTrack);
            tab.querySelector('.track-type').textContent = this.soundLabels[this.tracks[index].soundType];
        });
    }

    // ==================== Keyboard ====================

    renderKeyboard() {
        this.keyboard.innerHTML = '';

        // Generate 4 octaves of keys
        for (let oct = this.keyboardStartOctave; oct < this.keyboardStartOctave + this.keyboardOctaves; oct++) {
            const octaveIndex = oct - this.keyboardStartOctave;

            // White keys for this octave
            ['C', 'D', 'E', 'F', 'G', 'A', 'B'].forEach((note, noteIndex) => {
                const key = document.createElement('button');
                key.className = 'key';
                key.textContent = `${note}${octaveIndex}`;
                key.dataset.note = note;
                key.dataset.octave = oct;
                key.dataset.fullNote = `${note}${oct}`;

                this.addKeyEvents(key);
                this.keyboard.appendChild(key);
            });
        }

        // Black keys - positioned absolutely
        let whiteKeyIndex = 0;
        for (let oct = this.keyboardStartOctave; oct < this.keyboardStartOctave + this.keyboardOctaves; oct++) {
            const octaveIndex = oct - this.keyboardStartOctave;
            const blackKeyOffsets = [0.7, 1.7, 3.7, 4.7, 5.7]; // Positions relative to white keys
            const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];

            blackNotes.forEach((note, i) => {
                const key = document.createElement('button');
                key.className = 'key black';
                key.textContent = `${note.replace('#', '♯')}${octaveIndex}`;
                key.dataset.note = note;
                key.dataset.octave = oct;
                key.dataset.fullNote = `${note}${oct}`;

                // Position based on white key width (36px + 2px gap = 38px)
                const baseOffset = octaveIndex * 7 * 38; // 7 white keys per octave
                const keyOffset = blackKeyOffsets[i] * 38;
                key.style.left = `${baseOffset + keyOffset}px`;

                this.addKeyEvents(key);
                this.keyboard.appendChild(key);
            });
        }

        // Scroll to middle (octave 4)
        setTimeout(() => {
            const scrollTo = 2 * 7 * 38; // Scroll to octave 4 (index 2)
            this.keyboardWrapper.scrollLeft = scrollTo;
        }, 100);
    }

    addKeyEvents(key) {
        const startNote = () => {
            audioEngine.resume();
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
        key.addEventListener('touchstart', (e) => { e.preventDefault(); startNote(); });
        key.addEventListener('mouseup', stopNote);
        key.addEventListener('touchend', stopNote);
        key.addEventListener('mouseleave', stopNote);
        key.addEventListener('touchcancel', stopNote);
    }

    // ==================== Pattern Input ====================

    insertNote(note) {
        const pattern = this.tracks[this.currentTrack].pattern;
        pattern[this.selectedStep] = { note, type: 'note' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    insertRest() {
        const pattern = this.tracks[this.currentTrack].pattern;
        pattern[this.selectedStep] = { note: null, type: 'rest' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    insertTie() {
        const pattern = this.tracks[this.currentTrack].pattern;
        pattern[this.selectedStep] = { note: null, type: 'tie' };
        this.advanceStep();
        this.renderGrid();
        this.autoSave();
    }

    deletePrevious() {
        const pattern = this.tracks[this.currentTrack].pattern;

        if (this.selectedStep > 0) {
            this.selectedStep--;
        } else {
            this.selectedStep = this.patternLength - 1;
        }

        pattern[this.selectedStep] = { note: null, type: 'empty' };
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
        this.renderGrid();
        this.autoSave();
        this.showToast(`🗑️ トラック ${this.currentTrack + 1} をクリアしました`);
    }

    advanceStep() {
        this.selectedStep = (this.selectedStep + 1) % this.patternLength;
    }

    toggleRecording() {
        this.isRecording = !this.isRecording;
        this.recBtn.classList.toggle('active', this.isRecording);
    }

    // ==================== Grid ====================

    renderGrid() {
        this.stepGrid.innerHTML = '';
        const pattern = this.tracks[this.currentTrack].pattern;

        for (let i = 0; i < 32; i++) {
            const step = pattern[i];
            const stepEl = document.createElement('div');
            stepEl.className = 'step';

            if (step.type === 'note') stepEl.classList.add('has-note');
            if (step.type === 'rest') stepEl.classList.add('rest');
            if (step.type === 'tie') stepEl.classList.add('tie');
            if (i >= this.patternLength) stepEl.classList.add('out-of-range');
            if (i === this.currentStep && this.isPlaying) stepEl.classList.add('current');
            if (i === this.selectedStep) stepEl.classList.add('selected');

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

            stepEl.addEventListener('click', () => this.onStepClick(i));

            this.stepGrid.appendChild(stepEl);
        }
    }

    onStepClick(index) {
        if (index >= this.patternLength) return;

        const now = Date.now();

        if (this.lastTapStep === index && now - this.lastTapTime < 300) {
            const pattern = this.tracks[this.currentTrack].pattern;
            pattern[index] = { note: null, type: 'empty' };
            this.lastTapStep = -1;
        } else {
            this.selectedStep = index;

            const step = this.tracks[this.currentTrack].pattern[index];
            if (step.type === 'note' && step.note) {
                audioEngine.resume();
                audioEngine.playNote(step.note, this.tracks[this.currentTrack].soundType, 0.2, this.currentTrack);
            }
        }

        this.lastTapTime = now;
        this.lastTapStep = index;
        this.renderGrid();
        this.autoSave();
    }

    // ==================== Playback ====================

    togglePlay() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    async play() {
        await audioEngine.init();
        await audioEngine.resume();

        this.isPlaying = true;
        this.playStopBtn.classList.add('playing');
        this.playStopBtn.querySelector('.play-icon').textContent = '■';

        const stepDuration = 60 / this.bpm / (this.division / 4);

        this.playInterval = setInterval(() => {
            for (let t = 0; t < 4; t++) {
                const track = this.tracks[t];
                const step = track.pattern[this.currentStep];

                let noteDuration = stepDuration;
                if (step.type === 'note') {
                    let tieCount = 0;
                    for (let i = this.currentStep + 1; i < this.patternLength; i++) {
                        if (track.pattern[i].type === 'tie') {
                            tieCount++;
                        } else {
                            break;
                        }
                    }
                    noteDuration = stepDuration * (1 + tieCount);
                }

                if (step.type !== 'tie') {
                    audioEngine.playStep(step, track.soundType, noteDuration, t);
                }
            }

            this.renderGrid();

            this.currentStep = (this.currentStep + 1) % this.patternLength;
        }, stepDuration * 1000);
    }

    stop() {
        this.isPlaying = false;
        this.playStopBtn.classList.remove('playing');
        this.playStopBtn.querySelector('.play-icon').textContent = '▶';
        this.currentStep = 0;

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
        this.patternLength = newLength;
        this.lenButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.length) === newLength);
        });

        if (this.selectedStep >= newLength) this.selectedStep = 0;
        if (this.currentStep >= newLength) this.currentStep = 0;

        this.renderGrid();
        this.autoSave();
    }

    changeDivision(newDivision) {
        this.division = newDivision;
        this.divButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.division) === newDivision);
        });

        if (this.isPlaying) {
            this.stop();
            this.play();
        }
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
        const deltaVolume = Math.round(deltaY / 2); // 2px = 1 volume

        const newVolume = Math.max(0, Math.min(100, this.mixerTouchStart[index].volume + deltaVolume));
        this.setTrackVolume(index, newVolume);
    }

    onMixerTouchEnd(index, e) {
        if (!this.mixerTouchStart[index]) return;

        const now = Date.now();
        const duration = now - this.mixerTouchStart[index].time;

        // Double tap detection
        if (duration < 200) { // Quick tap
            if (this.mixerDoubleTapTime[index] && now - this.mixerDoubleTapTime[index] < 300) {
                // Double tap - toggle mute
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
        // For desktop: use scroll wheel or click-drag
        const startY = e.clientY;
        const startVolume = this.tracks[index].volume;

        const onMouseMove = (moveE) => {
            const deltaY = startY - moveE.clientY;
            const deltaVolume = Math.round(deltaY / 2);
            const newVolume = Math.max(0, Math.min(100, startVolume + deltaVolume));
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
        audioEngine.setTrackVolume(trackIndex, volume / 100);
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
        this.lenButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.length) === this.patternLength);
        });
        this.divButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.division) === this.division);
        });
        this.updateTrackTabs();
        this.updateMixerDisplay();
    }

    // ==================== Storage ====================

    autoSave() {
        const data = {
            version: 3,
            bpm: this.bpm,
            patternLength: this.patternLength,
            division: this.division,
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
            this.patternLength = data.patternLength || 16;
            this.division = data.division || 16;

            if (data.tracks) {
                this.tracks = data.tracks;
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
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 240, 255, 0.9);
            color: #000;
            padding: 8px 16px;
            border-radius: 16px;
            font-family: var(--font-mono);
            font-size: 0.8rem;
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
