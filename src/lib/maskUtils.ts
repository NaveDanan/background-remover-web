/**
 * Mask compression utilities using Run-Length Encoding (RLE)
 * 
 * RLE format: Array of [start, length] pairs where each pair indicates
 * a run of 'true' (selected) pixels. Coordinates are flattened (row-major).
 * 
 * Memory savings example:
 * - 1000x1000 region with 50% fill:
 *   - Raw Uint8Array: 1,000,000 bytes
 *   - RLE (best case - one contiguous block): ~8 bytes
 *   - RLE (worst case - checkerboard): ~1,000,000 numbers * 4 = 4MB (worse!)
 *   - RLE (typical flood fill - ~100 runs): ~400 bytes
 */

/**
 * Encode a binary mask to RLE format
 * @param mask - Binary mask (0 or 1 values)
 * @returns RLE encoded array of [start, length] pairs
 */
export function encodeMaskToRLE(mask: Uint8Array): Uint32Array {
  const runs: number[] = [];
  let inRun = false;
  let runStart = 0;

  for (let i = 0; i < mask.length; i++) {
    const isSelected = mask[i] > 0;

    if (isSelected && !inRun) {
      // Start new run
      inRun = true;
      runStart = i;
    } else if (!isSelected && inRun) {
      // End current run
      runs.push(runStart, i - runStart);
      inRun = false;
    }
  }

  // Close final run if still active
  if (inRun) {
    runs.push(runStart, mask.length - runStart);
  }

  return new Uint32Array(runs);
}

/**
 * Decode RLE back to binary mask
 * @param rle - RLE encoded array of [start, length] pairs
 * @param maskSize - Total size of the output mask
 * @returns Binary mask Uint8Array
 */
export function decodeMaskFromRLE(rle: Uint32Array, maskSize: number): Uint8Array {
  const mask = new Uint8Array(maskSize);

  for (let i = 0; i < rle.length; i += 2) {
    const start = rle[i];
    const length = rle[i + 1];
    const end = Math.min(start + length, maskSize);

    for (let j = start; j < end; j++) {
      mask[j] = 1;
    }
  }

  return mask;
}

/**
 * Check if a pixel is selected in an RLE-encoded mask
 * Useful for point queries without decoding entire mask
 * @param rle - RLE encoded array
 * @param index - Pixel index to check
 * @returns true if pixel is selected
 */
export function isPixelSelectedInRLE(rle: Uint32Array, index: number): boolean {
  // Binary search for the run containing this index
  let left = 0;
  let right = rle.length / 2 - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const runStart = rle[mid * 2];
    const runLength = rle[mid * 2 + 1];
    const runEnd = runStart + runLength;

    if (index >= runStart && index < runEnd) {
      return true;
    } else if (index < runStart) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return false;
}

/**
 * Get the memory size of an RLE-encoded mask in bytes
 */
export function getRLEMemorySize(rle: Uint32Array): number {
  return rle.byteLength;
}

/**
 * Get the memory size of a raw mask in bytes
 */
export function getRawMaskMemorySize(width: number, height: number): number {
  return width * height;
}

/**
 * Calculate compression ratio (raw size / RLE size)
 * Higher is better. < 1 means RLE is actually larger.
 */
export function getCompressionRatio(rle: Uint32Array, width: number, height: number): number {
  const rawSize = getRawMaskMemorySize(width, height);
  const rleSize = getRLEMemorySize(rle);
  return rleSize > 0 ? rawSize / rleSize : Infinity;
}

/**
 * Merge two RLE-encoded masks with OR operation
 * Both masks must have same dimensions
 * @param rle1 - First RLE mask
 * @param rle2 - Second RLE mask  
 * @param maskSize - Total mask size
 * @returns Merged RLE mask
 */
export function mergeRLEMasks(
  rle1: Uint32Array,
  rle2: Uint32Array,
  maskSize: number
): Uint32Array {
  // For simplicity, decode both, merge, and re-encode
  // This could be optimized with a merge algorithm, but rarely needed
  const mask1 = decodeMaskFromRLE(rle1, maskSize);
  const mask2 = decodeMaskFromRLE(rle2, maskSize);

  // OR operation
  for (let i = 0; i < maskSize; i++) {
    mask1[i] = mask1[i] | mask2[i];
  }

  return encodeMaskToRLE(mask1);
}

/**
 * Count set pixels in an RLE mask efficiently (without decoding)
 */
export function countPixelsInRLE(rle: Uint32Array): number {
  let count = 0;
  for (let i = 1; i < rle.length; i += 2) {
    count += rle[i]; // Sum all lengths
  }
  return count;
}

/**
 * Type for compressed mask with metadata
 */
export interface CompressedMask {
  rle: Uint32Array;
  width: number;
  height: number;
  pixelCount: number;
}

/**
 * Create a compressed mask from raw mask data
 */
export function compressMask(
  mask: Uint8Array,
  width: number,
  height: number
): CompressedMask {
  const rle = encodeMaskToRLE(mask);
  const pixelCount = countPixelsInRLE(rle);
  
  return {
    rle,
    width,
    height,
    pixelCount,
  };
}

/**
 * Decompress a mask back to Uint8Array
 */
export function decompressMask(compressed: CompressedMask): Uint8Array {
  return decodeMaskFromRLE(compressed.rle, compressed.width * compressed.height);
}
