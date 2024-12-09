'use client';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import useFrameStore from '@/lib/store';

const P5Canvas = dynamic(() => import('@/components/P5Canvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading drawing canvas...</div>
});

export default function FrameEditorWrapper({ frameId }) {
    const [isClient, setIsClient] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const imageRef = useRef(null);
    const [processedImageData, setProcessedImageData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
  
  // Maintain drawing state separately from frame data
  const [drawingState, setDrawingState] = useState({
    timePoints: [],
    startTime: null
  });

  const [frameData, setFrameData] = useState({
    title: '',
    description: '',
    generativePrompt: '',
    imageData: null,
    drawingData: null
  });
  
  const { updateFrame, getFrame } = useFrameStore();

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
  };

  // Load existing frame data and drawing state
  useEffect(() => {
    setIsClient(true);
    const existingFrame = getFrame(frameId);
    if (existingFrame) {
      setFrameData(existingFrame);
      if (existingFrame.drawingData) {
        setDrawingState(existingFrame.drawingData);
      }
    }
  }, [frameId, getFrame]);

  useEffect(() => {
    if (frameData.imageData) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.width,
          height: img.height
        });
      };
      img.src = frameData.imageData;
    }
  }, [frameData.imageData]);

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

  // Handler for drawing updates from P5Canvas
  const handleDrawingUpdate = (newTimePoints, newStartTime) => {
    const newDrawingState = {
      timePoints: newTimePoints,
      startTime: newStartTime
    };
    
    // Update both local state and frame data
    setDrawingState(newDrawingState);
    const updatedFrameData = {
      ...frameData,
      drawingData: newDrawingState
    };
    setFrameData(updatedFrameData);
    
    // Persist to store
    updateFrame(frameId, updatedFrameData);
  };

  const generateImage = async () => {
    if (!frameData.generativePrompt) {
      alert('Please enter a prompt first');
      return;
    }
  
    setIsGenerating(true);
    
    try {
      // First generate image from Stability AI
      const formData = new FormData();
      formData.append('prompt', frameData.generativePrompt);
      formData.append('output_format', 'png');
      formData.append('model', 'sd3.5-large-turbo');
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
      console.log('Successfully generated image from Stability AI');
  
      // Then process it through your line drawing API
      console.log('Sending to line drawing processing...');
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
  
      console.log('Received response from line drawing API');
      const lineDrawingResult = await lineDrawingResponse.json();
      
      if (!lineDrawingResponse.ok) {
        console.error('Line drawing API error:', lineDrawingResult);
        throw new Error(`Line drawing API error! status: ${lineDrawingResponse.status}`);
      }
  
      if (!lineDrawingResult.success) {
        console.error('Line drawing processing failed:', lineDrawingResult);
        throw new Error(lineDrawingResult.error || 'Line drawing processing failed');
      }
  
      console.log('Successfully processed line drawing');
  
      // Update frame with both original and processed images
      const updatedFrameData = {
        ...frameData,
        imageData,  // original image
        lineDrawing: lineDrawingResult.images[0],  // processed line drawing
        drawingData: drawingState
      };
      
      setFrameData(updatedFrameData);
      updateFrame(frameId, updatedFrameData);
    } catch (error) {
      console.error('Error in image generation pipeline:', error);
      alert(`Failed to process image: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen">
      <div className="w-1/2 p-6 border-r border-gray-200">
        <div className="bg-white rounded-lg shadow-sm p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold" style={{ fontFamily: 'Caslon' }}>
              Creating Image
            </h2>
            {frameData.imageData && (
              <div className="relative z-[9999] flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                {/* Add speed control when there are drawing points and we're not in drawing mode */}
                {!isDrawingMode && drawingState.timePoints.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Speed:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={playbackSpeed}
                      onChange={handleSpeedChange}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600">{playbackSpeed.toFixed(1)}x</span>
                  </div>
                )}

               {/* Drawing mode toggle */}
                <button
                  onClick={toggleDrawingMode}
                  className={`px-4 py-2 rounded-lg ${
                    isDrawingMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isDrawingMode ? 'Stop Drawing' : 'Draw Lines'}
                </button>
                
                {!isDrawingMode && drawingState.timePoints.length > 0 && (
                  <button
                    onClick={togglePlay}
                    className={`px-4 py-2 rounded-lg ${
                      isPlaying ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                    }`}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden relative flex items-center justify-center">
            {frameData.imageData && (
              <div 
                className="relative"
                style={{
                  width: imageDimensions.width,
                  height: imageDimensions.height,
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
              >
                <img 
                  ref={imageRef}
                  src={frameData.imageData} 
                  alt="Generated artwork"
                  className="w-full h-full object-contain"
                />
                <div 
                  className="absolute inset-0" 
                  style={{ pointerEvents: 'auto', cursor: isDrawingMode ? 'crosshair' : 'default' }}
                >
<P5Canvas 
  imageData={frameData.imageData}
  processedImageData={frameData.lineDrawing ? `data:image/png;base64,${frameData.lineDrawing}` : null}
  parentDimensions={imageDimensions}
  isPlaying={isPlaying}
  canDraw={isDrawingMode}
  timePoints={drawingState.timePoints}
  startTime={drawingState.startTime}
  onDrawingUpdate={handleDrawingUpdate}
  playbackSpeed={playbackSpeed}
/>
                </div>
              </div>
            )}
            {!frameData.imageData && (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image generated yet
              </div>
            )}
          </div>
          
          {/* Generative Text Input */}
          <div className="mt-4 space-y-4">
            <textarea
              className="w-full p-3 border rounded-lg resize-none"
              placeholder="Describe the image you want to generate..."
              value={frameData.generativePrompt}
              onChange={(e) => 
                setFrameData(prev => ({ ...prev, generativePrompt: e.target.value }))
              }
              rows={3}
            />
            
            <button
              onClick={generateImage}
              disabled={isGenerating}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium
                ${isGenerating 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isGenerating ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Frame Details */}
      <div className="w-1/2 p-6">
        <div className="bg-white rounded-lg shadow-sm p-4 h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Caslon' }}>
            Frame Details
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Frame Title
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-lg"
              value={frameData.title}
              onChange={(e) => 
                setFrameData(prev => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter frame title"
            />
          </div>
          
          <div className="mb-4 flex-1">
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              className="w-full h-full p-3 border rounded-lg resize-none"
              value={frameData.description}
              onChange={(e) => 
                setFrameData(prev => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe this frame..."
            />
          </div>
          
          <div className="flex justify-between mt-4">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={() => updateFrame(frameId, frameData)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Frame
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}