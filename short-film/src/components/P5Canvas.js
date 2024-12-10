'use client';

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';


const Sketch = dynamic(
  () => import('react-p5').then((mod) => mod.default),
  { ssr: false }
);

// Available fonts configuration
const AVAILABLE_FONTS = {
  'Times New Roman': 'https://db.onlinewebfonts.com/t/32441506567156636049eb850b53f02a.ttf',
  'Garamond': 'https://db.onlinewebfonts.com/t/2596224269750e00c3ad5356299a3b9f.ttf',
  'Grillages': 'https://db.onlinewebfonts.com/t/00dd609da9143be366f7cf9bdab6e747.ttf',
  'Caslon': 'https://db.onlinewebfonts.com/t/22bd8660c8d0b70ac3e9d024f7f2c31d.ttf',
  'Future': 'https://db.onlinewebfonts.com/t/6901c65d6d291c5e2cbb9b44aaa905f7.ttf'
};

const P5Canvas = forwardRef(({ 
    imageData, 
    processedImageData,
    parentDimensions, 
    isPlaying, 
    canDraw,
    timePoints: externalTimePoints = [],
    startTime: externalStartTime,
    onDrawingUpdate,
    playbackSpeed = 1,
    fontSize = 24,
    fontThickness = 2,
    drawingText = ''
  }, ref) => {
  
  // Add font state
  const [currentFont, setCurrentFont] = useState('Garamond');
  const customFont = useRef(null);
  
  // Core refs
  const p5InstanceRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timePoints = useRef(externalTimePoints);
  const startTimeRef = useRef(externalStartTime);
  
  // Image refs
  const backgroundImage = useRef(null);
  const processedImage = useRef(null);
  
  // State
  const [mounted, setMounted] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [debug, setDebug] = useState('');
  const [useProcessedImage, setUseProcessedImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Drawing state refs
  const spacingFactor = 2;
  const letterSpacing = useRef(fontSize * spacingFactor);
  const lastDrawnPoint = useRef({ x: 0, y: 0 });
  const accumulatedDistance = useRef(0);
  const currentLetterIndex = useRef(0);
  const letterData = useRef([]);
  const lastTimeRef = useRef(0);
  const activeDrawingTime = useRef(0);
  const currentSegmentRef = useRef([]);

  // Recording state
  const recordingRef = useRef({
    chunks: [],
    mediaRecorder: null,
    stream: null,
    isRecording: false,
    animationFrame: null
  });

  const loadFont = async (p5) => {
    try {
      customFont.current = await p5.loadFont(AVAILABLE_FONTS[currentFont]);
      if (customFont.current) {
        p5.textFont(customFont.current);
      }
    } catch (error) {
      console.error('Error loading font:', error);
      // Fallback to default font
      p5.textFont('Arial');
    }
  };

  // Setup effects
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

  // Font loading effect
  useEffect(() => {
    async function updateFont() {
      if (p5InstanceRef.current) {
        await loadFont(p5InstanceRef.current);
        // Force a redraw after font loads
        if (letterData.current.length > 0) {
          const p5 = p5InstanceRef.current;
          p5.clear();
          drawLetters(p5);
        }
      }
    }
    updateFont();
  }, [currentFont]);

  useEffect(() => {
    if (!canDraw) {
      setIsDrawing(false);
      currentSegmentRef.current = [];
    }
  }, [canDraw]);

  useEffect(() => {
    if (p5InstanceRef.current) {
      loadImages(p5InstanceRef.current);
    }
  }, [imageData, processedImageData]);

  // Image loading
  const loadImages = (p5) => {
    if (!p5) return;

    if (imageData) {
      p5.loadImage(imageData, img => {
        backgroundImage.current = img;
      }, error => console.error('Error loading original image:', error));
    }
    
    if (processedImageData) {
      p5.loadImage(processedImageData, img => {
        processedImage.current = img;
      }, error => console.error('Error loading processed image:', error));
    }
  };

  // Export functionality
  useImperativeHandle(ref, () => ({
    exportAnimation: async () => {
      if (!canvasRef.current || recordingRef.current.isRecording) return;
      
      try {
        // Get the actual canvas element
        const canvas = canvasRef.current.elt;
        
        // Set up recording
        const stream = canvas.captureStream(60);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm',
          videoBitsPerSecond: 8000000 // 8Mbps for high quality
        });
        
        recordingRef.current = {
          chunks: [],
          mediaRecorder,
          stream,
          isRecording: true,
          animationFrame: null
        };
        
        return new Promise((resolve) => {
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordingRef.current.chunks.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(recordingRef.current.chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'animation.webm';
            a.click();
            URL.revokeObjectURL(url);
            
            // Clean up
            recordingRef.current.isRecording = false;
            if (recordingRef.current.animationFrame) {
              cancelAnimationFrame(recordingRef.current.animationFrame);
            }
            setIsRecording(false);
            resolve();
          };

          setIsRecording(true);
          mediaRecorder.start();

          // Reset animation state
          const duration = activeDrawingTime.current;
          const totalCycleDuration = duration * 2;
          const startTime = Date.now();
          
          // Custom animation loop for recording
          function animate() {
            const currentTime = (Date.now() - startTime) / 1000;
            const cycleTime = (currentTime * playbackSpeed) % totalCycleDuration;
            
            // Draw frame with black background
            const p5 = p5InstanceRef.current;
            p5.clear();
            p5.background(255);
            
            // Calculate playback time for forward/reverse animation
            const playbackTime = cycleTime <= duration 
              ? cycleTime 
              : totalCycleDuration - cycleTime;
            
            drawLetters(p5, playbackTime);

            // Stop after one complete cycle
            if (currentTime * playbackSpeed >= totalCycleDuration) {
              mediaRecorder.stop();
              return;
            }

            recordingRef.current.animationFrame = requestAnimationFrame(animate);
          }

          // Start animation
          animate();
        });
      } catch (error) {
        console.error('Export failed:', error);
        setIsRecording(false);
      }
    }
  }));

  const setup = (p5, canvasParentRef) => {
    p5InstanceRef.current = p5;
    
    const canvas = p5.createCanvas(parentDimensions.width, parentDimensions.height);
    canvas.parent(canvasParentRef);
    canvasRef.current = canvas;
    
    canvas.elt.style.position = 'absolute';
    canvas.elt.style.top = '0';
    canvas.elt.style.left = '0';
    canvas.elt.style.zIndex = '1';
    
    loadImages(p5);
    loadFont(p5);
    p5.clear();
    p5.textAlign(p5.CENTER, p5.CENTER);
  };

  // Letter management
  const addLetter = (point, angle) => {
    if (!drawingText || drawingText.length === 0) return;

    const letter = drawingText[currentLetterIndex.current % drawingText.length];
    
    letterData.current.push({
      letter,
      x: point.x,
      y: point.y,
      angle,
      fontSize: fontSize,
      thickness: fontThickness,
      time: point.t
    });

    currentLetterIndex.current = (currentLetterIndex.current + 1) % drawingText.length;
  };

  const drawLetters = (p5, upToTime = null) => {
    letterData.current.forEach(data => {
      if (upToTime !== null && data.time > upToTime) return;

      p5.push();
      p5.translate(data.x, data.y);
      p5.rotate(data.angle);
      p5.textSize(data.fontSize);
      p5.strokeWeight(data.thickness);
      p5.stroke(255);
      p5.fill(0);
      p5.text(data.letter, 0, 0);
      p5.pop();
    });
  };

  // Main draw loop
  const draw = (p5) => {
    if (isRecording) return;
    
    p5.clear();
    
    if (showBackground) {
      const currentImage = useProcessedImage && processedImage.current ? 
        processedImage.current : backgroundImage.current;
      if (currentImage) {
        p5.image(currentImage, 0, 0, parentDimensions.width, parentDimensions.height);
      }
    } else {
      p5.background(255);
    }

    const duration = activeDrawingTime.current;
    const totalCycleDuration = duration * 2;

    if (isPlaying && timePoints.current?.length > 1) {
      const cycleTime = (p5.millis() / 1000 * playbackSpeed) % totalCycleDuration;
      const currentPlaybackTime = cycleTime <= duration ? cycleTime : totalCycleDuration - cycleTime;
      drawLetters(p5, currentPlaybackTime);
    } else {
      drawLetters(p5);
    }

    // Debug info
    const cycleTime = (p5.millis() / 1000 * playbackSpeed) % totalCycleDuration;
    const direction = cycleTime <= duration ? "Forward" : "Reverse";
    
    let debugInfo = `Canvas Size: ${p5.width}x${p5.height}\n`;
    debugInfo += `Points: ${timePoints.current ? timePoints.current.length : 0}\n`;
    debugInfo += `Letters: ${letterData.current.length}\n`;
    debugInfo += `Drawing: ${isDrawing}\n`;
    debugInfo += `Playing: ${isPlaying}\n`;
    debugInfo += `Recording: ${isRecording}\n`;
    debugInfo += `Speed: ${playbackSpeed}x\n`;
    debugInfo += `Duration: ${duration.toFixed(2)}s\n`;
    
    if (isPlaying) {
      debugInfo += `Time: ${(cycleTime <= duration ? cycleTime : totalCycleDuration - cycleTime).toFixed(2)}/${duration.toFixed(2)}s (${direction})\n`;
    }
    
    setDebug(debugInfo);
  };

  // Mouse event handlers
  const mousePressed = (p5) => {
    if (!canDraw) return;

    setIsDrawing(true);
    const currentTime = p5.millis() / 1000;
    letterSpacing.current = fontSize * spacingFactor;
    
    const newPoint = {
      x: p5.mouseX,
      y: p5.mouseY,
      t: activeDrawingTime.current,
      isNewSegment: true
    };

    currentSegmentRef.current = [newPoint];
    accumulatedDistance.current = 0;
    lastDrawnPoint.current = newPoint;
    
    if (!timePoints.current?.length) {
      startTimeRef.current = currentTime;
      lastTimeRef.current = currentTime;
      activeDrawingTime.current = 0;
      timePoints.current = [newPoint];
      letterData.current = [];
      currentLetterIndex.current = 0;
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

    const dist = p5.dist(lastDrawnPoint.current.x, lastDrawnPoint.current.y, newPoint.x, newPoint.y);
    accumulatedDistance.current += dist;

    if (accumulatedDistance.current >= letterSpacing.current) {
      const angle = p5.atan2(newPoint.y - lastDrawnPoint.current.y, newPoint.x - lastDrawnPoint.current.x);
      addLetter(newPoint, angle);
      accumulatedDistance.current = 0;
      lastDrawnPoint.current = newPoint;
    }

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

  const handleFontChange = (value) => {
    setCurrentFont(value);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex gap-4 mb-4 items-center justify-center">
        <button
          onClick={() => setShowBackground(prev => !prev)}
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

        <select 
        value={currentFont}
        onChange={(e) => setCurrentFont(e.target.value)}
        className="px-3 py-2 w-48 rounded-md border border-gray-300 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
        <option value="" disabled>Select a font</option>
        {Object.keys(AVAILABLE_FONTS).map((font) => (
            <option 
            key={font} 
            value={font} 
            style={{ fontFamily: font }}
            >
            {font}
            </option>
        ))}
        </select>
      </div>

      <div 
        ref={containerRef} 
        className="relative"
        style={{ 
          width: parentDimensions.width,
          height: parentDimensions.height,
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
      </div>
    </div>
  );
});

P5Canvas.displayName = 'P5Canvas';

export default dynamic(() => Promise.resolve(P5Canvas), {
  ssr: false
});