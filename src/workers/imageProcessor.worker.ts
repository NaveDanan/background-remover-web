// Image Processing Web Worker for Background Removal
// Optimized for performance with larger chunks, SIMD-like operations, and reduced allocations

interface SelectedColor {
  id: string;
  r: number;
  g: number;
  b: number;
  tolerance: number;
}

interface MagicRegion {
  id: string;
  maskRLE: Uint32Array; // RLE-encoded binary mask (pairs of [start, length])
  bounds: { x: number; y: number; width: number; height: number };
  pixelCount: number;
  averageColor: { r: number; g: number; b: number };
  mode: 'keep' | 'remove';
}

interface MagicSelectionState {
  isActive: boolean;
  tolerance: number;
  previewRegion: MagicRegion | null;
  appliedRegions: MagicRegion[];
}

interface ProcessingSettings {
  mode: 'auto' | 'manual' | 'colorPicker';
  threshold: number;
  autoThreshold: number;
  selectedColors: SelectedColor[];
  edgeMode: 'hard' | 'feathered' | 'decontaminate' | 'smooth' | 'refine';
  featherRadius: number;
  magicSelection: MagicSelectionState;
}

interface ProcessMessage {
  type: 'process';
  imageData: ImageData;
  settings: ProcessingSettings;
}

interface CalculateAutoThresholdMessage {
  type: 'calculateAutoThreshold';
  imageData: ImageData;
}

interface MagicSelectMessage {
  type: 'magicSelect';
  imageData: ImageData;
  magicSelectParams: {
    x: number;
    y: number;
    tolerance: number;
    width: number;
    height: number;
  };
}

interface CancelMessage {
  type: 'cancel';
}

type WorkerMessage = ProcessMessage | CalculateAutoThresholdMessage | MagicSelectMessage | CancelMessage;

interface ProgressResponse {
  type: 'progress';
  progress: number;
}

interface CompleteResponse {
  type: 'complete';
  imageData: ImageData;
}

interface AutoThresholdResponse {
  type: 'autoThreshold';
  threshold: number;
  dominantColor: { r: number; g: number; b: number };
}

interface MagicSelectResponse {
  type: 'magicSelectResult';
  magicRegion: MagicRegion;
}

interface CancelledResponse {
  type: 'cancelled';
}

interface ErrorResponse {
  type: 'error';
  error: string;
}

// WorkerResponse type documents the API - used for type-safe message posting
type _WorkerResponse =
  | ProgressResponse
  | CompleteResponse
  | AutoThresholdResponse
  | MagicSelectResponse
  | CancelledResponse
  | ErrorResponse;

// Ensure type is used (prevents TS6196)
void (0 as unknown as _WorkerResponse);

// Processing state
let isCancelled = false;

// ============================================
// RLE (Run-Length Encoding) utilities for mask compression
// ============================================

/**
 * Encode a binary mask to RLE format
 * @param mask - Binary mask (0 or 1 values)
 * @returns RLE encoded array of [start, length] pairs
 */
