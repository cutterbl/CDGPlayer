// JSZip and JSZipUtils are external dependencies
//import * as JSZip from 'jszip';
//import JSZipUtils from 'jszip-utils';
import Deferred from '../utilities/deferred.js';

const getDataFile = function(filePath) {
    const deferred = new Deferred();
    JSZipUtils.getBinaryContent(filePath, (err, data) => {
        if (err) {
            deferred.reject(new Error(`There was an error retrieving ${filePath}`, err));
            return;
        }
        JSZip.loadAsync(data)
            .then(zipFile => {
                deferred.resolve(zipFile);
            })
            .catch(error => {
                deferred.reject(new Error(`There was an error reading ${filePath}`, error));
            });
    });
    return deferred.promise;
};

const loadAudio = function(zipEntry, zipFile) {
    return zipFile
        .file(zipEntry)
        .async('arraybuffer')
        .catch(error =>
            Promise.reject(new Error(`There was an issue getting the data from ${zipEntry}`, error))
        );
};

const loadVideo = function(zipEntry, zipFile) {
    return zipFile
        .file(zipEntry)
        .async('uint8array')
        .catch(error =>
            Promise.reject(new Error(`There was an issue getting the data from ${zipEntry}`, error))
        );
};

const processZip = function(entries, zipFile) {
    const process = [];
    const audio = entries.find(el => el.toLowerCase().includes('.mp3'));
    const video = entries.find(el => el.toLowerCase().includes('.cdg'));
    if (audio && video) {
        process.push(loadAudio(audio, zipFile));
        process.push(loadVideo(video, zipFile));
        return Promise.all(process).catch(error =>
            Promise.reject(new Error(`Processing audio and video failed`, error))
        );
    } else {
        const errors = [];
        if (!audio) {
            errors.push('No mp3 audio file present.');
        }
        if (!video) {
            errors.push('No cdg video file present.');
        }
        return Promise.reject(new Error(errors.join(' ')));
    }
};

export default class CDGFileLoader {
    static loadZipFile(filePath) {
        const promise = getDataFile(filePath).then(zipFile => {
            const entries = Object.keys(zipFile.files);
            if (entries.length) {
                return processZip(entries, zipFile);
            } else {
                return Promise.reject(new Error(`The zip file (${filePath}) was empty.`));
            }
        });
        return promise.catch(error => Promise.reject(new Error('File retrieval error', error)));
    }
}
