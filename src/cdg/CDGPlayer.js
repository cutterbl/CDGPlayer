import { PACKETS_PER_SECTOR, SECTORS_PER_SECOND } from './constants';

import CDGContext from './CDGContext';
import CDGParser from './CDGParser';

/**
 * Calculates current time for the sake of determining playback intervals
 *
 * @return {number} milliseconds
 */
function now() {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  } else if (
    typeof process !== 'undefined' &&
    typeof process.hrtime === 'function'
  ) {
    const [seconds, microseconds] = process.hrtime();
    return seconds * 1000 + microseconds / 1000000;
  }
  return Date.now();
}

function requestFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 25);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame === 'function') {
    return cancelAnimationFrame(id);
  }
  return clearTimeout(id);
}

/**
 * CDG Player
 * ==========
 *
 * Provides an interface for interpreting CDG instructions and rendering the results to a canvas
 */
export default class CDGPlayer {
  /**
   * CDG instructions
   * @type {Array}
   */
  instructions = [];

  /**
   * Packet counter
   * @type {Number}
   */
  pc = -1;

  /**
   * requestAnimationFrame unique ID
   * @type {number}
   */
  frameId = null;

  /**
   * Current time (ms)
   * @type {Number}
   */
  pos = 0;

  /**
   * Last sync time (ms)
   * @type {number}
   */
  lastSyncPos = null;

  /**
   * Last sync timestamp
   * @type {DOMHighResTimeStamp}
   */
  lastTimestamp = null;

  /**
   * Steps through however many frames are necessary to bring the context up-to-date with
   *
   * @param  {DOMHighResTimeStamp} timestamp
   * @return {self}
   */
  update = (timestamp = now()) => {
    // Packet counter says relax
    if (this.pc === -1) {
      return this;
    }

    // go ahead and request the next frame
    this.frameId = requestFrame(this.update);

    if (this.lastSyncPos) {
      // last known audio position + time delta
      this.pos = this.lastSyncPos + (timestamp - this.lastTimestamp);
    } else {
      // time delta only (unsynced)
      this.pos += timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
    }

    // determine packet we should be at, based on spec
    // of 4 packets per sector @ 75 sectors per second
    const newPc = Math.floor(
      SECTORS_PER_SECOND * PACKETS_PER_SECTOR * (this.pos / 1000)
    );

    const ffAmt = newPc - this.pc;
    if (ffAmt > 0) {
      this.fastForward(ffAmt);
      this.render();
    }

    return this;
  };

  /**
   * Creates CDGPlayer instance
   *
   * @constructor
   * @param  {Object} [options] - CDG player options
   * @param  {Object} [options.contextOptions] - options for the CDG context
   * @param  {function} [options.afterRender] - function to call after rendering a frame
   */
  constructor({
    contextOptions = {},
    context = this.createContext(contextOptions),
    afterRender,
  } = {}) {
    this.context = context;
    this.afterRender = afterRender;
  }

  /**
   * Creates a CDG context instance for rendering
   *
   * @param  {Object} [options] - parameters passed to the context constructor
   * @return {CDGContext} context instance
   */
  createContext(options = {}) {
    return new CDGContext(options);
  }

  /**
   * Loads CDG data and parses the instructions
   *
   * @param  {string} data - CDG instruction data
   * @return {self}
   */
  load(data) {
    const parser = new CDGParser();
    this.instructions = parser.parseInstructions(data);
    this.reset();
    return this;
  }

  /**
   * Resets the counters
   *
   * @return {self}
   */
  reset() {
    this.pc = 0;
    this.pos = 0;
    this.lastSyncPos = null;
    this.context.reset();
    return this;
  }

  /**
   * Renders the CDG context frame
   * @return {self}
   */
  render() {
    this.context.renderFrame();
    this.afterRender && this.afterRender(this.context);
    return this;
  }

  /**
   * Executes an instruction on this player's context
   *
   * @param  {CDGInstruction} instruction - CDG instruction to run
   * @return {self}
   */
  executeInstruction(instruction) {
    if (instruction && typeof instruction.execute === 'function') {
      instruction.execute(this.context);
    }
    return this;
  }

  /**
   * Executes the next CDG instruction packet
   *
   * @return {self}
   */
  step() {
    if (this.pc >= 0 && this.pc < this.instructions.length) {
      this.executeInstruction(this.instructions[this.pc]);
      this.pc += 1;
    } else {
      this.pc = -1;
      this.stop();
    }
    return this;
  }

  /**
   * Executes several CDG instructions
   *
   * @param  {number} [count]
   * @return {self}
   */
  fastForward(count = 1) {
    const max = this.pc + count;
    while (this.pc >= 0 && this.pc < max) {
      this.step();
    }
    return this;
  }

  /**
   * Starts CDG playback
   *
   * @return {self}
   */
  play() {
    if (!this.frameId) {
      this.frameId = requestFrame(this.update);
      this.lastTimestamp = now();
    }
    return this;
  }

  /**
   * Stops CDG playback
   *
   * @return {self}
   */
  stop() {
    cancelFrame(this.frameId);
    this.frameId = null;
    this.lastSyncPos = null;
    return this;
  }

  /**
   * Syncs playback with a timestamp
   *
   * This is used to sync with the current time of the audio track
   *
   * @param  {number} ms - sync timestamp
   * @return {self}
   */
  sync(ms) {
    this.lastSyncPos = ms;
    this.lastTimestamp = now();
    return this;
  }
}