function encodeMaskToRLE(mask: Uint8Array): Uint32Array {
  const runs: number[] = [];
  let inRun = false;
  let runStart = 0;

  for (let i = 0; i < mask.length; i++) {
    const isSelected = mask[i] > 0;

    if (isSelected && !inRun) {
      inRun = true;
      runStart = i;
    } else if (!isSelected && inRun) {
      runs.push(runStart, i - runStart);
      inRun = false;
    }
  }

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
function decodeMaskFromRLE(rle: Uint32Array, maskSize: number): Uint8Array {
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

// ============================================

// Pre-computed lookup table for squared color distances (avoids sqrt in hot path)
const SQUARED_COLOR_WEIGHTS = { r: 2, g: 4, b: 3 };

/**
 * Calculate perceptually weighted color distance (squared, for comparison)
 * Using squared distance avoids expensive sqrt operation
 */
function colorDistanceSquared(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const rDiff = r1 - r2;
  const gDiff = g1 - g2;
  const bDiff = b1 - b2;
  return SQUARED_COLOR_WEIGHTS.r * rDiff * rDiff + 
         SQUARED_COLOR_WEIGHTS.g * gDiff * gDiff + 
         SQUARED_COLOR_WEIGHTS.b * bDiff * bDiff;
}

/**
 * Calculate actual color distance (only when needed for feathering)
 */
function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  return Math.sqrt(colorDistanceSquared(r1, g1, b1, r2, g2, b2));
}

/**
 * Gaussian-like falloff for feathered edges
 */
function gaussianFalloff(distance: number, threshold: number, featherRadius: number): number {
  if (distance <= threshold) {
    return 0;
  }
  if (distance >= threshold + featherRadius) {
    return 255;
  }
  const t = (distance - threshold) / featherRadius;
  // Smooth step function for natural-looking edges
  const smoothT = t * t * (3 - 2 * t);
  return Math.round(smoothT * 255);
}

// ============================================
// Advanced Edge Processing Algorithms
// ============================================

/**
 * Check if a pixel is on the edge (has at least one transparent neighbor)
 */
function isEdgePixel(alphaMask: Uint8Array, x: number, y: number, width: number, height: number): boolean {
  const centerAlpha = alphaMask[y * width + x];
  if (centerAlpha === 0 || centerAlpha === 255) {
    // Check 4-connected neighbors
    const neighbors = [
      y > 0 ? alphaMask[(y - 1) * width + x] : centerAlpha,
      y < height - 1 ? alphaMask[(y + 1) * width + x] : centerAlpha,
      x > 0 ? alphaMask[y * width + (x - 1)] : centerAlpha,
      x < width - 1 ? alphaMask[y * width + (x + 1)] : centerAlpha,
    ];
    for (const n of neighbors) {
      if ((centerAlpha > 128 && n <= 128) || (centerAlpha <= 128 && n > 128)) {
        return true;
      }
    }
  }
  return centerAlpha > 0 && centerAlpha < 255;
}

/**
 * Decontaminate edge pixels by removing background color spill
 * This shifts the color of edge pixels away from the background color
 */
function decontaminateEdges(
  imageData: Uint8ClampedArray,
  alphaMask: Uint8Array,
  width: number,
  height: number,
  bgColor: { r: number; g: number; b: number },
  radius: number
): void {
  const edgeRadius = Math.max(1, Math.min(radius, 10));
  
  // Find edge pixels and decontaminate them
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = alphaMask[idx];
      
      // Only process semi-transparent and near-edge opaque pixels
      if (alpha === 0) continue;
      
      const isEdge = isEdgePixel(alphaMask, x, y, width, height);
      if (!isEdge && alpha === 255) continue;
      
      const pixelIdx = idx << 2;
      const r = imageData[pixelIdx];
      const g = imageData[pixelIdx + 1];
      const b = imageData[pixelIdx + 2];
      
      // Calculate how much this pixel resembles the background color
      const bgSimilarity = 1 - Math.min(1, Math.sqrt(
        colorDistanceSquared(r, g, b, bgColor.r, bgColor.g, bgColor.b)
      ) / 200);
      
      // Calculate how much this pixel is affected by transparency
      const bgInfluence = 1 - (alpha / 255);
      const decontamStrength = Math.min(1, (bgInfluence + bgSimilarity * 0.5) * (isEdge ? 1.2 : 0.8));
      
      if (decontamStrength > 0.05) {
        // Sample nearby opaque foreground pixels to get clean color
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        
        for (let dy = -edgeRadius; dy <= edgeRadius; dy++) {
          for (let dx = -edgeRadius; dx <= edgeRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            
            const nIdx = ny * width + nx;
            const nAlpha = alphaMask[nIdx];
            
            // Only sample from fully opaque non-edge pixels
            if (nAlpha === 255 && !isEdgePixel(alphaMask, nx, ny, width, height)) {
              const nPixelIdx = nIdx << 2;
              sumR += imageData[nPixelIdx];
              sumG += imageData[nPixelIdx + 1];
              sumB += imageData[nPixelIdx + 2];
              count++;
            }
          }
        }
        
        if (count > 0) {
          // Blend towards the average foreground color
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          
          // Remove background color influence from the pixel
          // This shifts the color away from background and towards foreground
          const cleanR = r + (avgR - r) * decontamStrength * 0.7 - (bgColor.r - r) * bgSimilarity * 0.3;
          const cleanG = g + (avgG - g) * decontamStrength * 0.7 - (bgColor.g - g) * bgSimilarity * 0.3;
          const cleanB = b + (avgB - b) * decontamStrength * 0.7 - (bgColor.b - b) * bgSimilarity * 0.3;
          
          imageData[pixelIdx] = Math.round(Math.max(0, Math.min(255, cleanR)));
          imageData[pixelIdx + 1] = Math.round(Math.max(0, Math.min(255, cleanG)));
          imageData[pixelIdx + 2] = Math.round(Math.max(0, Math.min(255, cleanB)));
        }
      }
    }
  }
}

