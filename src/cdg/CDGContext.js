import { WIDTH, HEIGHT, DISPLAY_PIXELS } from './constants';

/**
 * CDG Context
 * ===========
 *
 * CDG rendering context, maintaining the size and content of the screen and the color palette
 */
export default class CDGContext {
  /**
   * Horizontal offset
   * @type {number}
   */
  hOffset = 0;

  /**
   * Vertical offset
   * @type {number}
   */
  vOffset = 0;

  /**
   * Transparent index in the color lookup table
   * @type {number}
   */
  keyColor = null;

  /**
   * Background index in the color lookup table
   * @type {number}
   */
  backgroundContainer = null;

  /**
   * Last index in the color lookup table that was used as a border preset
   * @type {number}
   */
  borderColor = null;

  /**
   * Last index in the color lookup table that was used as a memory preset
   * @type {number}
   */
  memoryColor = null;

  /**
   * Color lookup table
   * @type {Array}
   */
  clut = new Array(16).fill([0, 0, 0]);

  /**
   * Pixels
   * @type {Array}
   */
  pixels = new Array(DISPLAY_PIXELS).fill(0);

  /**
   * Buffer
   * @type {Array}
   */
  buffer = new Array(DISPLAY_PIXELS).fill(0);

  /**
   * Creates a CDG rendering context
   *
   * @constructor
   * @param  {Object} [options] - context options
   * @param  {number} [options.width] - width of the canvas
   * @param  {number} [options.height] - height of the canvas
   * @param  {HTMLCanvasElement} [options.canvas] - canvas element
   * @param  {CanvasRenderingContext2D} [options.ctx] - canvas rendering context
   * @param  {ImageData} [options.imageData] - pixel data
   */
  constructor({
    width = WIDTH,
    height = HEIGHT,
    canvas = this.createCanvas(width, height),
    ctx = this.createCanvasContext(canvas),
    imageData = this.createImageData(canvas, ctx, width, height),
  } = {}) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.imageData = imageData;
  }

  /**
   * Creates a canvas at the given size
   *
   * @param  {number} width - width of the canvas
   * @param  {number} height - height of the canvas
   * @return {HTMLCanvasElement} created canvas
   */
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Creates a new 2D context for a canvas
   *
   * @param  {HTMLCanvasElement} canvas - canvas element
   * @return {CanvasRenderingContext2D} created context
   */
  createCanvasContext(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  /**
   * Creates image data to dump the pixel data for canvas rendering
   *
   * @param  {HTMLCanvasElement} canvas - canvas element
   * @param  {CanvasRenderingContext2D} ctx - 2D canvas rendering context
   * @param  {number} width - width of the canvas
   * @param  {number} height - height of the canvas
   * @return {ImageData} created image data
   */
  createImageData(canvas, ctx, width = canvas.width, height = canvas.height) {
    return ctx.createImageData(width, height);
  }

  /**
   * Resets the offset and key color
   */
  reset() {
    this.hOffset = 0;
    this.vOffset = 0;
    this.keyColor = null;
    this.backgroundColor = null;
    this.borderColor = null;
    this.memoryColor = null;
    this.pixels.fill(0);
  }

  /**
   * Sets an entry in the color lookup table
   *
   * @param  {Number} index - index in the palette
   * @param  {number} r - red component of the color
   * @param  {number} g - green component of the color
   * @param  {number} b - blue component of the color
   */
  setCLUTEntry(index, r, g, b) {
    this.clut[index] = [r, g, b].map((c) => c * 17);
  }

  /**
   * Sets a pixel's CLUT index value
   *
   * @param {number} x - x position of the pixel
   * @param {number} y - y position of the pixel
   * @param {number} colorIndex - CLUT index
   */
  setPixel(x, y, colorIndex) {
    this.pixels[x + y * WIDTH] = colorIndex;
  }

  /**
   * Gets a pixel's CLUT index value
   *
   * @param  {number} x - x position of the pixel
   * @param  {number} y - y position of the pixel
   * @return {number} CLUT index
   */
  getPixel(x, y) {
    return this.pixels[x + y * WIDTH];
  }

  /**
   * Gets the background color index from the CLUT based on the transparent or background color
   *
   * @return {number} CLUT index
   */
  getBackground() {
    switch (true) {
      case this.keyColor != null:
        return this.keyColor;
      case this.backgroundColor != null:
        return this.backgroundColor;
      case this.memoryColor != null:
        return this.memoryColor;
      case this.borderColor != null:
        return this.borderColor;
      default:
        return 0;
    }
  }

  /**
   * Converts palette-based pixel data to image data
   *
   * @return {ImageData} generated imagedata
   */
  generateImageData() {
    const [left, top, right, bottom] = [0, 0, WIDTH, HEIGHT];
    for (let x = left; x < right; x++) {
      for (let y = top; y < bottom; y++) {
        // The offset is where we draw the pixel in the raster data
        const offset = 4 * (x + y * WIDTH);
        // Respect the horizontal and vertical offsets for grabbing the pixel color
        const px = (x - this.hOffset + WIDTH) % WIDTH;
        const py = (y - this.vOffset + HEIGHT) % HEIGHT;
        const pixelIndex = px + py * WIDTH;
        const colorIndex = this.pixels[pixelIndex];
        const [r, g, b] = this.clut[colorIndex];
        // Set the rgba values in the image data
        this.imageData.data[offset] = r;
        this.imageData.data[offset + 1] = g;
        this.imageData.data[offset + 2] = b;
        this.imageData.data[offset + 3] =
          colorIndex === this.keyColor ? 0x00 : 0xff;
      }
    }
    return this.imageData;
  }

  /**
   * Renders the pixel buffer
   */
  renderFrame() {
    this.ctx.putImageData(this.generateImageData(), 0, 0);
  }
}
