import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  ImageState,
  ProcessingSettings,
  HistoryEntry,
  ProcessingMode,
  EdgeMode,
  SelectedColor,
  MagicRegion,
  MagicSelectionState,
} from '../types';
import { mergeRLEMasks, countPixelsInRLE } from '../lib/maskUtils';

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_ENTRIES = 10;
const MAX_MAGIC_REGIONS = 50; // Limit regions to prevent memory bloat

const DEFAULT_MAGIC_SELECTION_STATE: MagicSelectionState = {
  isActive: false,
  tolerance: 32,
  previewRegion: null,
  appliedRegions: [],
  lastClickCoords: null,
};

const DEFAULT_PROCESSING_SETTINGS: ProcessingSettings = {
  mode: 'auto',
  threshold: 128,
  autoThreshold: null,
  selectedColors: [],
  edgeMode: 'hard',
  featherRadius: 2,
  isProcessing: false,
  progress: 0,
  magicSelection: DEFAULT_MAGIC_SELECTION_STATE,
};

const DEFAULT_IMAGE_STATE: ImageState = {
  originalFile: null,
  originalImageData: null,
  processedImageData: null,
  width: 0,
  height: 0,
  fileName: '',
};

// ============================================================================
// Types
// ============================================================================

interface AppState {
  image: ImageState;
  settings: ProcessingSettings;
  history: HistoryEntry[];
  historyIndex: number;
}

