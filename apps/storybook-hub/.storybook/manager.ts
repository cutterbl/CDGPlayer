const STOP_PLAYBACK_MESSAGE_TYPE = 'cdg:stop-playback';

let lastManagerLocation = '';

const getTrackedLocation = (): string =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

/**
 * Posts a best-effort stop message into every Storybook preview iframe.
 *
 * Storybook Hub composes multiple external Storybooks in iframes. Those preview
 * runtimes can remain alive across manager-side navigation, so media playback
 * must be stopped explicitly instead of relying on iframe teardown.
 */
const broadcastStopPlayback = (): void => {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');

  for (const iframe of iframes) {
    iframe.contentWindow?.postMessage(
      { type: STOP_PLAYBACK_MESSAGE_TYPE },
      '*',
    );
  }
};

/**
 * Detects manager URL changes and rebroadcasts stop messages when navigation
 * occurs between composed refs and stories.
 */
const handleManagerLocationChange = (): void => {
  const nextLocation = getTrackedLocation();
  if (nextLocation === lastManagerLocation) {
    return;
  }

  lastManagerLocation = nextLocation;
  broadcastStopPlayback();
};

/**
 * Watches for iframe replacement or reordering in the manager UI and
 * rebroadcasts stop messages so newly mounted previews receive the latest stop
 * signal.
 */
const observeIframeChanges = (): void => {
  const observer = new MutationObserver(() => {
    broadcastStopPlayback();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

lastManagerLocation = getTrackedLocation();
broadcastStopPlayback();
observeIframeChanges();

window.addEventListener('hashchange', handleManagerLocationChange);
window.addEventListener('popstate', handleManagerLocationChange);
window.setInterval(handleManagerLocationChange, 250);
