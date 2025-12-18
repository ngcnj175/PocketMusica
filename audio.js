/**
 * PocketMusica - Audio Engine v2
 * Multi-track chiptune synthesizer
 */

class ChiptuneAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.trackGains = []; // Per-track gain nodes
        this.trackMuted = [false, false, false, false];
        this.trackVolumes = [1, 1, 1, 1];
        this.isInitialized = false;
        this.activeOscillators = new Map(); // Track active oscillators for sustained notes

        // Sound types
        this.soundTypes = {
            pulse1: { type: 'square', detune: 0 },
            pulse2: { type: 'square', detune: 5 },
            triangle: { type: 'triangle', detune: 0 },
            noise: { type: 'sawtooth', detune: 0 } // Approximation for noise
        };
    }

    async init() {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.audioContext.destination);

            // Per-track gain nodes
            for (let i = 0; i < 4; i++) {
                const gain = this.audioContext.createGain();
                gain.gain.value = 1;
                gain.connect(this.masterGain);
                this.trackGains.push(gain);
            }

            this.isInitialized = true;
            console.log('🎵 Audio engine initialized');
        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }

    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
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

    /**
     * Start a sustained note (for keyboard hold)
     */
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

        // Quick attack
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.02);

        oscillator.connect(gainNode);
        gainNode.connect(this.trackGains[trackIndex]);

        oscillator.start(now);

        this.activeOscillators.set(key, { oscillator, gainNode });
        return key;
    }

    /**
     * Stop a sustained note
     */
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

    /**
     * Stop all notes for a track
     */
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

    /**
     * Play a note with fixed duration (for sequencer playback)
     */
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

        // Chiptune envelope
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

    /**
     * Play sequencer step
     */
    playStep(step, soundType, stepDuration, trackIndex) {
        if (!step || step.type === 'rest') return;
        if (step.type === 'tie') return; // TIE handled by caller

        if (step.note) {
            this.playNote(step.note, soundType, stepDuration * 0.9, trackIndex);
        }
    }

    /**
     * Set track volume
     */
    setTrackVolume(trackIndex, volume) {
        if (this.trackGains[trackIndex]) {
            this.trackVolumes[trackIndex] = volume;
            if (!this.trackMuted[trackIndex]) {
                this.trackGains[trackIndex].gain.value = volume;
            }
        }
    }

    /**
     * Toggle track mute
     */
    toggleMute(trackIndex) {
        this.trackMuted[trackIndex] = !this.trackMuted[trackIndex];
        if (this.trackGains[trackIndex]) {
            this.trackGains[trackIndex].gain.value = this.trackMuted[trackIndex] ? 0 : this.trackVolumes[trackIndex];
        }
        return this.trackMuted[trackIndex];
    }

    /**
     * Check if track is muted
     */
    isMuted(trackIndex) {
        return this.trackMuted[trackIndex];
    }
}

const audioEngine = new ChiptuneAudio();
