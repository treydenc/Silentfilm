from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import os
import time
from openai import OpenAI
from dotenv import load_dotenv
import logging
import requests
from datetime import datetime
import cv2 as cv
import numpy as np
import sys

# Load environment variables
load_dotenv()

# Retrieve API keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Check if API key is available
if not OPENAI_API_KEY:
    raise ValueError("OpenAI API key not found. Please set it in the .env file.")

# Set up logging
logger = logging.getLogger(__name__)

# Initialize Flask app with CORS
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3001", "http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

class CropLayer(object):
    def __init__(self, params, blobs):
        self.xstart = 0
        self.xend = 0
        self.ystart = 0
        self.yend = 0

    def getMemoryShapes(self, inputs):
        inputShape, targetShape = inputs[0], inputs[1]
        batchSize, numChannels = inputShape[0], inputShape[1]
        height, width = targetShape[2], targetShape[3]

        self.ystart = int((inputShape[2] - targetShape[2]) / 2)
        self.xstart = int((inputShape[3] - targetShape[3]) / 2)
        self.yend = self.ystart + height
        self.xend = self.xstart + width

        return [[batchSize, numChannels, height, width]]

    def forward(self, inputs):
        return [inputs[0][:,:,self.ystart:self.yend,self.xstart:self.xend]]

class StoryState:
    def __init__(self):
        self.current_images = []
        self.current_stories = []
        self.counter = 0
        
    def reset(self):
        self.__init__()

# Initialize global variables
story_state = StoryState()
net = None

def initialize_model():
    """Initialize the HED model once at startup"""
    global net
    
    # Check if model files exist
    prototxt_path = "deploy.prototxt"
    model_path = "hed_pretrained_bsds.caffemodel"
    
    if not os.path.exists(prototxt_path) or not os.path.exists(model_path):
        logger.error("Model files not found")
        raise FileNotFoundError(f"Required model files not found. Please ensure {prototxt_path} and {model_path} exist in the current directory.")

    # Register the custom crop layer only once
    cv.dnn_registerLayer('Crop', CropLayer)
    logger.debug("Registered CropLayer")
    
    # Load the model
    net = cv.dnn.readNetFromCaffe(prototxt_path, model_path)
    logger.debug("Loaded HED model")
    
    return net

def process_line_drawing(image_data, detail_level='medium'):
    """Convert captured image to line drawing using HED"""
    global net
    
    try:
        logger.debug("Starting process_line_drawing")
        
        # Verify image_data format
        logger.debug(f"Image data prefix: {image_data[:30]}...")
        
        # Convert base64 to image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
            logger.debug(f"Successfully decoded base64. Size: {len(image_bytes)} bytes")
        except Exception as e:
            logger.error(f"Base64 decode error: {str(e)}")
            raise ValueError("Invalid base64 image data")

        # Convert to numpy array
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv.imdecode(nparr, cv.IMREAD_COLOR)
            if image is None:
                raise ValueError("Failed to decode image")
            logger.debug(f"Successfully converted to image. Shape: {image.shape}")
        except Exception as e:
            logger.error(f"Image decode error: {str(e)}")
            raise

        # Calculate new dimensions maintaining aspect ratio
        max_dim = 256
        original_height, original_width = image.shape[:2]
        
        if original_height > original_width:
            new_height = max_dim
            new_width = int(original_width * (max_dim / original_height))
        else:
            new_width = max_dim
            new_height = int(original_height * (max_dim / original_width))
            
        # Resize image maintaining aspect ratio
        image = cv.resize(image, (new_width, new_height))
        logger.debug(f"Resized image to {new_width}x{new_height} maintaining aspect ratio")

        # Create blob from image
        inp = cv.dnn.blobFromImage(
            image,
            scalefactor=1.0,
            size=(new_width, new_height),
            mean=(104.00698793, 116.66876762, 122.67891434),
            swapRB=False,
            crop=False
        )
        logger.debug("Created blob")

        # Process with HED model
        try:
            net.setInput(inp)
            out = net.forward()
            logger.debug("Model inference completed")
        except Exception as e:
            logger.error(f"Model inference error: {str(e)}")
            raise

        # Format the output
        out = out[0, 0]
        # Resize back to original dimensions
        out = cv.resize(out, (original_width, original_height))
        out = cv.cvtColor(out, cv.COLOR_GRAY2BGR)
        out = 255 * out
        out = out.astype(np.uint8)
        logger.debug("Formatted output")

        # Convert to base64 for response
        _, buffer = cv.imencode('.png', out)
        line_drawing_base64 = base64.b64encode(buffer).decode('utf-8')
        logger.debug("Converted result to base64")
        
        return line_drawing_base64

    except Exception as e:
        logger.error(f"Error in line drawing conversion: {str(e)}")
        raise

@app.route('/process-line-drawing', methods=['POST', 'OPTIONS'])
def process_line_drawing_story():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        logger.debug("Received request for process-line-drawing")
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data received")
            return jsonify({'success': False, 'error': "No image data received"}), 400
            
        # Get detail level from request or use default
        detail_level = data.get('detail_level', 'medium')
        logger.debug(f"Processing with detail level: {detail_level}")
            
        # Process new image into line drawing
        try:
            line_drawing = process_line_drawing(data['image'], detail_level)
            logger.debug("Successfully processed line drawing")
            
            return jsonify({
                'success': True,
                'images': [line_drawing],
                'counter': story_state.counter
            })
        except Exception as e:
            logger.error(f"Error processing line drawing: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500
        
    except Exception as e:
        logger.error(f"Server Error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/generate-dialogue', methods=['POST', 'OPTIONS'])
def generate_dialogue():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': "No image data received"}), 400
            
        # Generate dialogue based on the current scene
        image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        position = data.get('position', {'x': 0.5, 'y': 0.5})
        previous_dialogue = data.get('previousDialogue', None)
        
        # Create the prompt based on whether there's previous dialogue
        prompt = "Generate a single short line of dialogue between these two characters in a movie scene. Use the facial expressions in the image to inform the tone of the dialogue and what you say. "
        if previous_dialogue:
            prompt += f"The other character just said: '{previous_dialogue}'. Respond to their statement. Make sure it is a new response as if this was a movie scene dialogue. "
        prompt += "Incorporate the doodles in the image as if they are real in the surrounding environment they are not doodles they are real! Make it brief and witty. Don't repeat the same sentiment or themes from previous dialogue."
        
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        }
                    }
                ]
            }],
            max_tokens=50
        )
        
        dialogue = response.choices[0].message.content
        
        return jsonify({
            'success': True,
            'dialogue': dialogue
        })
        
    except Exception as e:
        logger.error(f"Server Error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Configure logging to write to a file
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('app.log'),
            logging.StreamHandler()
        ]
    )
    
    # Check for model files and initialize the model before starting server
    try:
        net = initialize_model()
        logger.info("Successfully initialized HED model")
    except Exception as e:
        logger.error(f"Failed to initialize model: {str(e)}")
        print(f"ERROR: Failed to initialize model: {str(e)}")
        sys.exit(1)
    
    logger.info("Starting Flask server")
    app.run(port=5000, debug=True)