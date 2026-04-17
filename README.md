# CDGPlayer

A browser based HTML5/JS karaoke 'Player', that takes a `.zip` rile containing an `.mp3` and `.cdg` file, allowing the
user to render and play directly in the browser.

## Disclaimer

`CDGPlayer` is written for modern browsers, in ECMAScript 6. You may require [Babel](https://babeljs.io/) to bundle the
player into your application. Code does not support Internet Explorer. (It might work in IE 10 or 11, but I'm not
testing for it.)

## External Dependencies

The `CDGPlayer` requires that [JSZip](https://stuk.github.io/jszip/), [JSZipUtils](https://stuk.github.io/jszip-utils/)
and [jsmediatags](https://github.com/aadsm/jsmediatags) be included in your html.

```html
<script type="text/javascript" src="my/assets/jszip.min.js"></script>
<script type="text/javascript" src="my/assets/jszip-utils.min.js"></script>
<script type="text/javascript" src="my/assets/jsmediatags.min.js"></script>
```

## Usage

To include the player in your application, simply install it via npm:

```
npm install cdgplayer
```

The package contains two objects for use in your code. Import the objects that you require directly into your project.

```javascript
import { CDGPlayer, CDGControls } from 'cdgplayer';
```

## The CDGPlayer

The `CDGPlayer` object will handle adding the output 'screen' to a container that you define in your html, and provides
methods for loading a `.zip` file from your server.

#### constructor(String - CSS selector for video wrapper container)

```javascript
const player = new CDGPlayer('#cdg_video_wrapper');
```

To load your karaoke file into the player, the player expects that the file is a `.zip` file containing the two
necessary files for CD+G playback: the `.mp3` file and it's corresponding `.cdg` file. This is the industry standard
today for distributing CD+G files.

Currently loading a file takes a string as a relative path on your server. The player will handle the `GET` request
to request the file.

```javascript
const myFilePath = 'path/on/my/server/to/song.zip';
player.load(myFilePath);
```

The other methods are really only necessary for anyone **not** using the [CDGControls](#CDGControls), which handle all
of these function calls automatically. If you want to use a custom control set, these methods are provided for your
convenience. If you don't require a custom control set, then I suggest you jump straight to the
[CDGControls](#CDGControls) documentation.

### Audio Methods

#### start()

Starts the audio and video display

```javascript
player.start();
```

#### pause()

Pauses the audio and video display

```javascript
player.pause();
```

#### stop()

Stops the audio and video display, and resets the playhead to the beginning of the song

```javascript
player.stop();
```

#### togglePlay()

Will start or pause the audio and video display, depending on it's current state

```javascript
player.togglePlay();
```

#### changePlayerPosition(Integer - percentage of song (0 - 100))

Resets the playhead to the percentage of the song passed in.

```javascript
player.changePlayerPosition(36);
```

#### changeKey(Integer - half steps up or down (-7 thru 7))

Changes the song key by semitones (half steps) up or down. Maintains the song tempo regardless.

```javascript
player.changeKey(-1); // takes it down half a step
```

#### volume(Float - volume up or down, rounded to two decimal places)

Changes the song volume up or down.

```javascript
player.volume(.5); // takes it up a few steps
player.volume(-.5); // takes it down a few steps
```

### toggleMute()

Toggles the "Mute". If volume is greater than 0 it will "Mute" the audio. If already "Mute"d it will put the volume
back to it's previous value.

```javascript
player.toggleMute();
```

### Video Methods

None. Video is loaded with the file, and plays/pauses when the audio plays/pauses. Size of your overall video is
controlled by how you size your 'player' container, and will automatically maintain it's aspect ratio of 300:216.

### Other Methods

#### destroy()

Convenience method to remove all DOM listeners, classes, and elements that had been applied to the DOM.
**Note:** Calling methods on the instance, after calling `destroy()`, will throw many errors.

```javascript
player.destroy();
```

### READ THIS!!! Observed Properties

#### CDGPlayer.props

There are several properties that are 'observed' in the prayer. It is possible to subscribe to updates of these
properties, so that your application can automatically respond to player changes. The 'observed' properties are

* status - String (Gives status updates during player operations)
* loaded - Boolean (Is the song loaded)
* loading - Boolean (Is the song loading)
* isPlaying - Boolean (Is the song playing)
* timePlayed - String (Current time code of the playhead, in minutes:seconds [m:ss] format)
* trackLength - String (Length of currently loaded song, in minutes:seconds [m:ss] format)
* destroy - Boolean (Is the player 'destroyed')

These are 'observed' properties, so you can 'listen' for changes.

```javascript
const onLoadingChange = player.props.on('loading', (val, prev) => {
    if (val !== prev) {
        // loading changed, so now do something
    }
});
```

Remember to clean up your 'listeners' if you're tearing down your player instance.

```javascript
player.props.off(onLoadingChange);
player.destroy(); // 'destroy()' doesn't know about **your** listeners, so you have to handle it yourself
```

## The CDGControls

The `CDGControls` object provides you with a prebuilt, fully configured player interface for controlling the song
loaded into the `CDGPlayer`, including base styling. It allows you to start/pause your song, change the playhead
position, and change the key. This makes setting up a fully functional player very easy. Control defaults to 100% of
the width of it's container.

#### constructor(String - CSS selector for video wrapper container, CDGPlayer - your 'player' instance [,options])

```html
    <div class="cdg-player">
        <div id="cdg_controls"></div>
        <div id="cdg_wrapper"></div>
    </div>
```

```javascript
import { CDGPlayer, CDGControls } from 'cdgplayer';

const player = new CDGPlayer('#cdg_wrapper');
const controls = new CDGControls('#cdg_controls', player);
// logic to get your songlist and load songs
```

Options is an optional object. Currently the only option is `position`, which defaults to `bottom`. If you place the
controls above your player, use `postion: 'top'`. This will allow the volume slider to switch positions.

There are no methods, as all control is handled directly from the interface and it's connection to your player.

* Play/Pause Button - Disabled until your song is 'loaded' into the player, 'click' will toggle the play state
* Progress Meter - Shows the percentage of the current playhead. 'Click'ing this will change to position in the song.
* Pitch Control - Disabled until your song is 'loaded' into the player, a Number input to change your key up or down
(on change). Defaults to 0;

## Adding A Title Image

It's fairly common to want something to display when the player is not yet loaded. We've provided a container, with
a transparent background, which will automatically cover the video canvas whenever the player is not 'loaded'. Here
you can add your own CSS to include your own title image. Because you want to use something that works at almost any
size, we suggest you use a large SVG (maybe 1024x1024). Just remember that your video window's aspect ration is 75:54.
Here's an example of your possible CSS.

```css
.titleImage {
    background-image: url('./myTitleGraphic.svg');
    background-size: 90% 90%;
    background-position: center;
    background-repeat: no-repeat;
}
```

## Styleguide

The following classes are automatically appended to the **head** of your document, by the package. If you choose to
override the default display, write a css file that is appened to the **body** of your document.

### CDGPlayer Styles

* .cdg-video-wrapper -- automatically applied to the wrapper passed in to your `CDGPlayer` constructor
* .cdg-video-player -- applied to the video `canvas` (base size is 300px x 216px) + 12px padding
* .cdg-video-player.x2 -- 2x the base player size
* .cdg-video-player.x3 -- 3x the base player size
* .cdg-video-player.x4 -- 4x the base player size
* .titleImage -- A container for a title image to display when the player isn't loaded

### CDGControls Styles

* cdg-controls (HTML element) flexbox container
* .playButton -- The play/pause 'button'
* .playButton>i -- The icon in the play button
* .playButton>i.icofont-play-alt-1 -- The icon when song not playing (play icon)
* .playButton>i.icofont-pause -- The icon when song is playing (pause icon)
* .playButton[disabled] -- change the cursor and font color when disabled
* .timePlayed -- The current playhead time position
* .progress-meter -- Container for the meter
* .progress -- The actual `progress` HTML element
* .progress::-webkit-progress-bar -- Style the progress bar
* .progress::-webkit-progress-value -- Style the "progress" of the progress bar
* .trackLength -- The current song's track length
* .pitch -- The key changer Number input
* .pitch[disabled] -- change the cursor when disabled
* .volumeControl -- container for the volume button and slider
* .volumeButton -- the volume button itself
* .volumeButton.i -- the icon for volume
* .volumeButton.i.icofont-audio -- the actual icon
* .volumeButton[disabled] -- change the cursor and font color when disabled
* .volumeSlider -- the container for the volume range slider
* .volumeSlider.under -- moves the range slider to below the controls (defaults to above)
* .volumeRange -- the volume range slider
* .volumeRange::-webkit-slider-thumb -- the slider knob

### Running The Example

If you cloned this repository you can easily run the included [example]().

* Run `npm install`
& Place a CD+G karaoke `.zip` file in the `zipfiles` folder
* Write the `.zip` filename into the root `index.js` file.
* Run `npm start`
* Open your browser to [http://localhost:8081](http://localhost:8081)

### Credit Where Credit Is Due

I've done a lot of back-and-forth/trial-and-error on this player over the last year or so. I had a working player
that worked with the HTML `audio` element, but it didn't give me the control to change the key (critical for any
real karaoke player). The original player was based on the HTML5 cdg player from [CD+Graphics Magic](http://cdgmagic.sourceforge.net/).

I rewrote [SoundTouch JS](https://github.com/also/soundtouch-js) to a distributable [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS)
package, and included a `PitchShifter` component for handling key changes. See that repository for credits there.

The current player is based on, and uses pieces of the [karaoke](https://github.com/kmck/karaoke) player written by
[Keith McKnight](https://github.com/kmck). He gives some additional credits in that repository too.

I got my observable properties courtesy of [proxy-observable](https://github.com/AntonLapshin/proxy-observable#readme) by
Anton Lapshin.

And I got royalty free `play` and `pause` font icons courtesy of [IcoFont](https://icofont.com).
