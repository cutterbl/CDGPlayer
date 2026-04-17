// JSZip and JSZipUtils are external dependencies
//import * as JSZip from 'jszip';
//import JSZipUtils from 'jszip-utils';
import Deferred from '../utilities/deferred.js';
// import jsmediatags from 'jsmediatags';

const getDataFile = function (filePath) {
  const deferred = new Deferred();
  JSZipUtils.getBinaryContent(filePath, (err, data) => {
    if (err) {
      deferred.reject(
        new Error(`There was an error retrieving ${filePath}`, err)
      );
      return;
    }
    deferred.resolve(data);
  });
  return deferred.promise;
};

const loadZipBuffer = function (fileBuffer) {
  return JSZip.loadAsync(fileBuffer).catch((error) =>
    Promise.reject(new Error('There was an error reading the zip file.', error))
  );
};

const loadAudio = function (zipEntry) {
  return zipEntry
    .async('arraybuffer')
    .catch(() => Promise.reject(new Error('Unable to load the audio file')));
};

const getFallbackTagData = function (name) {
  const parts = name.split(' - ');
  const tag = { tags: {} };
  // most downloaded cdgs have filenames 'album - artist - songtitle
  tag.tags.album = parts[0].trim();
  tag.tags.artist = parts[1] ? parts[1].trim() : tag.tags.album;
  tag.tags.title = parts[2] ? parts[2].trim() : tag.tags.artist;
  return tag;
};

const getTagData = function (zipEntry) {
  return zipEntry
    .async('blob')
    .then(
      (buffer) =>
        new Promise((resolve) => {
          new jsmediatags.Reader(buffer)
            .setTagsToRead([
              'title',
              'artist',
              'album',
              'track',
              'year',
              'genre',
              'picture',
            ])
            .read({
              onSuccess: (tag) => resolve(tag),
              onError: () => resolve(getFallbackTagData(zipEntry.name)),
            });
        })
    )
    .catch(() => Promise.reject(new Error('Unable to parse tag data')));
};

const loadVideo = function (zipEntry) {
  return zipEntry
    .async('uint8array')
    .catch(() => Promise.reject(new Error('Unable to load the video file')));
};

const getKaraokeFiles = function (zipFile) {
  const entries = zipFile.filter(
    (relPath) => relPath.endsWith('.cdg') || relPath.endsWith('.mp3')
  );
  if (entries.length === 2) {
    return Promise.resolve(entries);
  }
  return Promise.reject('The file is not a karaoke .zip file');
};

const processZip = function (entries) {
  const audio = entries.filter((entry) => entry.name.endsWith('.mp3'));
  const video = entries.filter((entry) => entry.name.endsWith('.cdg'));
  const process = [];
  if (audio.length && video.length) {
    process.push(loadAudio(audio[0]));
    process.push(loadVideo(video[0]));
    process.push(getTagData(audio[0]));
    return Promise.all(process);
  }
  const errors = [];
  if (!audio.length) {
    errors.push('No mp3 audio file present.');
  }
  if (!video.length) {
    errors.push('No cdg video file present.');
  }
  return Promise.reject(new Error(errors.join(' ')));
};

export default class CDGFileLoader {
  static loadZipFile(filePath) {
    return getDataFile(filePath)
      .then((fileBuffer) => loadZipBuffer(fileBuffer))
      .then((zipFile) => getKaraokeFiles(zipFile))
      .then((entries) => processZip(entries))
      .catch((error) => Promise.reject(error));
  }

  static loadFileBuffer(fileBuffer) {
    return loadZipBuffer(fileBuffer)
      .then((zipFile) => getKaraokeFiles(zipFile))
      .then((entries) => processZip(entries))
      .catch((err) => Promise.reject(err));
  }
}
