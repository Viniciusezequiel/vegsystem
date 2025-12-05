import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas } from 'fabric';
import { Button } from './button';
import { Eraser, RotateCcw } from 'lucide-react';

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
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

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

    // Configure drawing brush for signature
    canvas.freeDrawingBrush.color = '#1a1a2e';
    canvas.freeDrawingBrush.width = 2;

    // Listen for drawing events
    canvas.on('path:created', () => {
      setIsEmpty(false);
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
      onSignatureChange(dataUrl);
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [width, height, onSignatureChange]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
    setIsEmpty(true);
    onSignatureChange(null);
  };

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
