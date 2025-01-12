'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import useFrameStore from '@/lib/store';
import { Card } from '@/components/ui/card';
import { 
  Eye, EyeOff, Image as ImageIcon, Trash2, Play, Pause, 
  Download, Type, Settings, ChevronLeft, Save, Wand2,
  ZoomIn, ZoomOut, RotateCcw, Plus, Minus
} from 'lucide-react';

// Dynamically import P5Canvas with no SSR
const P5Canvas = dynamic(() => import('@/components/P5Canvas'), {
  ssr: false,
  loading: () => null
});

export default function FrameEditorWrapper({ frameId }) {
  // Mount state
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Client-side states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(24);
  const [fontThickness, setFontThickness] = useState(2);
  const [fontColor, setFontColor] = useState(0);
  const [borderColor, setBorderColor] = useState(255);
  const p5CanvasRef = useRef(null);
  const [showBackground, setShowBackground] = useState(true);
  const [useProcessedImage, setUseProcessedImage] = useState(false);
  const [currentFont, setCurrentFont] = useState('Garamond');
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(0);
  
  // Dimensions states
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0
  });
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0
  });

  // Frame data state
  const [frameData, setFrameData] = useState({
    sceneDescription: '',
    characterDialogue: '',
    sequence: '',
    visualPrompt: '',
    imageData: null,
    lineDrawing: null,
    drawingData: {
      timePoints: [],
      startTime: null
    }
  });

    // Add AVAILABLE_FONTS constant
    const AVAILABLE_FONTS = {
      'Times New Roman': 'https://db.onlinewebfonts.com/t/32441506567156636049eb850b53f02a.ttf',
      'Garamond': 'https://db.onlinewebfonts.com/t/2596224269750e00c3ad5356299a3b9f.ttf',
      'Grillages': 'https://db.onlinewebfonts.com/t/00dd609da9143be366f7cf9bdab6e747.ttf',
      'Caslon': 'https://db.onlinewebfonts.com/t/22bd8660c8d0b70ac3e9d024f7f2c31d.ttf',
      'Future': 'https://db.onlinewebfonts.com/t/6901c65d6d291c5e2cbb9b44aaa905f7.ttf'
    };
  
    const handleClearCanvas = () => {
      // Reset the frame data
      setFrameData(prev => ({
        ...prev,
        drawingData: {
          timePoints: [],
          startTime: null
        }
      }));
    
      // Reset playback state
      setIsPlaying(false);
    
      // Clear the canvas through the ref
      if (p5CanvasRef.current?.clearCanvas) {
        p5CanvasRef.current.clearCanvas();
      }
    };

  const { updateFrame, getFrame } = useFrameStore();

  // Mount effect
  useEffect(() => {
    setMounted(true);
    const existingFrame = getFrame(frameId);
    if (existingFrame) {
      setFrameData(existingFrame);
    }
  }, [frameId, getFrame]);

  // Container resize effect
  useEffect(() => {
    if (!mounted) return;

    const updateContainerDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerDimensions({ width, height });
      }
    };

    updateContainerDimensions();
    window.addEventListener('resize', updateContainerDimensions);
    return () => window.removeEventListener('resize', updateContainerDimensions);
  }, [mounted]);

  // Image dimensions effect
  useEffect(() => {
    if (!mounted || !frameData.imageData) return;

    const img = new Image();
    img.onload = () => {
      setImageDimensions({
        width: img.width,
        height: img.height
      });
    };
    img.src = frameData.imageData;
  }, [mounted, frameData.imageData]);

  // Calculate scaled dimensions
  const getScaledDimensions = () => {
    if (!imageDimensions.width || !imageDimensions.height || !containerDimensions.width) {
      return imageDimensions;
    }

    const containerAspectRatio = containerDimensions.width / containerDimensions.height;
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    
    let scaledWidth, scaledHeight;
    
    if (containerAspectRatio > imageAspectRatio) {
      scaledHeight = containerDimensions.height * 0.8;
      scaledWidth = scaledHeight * imageAspectRatio;
    } else {
      scaledWidth = containerDimensions.width * 0.8;
      scaledHeight = scaledWidth / imageAspectRatio;
    }

    return {
      width: scaledWidth,
      height: scaledHeight
    };
  };

  // Event handlers
  const handleSpeedChange = (e) => {
    setPlaybackSpeed(parseFloat(e.target.value));
  };

  const togglePlay = () => {
    if (!isDrawingMode && frameData.imageData) {
      setIsPlaying(!isPlaying);
    }
  };

  const toggleDrawingMode = () => {
    setIsDrawingMode(!isDrawingMode);
    if (!isDrawingMode) {
      setIsPlaying(false);
    }
  };

  const handleDrawingUpdate = (newTimePoints, newStartTime) => {
    setFrameData(prev => ({
      ...prev,
      drawingData: {
        timePoints: newTimePoints,
        startTime: newStartTime
      }
    }));
  };

  const generateImage = async () => {
    if (!frameData.sceneDescription && !frameData.visualPrompt) {
      alert('Please enter a scene description or visual prompt');
      return;
    }

    setIsGenerating(true);
    
    try {
      const combinedPrompt = `
        Scene: ${frameData.sceneDescription}
        ${frameData.visualPrompt ? `Additional details: ${frameData.visualPrompt}` : ''}
      `.trim();

      const formData = new FormData();
      formData.append('prompt', combinedPrompt);
      formData.append('output_format', 'png');
      formData.append('model', 'sd3.5-large');
      formData.append('aspect_ratio', '9:16');
      
      const stabilityResponse = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_STABILITY_API_KEY}`,
          'Accept': 'image/*'
        },
        body: formData
      });

      if (!stabilityResponse.ok) {
        throw new Error(`Stability API error! status: ${stabilityResponse.status}`);
      }

      const arrayBuffer = await stabilityResponse.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const imageData = `data:image/png;base64,${base64}`;

      const lineDrawingResponse = await fetch('http://localhost:5000/process-line-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageData,
          detail_level: 'medium'
        })
      });

      const lineDrawingResult = await lineDrawingResponse.json();
      
      if (!lineDrawingResponse.ok || !lineDrawingResult.success) {
        throw new Error('Line drawing processing failed');
      }

      setFrameData(prev => ({
        ...prev,
        imageData,
        lineDrawing: lineDrawingResult.images[0]
      }));
      
    } catch (error) {
      console.error('Error in image generation:', error);
      alert(`Failed to generate image: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!mounted) {
    return null;
  }

  // New function to handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target.result;
        
        try {
          // Process the uploaded image for line drawing
          const lineDrawingResponse = await fetch('http://localhost:5000/process-line-drawing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image: imageData,
              detail_level: 'medium'
            })
          });

          const lineDrawingResult = await lineDrawingResponse.json();
          
          if (!lineDrawingResponse.ok || !lineDrawingResult.success) {
            throw new Error('Line drawing processing failed');
          }

          setFrameData(prev => ({
            ...prev,
            imageData,
            lineDrawing: lineDrawingResult.images[0]
          }));
        } catch (error) {
          console.error('Error processing uploaded image:', error);
          // Still set the image even if line drawing processing fails
          setFrameData(prev => ({
            ...prev,
            imageData,
          }));
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload an image file');
    }
  };

  const scaledDimensions = getScaledDimensions();

  // Add the DraggableNumber component before your main component
