import cv2 as cv
import numpy as np

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

# Load and register the custom crop layer
cv.dnn_registerLayer('Crop', CropLayer)

# Load the model
net = cv.dnn.readNetFromCaffe("deploy.prototxt", "hed_pretrained_bsds.caffemodel")

# Read and process image
image = cv.imread("head.jpg")
width = 256  # You can adjust these dimensions
height = 256
image = cv.resize(image, (width, height))

# Create blob from image
inp = cv.dnn.blobFromImage(
    image, 
    scalefactor=1.0, 
    size=(width, height),
    mean=(104.00698793, 116.66876762, 122.67891434),
    swapRB=False, 
    crop=False
)

# Process the image
net.setInput(inp)
out = net.forward()
out = out[0, 0]
out = cv.resize(out, (image.shape[1], image.shape[0]))

# Convert to proper format
out = cv.cvtColor(out, cv.COLOR_GRAY2BGR)
out = 255 * out
out = out.astype(np.uint8)

# Save both original and processed images side by side
result = np.concatenate((image, out), axis=1)
cv.imwrite('head_processed.jpg', result)

# Optionally display the result
cv.imshow("Result", result)
cv.waitKey(0)
cv.destroyAllWindows()