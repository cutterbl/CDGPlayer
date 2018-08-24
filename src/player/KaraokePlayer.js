import './karaokeplayer.scss';
import CDGPlayer from '../cdg/CDGPlayer.js';
import CDGFileLoader from '../loader/CDGFileLoader.js';
import { PitchShifter } from 'soundtouchjs';
import Deferred from '../utilities/deferred.js';
import { WIDTH, HEIGHT, GAIN_DEFAULT, SCALE_DEFAULT, PITCH_DEFAULT } from '../cdg/constants';
import { isString } from '../utilities/is.js';
import observable from '../observable/observable.js';

const createDisplayCanvas = function(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

const createCanvasContext = function(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    return ctx;
};

const copyContextToCanvas = function(context) {
    // If there's transparency, clear the canvas first
    if (context.keyColor >= 0) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // Copy from source canvas to the target canvas
    this.ctx.drawImage(
        context.canvas,
        0,
        0,
        context.canvas.width,
        context.canvas.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height
    );
};

const loadAudio = function(buffer) {
    return this.audio
        .decodeAudioData(buffer)
        .then(audioBuffer => {
            this.shifter = new PitchShifter(this.audio, audioBuffer, 1024, () => {
                this.stop();
            });
            this.shifter.pitch = PITCH_DEFAULT;
            this.props.trackLength = this.shifter.formattedDuration;
        })
        .catch(error =>
            Promise.reject(new Error(`There was an error decoding the audio file`, error))
        );
};

const loadVideo = function(buffer) {
    const deferred = new Deferred();
    if (buffer) {
        this.player.load(Array.from(buffer));
        deferred.resolve();
    } else {
        deferred.reject(new Error('There was an error loading the video file'));
    }
    return deferred.promise;
};

const updatePlayPosition = function() {
    this.props.timePlayed = this.shifter.formattedTimePlayed;
    this.props.percentagePlayed = this.shifter.percentagePlayed;
    this.player.sync(this.shifter.timePlayed * 1000);
};

const setupListeners = function() {
    this.wrapper.addEventListener('dblclick', () => this.changeSize());
};

const removeListeners = function() {
    this.wrapper.removeListener('dblclick', () => this.changeSize());
};

export class KaraokePlayer {
    audio = null;
    gainNode = null;
    shifter = null;

    wrapper = null;
    player = null;
    currentSize = SCALE_DEFAULT;
    canvas = null;
    ctx = null;

    props = observable({
        status: '',
        loaded: false,
        loading: false,
        isPlaying: false,
        timePlayed: '0:00',
        trackLength: '0:00',
        percentagePlayed: 0,
        destroy: false
    });

    constructor(selector) {
        this.wrapper = document.querySelector(selector);
        if (!this.wrapper) {
            throw new Error(`CDGPlayer: and element was not found with the "${selector}" selector`);
        }
        this.wrapper.classList.add('cdg-video-wrapper');
        this.canvas = createDisplayCanvas(WIDTH, HEIGHT);
        this.canvas.classList.add('cdg-video-player');
        this.ctx = createCanvasContext(this.canvas);
        this.player = new CDGPlayer({
            afterRender: context => copyContextToCanvas.call(this, context)
        });
        this.wrapper.appendChild(this.canvas);
        setupListeners.call(this);

        this.audio = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audio.createGain();
        this.gainNode.gain.value = GAIN_DEFAULT;
    }

    destroy() {
        removeListeners.call(this);
        this.wrapper.classList.remove('cdg-video-wrapper');
        this.stop();
        this.gainNode.disconnect();
        this.shifter = null;
        this.gainNode = null;
        this.audio = null;
        this.canvas.remove();
        this.props.destroy = true;
    }

    changeSize(value = null) {
        if (value === null) {
            if (this.currentSize < 4) {
                this.currentSize = this.currentSize + 1;
            } else {
                this.currentSize = 1;
            }
        } else {
            if (isNaN(value)) {
                throw new Error(`${value} is not a valid size (1 - 4)`);
            }
            this.currentSize = value < 1 ? 1 : value > 4 ? 4 : value;
        }
        this.canvas.classList.remove('x2', 'x3', 'x4');
        if (this.currentSize > 1) {
            this.canvas.classList.add(`x${this.currentSize}`);
        }
    }

    load(filePath) {
        this.props.status = 'Retrieving File...';
        if (isString(filePath)) {
            if (filePath.toLowerCase().endsWith('.zip')) {
                this.stop();
                this.props.loading = true;
                CDGFileLoader.loadZipFile(filePath)
                    .then(zipResponse => {
                        const process = [];
                        process.push(loadAudio.call(this, zipResponse[0])); // audio is always first
                        process.push(loadVideo.call(this, zipResponse[1])); // video is always last
                        return Promise.all(process).catch(
                            error => new Error(`Unable to process ${filePath}`, error)
                        );
                    })
                    .then(() => {
                        this.props.status = 'File Loaded';
                        this.props.loaded = true;
                    })
                    .catch(error => {
                        this.props.status = 'File Loading Failed';
                        return Promise.reject(error);
                    })
                    .then(() => {
                        this.props.loading = false;
                    });
            } else {
                this.props.status = `${filePath} doesn't appear to be a ".zip" file.`;
            }
        } else {
            this.props.status = `Your "filePath" doesn't appear to be a string.`;
        }
    }

    togglePlay() {
        if (this.props.isPlaying) {
            this.pause();
        } else {
            this.start();
        }
    }

    start() {
        this.shifter.connect(this.gainNode);
        this.gainNode.connect(this.audio.destination);
        this.props.isPlaying = true;
        this.player.play();
        this.timeInterval = setInterval(() => updatePlayPosition.call(this), 20);
    }

    pause(playing = false) {
        this.props.isPlaying = playing;
        this.shifter.disconnect();
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
            this.timeInterval = null;
        }
        this.player.stop();
    }

    stop() {
        if (this.shifter) {
            this.pause();
            this.changePlayerPosition(0);
        }
    }

    changePlayerPosition(perc) {
        perc = perc < 0 ? 0 : perc > 100 ? 100 : perc;
        this.shifter.percentagePlayed = perc;
        this.props.percentagePlayed = this.shifter.percentagePlayed;
        this.props.timePlayed = this.shifter.formattedTimePlayed;
        this.player.reset();
        if (this.props.isPlaying) {
            updatePlayPosition.call(this);
        }
    }

    changeKey(pitchChange) {
        pitchChange = pitchChange < -7 ? -7 : pitchChange > 7 ? 7 : pitchChange;
        this.shifter.pitchSemitones = pitchChange;
        this.shifter.tempo = 1; // keep the tempo straight
    }
}
