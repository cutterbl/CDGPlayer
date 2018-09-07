import ctrlTemplate from './cdgcontrols.html';
import './cdgcontrols.scss';

const playIcon = 'icofont-play-alt-1'; //icon(faPlayCircle, { title: 'Play', transform: { size: 24 } }).html;
const pauseIcon = 'icofont-pause'; //icon(faPauseCircle, { title: 'Pause', transform: { size: 24 } }).html;

const htmlToElement = function(html) {
    let template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
};

const setupListeners = function() {
    const props = this.player.props;
    this.onloaded = props.on('loaded', val => {
        if (val) {
            this.playBtn.removeAttribute('disabled');
            this.pitch.removeAttribute('disabled');
        } else {
            this.playBtn.setAttribute('disabled', 'disabled');
            this.pitch.setAttribute('disabled', 'disabled');
        }
    });
    this.ontimeplayed = props.on('timePlayed', (val, prev) => {
        if (val !== prev) {
            this.timePlayed.innerHTML = val;
        }
    });
    this.onpercentageplayed = props.on('percentagePlayed', (val, prev) => {
        if (val !== prev) {
            this.progress.value = val;
        }
    });
    this.ontracklength = props.on('trackLength', (val, prev) => {
        if (val !== prev) {
            this.trackLength.innerHTML = val;
        }
    });
    this.ondestroy = props.on('destroy', val => {
        if (val) {
            removeListeners.call(this);
        }
    });
    this.onplay = props.on('isPlaying', val => {
        this.playIcn.classList.remove(playIcon, pauseIcon);
        this.playIcn.classList.add(val ? pauseIcon : playIcon);
    });

    this.playBtn.addEventListener('click', () => this.player.togglePlay());
    this.progress.addEventListener('click', event => changePosition.call(this, event));
    this.pitch.addEventListener('change', () => changeKey.call(this));
};

const removeListeners = function() {
    const props = this.player.props;
    props.off(this.onloaded);
    props.off(this.ontimeplayed);
    props.off(this.onpercentageplayed);
    props.off(this.ontracklength);
    props.off(this.ondestroy);
    this.playBtn.removeEventListener('click', () => this.player.togglePlay());
    this.progress.removeEventListener('click', event => changePosition.call(this, event));
    this.pitch.removeEventListener('change', () => changeKey.call(this));
};

const changePosition = function(event) {
    const pos = event.target.getBoundingClientRect();
    const relX = event.pageX - pos.x;
    const perc = relX / event.target.offsetWidth;
    this.player.changePlayerPosition(perc);
};

const changeKey = function() {
    const val = this.pitch.value;
    if (isNaN(val)) {
        this.pitch.value = this.fallbackPitch;
        return;
    }
    this.fallbackPitch = val < -7 ? -7 : val > 7 ? 7 : val;
    this.player.changeKey(this.fallbackPitch);
};

export default class CDGControls {
    controls = htmlToElement(ctrlTemplate);
    player = null;

    playBtn = null;
    playIcn = null;
    timePlayed = null;
    progress = null;
    trackLength = null;
    pitch = null;

    constructor(selector, player) {
        const wrapper = document.querySelector(selector);
        wrapper.appendChild(this.controls);
        this.player = player;
        const props = this.player.props;
        this.playBtn = this.controls.querySelector('.playButton');
        this.playIcn = this.playBtn.querySelector('i');
        this.timePlayed = this.controls.querySelector('.timePlayed');
        this.timePlayed.innerHTML = props.timePlayed;
        this.progress = this.controls.querySelector('.progressMeter');
        this.progress.value = props.percentagePlayed;
        this.trackLength = this.controls.querySelector('.trackLength');
        this.trackLength.innerHTML = props.trackLength;
        this.pitch = this.controls.querySelector('.pitch');
        this.fallbackPitch = 0;
        setupListeners.call(this);
    }
}
