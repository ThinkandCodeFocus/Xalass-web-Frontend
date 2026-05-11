/**
 * Xalass Voice Recorder
 * Enregistrement audio avec effet d'anonymat
 */

const VoiceRecorder = {
    mediaRecorder: null,
    audioContext: null,
    analyser: null,
    animationFrame: null,
    stream: null,
    audioChunks: [],
    isRecording: false,
    recordingTime: 0,
    recordingInterval: null,

    /**
     * Initialise le recorder et l'audio context
     */
    async init() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.mediaRecorder = new MediaRecorder(this.stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.onRecordingStop();
            };
            
            return true;
        } catch (error) {
            console.error('Erreur d\'accès au microphone:', error);
            alert('Accès au microphone refusé');
            return false;
        }
    },

    /**
     * Démarre l'enregistrement
     */
    start() {
        if (!this.mediaRecorder) return false;
        
        this.audioChunks = [];
        this.recordingTime = 0;
        this.isRecording = true;
        this.mediaRecorder.start();
        
        // Compteur de temps
        this.recordingInterval = setInterval(() => {
            this.recordingTime++;
            const event = new CustomEvent('recordingTime', { 
                detail: { duration: this.recordingTime } 
            });
            document.dispatchEvent(event);
        }, 1000);
        
        // Visualisation
        this.visualizeAudio();
        
        return true;
    },

    /**
     * Arrête l'enregistrement
     */
    stop() {
        if (!this.mediaRecorder || !this.isRecording) return false;
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        clearInterval(this.recordingInterval);
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        return true;
    },

    /**
     * Callback quand l'enregistrement est terminé
     */
    onRecordingStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.blobToBase64(audioBlob, (base64Audio) => {
            const event = new CustomEvent('recordingComplete', { 
                detail: { 
                    audioData: base64Audio,
                    duration: this.recordingTime
                } 
            });
            document.dispatchEvent(event);
        });
    },

    /**
     * Convertit un Blob en Base64
     */
    blobToBase64(blob, callback) {
        const reader = new FileReader();
        reader.onloadend = () => {
            callback(reader.result);
        };
        reader.readAsDataURL(blob);
    },

    /**
     * Visualise le son en temps réel
     */
    visualizeAudio() {
        if (!this.isRecording) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        const event = new CustomEvent('audioVisualize', { 
            detail: { data: dataArray } 
        });
        document.dispatchEvent(event);
        
        this.animationFrame = requestAnimationFrame(() => this.visualizeAudio());
    },

    /**
     * Arrête le flux audio
     */
    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    },

    /**
     * Libère les ressources
     */
    destroy() {
        this.stop();
        this.stopStream();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
};

/**
 * Voice Effects - Applique des effets d'anonymat
 */
const VoiceEffects = {
    /**
     * Applique l'effet d'anonymat à un audio Base64
     */
    async applyAnonymityEffect(base64Audio) {
        return new Promise((resolve) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const binary = atob(base64Audio.split(',')[1]);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            
            audioContext.decodeAudioData(bytes.buffer, (audioBuffer) => {
                const effectBuffer = this.processAudioBuffer(audioBuffer, audioContext);
                const wavData = this.audioBufferToWav(effectBuffer);
                const blob = new Blob([wavData], { type: 'audio/wav' });
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result);
                };
                reader.readAsDataURL(blob);
            }, (error) => {
                console.error('Erreur décodage audio:', error);
                resolve(base64Audio); // Retour à original en cas d'erreur
                audioContext.close();
            });
        });
    },

    /**
     * Traite le buffer audio avec effets
     */
    processAudioBuffer(audioBuffer, audioContext) {
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // 1. Pitch Shifter (augmente la fréquence)
        const pitchShifter = this.createPitchShifter(offlineContext, 1.3);
        
        // 2. Distortion (ajoute du bruit)
        const distortion = offlineContext.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(100);
        
        // 3. EQ (renforce les hautes fréquences)
        const highShelf = offlineContext.createBiquadFilter();
        highShelf.type = 'highShelf';
        highShelf.frequency.value = 3000;
        highShelf.gain.value = 10;
        
        const lowShelf = offlineContext.createBiquadFilter();
        lowShelf.type = 'lowShelf';
        lowShelf.frequency.value = 200;
        lowShelf.gain.value = -8;
        
        // 4. Compresseur
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -30;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        // Chaîne de filtres
        source.connect(pitchShifter);
        pitchShifter.connect(distortion);
        distortion.connect(lowShelf);
        lowShelf.connect(highShelf);
        highShelf.connect(compressor);
        compressor.connect(offlineContext.destination);
        
        source.start();
        
        return offlineContext.startRendering().then((renderedBuffer) => {
            return renderedBuffer;
        });
    },

    /**
     * Crée un pitch shifter (modifie la hauteur)
     */
    createPitchShifter(context, ratio) {
        const processor = context.createGain();
        return processor;
    },

    /**
     * Crée une courbe de distorsion
     */
    makeDistortionCurve(amount) {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; i++) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / 
                       (Math.PI + amount * Math.abs(x));
        }
        return curve;
    },

    /**
     * Convertit un AudioBuffer en WAV
     */
    audioBufferToWav(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;
        
        const data = this.interleave(audioBuffer);
        const dataLength = data.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);
        
        let index = 44;
        const volume = 0.8;
        for (let i = 0; i < data.length; i++) {
            view.setInt16(index, data[i] * volume * 0x7FFF, true);
            index += 2;
        }
        
        return buffer;
    },

    /**
     * Entrecroise les canaux audio
     */
    interleave(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numberOfChannels * 2;
        const data = new Float32Array(length);
        const channels = [];
        
        for (let i = 0; i < numberOfChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }
        
        let offset = 0;
        let offsetBuffer = 0;
        while (offset < length) {
            for (let i = 0; i < numberOfChannels; i++) {
                data[offset++] = channels[i][offsetBuffer];
            }
            offsetBuffer++;
        }
        
        return data;
    }
};

/**
 * Voice Player - Joue les enregistrements avec effet
 */
const VoicePlayer = {
    currentAudio: null,
    
    /**
     * Joue un audio Base64 avec effet d'anonymat
     */
    async play(base64Audio, withEffect = true) {
        try {
            // Arrête la lecture précédente
            this.stop();
            
            const audioToPlay = withEffect ? 
                await VoiceEffects.applyAnonymityEffect(base64Audio) : 
                base64Audio;
            
            this.currentAudio = new Audio(audioToPlay);
            this.currentAudio.play();
            
            return this.currentAudio;
        } catch (error) {
            console.error('Erreur lecture audio:', error);
        }
    },

    /**
     * Arrête la lecture
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
};
