import { CDGPlayer, CDGControls } from './dist/cdgplayer.js';

const fileName = ''; /*** Place your file path here **/

(function() {
  const player = new CDGPlayer('#cdg_wrapper');
  const controls = new CDGControls('#cdg_controls', player, { position: 'top' });
  const statusChanged = player.props.on('status', val => {
    console.log('Status: ', val);
  });
  if (fileName) {
    setTimeout(() => {
      player.load(fileName);
    }, 1000);
  } else {
    alert('You need to put a fileName path in the example script');
  }
})();
