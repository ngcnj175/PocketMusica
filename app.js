/**
 * PocketMusica - Main Application v2
 * Multi-track chiptune sequencer
 */

class PocketMusica {
    constructor() {
        // State
        this.bpm = 120;
        this.octave = 4;
        this.patternLength = 16; // Playback length: 8, 16, or 32
        this.division = 16;      // Note division: 8, 16, or 32
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

        // Notes
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        this.blackKeys = ['C#', 'D#', null, 'F#', 'G#', 'A#'];

        // Long press handling
        this.longPressTimer = null;
        this.longPressTrack = null;

        // Double tap detection
        this.lastTapTime = 0;
        this.lastTapStep = -1;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderKeyboard();
        this.renderGrid();
        this.loadFromStorage();
        this.updateDisplay();

        console.log('🎹 PocketMusica v2 initialized');
    }

    cacheElements() {
        // Header
        this.bpmDisplay = document.getElementById('bpm-value');
        this.tempoDownBtn = document.getElementById('tempo-down');
        this.tempoUpBtn = document.getElementById('tempo-up');

        // Track tabs
        this.trackTabs = document.getElementById('track-tabs');
        this.soundSelector = document.getElementById('sound-selector');

        // Octave
        this.octaveDisplay = document.getElementById('octave-value');
        this.octaveDownBtn = document.getElementById('octave-down');
        this.octaveUpBtn = document.getElementById('octave-up');

        // Keyboard
        this.keyboard = document.getElementById('keyboard');

        // Seq controls
        this.restBtn = document.getElementById('btn-rest');
        this.tieBtn = document.getElementById('btn-tie');
        this.delBtn = document.getElementById('btn-del');
        this.recBtn = document.getElementById('btn-rec');

        // Grid
        this.stepGrid = document.getElementById('step-grid');
        this.lenButtons = document.querySelectorAll('.len-btn');
        this.divButtons = document.querySelectorAll('.div-btn');

        // Player
        this.playStopBtn = document.getElementById('btn-play-stop');
        this.trackMixers = document.querySelectorAll('.track-mixer');

        // Footer
        this.saveBtn = document.getElementById('btn-save');
        this.clearBtn = document.getElementById('btn-clear');
    }

    bindEvents() {
        // Tempo (±1)
        this.tempoDownBtn.addEventListener('click', () => this.changeTempo(-1));
        this.tempoUpBtn.addEventListener('click', () => this.changeTempo(1));

        // Octave
        this.octaveDownBtn.addEventListener('click', () => this.changeOctave(-1));
        this.octaveUpBtn.addEventListener('click', () => this.changeOctave(1));

        // Track tabs - tap to select, long press for sound selector
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
        this.delBtn.addEventListener('click', () => this.deletePrevious());
        this.recBtn.addEventListener('click', () => this.toggleRecording());

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

        // Mixer - click for volume, long press for mute
        this.trackMixers.forEach((mixer, index) => {
            let pressTimer = null;

            mixer.addEventListener('mousedown', () => {
                pressTimer = setTimeout(() => this.toggleMute(index), 500);
            });
            mixer.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => this.toggleMute(index), 500);
            });
            mixer.addEventListener('mouseup', () => clearTimeout(pressTimer));
            mixer.addEventListener('touchend', () => clearTimeout(pressTimer));
            mixer.addEventListener('mouseleave', () => clearTimeout(pressTimer));

