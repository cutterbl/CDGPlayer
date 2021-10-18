import {
  CDG_NOOP,
  CDG_MEMORY_PRESET,
  CDG_BORDER_PRESET,
  CDG_TILE_BLOCK,
  CDG_SCROLL_PRESET,
  CDG_SCROLL_COPY,
  CDG_SET_KEY_COLOR,
  CDG_LOAD_CLUT_LOW,
  CDG_LOAD_CLUT_HI,
  CDG_TILE_BLOCK_XOR,
  COMMAND_MASK,
  CDG_COMMAND,
  PACKET_SIZE,
} from './constants';

import { warn } from './logger';

import {
  CDGNoopInstruction,
  CDGMemoryPresetInstruction,
  CDGBorderPresetInstruction,
  CDGTileBlockInstruction,
  CDGScrollPresetInstruction,
  CDGScrollCopyInstruction,
  CDGSetKeyColorInstruction,
  CDGLoadCLUTLowInstruction,
  CDGLoadCLUTHighInstruction,
  CDGTileBlockXORInstruction,
} from './CDGInstruction';

/**
 * CDG Parser
 * ==========
 *
 * Instruction parser, converting bytecodes to arrays of CDGInstructions
 */
export default class CDGParser {
  static get instructionClassByType() {
    return {
      [CDG_NOOP]: CDGNoopInstruction,
      [CDG_MEMORY_PRESET]: CDGMemoryPresetInstruction,
      [CDG_BORDER_PRESET]: CDGBorderPresetInstruction,
      [CDG_TILE_BLOCK]: CDGTileBlockInstruction,
      [CDG_SCROLL_PRESET]: CDGScrollPresetInstruction,
      [CDG_SCROLL_COPY]: CDGScrollCopyInstruction,
      [CDG_SET_KEY_COLOR]: CDGSetKeyColorInstruction,
      [CDG_LOAD_CLUT_LOW]: CDGLoadCLUTLowInstruction,
      [CDG_LOAD_CLUT_HI]: CDGLoadCLUTHighInstruction,
      [CDG_TILE_BLOCK_XOR]: CDGTileBlockXORInstruction,
    };
  }

  /**
   * Maps commands to instruction classes
   * @type {Object}
   */
  instructionClassByType = this.constructor.instructionClassByType;

  /**
   * Registers an instruction type
   *
   * @param  {string} opcode - CDG instruction opcode
   * @param  {CDGInstruction} InstructionClass - CDG instruction subclass
   */
  registerInstruction(opcode, InstructionClass) {
    this.instructionClassByType[opcode] = InstructionClass;
  }

  /**
   * Creates an instruction
   *
   * @param  {string} opcode - CDG instruction opcode
   * @param  {string} bytes - bytes with CDG instruction
   * @param  {number} offset - a little piece of heaven
   * @return {CDGInstruction}
   */
  createInstruction(opcode, bytes, offset = 0) {
    if (!(opcode in this.instructionClassByType)) {
      warn(`Unknown CDG instruction (instruction = ${opcode})`);
    }
    const InstructionClass =
      this.instructionClassByType[opcode] || CDGNoopInstruction;
    return new InstructionClass(bytes, offset);
  }

  /**
   * Parses a single CDG instruction packet
   *
   * @param  {string} bytes - bytes with CDG instruction
   * @param  {number} offset - a little piece of heaven
   * @return {CDGInstruction}
   */
  parseInstruction(bytes, offset = 0) {
    const command = bytes[offset] & COMMAND_MASK;
    if (command === CDG_COMMAND) {
      const opcode = bytes[offset + 1] & COMMAND_MASK;
      return this.createInstruction(opcode, bytes, offset);
    }
    return new CDGNoopInstruction(bytes, offset);
  }

  /**
   * Parses all the CDG instruction packets
   *
   * @param {string} bytes - bytes with CDG instruction
   * @return {CDGInstruction[]}
   */
  parseInstructions(bytes) {
    const instructions = [];
    const bytesLength = bytes.length;
    for (let offset = 0; offset < bytesLength; offset += PACKET_SIZE) {
      instructions.push(this.parseInstruction(bytes, offset));
    }
    return instructions.filter((instruction) => instruction);
  }
}
