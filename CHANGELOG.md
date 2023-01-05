Changelog
### 0.1.17 (2023-01-05)

### 0.1.16 (2023-01-04)

### 0.1.15 (2023-01-04)

### 0.1.14 (2023-01-04)

### 0.1.13 (2023-01-04)

### 0.1.12 (2023-01-04)

### 0.1.11 (2023-01-04)

### 0.1.10 (2022-05-03)

### 0.1.9 (2021-10-18)

### 0.1.8 (2021-10-18)

### 0.1.7 (2021-10-18)

# Change Log

## Dec 17, 2019 - v0.1.4

* Update dependency libraries to account for security vulnerability
* Update example to account for changes in Chrome (Thanks to [Katherine Winter](https://github.com/KatherineWinter) for code updates)
* Update example to load via file browser (Thanks to [Katherine Winter](https://github.com/KatherineWinter) for code updates)

## Mar 6, 2019 - v0.1.1

* Update dependency libraries to account for security vulnerability
* Update play code for browser changes to autoplay policy (Thanks to Colin Hill for reporting)
* Update package bundling to Babel 7

## Sep 22, 2018 - v0.0.9

* Update underlying soundtouchjs library
* Update internal vars to use 'play' event from soundtouchjs
* Update playback head to use 'play' event from soundtouchjs
* Call video sync from 'play' event from soundtouchjs for smoother output
* Apply playback offset to more closely match the video and audio on timing

## Sep 14, 2018 - v0.0.8

* Change it so that it doesn't display the song tag until after the player is marked as 'loaded'.

## Sep 14, 2018 - v0.0.7

* Create Title Image capability. Documented in the README and added to example.

## Sep 13, 2018 - v0.0.6

* Create Volume slider control and methods
* Update example

## Sep 10, 2018 - v0.0.5

* Read ID3 tag from audio file in zip
* Output 'title' and 'artist' from tag data to the canvas on file load

## Sep 10, 2018 - v0.0.4

* Remove the changeSize() method from the CDGPlayer, and setup automatic ratio on resize via CSS
* Update CDGControls SASS for spacing in the control bar.
* Updated the example

## Sep 7, 2018 - v0.0.3

* Updates to the CDGControls CSS
* Refine the CDGFileLoader, and add capacity for loading zip from file buffer
* Clear player canvas on reload
* Refine player zip handling
* Add methods for controlling volume, and toggling "Mute"