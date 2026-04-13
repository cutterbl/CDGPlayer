import {
  CDG_BORDER_PRESET,
  CDG_COMMAND,
  CDG_LOAD_CLUT_HI,
  CDG_LOAD_CLUT_LOW,
  CDG_MEMORY_PRESET,
  CDG_NOOP,
  CDG_SCROLL_COPY,
  CDG_SCROLL_PRESET,
  CDG_SET_KEY_COLOR,
  CDG_TILE_BLOCK,
  CDG_TILE_BLOCK_XOR,
  COMMAND_MASK,
  PACKET_SIZE,
} from './constants.js';
import {
  CDGBorderPresetInstruction,
  CDGInstruction,
  CDGLoadCLUTHighInstruction,
  CDGLoadCLUTLowInstruction,
  CDGMemoryPresetInstruction,
  CDGNoopInstruction,
  CDGScrollCopyInstruction,
  CDGScrollPresetInstruction,
  CDGSetKeyColorInstruction,
  CDGTileBlockInstruction,
  CDGTileBlockXORInstruction,
} from './cdg-instruction.js';
import { warn } from './logger.js';
import type { ByteLike } from './types.js';

/**
 * Constructor signature for instruction classes registered with CDGParser.
 */
export type InstructionConstructor<T extends CDGInstruction = CDGInstruction> =
  new (args: { bytes: ByteLike; offset?: number }) => T;

/**
 * Parses CD+G packet byte streams into executable instruction objects.
 */
export class CDGParser {
  /**
   * Default opcode-to-instruction registry.
   */
  static get instructionClassByType(): Record<number, InstructionConstructor> {
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

  instructionClassByType: Record<number, InstructionConstructor> = {
    ...CDGParser.instructionClassByType,
  };

  /**
   * Registers or overrides an instruction implementation for an opcode.
   */
  registerInstruction({
    opcode,
    instructionClass,
  }: {
    opcode: number;
    instructionClass: InstructionConstructor;
  }): void {
    this.instructionClassByType[opcode] = instructionClass;
  }

  /**
   * Creates one instruction instance from opcode + packet bytes.
   */
  createInstruction({
    opcode,
    bytes,
    offset = 0,
  }: {
    opcode: number;
    bytes: ByteLike;
    offset?: number;
  }): CDGInstruction {
    if (!(opcode in this.instructionClassByType)) {
      warn(`Unknown CDG instruction (instruction = ${opcode})`);
    }

    const InstructionClass =
      this.instructionClassByType[opcode] ?? CDGNoopInstruction;
    return new InstructionClass({ bytes, offset });
  }

  /**
   * Parses one packet at the given byte offset.
   */
  parseInstruction({
    bytes,
    offset = 0,
  }: {
    bytes: ByteLike;
    offset?: number;
  }): CDGInstruction {
    const command = (bytes[offset] ?? 0) & COMMAND_MASK;
    if (command === CDG_COMMAND) {
      const opcode = (bytes[offset + 1] ?? 0) & COMMAND_MASK;
      return this.createInstruction({ opcode, bytes, offset });
    }

    return new CDGNoopInstruction({ bytes, offset });
  }

  /**
   * Parses a full byte stream into packet-aligned instruction objects.
   */
  parseInstructions({ bytes }: { bytes: ByteLike }): CDGInstruction[] {
    const instructions: CDGInstruction[] = [];
    for (let offset = 0; offset < bytes.length; offset += PACKET_SIZE) {
      instructions.push(this.parseInstruction({ bytes, offset }));
    }
    return instructions;
  }
}

export default CDGParser;
