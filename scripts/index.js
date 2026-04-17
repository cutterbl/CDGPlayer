import { CDGPlayer, CDGControls } from './js/cdgplayer.js';

function setState(state) {
  switch (state) {
    case 'loading':
      document.querySelector('#file-select-container').style.visibility =
        'visible';
      document.querySelector('.cdg-player').style.visibility = 'hidden';
      break;
    case 'cdg':
      document.querySelector('#file-select-container').style.visibility =
        'hidden';
      document.querySelector('.cdg-player').style.visibility = 'visible';
      break;
    default:
      alert('unknown state');
  }
}

function loadPlayer(filename) {
  const player = new CDGPlayer('#cdg_wrapper');
  const controls = new CDGControls('#cdg_controls', player, {
    position: 'top',
  });
  const statusChanged = player.props.on('status', (val) => {
    console.log('Status: ', val);
    if (val === 'File Loaded') {
      player.start();
    }
  });
  player.load(filename);
}

(function () {
  const fileReader = new FileReader();
  setState('loading');
  fileReader.onload = (fileEvent) => loadPlayer(fileEvent.target.result);
  document.querySelector('#file-select').addEventListener('change', (event) => {
    const files = event.target.files;
    try {
      fileReader.readAsArrayBuffer(files[0]);
      setState('cdg');
    } catch (error) {
      alert(error);
    }
  });
})();