/**
 * Apply smooth anti-aliasing to edges using local neighborhood sampling
 * Creates subpixel-accurate alpha values for smoother edges
 */
function smoothEdges(
  alphaMask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const smoothRadius = Math.max(1, Math.min(radius, 5));
  const smoothed = new Uint8Array(width * height);
  
  // Gaussian-like weights for smoothing kernel
  const kernelSize = smoothRadius * 2 + 1;
  const kernel: number[] = [];
  let kernelSum = 0;
  
  for (let i = 0; i < kernelSize; i++) {
    for (let j = 0; j < kernelSize; j++) {
      const dx = i - smoothRadius;
      const dy = j - smoothRadius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const weight = Math.exp(-(dist * dist) / (2 * smoothRadius));
      kernel.push(weight);
      kernelSum += weight;
    }
  }
  
  // Normalize kernel
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= kernelSum;
  }
  
  // Apply smoothing only to edge regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const centerAlpha = alphaMask[idx];
      
      // Check if this is an edge region (has variation in neighbors)
      let hasVariation = false;
      if (x > 0 && alphaMask[idx - 1] !== centerAlpha) hasVariation = true;
      if (x < width - 1 && alphaMask[idx + 1] !== centerAlpha) hasVariation = true;
      if (y > 0 && alphaMask[idx - width] !== centerAlpha) hasVariation = true;
      if (y < height - 1 && alphaMask[idx + width] !== centerAlpha) hasVariation = true;
      
      if (!hasVariation) {
        smoothed[idx] = centerAlpha;
        continue;
      }
      
      // Apply weighted average to edge pixels
      let sum = 0;
      let ki = 0;
      
      for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
        for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          sum += alphaMask[ny * width + nx] * kernel[ki];
          ki++;
        }
      }
      
      smoothed[idx] = Math.round(sum);
    }
  }
  
  return smoothed;
}

/**
 * Morphological refinement: erode to remove noise, then dilate to restore edges
 * This cleans up jagged edges and small artifacts
 */
function refineEdges(
  alphaMask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const erodeRadius = Math.max(1, Math.min(radius, 3));
  const temp = new Uint8Array(width * height);
  const refined = new Uint8Array(width * height);
  
  // Erode: shrink foreground (make edges cleaner)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let minAlpha = alphaMask[idx];
      
      // Check neighborhood for minimum alpha
      for (let dy = -erodeRadius; dy <= erodeRadius; dy++) {
        for (let dx = -erodeRadius; dx <= erodeRadius; dx++) {
          if (dx * dx + dy * dy > erodeRadius * erodeRadius) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          minAlpha = Math.min(minAlpha, alphaMask[ny * width + nx]);
        }
      }
      
      temp[idx] = minAlpha;
    }
  }
  
  // Dilate: grow foreground back (restore edges without noise)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let maxAlpha = temp[idx];
      
      // Check neighborhood for maximum alpha
      for (let dy = -erodeRadius; dy <= erodeRadius; dy++) {
        for (let dx = -erodeRadius; dx <= erodeRadius; dx++) {
          if (dx * dx + dy * dy > erodeRadius * erodeRadius) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          maxAlpha = Math.max(maxAlpha, temp[ny * width + nx]);
        }
      }
      
      refined[idx] = maxAlpha;
    }
  }
  
  // Optional: apply a light smoothing pass for better results
  const smoothed = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const center = refined[idx];
      
      // Quick 3x3 box blur on edges only
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const hasEdge = 
          refined[idx - 1] !== center || 
          refined[idx + 1] !== center ||
          refined[idx - width] !== center ||
          refined[idx + width] !== center;
        
        if (hasEdge) {
          const sum = 
            refined[idx - width - 1] + refined[idx - width] + refined[idx - width + 1] +
            refined[idx - 1] + center + refined[idx + 1] +
            refined[idx + width - 1] + refined[idx + width] + refined[idx + width + 1];
          smoothed[idx] = Math.round(sum / 9);
          continue;
        }
      }
      smoothed[idx] = center;
    }
  }
  
  return smoothed;
}

