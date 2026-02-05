import { useEffect, useRef, useState, useCallback } from 'react';
import type { ProcessingSettings, WorkerMessage, WorkerResponse, MagicRegion } from '../types';

interface UseImageProcessorOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (imageData: ImageData) => void;
  onAutoThreshold?: (threshold: number) => void;
  onMagicSelectResult?: (region: MagicRegion) => void;
  onError?: (error: string) => void;
}

interface UseImageProcessorResult {
  processImage: (imageData: ImageData, settings: ProcessingSettings) => void;
  cancelProcessing: () => void;
  calculateAutoThreshold: (imageData: ImageData) => void;
  performMagicSelect: (imageData: ImageData, x: number, y: number, tolerance: number) => void;
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

export function useImageProcessor(
  options: UseImageProcessorOptions = {}
): UseImageProcessorResult {
  const { onProgress, onComplete, onAutoThreshold, onMagicSelectResult, onError } = options;

  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Store latest callbacks in refs to avoid recreating worker message handler
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onAutoThresholdRef = useRef(onAutoThreshold);
  const onMagicSelectResultRef = useRef(onMagicSelectResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onAutoThresholdRef.current = onAutoThreshold;
    onMagicSelectResultRef.current = onMagicSelectResult;
    onErrorRef.current = onError;
  }, [onProgress, onComplete, onAutoThreshold, onMagicSelectResult, onError]);

  // Initialize Web Worker on mount
  useEffect(() => {
    try {
      // Create worker from the worker file
      workerRef.current = new Worker(
        new URL('../workers/imageProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;

        switch (response.type) {
          case 'progress':
            if (response.progress !== undefined) {
              setProgress(response.progress);
              onProgressRef.current?.(response.progress);
            }
            break;

          case 'complete':
            setIsProcessing(false);
            setProgress(100);
            if (response.imageData) {
              onCompleteRef.current?.(response.imageData);
            }
            break;

          case 'autoThreshold':
            if (response.autoThreshold !== undefined) {
              onAutoThresholdRef.current?.(response.autoThreshold);
            }
            break;

          case 'magicSelectResult':
            if (response.magicRegion) {
              onMagicSelectResultRef.current?.(response.magicRegion);
            }
            break;

          case 'error':
            setIsProcessing(false);
            setProgress(0);
            setError(response.error ?? 'Unknown error occurred');
            onErrorRef.current?.(response.error ?? 'Unknown error occurred');
            break;

          case 'cancelled':
            setIsProcessing(false);
            setProgress(0);
            break;
        }
      };

      // Set up error handler
      workerRef.current.onerror = (event: ErrorEvent) => {
        const errorMessage = event.message || 'Worker error occurred';
        setIsProcessing(false);
        setProgress(0);
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize worker';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
    }

    // Cleanup worker on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Process image with current settings
  const processImage = useCallback(
    (imageData: ImageData, settings: ProcessingSettings) => {
      if (!workerRef.current) {
        const errorMessage = 'Worker not initialized';
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
        return;
      }

      setIsProcessing(true);
      setProgress(0);
      setError(null);

      // Clone the ImageData to avoid detaching the original
      // This allows the UI to keep showing the image while processing
      const clonedData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      const message: WorkerMessage = {
        type: 'process',
        imageData: clonedData,
        settings,
      };

      // Transfer ImageData buffer to worker for better performance
      // This avoids copying the buffer, significantly improving performance for large images
      workerRef.current.postMessage(message, [clonedData.data.buffer]);
    },
    []
  );

  // Cancel ongoing processing
  const cancelProcessing = useCallback(() => {
    if (!workerRef.current) return;

    const message: WorkerMessage = {
      type: 'cancel',
    };

    workerRef.current.postMessage(message);
  }, []);

  // Calculate auto threshold for an image
  const calculateAutoThreshold = useCallback((imageData: ImageData) => {
    if (!workerRef.current) {
      const errorMessage = 'Worker not initialized';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      return;
    }

    setError(null);

    const message: WorkerMessage = {
      type: 'calculateAutoThreshold',
      imageData,
    };

    workerRef.current.postMessage(message);
  }, []);

  // Perform magic selection (flood fill)
  const performMagicSelect = useCallback((imageData: ImageData, x: number, y: number, tolerance: number) => {
    if (!workerRef.current) {
      const errorMessage = 'Worker not initialized';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      return;
    }

    setError(null);

    const message: WorkerMessage = {
      type: 'magicSelect',
      imageData,
      magicSelectParams: {
        x,
        y,
        tolerance,
        width: imageData.width,
        height: imageData.height,
      },
    };

    workerRef.current.postMessage(message);
  }, []);

  return {
    processImage,
    cancelProcessing,
    calculateAutoThreshold,
    performMagicSelect,
    isProcessing,
    progress,
    error,
  };
}

export default useImageProcessor;
