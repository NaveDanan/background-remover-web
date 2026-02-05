import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Layout } from '@/components/layout';
import { ExportDialog } from '@/components/ExportDialog';
import PreviewCanvas from '@/components/PreviewCanvas';
import type { PreviewCanvasRef, ZoomLevel } from '@/components/PreviewCanvas';
import { ZOOM_LEVELS } from '@/components/PreviewCanvas';
import { useApp } from '@/contexts/AppContext';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import type { SelectedColor, ProcessingMode, EdgeMode, MagicRegion } from '@/types';
import type { SidebarSettings, ColorSwatch } from '@/components/layout/Sidebar';

// Optimized image caching system
const imageUrlCache = new WeakMap<ImageData, string>();

// Memoized helper to convert ImageData to data URL with caching
function getCachedImageUrl(imageData: ImageData | null): string | null {
  if (!imageData) return null;
  
  let url = imageUrlCache.get(imageData);
  if (url) return url;
  
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  url = canvas.toDataURL('image/png');
  imageUrlCache.set(imageData, url);
  return url;
}

function App() {
  // App state from context
  const {
    state,
    setImage,
    setProcessedImage,
    setMode,
    setThreshold,
    setEdgeMode,
    setFeatherRadius,
    setAutoThreshold,
    setProcessingState,
    addColor,
    removeColor,
    saveToHistory,
    setMagicActive,
    setMagicTolerance,
    setMagicPreview,
    setMagicClickCoords,
    applyMagicRegion,
    removeMagicRegion,
    clearMagicRegions,
  } = useApp();

  const { image, settings } = state;
  
  // Local UI state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('fit');
  const [showOriginal] = useState(false);
  const [committedMagicRegions, setCommittedMagicRegions] = useState<MagicRegion[]>([]);
  // Track the tolerance value used for the last magic selection to avoid re-running on initial click
  const lastMagicToleranceRef = useRef<number | null>(null);
  // Note: showOriginal is available for future before/after toggle feature
  
  // Canvas ref for color picking and export
  const previewCanvasRef = useRef<PreviewCanvasRef>(null);
  
  // Image processor hook with callbacks
  const {
    processImage,
    calculateAutoThreshold,
    performMagicSelect,
    progress,
    isProcessing,
  } = useImageProcessor({
    onComplete: (result) => {
      setProcessedImage(result);
      saveToHistory();
    },
    onAutoThreshold: (threshold) => {
      setAutoThreshold(threshold);
    },
    onMagicSelectResult: (region) => {
      setMagicPreview(region);
    },
    onProgress: (p) => {
      setProcessingState(true, p);
    },
  });

  // Sync processing state
  useEffect(() => {
    setProcessingState(isProcessing, progress);
  }, [isProcessing, progress, setProcessingState]);

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    // Create image element to load file
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Create canvas to get ImageData
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      
      // Update app state
      setImage({
        originalFile: file,
        originalImageData: imageData,
        processedImageData: null,
        width: img.width,
        height: img.height,
        fileName: file.name,
      });
      
      // Calculate auto threshold
      calculateAutoThreshold(imageData);
      
      // Clean up
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }, [setImage, calculateAutoThreshold]);

  // Process image when settings are committed
  useEffect(() => {
    if (!image.originalImageData) return;
    
    // For color picker mode, need at least one color
    if (settings.mode === 'colorPicker' && settings.selectedColors.length === 0) {
      setProcessedImage(null);
      return;
    }
    
    // Determine threshold based on mode
    let effectiveThreshold = settings.threshold;
    if (settings.mode === 'auto' && settings.autoThreshold !== null) {
      effectiveThreshold = settings.autoThreshold;
    }
    
    // Process the image (result handled by onComplete callback)
    processImage(image.originalImageData, {
      mode: settings.mode,
      threshold: effectiveThreshold,
      autoThreshold: settings.autoThreshold ?? 0,
      selectedColors: settings.selectedColors,
      edgeMode: settings.edgeMode,
      featherRadius: settings.featherRadius,
      isProcessing: false,
      progress: 0,
      magicSelection: {
        ...settings.magicSelection,
        // Use committed regions for actual processing, not the pending ones
        appliedRegions: committedMagicRegions,
      },
    });
  }, [
    image.originalImageData,
    settings.mode,
    settings.threshold,
    settings.autoThreshold,
    settings.selectedColors,
    settings.edgeMode,
    settings.featherRadius,
    // Only process magic regions when committedMagicRegions changes (via Apply button)
    committedMagicRegions,
    processImage,
    setProcessedImage,
  ]);

  // Handle color pick from canvas
  const handleColorPick = useCallback((color: { r: number; g: number; b: number; hex: string }) => {
    if (settings.mode !== 'colorPicker') return;
    
    const newColor: SelectedColor = {
      id: crypto.randomUUID(),
      r: color.r,
      g: color.g,
      b: color.b,
      tolerance: 30, // Default tolerance
    };
    
    addColor(newColor);
  }, [settings.mode, addColor]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      if (prev === 'fit') return 100;
      const currentIndex = ZOOM_LEVELS.indexOf(prev as typeof ZOOM_LEVELS[number]);
      if (currentIndex === -1 || currentIndex >= ZOOM_LEVELS.length - 1) return prev;
      return ZOOM_LEVELS[currentIndex + 1];
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      if (prev === 'fit') return 75;
      const currentIndex = ZOOM_LEVELS.indexOf(prev as typeof ZOOM_LEVELS[number]);
      if (currentIndex <= 0) return prev;
      return ZOOM_LEVELS[currentIndex - 1];
    });
  }, []);

  const handleFitToScreen = useCallback(() => {
    setZoom('fit');
  }, []);

  // Direct zoom change handler (for Ctrl+Wheel)
  const handleZoomChange = useCallback((newZoom: ZoomLevel) => {
    setZoom(newZoom);
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    setIsExportDialogOpen(true);
  }, []);

  // Convert app colors to sidebar format
  const sidebarColors: ColorSwatch[] = settings.selectedColors.map((c) => ({
    id: c.id,
    color: `rgb(${c.r}, ${c.g}, ${c.b})`,
  }));

  // Convert sidebar settings to expected format
  const sidebarSettings: SidebarSettings = {
    mode: settings.mode as SidebarSettings['mode'],
    threshold: settings.mode === 'auto' && settings.autoThreshold !== null 
      ? settings.autoThreshold 
      : settings.threshold,
    edgeQuality: settings.edgeMode,
    featherRadius: settings.featherRadius,
    selectedColors: sidebarColors,
    magicTolerance: settings.magicSelection.tolerance,
    magicPreviewRegion: settings.magicSelection.previewRegion,
    magicAppliedRegions: settings.magicSelection.appliedRegions,
  };

  const handleSettingsChange = useCallback((newSettings: Partial<SidebarSettings>) => {
    if (newSettings.mode !== undefined) setMode(newSettings.mode as ProcessingMode);
    if (newSettings.threshold !== undefined) setThreshold(newSettings.threshold);
    if (newSettings.edgeQuality !== undefined) setEdgeMode(newSettings.edgeQuality as EdgeMode);
    if (newSettings.featherRadius !== undefined) setFeatherRadius(newSettings.featherRadius);
    if (newSettings.magicTolerance !== undefined) setMagicTolerance(newSettings.magicTolerance);
    if (newSettings.selectedColors !== undefined) {
      // Handle color tolerance updates - but sidebar doesn't have tolerance
      // So we just accept the colors as they are
    }
  }, [setMode, setThreshold, setEdgeMode, setFeatherRadius, setMagicTolerance]);

  // Handle color removal from sidebar
  const handleRemoveColor = useCallback((id: string) => {
    removeColor(id);
  }, [removeColor]);

  // Handle add color button - switch to color picker mode
  const handleAddColor = useCallback(() => {
    if (settings.mode !== 'colorPicker') {
      setMode('colorPicker');
    }
  }, [settings.mode, setMode]);

  // Magic selection handlers
  const handleMagicSelect = useCallback((x: number, y: number) => {
    if (!image.originalImageData) return;
    // Store click coordinates for re-selection when tolerance changes
    setMagicClickCoords({ x, y });
    // Track the tolerance used for this selection
    lastMagicToleranceRef.current = settings.magicSelection.tolerance;
    performMagicSelect(
      image.originalImageData,
      x,
      y,
      settings.magicSelection.tolerance
    );
  }, [image.originalImageData, settings.magicSelection.tolerance, performMagicSelect, setMagicClickCoords]);

  const handleMagicApply = useCallback((mode: 'keep' | 'remove') => {
    if (settings.magicSelection.previewRegion) {
      const regionWithMode: MagicRegion = {
        ...settings.magicSelection.previewRegion,
        mode,
      };
      applyMagicRegion(regionWithMode);
      // Reset tolerance tracking after applying
      lastMagicToleranceRef.current = null;
    }
  }, [settings.magicSelection.previewRegion, applyMagicRegion]);

  const handleMagicCancel = useCallback(() => {
    setMagicPreview(null);
    // Reset tolerance tracking when cancelling
    lastMagicToleranceRef.current = null;
  }, [setMagicPreview]);

  // Handle applying all magic regions to the image
  const handleMagicApplyAll = useCallback(() => {
    // Only commit if there are regions to apply
    if (settings.magicSelection.appliedRegions.length > 0) {
      // Commit the current regions for processing
      setCommittedMagicRegions([...settings.magicSelection.appliedRegions]);
    }
  }, [settings.magicSelection.appliedRegions]);

  // Re-run magic selection when tolerance changes and there's an active preview
  // Only triggers when tolerance differs from the last used value (avoids double-run on initial click)
  useEffect(() => {
    const { lastClickCoords, previewRegion, tolerance } = settings.magicSelection;
    if (!image.originalImageData || !lastClickCoords || !previewRegion) return;
    
    // Only re-run if tolerance actually changed from last selection
    if (lastMagicToleranceRef.current === tolerance) return;
    
    // Update the tracked tolerance
    lastMagicToleranceRef.current = tolerance;
    
    performMagicSelect(
      image.originalImageData,
      lastClickCoords.x,
      lastClickCoords.y,
      tolerance
    );
  }, [settings.magicSelection.tolerance, image.originalImageData, performMagicSelect, settings.magicSelection.lastClickCoords, settings.magicSelection.previewRegion]);

  // Create image URLs for canvas area preview (memoized for performance)
  const imageUrl = useMemo(
    () => getCachedImageUrl(image.originalImageData),
    [image.originalImageData]
  );
  const processedImageUrl = useMemo(
    () => getCachedImageUrl(image.processedImageData),
    [image.processedImageData]
  );

  return (
    <>
      <Layout
        settings={sidebarSettings}
        onSettingsChange={handleSettingsChange}
        onSettingsCommit={handleSettingsChange}
        onAddColor={handleAddColor}
        onRemoveColor={handleRemoveColor}
        onMagicApply={handleMagicApply}
        onMagicCancel={handleMagicCancel}
        onMagicRegionRemove={removeMagicRegion}
        onMagicClearAll={clearMagicRegions}
        onMagicApplyAll={handleMagicApplyAll}
        onMagicActiveChange={setMagicActive}
        image={imageUrl}
        processedImage={showOriginal ? null : processedImageUrl}
        isProcessing={settings.isProcessing}
        processingProgress={settings.progress}
        onImageUpload={handleImageUpload}
        zoom={typeof zoom === 'number' ? zoom : 100}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        onExport={handleExport}
        isExportDisabled={!image.processedImageData}
        statusText={settings.isProcessing ? `Processing... ${Math.round(settings.progress)}%` : undefined}
        canvasChildren={
          image.originalImageData && (
            <PreviewCanvas
              ref={previewCanvasRef}
              originalImageData={image.originalImageData}
              processedImageData={image.processedImageData}
              zoom={zoom}
              showOriginal={showOriginal}
              isColorPickerMode={settings.mode === 'colorPicker'}
              isMagicSelectionMode={settings.magicSelection.isActive}
              onColorPick={handleColorPick}
              onMagicSelect={handleMagicSelect}
              magicPreviewRegion={settings.magicSelection.previewRegion}
              magicAppliedRegions={settings.magicSelection.appliedRegions}
              onMagicApply={handleMagicApply}
              onMagicCancel={handleMagicCancel}
              onZoomChange={handleZoomChange}
              className="w-full h-full"
            />
          )
        }
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        imageData={image.processedImageData}
        originalFileName={image.fileName}
      />
    </>
  );
}

export default App;
