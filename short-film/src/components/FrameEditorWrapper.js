'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import useFrameStore from '@/lib/store';
import { Card } from '@/components/ui/card';

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
  const p5CanvasRef = useRef(null);
  
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

  return (
    <div className="grid grid-cols-2 h-screen overflow-hidden bg-gray-50">
      {/* Canvas Side */}
      <div className="h-full bg-gray-100 p-6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold font-serif">Frame {frameId}</h2>
          <div className="flex items-center gap-2">
            {frameData.imageData && frameData.drawingData.timePoints.length > 0 && !isDrawingMode && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={playbackSpeed}
                    onChange={handleSpeedChange}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">{playbackSpeed.toFixed(1)}x</span>
                </div>
                <button
                  onClick={togglePlay}
                  className={`px-4 py-2 rounded-lg ${
                    isPlaying ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                  }`}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => p5CanvasRef.current?.exportAnimation()}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                >
                  Export Animation
                </button>
              </>
            )}
            
            {/* Text Drawing Controls */}
            {isDrawingMode && (
              <div className="flex items-center gap-4 mr-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Size:</label>
                  <input
                    type="range"
                    min="6"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Thickness:</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={fontThickness}
                    onChange={(e) => setFontThickness(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">{fontThickness}</span>
                </div>
              </div>
            )}
            
            <button
              onClick={toggleDrawingMode}
              className={`px-4 py-2 rounded-lg ${
                isDrawingMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isDrawingMode ? 'Stop Drawing' : 'Draw Text'}
            </button>
          </div>
        </div>
  
        {/* Canvas Container */}
        <div className="flex-1 flex items-center justify-center">
          <div 
            ref={containerRef}
            className="relative bg-white rounded-lg shadow-sm w-full h-full flex items-center justify-center"
          >
            {frameData.imageData ? (
              <div className="relative h-full w-full flex items-center justify-center">
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
                    drawingText={frameData.characterDialogue || ''}
                  />
                </div>
              </div>
            ) : (
              <span className="text-gray-400">No image generated</span>
            )}
          </div>
        </div>
      </div>
  
      {/* Controls Side */}
      <div className="h-full overflow-y-auto">
        <div className="h-full p-6">
          <Card className="h-full p-6">
            <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Upload Background Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              {/* Scene Description */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Scene Description (Narration)
                </label>
                <textarea
                  className="w-full p-3 border rounded-lg resize-none bg-white"
                  placeholder="Describe the scene for narration..."
                  value={frameData.sceneDescription}
                  onChange={(e) => setFrameData(prev => ({ ...prev, sceneDescription: e.target.value }))}
                  rows={3}
                />
              </div>
  
              {/* Character Dialogue / Title Card */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Drawing Text
                </label>
                <textarea
                  className="w-full p-3 border rounded-lg resize-none bg-white"
                  placeholder="Enter text to draw or title card text..."
                  value={frameData.characterDialogue}
                  onChange={(e) => setFrameData(prev => ({ ...prev, characterDialogue: e.target.value }))}
                  rows={2}
                />
              </div>
  
              {/* Visual Prompt */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Additional Visual Details
                </label>
                <textarea
                  className="w-full p-3 border rounded-lg resize-none bg-white"
                  placeholder="Add specific visual details for image generation..."
                  value={frameData.visualPrompt}
                  onChange={(e) => setFrameData(prev => ({ ...prev, visualPrompt: e.target.value }))}
                  rows={2}
                />
              </div>
  
              {/* Generate Button */}
              <button
                onClick={generateImage}
                disabled={isGenerating}
                className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors
                  ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isGenerating ? 'Generating...' : 'Generate Image'}
              </button>
  
              {/* Action buttons */}
              <div className="flex justify-between pt-6 border-t">
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
                <button
                  onClick={() => updateFrame(frameId, frameData)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Frame
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );}