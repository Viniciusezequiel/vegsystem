import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush } from 'fabric';
import { Button } from './button';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  width?: number;
  height?: number;
}

export const SignaturePad = ({ 
  onSignatureChange, 
  width = 400, 
  height = 200 
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const onSignatureChangeRef = useRef(onSignatureChange);
  const [isEmpty, setIsEmpty] = useState(true);

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

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Prevent double initialization
    if (fabricCanvasRef.current) {
      return;
    }

    // Get container width for responsive sizing
    const containerWidth = containerRef.current.offsetWidth;
    const canvasWidth = Math.min(width, containerWidth - 2); // -2 for border
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

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height]);

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef}
        className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white"
      >
        <canvas ref={canvasRef} className="touch-none" />
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