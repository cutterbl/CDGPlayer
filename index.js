import { CDGPlayer, CDGControls } from './dist/cdgplayer.js';

(function() {
  const player = new CDGPlayer('#cdg_wrapper');
  const controls = new CDGControls('#cdg_controls', player, { position: 'top' });
  const statusChanged = player.props.on('status', val => {
    console.log('Status: ', val);
  });
  setTimeout(() => {
    player.load('zipfiles/MercyMe_I_Can_Only_Imagine(MP3+CDG_Karaoke)_65074.zip');
  }, 10000);
})();