            // Volume control via drag
            mixer.addEventListener('click', (e) => {
                if (e.detail === 1) { // Single click
                    const rect = mixer.querySelector('.volume-bar').getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const volume = Math.round(100 - (y / rect.height * 100));
                    this.setTrackVolume(index, Math.max(0, Math.min(100, volume)));
                }
            });
        });

        // Footer
        this.saveBtn.addEventListener('click', () => this.saveToStorage());
        this.clearBtn.addEventListener('click', () => this.clearCurrentTrack());

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

    // Track tab handlers
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

            // If not showing selector, switch track
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

    // Keyboard rendering
    renderKeyboard() {
        this.keyboard.innerHTML = '';

        // White keys
        this.whiteKeys.forEach((note, index) => {
            const key = document.createElement('button');
            key.className = 'key';
            key.textContent = note;
            key.dataset.note = note;

            this.addKeyEvents(key, note);
            this.keyboard.appendChild(key);
        });

        // Black keys
        this.blackKeys.forEach((note, index) => {
            if (note) {
                const key = document.createElement('button');
                key.className = 'key black';
                key.textContent = note.replace('#', '♯');
                key.dataset.note = note;

                this.addKeyEvents(key, note);
                this.keyboard.appendChild(key);
            }
        });
    }

    addKeyEvents(key, noteName) {
        const startNote = () => {
            audioEngine.resume();
            const fullNote = `${noteName}${this.octave}`;
            const soundType = this.tracks[this.currentTrack].soundType;
            audioEngine.startNote(fullNote, soundType, this.currentTrack);
            key.classList.add('active');

            // If recording, insert note
            if (this.isRecording) {
                this.insertNote(fullNote);
            }
        };

        const stopNote = () => {
            const fullNote = `${noteName}${this.octave}`;
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

    // Pattern input
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

        // Move back one step
        if (this.selectedStep > 0) {
            this.selectedStep--;
        } else {
            this.selectedStep = this.patternLength - 1;
        }

        // Clear that step
        pattern[this.selectedStep] = { note: null, type: 'empty' };
        this.renderGrid();
        this.autoSave();
    }

    advanceStep() {
        this.selectedStep = (this.selectedStep + 1) % this.patternLength;
    }

    toggleRecording() {
        this.isRecording = !this.isRecording;
        this.recBtn.classList.toggle('active', this.isRecording);
    }

    // Grid rendering
    renderGrid() {
        this.stepGrid.innerHTML = '';
        const pattern = this.tracks[this.currentTrack].pattern;

        for (let i = 0; i < 32; i++) {
            const step = pattern[i];
            const stepEl = document.createElement('div');
            stepEl.className = 'step';

            // State classes
            if (step.type === 'note') stepEl.classList.add('has-note');
            if (step.type === 'rest') stepEl.classList.add('rest');
            if (step.type === 'tie') stepEl.classList.add('tie');
            if (i >= this.patternLength) stepEl.classList.add('out-of-range');
            if (i === this.currentStep && this.isPlaying) stepEl.classList.add('current');
            if (i === this.selectedStep) stepEl.classList.add('selected');

            // Step number
            const numEl = document.createElement('span');
            numEl.className = 'step-number';
            numEl.textContent = i + 1;
            stepEl.appendChild(numEl);

            // Note display
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

            // Click handler - single tap select, double tap clear
            stepEl.addEventListener('click', () => this.onStepClick(i));

            this.stepGrid.appendChild(stepEl);
        }
    }

    onStepClick(index) {
        if (index >= this.patternLength) return;

        const now = Date.now();

        // Double tap detection
        if (this.lastTapStep === index && now - this.lastTapTime < 300) {
            // Double tap - clear step
            const pattern = this.tracks[this.currentTrack].pattern;
            pattern[index] = { note: null, type: 'empty' };
            this.lastTapStep = -1;
        } else {
            // Single tap - select
            this.selectedStep = index;

            // Play note if present
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

    // Playback
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
            // Play all tracks at current step
            for (let t = 0; t < 4; t++) {
                const track = this.tracks[t];
                const step = track.pattern[this.currentStep];

                // Handle TIE - check if previous note should continue
                let noteDuration = stepDuration;
                if (step.type === 'note') {
                    // Check how many TIEs follow
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

            // Advance
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

    // Controls
    changeTempo(delta) {
        this.bpm = Math.max(40, Math.min(300, this.bpm + delta));
        this.updateDisplay();

        if (this.isPlaying) {
            this.stop();
            this.play();
        }
        this.autoSave();
    }

    changeOctave(delta) {
        this.octave = Math.max(1, Math.min(7, this.octave + delta));
        this.updateDisplay();
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

    // Mixer
    setTrackVolume(trackIndex, volume) {
        this.tracks[trackIndex].volume = volume;
        audioEngine.setTrackVolume(trackIndex, volume / 100);
        this.updateMixerDisplay();
        this.autoSave();
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
            mixer.querySelector('.volume-bar').style.setProperty('--volume', `${track.volume}%`);
        });
    }

    clearCurrentTrack() {
        if (confirm('現在のトラックをクリアしますか？')) {
            this.tracks[this.currentTrack].pattern = this.createEmptyPattern();
            this.selectedStep = 0;
            this.renderGrid();
            this.autoSave();
        }
    }

    updateDisplay() {
        this.bpmDisplay.textContent = this.bpm;
        this.octaveDisplay.textContent = this.octave;
        this.updateTrackTabs();
        this.updateMixerDisplay();
    }

    // Storage
    autoSave() {
        this.saveToStorage(true);
    }

    saveToStorage(silent = false) {
        const data = {
            version: 2,
            bpm: this.bpm,
            patternLength: this.patternLength,
            division: this.division,
            tracks: this.tracks,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('pocketmusica_song', JSON.stringify(data));
            if (!silent) {
                this.showToast('💾 保存しました');
            }
        } catch (error) {
            console.error('Save failed:', error);
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

            // Update UI
            this.lenButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.length) === this.patternLength);
            });
            this.divButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.division) === this.division);
            });

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
