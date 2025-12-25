/**
 * PocketMusica - Audio Engine v4
 * Multi-track chiptune synthesizer with PAN
 * Optimized for iOS Safari
 */

class ChiptuneAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.trackGains = [];
        this.trackPanners = [];
        this.trackMuted = [false, false, false, false];
        this.trackVolumes = [0.8, 0.8, 0.8, 0.8]; // Default 80%
        this.trackPans = [0, 0, 0, 0]; // -100 to 100 (L100 to R100)
        this.isInitialized = false;
        this.activeOscillators = new Map();
        this.lastInteractionTime = Date.now();

        this.soundTypes = {
            pulse1: { type: 'square', detune: 0 },
            pulse2: { type: 'square', detune: 5 },
            triangle: { type: 'triangle', detune: 0 },
            noise: { type: 'sawtooth', detune: 0 }
        };
    }

    async init() {
        if (this.isInitialized) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();

            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.audioContext.destination);

            // Per-track panner + gain nodes
            for (let i = 0; i < 4; i++) {
                // Create stereo panner for pan control
                const panner = this.audioContext.createStereoPanner();
                panner.pan.value = 0;
                panner.connect(this.masterGain);
                this.trackPanners.push(panner);

                // Per-track gain
                const gain = this.audioContext.createGain();
                gain.gain.value = 0.8; // Default 80%
                gain.connect(panner);
                this.trackGains.push(gain);
            }

            this.isInitialized = true;
            console.log('🎵 Audio engine v4 initialized');

            // iOS: Force resume
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // iOS: Play silent sound to unlock
            this.playSilent();

        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }

    playSilent() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        gainNode.gain.value = 0.001;
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    async resume() {
        this.lastInteractionTime = Date.now();

        if (!this.audioContext) {
            await this.init();
            return;
        }

        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                this.playSilent();
            } catch (e) {
                console.log('Resume failed, reinitializing...');
                // Force reinitialize
                this.isInitialized = false;
                this.trackGains = [];
                this.trackPanners = [];
                await this.init();
            }
        }
    }

    // Check and recover audio context if needed (call periodically)
    async checkAndRecover() {
        if (!this.audioContext) {
            await this.init();
            return;
        }

        if (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted') {
            await this.resume();
        }
    }

    noteToFrequency(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 440;

        const note = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = notes.indexOf(note);
        if (noteIndex === -1) return 440;

        const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }

    startNote(noteName, soundType = 'pulse1', trackIndex = 0) {
        if (!this.isInitialized) return null;

        const key = `${trackIndex}-${noteName}`;
        if (this.activeOscillators.has(key)) return;

        const now = this.audioContext.currentTime;
        const frequency = this.noteToFrequency(noteName);
        const sound = this.soundTypes[soundType] || this.soundTypes.pulse1;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.detune.setValueAtTime(sound.detune, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.02);

        oscillator.connect(gainNode);
        gainNode.connect(this.trackGains[trackIndex]);

        oscillator.start(now);

        this.activeOscillators.set(key, { oscillator, gainNode });
        return key;
    }

    stopNote(noteName, trackIndex = 0) {
        const key = `${trackIndex}-${noteName}`;
        const active = this.activeOscillators.get(key);
        if (!active) return;

        const now = this.audioContext.currentTime;
        active.gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
        active.oscillator.stop(now + 0.05);

        setTimeout(() => {
            active.oscillator.disconnect();
            active.gainNode.disconnect();
        }, 100);

        this.activeOscillators.delete(key);
    }

    stopAllNotes(trackIndex = null) {
        for (const [key, active] of this.activeOscillators) {
            if (trackIndex === null || key.startsWith(`${trackIndex}-`)) {
                const now = this.audioContext.currentTime;
                active.gainNode.gain.linearRampToValueAtTime(0, now + 0.02);
                active.oscillator.stop(now + 0.02);
                this.activeOscillators.delete(key);
            }
        }
    }

    playNote(noteName, soundType = 'pulse1', duration = 0.15, trackIndex = 0) {
        if (!this.isInitialized || this.trackMuted[trackIndex]) return;

        const now = this.audioContext.currentTime;
        const frequency = this.noteToFrequency(noteName);
        const sound = this.soundTypes[soundType] || this.soundTypes.pulse1;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.detune.setValueAtTime(sound.detune, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.03);
        gainNode.gain.linearRampToValueAtTime(0.4, now + duration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.trackGains[trackIndex]);

        oscillator.start(now);
        oscillator.stop(now + duration);

        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }

    playStep(step, soundType, stepDuration, trackIndex) {
        if (!step || step.type === 'rest') return;
        if (step.type === 'tie') return;

        if (step.note) {
            this.playNote(step.note, soundType, stepDuration * 0.9, trackIndex);
        }
    }

    setTrackVolume(trackIndex, volume) {
        if (this.trackGains[trackIndex]) {
            this.trackVolumes[trackIndex] = volume;
            if (!this.trackMuted[trackIndex]) {
                this.trackGains[trackIndex].gain.value = volume;
            }
        }
    }

    setTrackPan(trackIndex, pan) {
        // pan: -100 (L100) to 100 (R100)
        if (this.trackPanners[trackIndex]) {
            this.trackPans[trackIndex] = pan;
            // Convert -100~100 to -1~1
            this.trackPanners[trackIndex].pan.value = pan / 100;
        }
    }

    toggleMute(trackIndex) {
        this.trackMuted[trackIndex] = !this.trackMuted[trackIndex];
        if (this.trackGains[trackIndex]) {
            this.trackGains[trackIndex].gain.value = this.trackMuted[trackIndex] ? 0 : this.trackVolumes[trackIndex];
        }
        return this.trackMuted[trackIndex];
    }

    isMuted(trackIndex) {
        return this.trackMuted[trackIndex];
    }
}

const audioEngine = new ChiptuneAudio();
