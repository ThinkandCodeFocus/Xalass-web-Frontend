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
            // Choisir le format supporté par le navigateur (mp4 sur iOS, webm sur Android/Chrome)
            const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
            const mimeType = preferred.find(t => MediaRecorder.isTypeSupported(t)) || '';
            this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});
            
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

    MAX_DURATION: 60,

    /**
     * Démarre l'enregistrement
     */
    start() {
        if (!this.mediaRecorder) return false;

        this.audioChunks = [];
        this.recordingTime = 0;
        this.isRecording = true;
        this.mediaRecorder.start();

        // Compteur de temps + arrêt automatique à MAX_DURATION secondes
        this.recordingInterval = setInterval(() => {
            this.recordingTime++;
            document.dispatchEvent(new CustomEvent('recordingTime', {
                detail: { duration: this.recordingTime }
            }));
            if (this.recordingTime >= this.MAX_DURATION) {
                this.stop();
                document.dispatchEvent(new CustomEvent('recordingMaxDuration'));
            }
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
     * Annule l'enregistrement en cours (ne sauvegarde rien)
     */
    cancel() {
        if (!this.mediaRecorder || !this.isRecording) return false;

        this._cancelled = true;
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
        if (this._cancelled) {
            this._cancelled = false;
            this.audioChunks = [];
            document.dispatchEvent(new CustomEvent('recordingCancelled'));
            return;
        }
        // Utiliser le vrai type MIME de ce que MediaRecorder a enregistré
        const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
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
        try {
            // Extraire les bytes depuis data URL ou base64 brut
            const parts = base64Audio.split(',');
            const b64 = parts.length > 1 ? parts[1] : parts[0];
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));
            audioContext.close();

            // processAudioBuffer retourne une Promise — on l'attend
            const processedBuffer = await this.processAudioBuffer(audioBuffer);

            const wavData = this.audioBufferToWav(processedBuffer);
            const blob = new Blob([wavData], { type: 'audio/wav' });

            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            // Ne JAMAIS retomber sur base64Audio : ce serait la voix reelle,
            // non anonymisee, alors que l'interface garantit a l'utilisateur
            // une anonymisation obligatoire. On echoue franchement, l'appelant
            // se charge de refuser l'enregistrement (ticket #5).
            console.error('Erreur effet audio:', error);
            throw new Error("L'anonymisation de la voix a echoue");
        }
    },

    /**
     * Génère un nombre aléatoire dans [min, max]
     */
    _rand(min, max) {
        return min + Math.random() * (max - min);
    },

    /**
     * Traite le buffer audio avec paramètres aléatoires pour l'anonymisation
     */
    processAudioBuffer(audioBuffer) {
        // Paramètres aléatoires — différents à chaque enregistrement
        // Valeurs réduites pour éviter le bruit excessif tout en préservant l'anonymat
        const pitchRate    = this._rand(0.88, 1.18);   // décalage de pitch discret
        const distAmount   = this._rand(12, 35);        // distortion légère (60-220 causait du bruit)
        const highGain     = this._rand(1, 5);          // boost hautes fréquences modéré
        const lowGain      = this._rand(-6, -1);        // coupe basses légère
        const highFreq     = this._rand(2500, 5000);
        const lowFreq      = this._rand(120, 300);
        const compRatio    = this._rand(3, 6);          // compression douce (8-16 écrasait le son)
        const compThresh   = this._rand(-30, -15);
        const outputGain   = this._rand(0.85, 1.15);    // volume aléatoire
        const noiseLevel   = this._rand(0.002, 0.01);   // bruit blanc de masquage

        // Durée modifiée par playbackRate (approximation de pitch shift)
        const outLength = Math.ceil(audioBuffer.length / pitchRate);

        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            outLength,
            audioBuffer.sampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = pitchRate;  // pitch shift via rate

        // Distortion
        const distortion = offlineContext.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(distAmount);
        distortion.oversample = '4x';

        // Formant simulation via bandpass + notch
        const bandpass = offlineContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = this._rand(800, 2200);
        bandpass.Q.value = this._rand(0.3, 1.2);

        // EQ
        const highShelf = offlineContext.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = highFreq;
        highShelf.gain.value = highGain;

        const lowShelf = offlineContext.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = lowFreq;
        lowShelf.gain.value = lowGain;

        // Compresseur
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = compThresh;
        compressor.knee.value = 40;
        compressor.ratio.value = compRatio;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // Volume aléatoire
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = outputGain;

        // Bruit blanc léger (masque les caractéristiques résiduelles de la voix)
        const noiseBuffer = offlineContext.createBuffer(1, outLength, audioBuffer.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < outLength; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * noiseLevel;
        }
        const noiseSource = offlineContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        source.connect(distortion);
        distortion.connect(bandpass);
        bandpass.connect(lowShelf);
        lowShelf.connect(highShelf);
        highShelf.connect(compressor);
        compressor.connect(gainNode);
        noiseSource.connect(gainNode);
        gainNode.connect(offlineContext.destination);

        source.start();
        noiseSource.start();

        return offlineContext.startRendering().then((renderedBuffer) => renderedBuffer);
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
        const length = audioBuffer.length * numberOfChannels;
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
     * Joue un audio Base64 tel quel.
     *
     * L'anonymisation est appliquee une seule fois, au moment de
     * l'enregistrement (voir anonymizeAudio) : la re-appliquer ici
     * distordrait une seconde fois un audio deja traite, et l'utilisateur
     * n'entendrait donc pas ce qui est reellement publie.
     */
    async play(base64Audio) {
        try {
            // Arrête la lecture précédente
            this.stop();

            this.currentAudio = new Audio(base64Audio);
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

/**
 * Anonymise un audio base64 :
 * 1. Essaie d'abord le backend /api/voice/anonymize (traitement FFmpeg côté serveur)
 * 2. Si indisponible ou erreur, repli sur VoiceEffects côté client
 */
async function anonymizeAudio(base64Audio) {
    try {
        const base = (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL ? API_CONFIG.BASE_URL : null)
                  || (typeof window !== 'undefined' && window.XALASS_API_BASE_URL ? window.XALASS_API_BASE_URL : null)
                  || 'https://api.xalass.com/api';

        const resp = await fetch(`${base}/voice/anonymize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_data: base64Audio }),
        });

        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.audio_data) {
                return data.audio_data;
            }
        }
    } catch (_) {
        // Réseau indisponible ou backend non démarré — repli silencieux
    }

    // Fallback client-side
    return VoiceEffects.applyAnonymityEffect(base64Audio);
}
