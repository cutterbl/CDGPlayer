import { CDGPlayer, CDGControls } from './dist/cdgplayer.js';

(function() {
    const player = new CDGPlayer('#cdg_wrapper');
    const controls = new CDGControls('#cdg_controls', player);
    const statusChanged = player.props.on('status', val => {
        console.log('Status: ', val);
    });
    player.load('zipfiles/FTXC416-03 - Rascal Flatts - Changed.zip');
})();
