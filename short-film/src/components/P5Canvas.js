import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Sketch = dynamic(
  () => import('react-p5').then((mod) => mod.default),
  { ssr: false }
);

const P5Canvas = ({ 
    imageData, 
    processedImageData,
    parentDimensions, 
    isPlaying, 
    canDraw,
    timePoints: externalTimePoints = [],
    startTime: externalStartTime,
    onDrawingUpdate,
    playbackSpeed = 1
  }) => {
  
  const backgroundImage = useRef(null);
  const processedImage = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [debug, setDebug] = useState('');
  const [useProcessedImage, setUseProcessedImage] = useState(false);
  
  const timePoints = useRef(externalTimePoints);
  const startTimeRef = useRef(externalStartTime);
  const lastTimeRef = useRef(0);
  const activeDrawingTime = useRef(0);
  const currentSegmentRef = useRef([]);
  const playSpeed = 1.0;

  useEffect(() => {
    if (!canDraw) {
      setIsDrawing(false);
      currentSegmentRef.current = [];
    }
  }, [canDraw]);

  useEffect(() => {
    if (canvasRef.current && processedImageData) {
      const p5Instance = canvasRef.current.p5;
      p5Instance.loadImage(processedImageData, img => {
        console.log('Loaded processed image:', img.width, img.height);
        processedImage.current = img;
      });
    }
  }, [processedImageData]);
  
  useEffect(() => {
    if (canvasRef.current && imageData) {
      const p5Instance = canvasRef.current.p5;
      p5Instance.loadImage(imageData, img => {
        console.log('Loaded original image:', img.width, img.height);
        backgroundImage.current = img;
      });
    }
  }, [imageData]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (externalTimePoints && externalTimePoints.length > 0) {
      timePoints.current = externalTimePoints;
    }
  }, [externalTimePoints]);

  useEffect(() => {
    startTimeRef.current = externalStartTime;
  }, [externalStartTime]);

  const setup = (p5, canvasParentRef) => {
    const canvas = p5.createCanvas(
      parentDimensions.width || window.innerWidth,
      parentDimensions.height || window.innerHeight
    );
    canvas.parent(canvasParentRef);
    canvasRef.current = canvas.elt;
    
    canvasRef.current.style.position = 'absolute';
    canvasRef.current.style.top = '0';
    canvasRef.current.style.left = '0';
    canvasRef.current.style.zIndex = '1';
  
    // Load both images
    if (imageData) {
      p5.loadImage(imageData, img => {
        backgroundImage.current = img;
      });
    }
    
    if (processedImageData) {
      p5.loadImage(processedImageData, img => {
        processedImage.current = img;
      });
    }
    
    p5.clear();
  };

  // Helper function to draw a smooth curve through points with enhanced styling
  const drawSmoothLine = (p5, points) => {
    if (points.length < 2) return;

    // Set up enhanced drawing style
    p5.strokeCap(p5.ROUND);
    p5.strokeJoin(p5.ROUND);
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(3); // Slightly thicker line

    // Draw the main smooth curve
    p5.beginShape();
    
    // Calculate control points for bezier curve
    const controlPoints = [];
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      
      // Calculate control points
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const tension = 0.5; // Adjust this value to control curve smoothness
      
      controlPoints.push({
        x1: curr.x + dx * tension,
        y1: curr.y + dy * tension,
        x2: next.x - dx * tension,
        y2: next.y - dy * tension
      });
    }

    // Draw enhanced smooth curve
    p5.vertex(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cp = controlPoints[i];
      p5.bezierVertex(
        cp.x1, cp.y1,
        cp.x2, cp.y2,
        points[i + 1].x, points[i + 1].y
      );
    }
    p5.endShape();

    // Add subtle glow effect
    p5.drawingContext.shadowBlur = 2;
    p5.drawingContext.shadowColor = 'rgba(255, 255, 255, 0.3)';
  };

  const draw = (p5) => {
    p5.clear();
    
    if (showBackground) {
      const currentImage = useProcessedImage && processedImage.current ? 
        processedImage.current : backgroundImage.current;
      
      if (currentImage) {
        // Calculate proper scaling
        const scaleX = p5.width / currentImage.width;
        const scaleY = p5.height / currentImage.height;
        const scale = Math.min(scaleX, scaleY);
        
        const newWidth = currentImage.width * scale;
        const newHeight = currentImage.height * scale;
        
        // Center the image
        const x = (p5.width - newWidth) / 2;
        const y = (p5.height - newHeight) / 2;
        
        p5.image(currentImage, x, y, newWidth, newHeight);
      }
    } else {
      p5.background(0);
    }
    
    const duration = activeDrawingTime.current;

    // Drawing mode - show all segments
    if (!isPlaying) {
      if (timePoints.current && timePoints.current.length > 0) {
        p5.noFill();
        p5.stroke(255);
        p5.strokeWeight(2);

        // Draw completed segments with smooth curves
        let currentSegment = [];
        timePoints.current.forEach((point) => {
          if (point.isNewSegment) {
            if (currentSegment.length > 0) {
              drawSmoothLine(p5, currentSegment);
              currentSegment = [];
            }
          }
          currentSegment.push(point);
        });

        // Draw last segment
        if (currentSegment.length > 0) {
          drawSmoothLine(p5, currentSegment);
        }
      }
    }
    // Playback mode with smooth curves
    else if (isPlaying && timePoints.current && timePoints.current.length > 1) {
      const currentPlaybackTime = ((p5.millis() / 1000 * playbackSpeed) % Math.max(duration, 0.001));
      
      p5.noFill();
      p5.stroke(255);
      p5.strokeWeight(2);
      
      let currentSegment = [];
      let lastDrawnPoint = null;
      
      // Collect points up to current time
      for (let i = 0; i < timePoints.current.length; i++) {
        const point = timePoints.current[i];
        
        if (point.t > currentPlaybackTime) {
          break;
        }

        if (point.isNewSegment && currentSegment.length > 0) {
          drawSmoothLine(p5, currentSegment);
          currentSegment = [];
        }
        
        currentSegment.push(point);
        lastDrawnPoint = point;
      }

      // Draw current segment
      if (currentSegment.length > 0) {
        drawSmoothLine(p5, currentSegment);
      }

      // Draw the position indicator
      if (lastDrawnPoint) {
        p5.fill(255, 0, 0);
        p5.noStroke();
        p5.circle(lastDrawnPoint.x, lastDrawnPoint.y, 10);
      }
    }

    let debugInfo = `Canvas Size: ${p5.width}x${p5.height}\n`;
    debugInfo += `Points: ${timePoints.current ? timePoints.current.length : 0}\n`;
    debugInfo += `Drawing: ${isDrawing}\n`;
    debugInfo += `Playing: ${isPlaying}\n`;
    debugInfo += `Can Draw: ${canDraw}\n`;
    debugInfo += `Speed: ${playbackSpeed}x\n`;
    debugInfo += `Active Drawing Time: ${duration.toFixed(2)}\n`;
    
    if (isPlaying) {
      const currentPlaybackTime = ((p5.millis() / 1000 * playbackSpeed) % Math.max(duration, 0.001));
      debugInfo += `Playback Time: ${currentPlaybackTime.toFixed(2)}/${duration.toFixed(2)}\n`;
    }
    
    setDebug(debugInfo);
  };

  const mousePressed = (p5) => {
    if (!canDraw) return;

    setIsDrawing(true);
    const currentTime = p5.millis() / 1000;
    
    const newPoint = {
      x: p5.mouseX,
      y: p5.mouseY,
      t: activeDrawingTime.current,
      isNewSegment: true
    };

    currentSegmentRef.current = [newPoint];
    
    if (!timePoints.current || timePoints.current.length === 0) {
      startTimeRef.current = currentTime;
      lastTimeRef.current = currentTime;
      activeDrawingTime.current = 0;
      timePoints.current = [newPoint];
    } else {
      lastTimeRef.current = currentTime;
      timePoints.current = [...timePoints.current, newPoint];
    }
    
    onDrawingUpdate(timePoints.current, startTimeRef.current);
  };
  
  const mouseDragged = (p5) => {
    if (!isDrawing || !canDraw) return;

    const currentTime = p5.millis() / 1000;
    activeDrawingTime.current += currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;
    
    const newPoint = {
      x: p5.mouseX,
      y: p5.mouseY,
      t: activeDrawingTime.current,
      isNewSegment: false
    };

    currentSegmentRef.current = [...currentSegmentRef.current, newPoint];
    timePoints.current = [...timePoints.current, newPoint];
    onDrawingUpdate(timePoints.current, startTimeRef.current);
  };

  const mouseReleased = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    currentSegmentRef.current = [];
    onDrawingUpdate(timePoints.current, startTimeRef.current);
  };

  if (!mounted) return null;

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0"
      style={{ 
        width: parentDimensions.width || '100vw',
        height: parentDimensions.height || '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Sketch 
        setup={setup} 
        draw={draw} 
        mouseDragged={mouseDragged}
        mousePressed={mousePressed}
        mouseReleased={mouseReleased}
      />
      
      <div className="absolute top-24 left-4 bg-black/50 text-white p-2 font-mono text-sm">
        <pre>{debug}</pre>
      </div>
      
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => {
            setShowBackground(prev => !prev);
            p5?.clear(); // Ensure canvas is cleared when toggling background
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          {showBackground ? 'Hide Background' : 'Show Background'}
        </button>
        
        {processedImageData && (
        <button
            onClick={() => setUseProcessedImage(!useProcessedImage)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
            Show {useProcessedImage ? 'Original' : 'Processed'} Image
        </button>
        )}
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(P5Canvas), {
  ssr: false
});