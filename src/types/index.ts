// Processing modes
export type ProcessingMode = 'auto' | 'manual' | 'colorPicker';

// Edge quality modes
// - hard: Binary mask with no transparency at edges
// - feathered: Gaussian falloff for soft edges
// - decontaminate: Removes background color spill from edge pixels
// - smooth: Anti-aliased edges using subpixel blending
// - refine: Morphological edge refinement (erode then dilate)
export type EdgeMode = 'hard' | 'feathered' | 'decontaminate' | 'smooth' | 'refine';

// Selected color for removal
export interface SelectedColor {
  id: string;
  r: number;
  g: number;
  b: number;
  tolerance: number; // 0-100
}

// Magic selection region
export interface MagicRegion {
  id: string;
  maskRLE: Uint32Array; // RLE-encoded binary mask (pairs of [start, length])
  bounds: { x: number; y: number; width: number; height: number };
  pixelCount: number;
  averageColor: { r: number; g: number; b: number };
  mode: 'keep' | 'remove'; // Keep: exclude from bg removal (preserve), Remove: force transparent
}

// Magic selection state
export interface MagicSelectionState {
  isActive: boolean;
  tolerance: number; // 0-100 for flood fill tolerance
  previewRegion: MagicRegion | null; // Currently previewing before apply
  appliedRegions: MagicRegion[];
  lastClickCoords: { x: number; y: number } | null; // Store coords to re-select on tolerance change
}

// Image state
export interface ImageState {
  originalFile: File | null;
  originalImageData: ImageData | null;
  processedImageData: ImageData | null;
  width: number;
  height: number;
  fileName: string;
}

// Processing settings
export interface ProcessingSettings {
  mode: ProcessingMode;
  threshold: number; // 0-255 for auto/manual
  autoThreshold: number | null; // Calculated optimal threshold
  selectedColors: SelectedColor[];
  edgeMode: EdgeMode;
  featherRadius: number; // 1-10
  isProcessing: boolean;
  progress: number; // 0-100
  magicSelection: MagicSelectionState;
}

// History state for undo/redo
export interface HistoryEntry {
  settings: ProcessingSettings;
  timestamp: number;
}

// Worker message types
export interface WorkerMessage {
  type: 'process' | 'cancel' | 'calculateAutoThreshold' | 'magicSelect';
  imageData?: ImageData;
  settings?: ProcessingSettings;
  magicSelectParams?: {
    x: number;
    y: number;
    tolerance: number;
    width: number;
    height: number;
  };
}

export interface WorkerResponse {
  type: 'progress' | 'complete' | 'autoThreshold' | 'error' | 'cancelled' | 'magicSelectResult';
  progress?: number;
  imageData?: ImageData;
  autoThreshold?: number;
  error?: string;
  magicRegion?: MagicRegion;
}