/**
 * Process image to remove background - optimized version with advanced edge modes
 */
async function processImage(imageData: ImageData, settings: ProcessingSettings): Promise<void> {
  const { mode, threshold, autoThreshold, selectedColors, edgeMode, featherRadius } = settings;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;
  
  // Optimized: Larger chunk size for fewer context switches (250K pixels per chunk)
  const chunkSize = 250000;
  let processedPixels = 0;
  let lastProgressUpdate = 0;
  
  // Progress update throttling (update every 10% for responsiveness without overhead)
  const PROGRESS_UPDATE_INTERVAL = 10;

  // Determine which threshold to use based on mode
  const effectiveThreshold = mode === 'auto' ? autoThreshold : threshold;
  // Pre-compute squared threshold for faster comparisons
  const thresholdSquared = effectiveThreshold * effectiveThreshold;

  // For auto/manual modes, we need a dominant color to compare against
  let dominantColor = { r: 255, g: 255, b: 255 };

  if (mode === 'auto' || mode === 'manual') {
    dominantColor = detectDominantColor(imageData);
  }

  // Pre-compute color picker data for faster lookups
  const colorPickerData = mode === 'colorPicker' ? selectedColors.map(c => ({
    r: c.r,
    g: c.g,
    b: c.b,
    toleranceSquared: c.tolerance * c.tolerance,
    tolerance: c.tolerance
  })) : [];

  // Create alpha mask for advanced edge processing
  const useAdvancedEdge = edgeMode === 'decontaminate' || edgeMode === 'smooth' || edgeMode === 'refine';
  let alphaMask: Uint8Array | null = null;
  
  if (useAdvancedEdge) {
    alphaMask = new Uint8Array(totalPixels);
    alphaMask.fill(255); // Start with all opaque
  }

  // Phase 1: Compute raw alpha mask / apply basic edge modes
  for (let chunkStart = 0; chunkStart < totalPixels; chunkStart += chunkSize) {
    if (isCancelled) {
      self.postMessage({ type: 'cancelled' } as CancelledResponse);
      return;
    }

    const chunkEnd = Math.min(chunkStart + chunkSize, totalPixels);

    // Process pixels in tight loop (minimized function calls)
    for (let i = chunkStart; i < chunkEnd; i++) {
      const pixelIndex = i << 2; // Multiply by 4 using bit shift (faster)
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      if (mode === 'colorPicker') {
        // Check against each selected color using squared distance
        for (let j = 0; j < colorPickerData.length; j++) {
          const selected = colorPickerData[j];
          const distSq = colorDistanceSquared(r, g, b, selected.r, selected.g, selected.b);
          
          if (distSq < selected.toleranceSquared) {
            if (useAdvancedEdge && alphaMask) {
              // Store distance-based alpha for advanced processing
              const dist = Math.sqrt(distSq);
              const ratio = dist / selected.tolerance;
              alphaMask[i] = Math.round(ratio * 255);
            } else if (edgeMode === 'hard') {
              data[pixelIndex + 3] = 0;
            } else {
              // Feathered mode
              const dist = Math.sqrt(distSq);
              data[pixelIndex + 3] = gaussianFalloff(dist, selected.tolerance * 0.7, featherRadius);
            }
            break; // Found a match, no need to check other colors
          }
        }
      } else {
        // Auto or manual mode - compare against dominant color
        const distSq = colorDistanceSquared(r, g, b, dominantColor.r, dominantColor.g, dominantColor.b);

        if (distSq < thresholdSquared) {
          if (useAdvancedEdge && alphaMask) {
            // Store distance-based alpha for advanced processing
            const dist = Math.sqrt(distSq);
            const ratio = dist / effectiveThreshold;
            alphaMask[i] = Math.round(ratio * 255);
          } else if (edgeMode === 'hard') {
            data[pixelIndex + 3] = 0;
          } else {
            // Feathered mode
            const dist = Math.sqrt(distSq);
            data[pixelIndex + 3] = gaussianFalloff(dist, effectiveThreshold * 0.7, featherRadius);
          }
        }
      }
    }

    processedPixels = chunkEnd;
    const progress = useAdvancedEdge 
      ? Math.round((processedPixels / totalPixels) * 50) // 50% for alpha mask generation
      : Math.round((processedPixels / totalPixels) * 100);

    // Send progress updates less frequently to reduce overhead
    if (progress >= lastProgressUpdate + PROGRESS_UPDATE_INTERVAL) {
      lastProgressUpdate = progress;
      self.postMessage({ type: 'progress', progress } as ProgressResponse);
    }

    // Yield to allow cancel checks (but only between chunks)
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Phase 2: Apply advanced edge processing if needed
  if (useAdvancedEdge && alphaMask) {
    if (isCancelled) {
      self.postMessage({ type: 'cancelled' } as CancelledResponse);
      return;
    }

    self.postMessage({ type: 'progress', progress: 60 } as ProgressResponse);

    let processedMask = alphaMask;

    switch (edgeMode) {
      case 'smooth':
        // Apply anti-aliasing to edges
        processedMask = smoothEdges(alphaMask, width, height, featherRadius);
        break;

      case 'refine':
        // Apply morphological edge refinement
        processedMask = refineEdges(alphaMask, width, height, featherRadius);
        break;

      case 'decontaminate':
        // First apply mild smoothing, then decontaminate colors
        processedMask = smoothEdges(alphaMask, width, height, Math.max(1, Math.floor(featherRadius / 2)));
        break;
    }

    if (isCancelled) {
      self.postMessage({ type: 'cancelled' } as CancelledResponse);
      return;
    }

    self.postMessage({ type: 'progress', progress: 80 } as ProgressResponse);

    // Apply processed alpha mask to image
    for (let i = 0; i < totalPixels; i++) {
      const pixelIndex = i << 2;
      data[pixelIndex + 3] = processedMask[i];
    }

    // For decontaminate mode, also remove color spill from edges
    if (edgeMode === 'decontaminate') {
      const bgColor = mode === 'colorPicker' && colorPickerData.length > 0
        ? { r: colorPickerData[0].r, g: colorPickerData[0].g, b: colorPickerData[0].b }
        : dominantColor;
      
      decontaminateEdges(data, processedMask, width, height, bgColor, featherRadius);
    }

    self.postMessage({ type: 'progress', progress: 95 } as ProgressResponse);
  }

  // Apply magic selection regions efficiently
  const { magicSelection } = settings;
  if (magicSelection && magicSelection.appliedRegions.length > 0) {
    for (const region of magicSelection.appliedRegions) {
      const { bounds, maskRLE, mode: regionMode } = region;
      const maskWidth = bounds.width;
      const maskHeight = bounds.height;
      const isKeep = regionMode === 'keep';
      const alphaValue = isKeep ? 255 : 0;
      
      // Decode RLE mask for this region
      const mask = decodeMaskFromRLE(maskRLE, maskWidth * maskHeight);
      
      for (let localY = 0; localY < maskHeight; localY++) {
        const globalY = bounds.y + localY;
        const rowOffset = globalY * width;
        const maskRowOffset = localY * maskWidth;
        
        for (let localX = 0; localX < maskWidth; localX++) {
          if (mask[maskRowOffset + localX]) {
            const pixelIndex = ((rowOffset + bounds.x + localX) << 2) + 3;
            data[pixelIndex] = alphaValue;
          }
        }
      }
    }
  }

  // Transfer the buffer back for performance
  self.postMessage(
    { type: 'complete', imageData } as CompleteResponse,
    { transfer: [imageData.data.buffer] }
  );
}

/**
 * Detect dominant background color using corner sampling and frequency analysis
 */
function detectDominantColor(imageData: ImageData): { r: number; g: number; b: number } {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Sample corners (more likely to be background)
  const cornerSamples: Array<{ r: number; g: number; b: number }> = [];
  const sampleSize = Math.min(20, Math.floor(Math.min(width, height) / 10));

  // Top-left corner
  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const idx = (y * width + x) * 4;
      cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Top-right corner
  for (let y = 0; y < sampleSize; y++) {
    for (let x = width - sampleSize; x < width; x++) {
      const idx = (y * width + x) * 4;
      cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Bottom-left corner
  for (let y = height - sampleSize; y < height; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const idx = (y * width + x) * 4;
      cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Bottom-right corner
  for (let y = height - sampleSize; y < height; y++) {
    for (let x = width - sampleSize; x < width; x++) {
      const idx = (y * width + x) * 4;
      cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // Find most frequent color cluster in corners
  // Use color quantization (reduce to 32 levels per channel)
  const colorMap = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (const sample of cornerSamples) {
    // Quantize to reduce unique colors
    const qr = Math.floor(sample.r / 8) * 8;
    const qg = Math.floor(sample.g / 8) * 8;
    const qb = Math.floor(sample.b / 8) * 8;
    const key = `${qr},${qg},${qb}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
      existing.r += sample.r;
      existing.g += sample.g;
      existing.b += sample.b;
    } else {
      colorMap.set(key, { count: 1, r: sample.r, g: sample.g, b: sample.b });
    }
  }

  // Find the most common color cluster
  let maxCount = 0;
  let dominantColor = { r: 255, g: 255, b: 255 };

  for (const entry of colorMap.values()) {
    if (entry.count > maxCount) {
      maxCount = entry.count;
      // Average the colors in this cluster
      dominantColor = {
        r: Math.round(entry.r / entry.count),
        g: Math.round(entry.g / entry.count),
        b: Math.round(entry.b / entry.count),
      };
    }
  }

  return dominantColor;
}

/**
 * Calculate optimal threshold using Otsu's method
 */
function calculateAutoThreshold(imageData: ImageData): { threshold: number; dominantColor: { r: number; g: number; b: number } } {
  const data = imageData.data;
  const totalPixels = data.length / 4;

  // Detect dominant background color
  const dominantColor = detectDominantColor(imageData);

  // Build histogram of color distances (sample every 4th pixel for speed)
  const maxDistance = 442; // Max possible distance with weighted formula sqrt(2*255² + 4*255² + 3*255²)
  const histogramBins = 256;
  const histogram = new Uint32Array(histogramBins);
  let sampledPixels = 0;

  for (let i = 0; i < totalPixels; i += 4) {
    const pixelIndex = i * 4;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];

    const dist = colorDistance(r, g, b, dominantColor.r, dominantColor.g, dominantColor.b);
    const binIndex = Math.min(Math.floor((dist / maxDistance) * (histogramBins - 1)), histogramBins - 1);
    histogram[binIndex]++;
    sampledPixels++;
  }

  // Otsu's method to find optimal threshold
  let sumTotal = 0;
  for (let i = 0; i < histogramBins; i++) {
    sumTotal += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let optimalBin = 0;

  for (let t = 0; t < histogramBins; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;

    const weightForeground = sampledPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    // Between-class variance
    const variance = weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      optimalBin = t;
    }
  }

  // Convert bin back to actual threshold value
  const threshold = (optimalBin / (histogramBins - 1)) * maxDistance;

  // Apply some reasonable bounds (not too low, not too high)
  const clampedThreshold = Math.max(20, Math.min(threshold, 150));

  return { threshold: clampedThreshold, dominantColor };
}

/**
 * Magic select - Optimized flood fill algorithm using scanline approach
 * Much faster than pixel-by-pixel BFS for large connected regions
 */
function magicSelect(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number
): MagicRegion {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const selected = new Uint8Array(totalPixels);
  
  // Get the seed pixel color
  const seedIdx = (startY * width + startX) << 2;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];

  // Track bounds and stats
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;
  let totalR = 0, totalG = 0, totalB = 0;
  let pixelCount = 0;

  // Tolerance threshold squared for faster comparison
  const toleranceThreshold = tolerance * 4.42;
  const toleranceThresholdSq = toleranceThreshold * toleranceThreshold;

  // Optimized: Use array-based stack instead of queue (faster for flood fill)
  const stack: number[] = [startX, startY];
  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const idx = (y * width + x) << 2;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Check color similarity to seed using squared distance
    const distSq = colorDistanceSquared(r, g, b, seedR, seedG, seedB);
    
    if (distSq <= toleranceThresholdSq) {
      // Mark as selected
      const pixelIdx = y * width + x;
      selected[pixelIdx] = 1;
      pixelCount++;

      // Update bounds
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      // Accumulate color
      totalR += r;
      totalG += g;
      totalB += b;

      // Add neighbors using scanline-like optimization
      // Check left
      if (x > 0) {
        const nIdx = pixelIdx - 1;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          stack.push(x - 1, y);
        }
      }
      // Check right
      if (x < width - 1) {
        const nIdx = pixelIdx + 1;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          stack.push(x + 1, y);
        }
      }
      // Check up
      if (y > 0) {
        const nIdx = pixelIdx - width;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          stack.push(x, y - 1);
        }
      }
      // Check down
      if (y < height - 1) {
        const nIdx = pixelIdx + width;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          stack.push(x, y + 1);
        }
      }
    }
  }

  // Calculate bounds dimensions
  const boundsWidth = maxX - minX + 1;
  const boundsHeight = maxY - minY + 1;

  // Create mask relative to bounds
  const mask = new Uint8Array(boundsWidth * boundsHeight);
  for (let y = minY; y <= maxY; y++) {
    const srcRowOffset = y * width;
    const dstRowOffset = (y - minY) * boundsWidth - minX;
    for (let x = minX; x <= maxX; x++) {
      if (selected[srcRowOffset + x]) {
        mask[dstRowOffset + x] = 1;
      }
    }
  }

  // Encode mask to RLE for memory efficiency
  const maskRLE = encodeMaskToRLE(mask);

  // Calculate average color
  const avgR = pixelCount > 0 ? Math.round(totalR / pixelCount) : seedR;
  const avgG = pixelCount > 0 ? Math.round(totalG / pixelCount) : seedG;
  const avgB = pixelCount > 0 ? Math.round(totalB / pixelCount) : seedB;

  return {
    id: crypto.randomUUID(),
    maskRLE,
    bounds: { x: minX, y: minY, width: boundsWidth, height: boundsHeight },
    pixelCount,
    averageColor: { r: avgR, g: avgG, b: avgB },
    mode: 'remove',
  };
}

/**
 * Handle incoming messages
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'process':
        isCancelled = false;
        await processImage(message.imageData, message.settings);
        break;

      case 'calculateAutoThreshold':
        const result = calculateAutoThreshold(message.imageData);
        self.postMessage({
          type: 'autoThreshold',
          threshold: result.threshold,
          dominantColor: result.dominantColor,
        } as AutoThresholdResponse);
        break;

      case 'magicSelect':
        const { x, y, tolerance } = message.magicSelectParams;
        const magicRegion = magicSelect(message.imageData, x, y, tolerance);
        self.postMessage({
          type: 'magicSelectResult',
          magicRegion,
        } as MagicSelectResponse);
        break;

      case 'cancel':
        isCancelled = true;
        // The processing loop will detect this and send cancelled response
        break;

      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${(message as { type: string }).type}`,
        } as ErrorResponse);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    self.postMessage({ type: 'error', error: errorMessage } as ErrorResponse);
  }
};

// Export empty object for ES module compatibility with Vite
export {};