type AppAction =
  | { type: 'SET_IMAGE'; payload: Partial<ImageState> }
  | { type: 'CLEAR_IMAGE' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<ProcessingSettings> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'SET_PROCESSING_STATE'; payload: { isProcessing: boolean; progress?: number } }
  | { type: 'SET_PROCESSED_IMAGE'; payload: ImageData | null }
  | { type: 'SET_AUTO_THRESHOLD'; payload: number }
  | { type: 'ADD_COLOR'; payload: SelectedColor }
  | { type: 'REMOVE_COLOR'; payload: string }
  | { type: 'UPDATE_COLOR'; payload: { id: string; updates: Partial<SelectedColor> } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_TO_HISTORY' }
  | { type: 'SET_MAGIC_ACTIVE'; payload: boolean }
  | { type: 'SET_MAGIC_TOLERANCE'; payload: number }
  | { type: 'SET_MAGIC_PREVIEW'; payload: MagicRegion | null }
  | { type: 'SET_MAGIC_CLICK_COORDS'; payload: { x: number; y: number } | null }
  | { type: 'APPLY_MAGIC_REGION'; payload: MagicRegion }
  | { type: 'REMOVE_MAGIC_REGION'; payload: string }
  | { type: 'CLEAR_MAGIC_REGIONS' };

interface AppContextValue {
  state: AppState;
  // Image actions
  setImage: (image: Partial<ImageState>) => void;
  clearImage: () => void;
  setProcessedImage: (imageData: ImageData | null) => void;
  // Settings actions
  updateSettings: (settings: Partial<ProcessingSettings>) => void;
  resetSettings: () => void;
  setMode: (mode: ProcessingMode) => void;
  setThreshold: (threshold: number) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setFeatherRadius: (radius: number) => void;
  setAutoThreshold: (threshold: number) => void;
  // Processing state actions
  setProcessingState: (isProcessing: boolean, progress?: number) => void;
  // Color actions
  addColor: (color: SelectedColor) => void;
  removeColor: (id: string) => void;
  updateColor: (id: string, updates: Partial<SelectedColor>) => void;
  // History actions
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Magic selection actions
  setMagicActive: (active: boolean) => void;
  setMagicTolerance: (tolerance: number) => void;
  setMagicPreview: (region: MagicRegion | null) => void;
  setMagicClickCoords: (coords: { x: number; y: number } | null) => void;
  applyMagicRegion: (region: MagicRegion) => void;
  removeMagicRegion: (id: string) => void;
  clearMagicRegions: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AppState = {
  image: DEFAULT_IMAGE_STATE,
  settings: DEFAULT_PROCESSING_SETTINGS,
  history: [],
  historyIndex: -1,
};

// ============================================================================
// Reducer
// ============================================================================

/**
 * Merge multiple magic regions of the same mode into one
 * This helps manage memory when there are many regions
 */
function mergeRegionsOfSameMode(regions: MagicRegion[], mode: 'keep' | 'remove'): MagicRegion | null {
  const regionsToMerge = regions.filter(r => r.mode === mode);
  if (regionsToMerge.length === 0) return null;
  if (regionsToMerge.length === 1) return regionsToMerge[0];

  // Calculate combined bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const region of regionsToMerge) {
    minX = Math.min(minX, region.bounds.x);
    minY = Math.min(minY, region.bounds.y);
    maxX = Math.max(maxX, region.bounds.x + region.bounds.width);
    maxY = Math.max(maxY, region.bounds.y + region.bounds.height);
  }

  const mergedWidth = maxX - minX;
  const mergedHeight = maxY - minY;
  const mergedSize = mergedWidth * mergedHeight;

  // Create merged mask by combining all regions
  // First, create an empty RLE for initialization  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mergedRLE: Uint32Array = new Uint32Array(0) as any;
  let totalR = 0, totalG = 0, totalB = 0, totalPixels = 0;

  for (const region of regionsToMerge) {
    // Remap region's mask coordinates to the merged bounds
    const offsetX = region.bounds.x - minX;
    const offsetY = region.bounds.y - minY;
    
    // Create offset mask in merged coordinate system
    const offsetRuns: number[] = [];
    for (let i = 0; i < region.maskRLE.length; i += 2) {
      const start = region.maskRLE[i];
      const length = region.maskRLE[i + 1];
      
      // Convert local coordinates to merged coordinates
      const localY = Math.floor(start / region.bounds.width);
      const localX = start % region.bounds.width;
      const mergedStart = (localY + offsetY) * mergedWidth + (localX + offsetX);
      
      // Handle run that may wrap to next line
      let remaining = length;
      let currentStart = mergedStart;
      let currentLocalX = localX;
      
      while (remaining > 0) {
        const spaceInRow = region.bounds.width - currentLocalX;
        const runLength = Math.min(remaining, spaceInRow);
        offsetRuns.push(currentStart, runLength);
        remaining -= runLength;
        if (remaining > 0) {
          currentLocalX = 0;
          currentStart = currentStart - currentLocalX + mergedWidth;
        }
      }
    }
    
    const offsetRLE = new Uint32Array(offsetRuns);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mergedRLE = mergeRLEMasks(mergedRLE, offsetRLE, mergedSize) as any;
    
    // Accumulate color info
    totalR += region.averageColor.r * region.pixelCount;
    totalG += region.averageColor.g * region.pixelCount;
    totalB += region.averageColor.b * region.pixelCount;
    totalPixels += region.pixelCount;
  }

  const pixelCount = countPixelsInRLE(mergedRLE);

  return {
    id: crypto.randomUUID(),
    maskRLE: mergedRLE,
    bounds: { x: minX, y: minY, width: mergedWidth, height: mergedHeight },
    pixelCount,
    averageColor: {
      r: totalPixels > 0 ? Math.round(totalR / totalPixels) : 128,
      g: totalPixels > 0 ? Math.round(totalG / totalPixels) : 128,
      b: totalPixels > 0 ? Math.round(totalB / totalPixels) : 128,
    },
    mode,
  };
}

/**
 * Consolidate regions when limit is exceeded
 * Merges all regions of the same mode together
 */
function consolidateRegions(regions: MagicRegion[]): MagicRegion[] {
  const keepRegion = mergeRegionsOfSameMode(regions, 'keep');
  const removeRegion = mergeRegionsOfSameMode(regions, 'remove');
  
  const result: MagicRegion[] = [];
  if (keepRegion) result.push(keepRegion);
  if (removeRegion) result.push(removeRegion);
  
  return result;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_IMAGE':
      return {
        ...state,
        image: {
          ...state.image,
          ...action.payload,
        },
      };

    case 'CLEAR_IMAGE':
      return {
        ...state,
        image: DEFAULT_IMAGE_STATE,
        settings: {
          ...DEFAULT_PROCESSING_SETTINGS,
        },
        history: [],
        historyIndex: -1,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case 'RESET_SETTINGS':
      return {
        ...state,
        settings: {
          ...DEFAULT_PROCESSING_SETTINGS,
          autoThreshold: state.settings.autoThreshold,
        },
      };

    case 'SET_PROCESSING_STATE':
      return {
        ...state,
        settings: {
          ...state.settings,
          isProcessing: action.payload.isProcessing,
          progress: action.payload.progress ?? state.settings.progress,
        },
      };

    case 'SET_PROCESSED_IMAGE':
      return {
        ...state,
        image: {
          ...state.image,
          processedImageData: action.payload,
        },
      };

    case 'SET_AUTO_THRESHOLD':
      return {
        ...state,
        settings: {
          ...state.settings,
          autoThreshold: action.payload,
          threshold: state.settings.mode === 'auto' ? action.payload : state.settings.threshold,
        },
      };

    case 'ADD_COLOR':
      return {
        ...state,
        settings: {
          ...state.settings,
          selectedColors: [...state.settings.selectedColors, action.payload],
        },
      };

    case 'REMOVE_COLOR':
      return {
        ...state,
        settings: {
          ...state.settings,
          selectedColors: state.settings.selectedColors.filter(
            (color) => color.id !== action.payload
          ),
        },
      };

    case 'UPDATE_COLOR':
      return {
        ...state,
        settings: {
          ...state.settings,
          selectedColors: state.settings.selectedColors.map((color) =>
            color.id === action.payload.id
              ? { ...color, ...action.payload.updates }
              : color
          ),
        },
      };

    case 'SAVE_TO_HISTORY': {
      const entry: HistoryEntry = {
        settings: { ...state.settings },
        timestamp: Date.now(),
      };

      // Trim history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);

      // Limit history size
      if (newHistory.length > MAX_HISTORY_ENTRIES) {
        newHistory.shift();
      }

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;

      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];

      return {
        ...state,
        settings: {
          ...entry.settings,
          isProcessing: false,
          progress: 0,
        },
        historyIndex: newIndex,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;

      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];

      return {
        ...state,
        settings: {
          ...entry.settings,
          isProcessing: false,
          progress: 0,
        },
        historyIndex: newIndex,
      };
    }

    case 'SET_MAGIC_ACTIVE':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            isActive: action.payload,
            previewRegion: action.payload ? state.settings.magicSelection.previewRegion : null,
          },
        },
      };

    case 'SET_MAGIC_TOLERANCE':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            tolerance: action.payload,
          },
        },
      };

    case 'SET_MAGIC_PREVIEW':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            previewRegion: action.payload,
            // Clear lastClickCoords when preview is cleared (cancelled)
            lastClickCoords: action.payload === null ? null : state.settings.magicSelection.lastClickCoords,
          },
        },
      };

    case 'SET_MAGIC_CLICK_COORDS':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            lastClickCoords: action.payload,
          },
        },
      };

    case 'APPLY_MAGIC_REGION': {
      let newRegions = [...state.settings.magicSelection.appliedRegions, action.payload];
      
      // If exceeding limit, consolidate regions by merging same-mode regions
      if (newRegions.length > MAX_MAGIC_REGIONS) {
        newRegions = consolidateRegions(newRegions);
      }
      
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            appliedRegions: newRegions,
            previewRegion: null,
            lastClickCoords: null, // Clear coords after applying
          },
        },
      };
    }

    case 'REMOVE_MAGIC_REGION':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            appliedRegions: state.settings.magicSelection.appliedRegions.filter(
              (r) => r.id !== action.payload
            ),
          },
        },
      };

    case 'CLEAR_MAGIC_REGIONS':
      return {
        ...state,
        settings: {
          ...state.settings,
          magicSelection: {
            ...state.settings.magicSelection,
            appliedRegions: [],
            previewRegion: null,
            lastClickCoords: null,
          },
        },
      };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Image actions
  const setImage = useCallback((image: Partial<ImageState>) => {
    dispatch({ type: 'SET_IMAGE', payload: image });
  }, []);

  const clearImage = useCallback(() => {
    dispatch({ type: 'CLEAR_IMAGE' });
  }, []);

  const setProcessedImage = useCallback((imageData: ImageData | null) => {
    dispatch({ type: 'SET_PROCESSED_IMAGE', payload: imageData });
  }, []);

  // Settings actions
  const updateSettings = useCallback((settings: Partial<ProcessingSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  const resetSettings = useCallback(() => {
    dispatch({ type: 'RESET_SETTINGS' });
  }, []);

  const setMode = useCallback((mode: ProcessingMode) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { mode } });
  }, []);

  const setThreshold = useCallback((threshold: number) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { threshold } });
  }, []);

  const setEdgeMode = useCallback((edgeMode: EdgeMode) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { edgeMode } });
  }, []);

  const setFeatherRadius = useCallback((featherRadius: number) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { featherRadius } });
  }, []);

  const setAutoThreshold = useCallback((threshold: number) => {
    dispatch({ type: 'SET_AUTO_THRESHOLD', payload: threshold });
  }, []);

  // Processing state actions
  const setProcessingState = useCallback((isProcessing: boolean, progress?: number) => {
    dispatch({ type: 'SET_PROCESSING_STATE', payload: { isProcessing, progress } });
  }, []);

  // Color actions
  const addColor = useCallback((color: SelectedColor) => {
    dispatch({ type: 'ADD_COLOR', payload: color });
  }, []);

  const removeColor = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_COLOR', payload: id });
  }, []);

  const updateColor = useCallback((id: string, updates: Partial<SelectedColor>) => {
    dispatch({ type: 'UPDATE_COLOR', payload: { id, updates } });
  }, []);

  // History actions
  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const saveToHistory = useCallback(() => {
    dispatch({ type: 'SAVE_TO_HISTORY' });
  }, []);

  // Magic selection actions
  const setMagicActive = useCallback((active: boolean) => {
    dispatch({ type: 'SET_MAGIC_ACTIVE', payload: active });
  }, []);

  const setMagicTolerance = useCallback((tolerance: number) => {
    dispatch({ type: 'SET_MAGIC_TOLERANCE', payload: tolerance });
  }, []);

  const setMagicPreview = useCallback((region: MagicRegion | null) => {
    dispatch({ type: 'SET_MAGIC_PREVIEW', payload: region });
  }, []);

  const setMagicClickCoords = useCallback((coords: { x: number; y: number } | null) => {
    dispatch({ type: 'SET_MAGIC_CLICK_COORDS', payload: coords });
  }, []);

  const applyMagicRegion = useCallback((region: MagicRegion) => {
    dispatch({ type: 'APPLY_MAGIC_REGION', payload: region });
  }, []);

  const removeMagicRegion = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MAGIC_REGION', payload: id });
  }, []);

  const clearMagicRegions = useCallback(() => {
    dispatch({ type: 'CLEAR_MAGIC_REGIONS' });
  }, []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const value: AppContextValue = {
    state,
    setImage,
    clearImage,
    setProcessedImage,
    updateSettings,
    resetSettings,
    setMode,
    setThreshold,
    setEdgeMode,
    setFeatherRadius,
    setAutoThreshold,
    setProcessingState,
    addColor,
    removeColor,
    updateColor,
    undo,
    redo,
    saveToHistory,
    canUndo,
    canRedo,
    setMagicActive,
    setMagicTolerance,
    setMagicPreview,
    setMagicClickCoords,
    applyMagicRegion,
    removeMagicRegion,
    clearMagicRegions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useApp(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
}

export { DEFAULT_PROCESSING_SETTINGS, DEFAULT_IMAGE_STATE };
