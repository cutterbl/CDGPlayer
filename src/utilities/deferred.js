/**
 * Deferred()
 * Is a shim, written by Mozilla. It's a backwards/forwards compatible helper object to account for the
 * elimination of the Deferred object while still having a need for the functionality.
 *
 * https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred#backwards_forwards_compatible
 * (Usage example can be found at above link, but here's the basics)
 *
 * const deferred = new Deferred();
 * const promise = deferred.promise; // still just a promise
 */

const Deferred = function () {
  // update 062115 for typeof
  if (typeof Promise !== 'undefined' && Promise.defer) {
    //need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
    return Promise.defer();
  } else if (typeof PromiseUtils !== 'undefined' && PromiseUtils.defer) {
    // eslint-disable-line no-undef
    //need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
    return PromiseUtils.defer(); // eslint-disable-line no-undef
  } else {
    /* A method to resolve the associated Promise with the value passed.
     * If the promise is already settled it does nothing.
     *
     * @param {anything} value : This value is used to resolve the promise
     * If the value is a Promise then the associated promise assumes the state
     * of Promise passed as value.
     */
    this.resolve = null;

    /* A method to reject the assocaited Promise with the value passed.
     * If the promise is already settled it does nothing.
     *
     * @param {anything} reason: The reason for the rejection of the Promise.
     * Generally its an Error object. If however a Promise is passed, then the Promise
     * itself will be the reason for rejection no matter the state of the Promise.
     */
    this.reject = null;

    /* A newly created Promise object.
     * Initially in pending state.
     */
    this.promise = new Promise(
      function (resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
      }.bind(this)
    );
    Object.freeze(this);
  }
};

export default Deferred;
