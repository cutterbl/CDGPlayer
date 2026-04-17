import './karaokeplayer.scss';
import CDGPlayer from '../cdg/CDGPlayer.js';
import CDGFileLoader from '../loader/CDGFileLoader.js';
import { PitchShifter } from 'soundtouchjs';
import Deferred from '../utilities/deferred.js';
import {
  WIDTH,
  HEIGHT,
  GAIN_DEFAULT,
  SCALE_DEFAULT,
  PITCH_DEFAULT,
  START_TIME,
  FILTER_PLAYBACK_OFFSET,
} from '../cdg/constants';
import { isString } from '../utilities/is.js';
import observable from '../observable/observable.js';

const createDisplayCanvas = function (width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const createCanvasContext = function (canvas) {
  const ctx = canvas.getContext('2d');
  ctx.webkitImageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  return ctx;
};

const copyContextToCanvas = function (context) {
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

const clearCanvas = function (context, canvas) {
  context.clearRect(0, 0, canvas.width, canvas.height);
};

const loadAudio = function (buffer) {
  if (this.shifter) {
    this.shifter.off();
  }
  return this.audio
    .decodeAudioData(buffer)
    .then((audioBuffer) => {
      this.shifter = observable(
        new PitchShifter(this.audio, audioBuffer, 1024, () => {
          this.stop();
        })
      );
      this.shifter.on('play', (detail) => {
        this.props.timePlayed = detail.formattedTimePlayed;
        this.props.percentagePlayed = detail.percentagePlayed;
        this.player.sync(detail.timePlayed * 1000 - FILTER_PLAYBACK_OFFSET);
      });
      this.shifter.pitch = PITCH_DEFAULT;
      this.props.trackLength = this.shifter.formattedDuration;
    })
    .catch((error) =>
      Promise.reject(
        new Error('There was an error decoding the audio file', error)
      )
    );
};

const loadVideo = function (buffer) {
  const deferred = new Deferred();
  if (buffer) {
    this.player.load(Array.from(buffer));
    deferred.resolve();
  } else {
    deferred.reject(new Error('There was an error loading the video file'));
  }
  return deferred.promise;
};

const wrapText = function (context, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line = '';

  for (var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line.trim(), x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line.trim(), x, y);
};

const drawTag = function () {
  const ctx = this.ctx;
  const cvs = this.canvas;
  const maxWidth = cvs.width - 10;
  let lineHeight = 30;
  const x = maxWidth / 2;
  let y = 60;
  ctx.font = '30px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  wrapText(ctx, this.tag.title, x, y, maxWidth, lineHeight);
  ctx.font = '20px sans-serif';
  y = cvs.height - 60;
  wrapText(ctx, `by ${this.tag.artist}`, x, y, maxWidth, lineHeight);
};

const loadTag = function (tag) {
  this.tag = tag && tag.tags;
  if (this.tag) {
    return drawTag.call(this);
  }
};

const handleExtractedZip = function (responseArr) {
  const process = [];
  process.push(loadAudio.call(this, responseArr[0])); // audio is always first
  process.push(loadVideo.call(this, responseArr[1])); // video is always second
  return Promise.all(process)
    .then(() => {
      this.props.status = 'File Loaded';
      this.props.loaded = true;
      // Display tag after marking player loaded
      loadTag.call(this, responseArr[2]); // mp3 tag data is always last
    })
    .catch((error) => {
      this.props.status = 'File Loading Failed';
      return Promise.reject(error);
    })
    .then(() => {
      this.props.loading = false;
    });
};

const setVolume = function (val) {
  this.gainNode.gain.value = val;
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
    timePlayed: START_TIME,
    trackLength: START_TIME,
    percentagePlayed: 0,
    songVolume: 1,
    destroy: false,
  });

  constructor(selector) {
    this.wrapper = document.querySelector(selector);
    if (!this.wrapper) {
      throw new Error(
        `CDGPlayer: and element was not found with the "${selector}" selector`
      );
    }
    this.wrapper.classList.add('cdg-video-wrapper');
    this.canvas = createDisplayCanvas(WIDTH, HEIGHT);
    this.canvas.classList.add('cdg-video-player');
    this.ctx = createCanvasContext(this.canvas);
    this.player = new CDGPlayer({
      afterRender: (context) => copyContextToCanvas.call(this, context),
    });
    this.wrapper.appendChild(this.canvas);
    const titleImage = document.createElement('div');
    titleImage.classList.add('titleImage');
    this.wrapper.appendChild(titleImage);
    this.onloaded = this.props.on('loaded', (val) => {
      if (val) {
        titleImage.classList.add('hide');
        return;
      }
      titleImage.classList.remove('hide');
    });

    this.audio = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audio.createGain();
    this.onvolume = this.props.on('songVolume', (val) => {
      setVolume.call(this, val);
    });
    this.props.songVolume = GAIN_DEFAULT;
  }

  destroy() {
    this.wrapper.classList.remove('cdg-video-wrapper');
    this.stop();
    this.gainNode.disconnect();
    if (this.shifter) {
      this.shifter.off();
    }
    this.shifter = null;
    this.gainNode = null;
    this.audio = null;
    this.canvas.remove();
    this.props.destroy = true;
    this.props.off('onvolume');
  }

  load(filePath) {
    this.stop();
    clearCanvas(this.ctx, this.canvas);
    this.props.loading = true;
    let promise;
    if (isString(filePath)) {
      if (!filePath.toLowerCase().endsWith('.zip')) {
        this.props.loading = false;
        this.props.status = `${filePath} doesn't appear to be a ".zip" file.`;

        return Promise.reject(this.props.status);
      }
      this.props.status = 'Retrieving File...';
      promise = CDGFileLoader.loadZipFile(filePath);
    } else {
      this.props.status = 'Loading File...';
      promise = CDGFileLoader.loadFileBuffer(filePath);
    }
    return promise
      .then((zipResponse) => handleExtractedZip.call(this, zipResponse))
      .catch((error) => Promise.reject(error));
  }

  togglePlay() {
    if (this.props.isPlaying) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    clearCanvas.call(this, this.ctx, this.canvas);
    this.shifter.connect(this.gainNode);
    this.gainNode.connect(this.audio.destination);
    // updates for autoplay issues
    this.audio.resume().then(() => {
      this.props.isPlaying = true;
      this.player.play();
    });
  }

  pause(playing = false) {
    this.props.isPlaying = playing;
    this.shifter.disconnect();
    /*if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }*/
    this.player.stop();
  }

  stop() {
    if (this.shifter) {
      this.pause();
      this.changePlayerPosition(0);
      drawTag.call(this);
    }
  }

  changePlayerPosition(perc) {
    perc = perc < 0 ? 0 : perc > 100 ? 100 : perc;
    this.shifter.percentagePlayed = perc;
    this.props.percentagePlayed = this.shifter.percentagePlayed;
    this.props.timePlayed = this.shifter.formattedTimePlayed;
    this.player.reset();
    if (!perc) {
      this.props.isPlaying = false;
      this.props.timePlayed = START_TIME;
    }
  }

  changeKey(pitchChange) {
    pitchChange = pitchChange < -7 ? -7 : pitchChange > 7 ? 7 : pitchChange;
    this.shifter.pitchSemitones = pitchChange;
    this.shifter.tempo = 1; // keep the tempo straight
  }

  volume(change) {
    const current = this.gainNode.gain.value;
    const newValue = +(current + change).toFixed(2);
    this.props.songVolume = newValue < 0 ? 0 : newValue > 1 ? 1 : newValue;
  }

  toggleMute() {
    const fallback = this.gainNode.gain.value;
    this.props.songVolume = fallback ? 0 : this.fallbackVolume;
    this.fallbackVolume = fallback;
  }
}
