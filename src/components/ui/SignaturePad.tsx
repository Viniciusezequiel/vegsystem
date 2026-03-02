import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush } from 'fabric';
import { Button } from './button';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  height?: number;
}

export const SignaturePad = ({ 
  onSignatureChange, 
  height = 200 
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const onSignatureChangeRef = useRef(onSignatureChange);
  const [isEmpty, setIsEmpty] = useState(true);
  const initAttemptRef = useRef(0);

  // Keep ref in sync with prop
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);

  const handleClear = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = '#ffffff';
    fabricCanvasRef.current.renderAll();
    setIsEmpty(true);
    onSignatureChangeRef.current(null);
  }, []);

  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Dispose existing canvas
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    const containerWidth = containerRef.current.offsetWidth;
    
    // If container has no width yet (dialog not fully rendered), retry
    if (containerWidth < 50) {
      initAttemptRef.current += 1;
      if (initAttemptRef.current < 10) {
        requestAnimationFrame(initCanvas);
      }
      return;
    }

    const canvasWidth = containerWidth - 2; // -2 for border
    const canvasHeight = height;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      isDrawingMode: true,
    });

    // Create and configure drawing brush for signature
    const brush = new PencilBrush(canvas);
    brush.color = '#1a1a2e';
    brush.width = 2;
    canvas.freeDrawingBrush = brush;

    // Listen for drawing events
    canvas.on('path:created', () => {
      setIsEmpty(false);
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
      onSignatureChangeRef.current(dataUrl);
    });

    fabricCanvasRef.current = canvas;
  }, [height]);

  useEffect(() => {
    initAttemptRef.current = 0;
    
    // Use a small delay to ensure the dialog/container is fully rendered
    const timer = setTimeout(() => {
      initCanvas();
    }, 100);

    // Also observe container resize to re-init if needed
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    
    if (container) {
      let lastWidth = 0;
      let initialised = false;
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const newWidth = entry.contentRect.width;
          // Only re-init on first meaningful width or if width changed significantly while canvas is still empty
          if (!initialised && newWidth > 50) {
            initialised = true;
            lastWidth = newWidth;
            return; // skip — the setTimeout init will handle first render
          }
          if (Math.abs(newWidth - lastWidth) > 10 && lastWidth > 0 && fabricCanvasRef.current) {
            // Only re-init if canvas is empty to avoid losing a signature
            const objects = fabricCanvasRef.current.getObjects();
            if (objects.length === 0) {
              initCanvas();
            }
          }
          lastWidth = newWidth;
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [initCanvas]);

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef}
        className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white w-full"
      >
        <canvas ref={canvasRef} className="touch-none w-full" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isEmpty ? 'Assine acima usando caneta ou dedo' : 'Assinatura capturada'}
        </p>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      </div>
    </div>
  );
};