const DraggableNumber = ({ value, onChange, min, max, step = 1, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartValue(value);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    const newValue = Math.min(max, Math.max(min, startValue + diff * step));
    onChange(newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex items-center gap-2" onMouseDown={handleMouseDown}>
      <span className="text-gray-400 text-sm min-w-[70px]">{label}:</span>
      <div 
        className={`px-2 py-1 bg-gray-700 rounded cursor-ew-resize select-none 
                   ${isDragging ? 'ring-2 ring-purple-500' : ''}`}
      >
        <span className="text-white text-sm">{value}</span>
      </div>
    </div>
  );
};

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Left Control Panel */}
      <div className="w-16 bg-gray-800 flex flex-col items-center py-4">
        {/* View Controls Group */}
        <div className="space-y-3 mb-6 relative group">
          <div className="absolute -left-2 w-14 h-[1px] bg-gray-700/50 -top-3" />
          <button
            onClick={() => setShowBackground(prev => !prev)}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all
                     hover:bg-gray-700 hover:scale-105 bg-gray-700/50 text-white"
            title="Toggle Background"
          >
            {showBackground ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>

          {frameData.lineDrawing && (
            <button
              onClick={() => setUseProcessedImage(!useProcessedImage)}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all
                       hover:bg-purple-700 hover:scale-105 bg-purple-600/50 text-white"
              title="Toggle Processed Image"
            >
              <ImageIcon size={20} />
            </button>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              className="w-10 h-8 rounded-lg flex items-center justify-center transition-all
                       hover:bg-blue-700 hover:scale-105 bg-blue-600/50 text-white"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="w-10 h-8 rounded-lg flex items-center justify-center transition-all
                       hover:bg-blue-700 hover:scale-105 bg-blue-600/50 text-white"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
          </div>
        </div>

        {/* Drawing Controls Group */}
        <div className="space-y-3 mb-6 relative">
          <div className="absolute -left-2 w-14 h-[1px] bg-gray-700/50 -top-3" />
          <button
            onClick={toggleDrawingMode}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all
                     hover:scale-105 ${
                       isDrawingMode 
                         ? 'bg-blue-600 hover:bg-blue-700' 
                         : 'bg-gray-700/50 hover:bg-gray-700'
                     } text-white`}
            title="Toggle Drawing Mode"
          >
            <Type size={20} />
          </button>

          <button
            onClick={handleClearCanvas}
            disabled={!frameData.drawingData.timePoints.length}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all
                     hover:bg-red-700 hover:scale-105 disabled:bg-red-400/50 
                     disabled:hover:scale-100 bg-red-600/50 text-white"
            title="Clear Canvas"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Playback Controls Group */}
        {frameData.drawingData.timePoints.length > 0 && !isDrawingMode && (
          <div className="space-y-3 relative">
            <div className="absolute -left-2 w-14 h-[1px] bg-gray-700/50 -top-3" />
            <button
              onClick={togglePlay}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all
                       hover:scale-105 ${
                         isPlaying 
                           ? 'bg-red-600 hover:bg-red-700' 
                           : 'bg-green-600 hover:bg-green-700'
                       } text-white`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <div className="w-10">
              <label className="text-gray-400 text-xs block mb-1 text-center">
                Speed
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value) || 1)}
                className="w-full px-1 py-1 bg-gray-700 border border-gray-600 rounded-lg
                         text-white text-xs text-center focus:outline-none 
                         focus:ring-2 focus:ring-purple-500 transition-colors"
              />
            </div>

            <button
              onClick={() => p5CanvasRef.current?.exportAnimation()}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all
                       hover:bg-purple-700 hover:scale-105 bg-purple-600/50 text-white"
              title="Export Animation"
            >
              <Download size={20} />
            </button>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all
                   hover:bg-gray-700 hover:scale-105 bg-gray-700/50 text-white mt-auto"
          title="Drawing Settings"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Canvas Area */}
        <div className="flex-1 p-2 flex flex-col">
          {/* Canvas Container with Relative Positioning */}
          <div className="flex-1 relative bg-transparent">
            {/* Settings Panel */}
            {showSettings && (
              <div className="absolute top-1 right-1 bg-gray-800 rounded-lg shadow-lg z-50 border border-gray-700 animate-in slide-in-from-top duration-300">

                <div className="p-3 space-y-2">
                <div>
                  <p className="flex items-center gap-2 text-white text-sm">Font:</p>
                </div>
                  <select 
                    value={currentFont}
                    onChange={(e) => setCurrentFont(e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded bg-gray-700 text-white
                             border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.keys(AVAILABLE_FONTS).map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-gray-400 text-sm min-w-[70px]">Font Size:</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value) || 6)}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-gray-400 text-sm min-w-[70px]">Font Color:</label>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={fontColor}
                        onChange={(e) => setFontColor(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <p className="flex items-center gap-2 text-white text-sm">Border:</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-gray-400 text-sm min-w-[70px]">Thickness:</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={fontThickness}
                        onChange={(e) => setFontThickness(parseFloat(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-gray-400 text-sm min-w-[70px]">Color:</label>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={borderColor}
                        onChange={(e) => setBorderColor(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={containerRef} className="absolute inset-0">
              {frameData.imageData ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img 
                    ref={imageRef}
                    src={frameData.imageData} 
                    alt="Scene"
                    className="max-w-full max-h-full object-contain"
                    style={{ display: frameData.lineDrawing ? 'none' : 'block' }}
                  />
                  <div 
                    className="absolute inset-0 flex items-center justify-center" 
                    style={{ 
                      pointerEvents: 'auto', 
                      cursor: isDrawingMode ? 'crosshair' : 'default' 
                    }}
                  >
                    <P5Canvas
                      ref={p5CanvasRef}
                      imageData={frameData.imageData}
                      processedImageData={frameData.lineDrawing ? `data:image/png;base64,${frameData.lineDrawing}` : null}
                      parentDimensions={scaledDimensions}
                      isPlaying={isPlaying}
                      canDraw={isDrawingMode}
                      timePoints={frameData.drawingData.timePoints}
                      startTime={frameData.drawingData.startTime}
                      onDrawingUpdate={handleDrawingUpdate}
                      playbackSpeed={playbackSpeed}
                      fontSize={fontSize}
                      fontThickness={fontThickness}
                      fontColor={fontColor}
                      borderColor={borderColor}
                      drawingText={frameData.characterDialogue || ''}
                      showBackground={showBackground}
                      useProcessedImage={useProcessedImage}
                      currentFont={currentFont}
                      onClear={handleClearCanvas}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-400">No image generated</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-80 p-4 bg-gray-800">
          <Card className="h-full bg-gray-900 border-gray-700">
            <div className="flex flex-col h-full p-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Frame Editor</h2>
                <span className="text-gray-400 text-sm">Frame {frameId}</span>
              </div>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Background Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full p-2 border border-gray-700 rounded-lg bg-gray-800
                             text-gray-300 file:mr-4 file:py-2 file:px-4
                             file:rounded-full file:border-0
                             file:text-sm file:font-semibold
                             file:bg-purple-600 file:text-white
                             hover:file:bg-purple-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Scene Description
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-700 rounded-lg resize-none
                             bg-gray-800 text-gray-300 focus:ring-2 focus:ring-purple-500
                             focus:border-transparent"
                    placeholder="Describe the scene..."
                    value={frameData.sceneDescription}
                    onChange={(e) => setFrameData(prev => ({ ...prev, sceneDescription: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Drawing Text
                  </label>
                  <div className="relative">
                    <textarea
                      className="w-full p-3 border border-gray-700 rounded-lg resize-none
                               bg-gray-800 text-gray-300 focus:ring-2 focus:ring-purple-500
                               focus:border-transparent"
                      placeholder="Enter text to draw..."
                      value={frameData.characterDialogue}
                      onChange={(e) => setFrameData(prev => ({ ...prev, characterDialogue: e.target.value }))}
                      rows={2}
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-gray-500">
                      {frameData.characterDialogue.length} chars
                    </span>
                  </div>
                </div>

                <button
                  onClick={generateImage}
                  disabled={isGenerating}
                  className="w-full py-3 px-4 rounded-lg text-white font-medium transition-all
                           flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700
                           disabled:bg-purple-400 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Wand2 size={20} />
                  {isGenerating ? 'Generating...' : 'Generate Image'}
                </button>
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-700 mt-4">
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 text-gray-400 hover:text-white flex items-center gap-2
                           transition-colors"
                >
                  <ChevronLeft size={20} /> Back
                </button>
                <button
                  onClick={() => updateFrame(frameId, frameData)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           transition-all flex items-center gap-2 hover:scale-105"
                >
                  <Save size={20} /> Save
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
  );
};