let faceMesh, camera;
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const colorDisplay = document.getElementsByClassName('color-display')[0];
const errorMessageElement = document.getElementById('error-message');
const progressBox1 = document.getElementsByClassName('progress-box-1')[0];
const progressBox2 = document.getElementsByClassName('progress-box-2')[0];
const startScanButton = document.getElementById('start-scan-button');
const progressCircle = document.getElementById('progress-circle');
const progressValue = document.getElementById('progress-value');
const scanProgressMessage = document.getElementById('scan-progress-message');
let analysisActive = false;
let rgbValues = { r: [], g: [], b: [] };
let frameCount = 0;
let startTime;
let capturedFrame = null;
let scanInterval = null;

function showErrorDialog(message) {
    const errorDialog = document.getElementById('error-dialog');
    const errorDialogMessage = document.getElementById('error-dialog-message');
    errorDialogMessage.textContent = message;
    errorDialog.style.display = 'block';
}

function closeErrorDialog() {
    const errorDialog = document.getElementById('error-dialog');
    errorDialog.style.display = 'none';
}

// Initialize face mesh
function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);
}

// Initialize camera
function initializeCamera() {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    camera.start()
        .then(() => {
            console.log('Camera started successfully');
        })
        .catch((error) => {
            console.error('Error starting camera:', error);
            showErrorDialog('Failed to start camera: ' + error.message);
        });
}

// Function to capture, compress, and convert frame to Base64
function captureCompressAndEncode(image, quality = 0.7) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // Compress and convert to Base64
        canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }, 'image/jpeg', quality);
    });
}
function onResults(results) {
    if (!analysisActive) return;

    frameCount++;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Flip the image horizontally
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);

    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
                { color: '#C0C0C070', lineWidth: 1 });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#FF3030' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#30FF30' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });

            // Perform color analysis only for frames 100 to 600
            if (frameCount >= 100 && frameCount <= 600) {
                const color = processFrame(results.image, landmarks);
                if (color) {
                    rgbValues.r.push(color[0]);
                    rgbValues.g.push(color[1]);
                    rgbValues.b.push(color[2]);
                    updateColorDisplay(color);
                }
            }

            // Capture and process the 101st frame
            if (frameCount === 101 && !capturedFrame) {
                captureCompressAndEncode(results.image)
                    .then(base64Image => {
                        capturedFrame = base64Image.replace("data:image/jpeg;base64,", "");
                        console.log('Compressed Base64 encoded 101st frame:', capturedFrame);

                        // You can send this base64Image to your server or use it as needed
                    });
            }
        }
    }
    canvasCtx.restore();
}

function processFrame(image, landmarks) {
    const regions = {
        forehead: [10, 108, 151, 9, 336, 337, 338, 339, 340],
        rightCheek: [36, 31, 39, 0, 267, 269, 270, 409],
        leftCheek: [266, 261, 269, 230, 37, 39, 40, 185]
    };

    const allRegionsColors = [];

    for (const [regionName, indices] of Object.entries(regions)) {
        const regionPoints = indices.map(index => ({
            x: landmarks[index].x * image.width,
            y: landmarks[index].y * image.height
        }));

        const minX = Math.min(...regionPoints.map(p => p.x));
        const maxX = Math.max(...regionPoints.map(p => p.x));
        const minY = Math.min(...regionPoints.map(p => p.y));
        const maxY = Math.max(...regionPoints.map(p => p.y));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maxX - minX;
        tempCanvas.height = maxY - minY;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(image, minX, minY, tempCanvas.width, tempCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            count++;
        }

        if (count > 0) {
            allRegionsColors.push([sumR / count, sumG / count, sumB / count]);
        }
    }

    if (allRegionsColors.length > 0) {
        const avgColor = allRegionsColors.reduce((acc, color) => [
            acc[0] + color[0] / allRegionsColors.length,
            acc[1] + color[1] / allRegionsColors.length,
            acc[2] + color[2] / allRegionsColors.length
        ], [0, 0, 0]);

        return avgColor.map(Math.round);
    }

    return null;
}

function updateColorDisplay(color) {
    const colorString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    colorDisplay.textContent = `Average Color: ${colorString}`;
}

function startScan() {
    if (analysisActive) {
        // Cancel scan
        analysisActive = false;
        resetValues();
        clearInterval(scanInterval);
        startScanButton.textContent = 'Start Scan';
        scanProgressMessage.style.display = 'none';
        progressBox1.style.display = 'flex';
        progressBox2.style.display = 'none';
    } else {
        // Start scan
        analysisActive = true;
        startTime = Date.now();
        frameCount = 0;
        capturedFrame = null;
        rgbValues = { r: [], g: [], b: [] };

        scanProgressMessage.style.display = 'block';
        progressBox2.style.display = 'none';
        startScanButton.textContent = 'Cancel';

        animateProgressBar();
    }
}

function resetValues() {
    frameCount = 0;
    rgbValues = { r: [], g: [], b: [] };
    capturedFrame = null;
    progressValue.textContent = '0%';
    progressCircle.style.background = 'conic-gradient(#ccc 0deg, #ccc 360deg)';
    colorDisplay.textContent = '';
    scanProgressMessage.textContent = 'Scan in progress...';
}

function animateProgressBar() {
    const duration = 20000; // 20 seconds
    const updateInterval = 100; // 100ms

    const startTime = Date.now();
    scanInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const progressDegrees = progress * 360;
        const progressPercent = Math.floor(progress * 100);

        progressCircle.style.background = `conic-gradient(#4d5bf9 ${progressDegrees}deg, #ccc ${progressDegrees}deg)`;
        progressValue.textContent = `${progressPercent}%`;

        if (progress >= 1) {
            clearInterval(scanInterval);
            completeScan();
        }
    }, updateInterval);
}

function completeScan() {
    analysisActive = false;
    startScanButton.textContent = 'Start Scan';
    scanProgressMessage.style.display = 'none';
    progressBox1.style.display = 'none';
    progressBox2.style.display = 'flex';

    const avgR = rgbValues.r.reduce((a, b) => a + b, 0) / rgbValues.r.length;
    const avgG = rgbValues.g.reduce((a, b) => a + b, 0) / rgbValues.g.length;
    const avgB = rgbValues.b.reduce((a, b) => a + b, 0) / rgbValues.b.length;

    colorDisplay.textContent = `Average Color: rgb(${Math.round(avgR)}, ${Math.round(avgG)}, ${Math.round(avgB)})`;
    console.log('Average R:', avgR);
    console.log('Average G:', avgG);
    console.log('Average B:', avgB);
}

startScanButton.addEventListener('click', startScan);
document.getElementById('error-dialog-close').addEventListener('click', closeErrorDialog);

window.addEventListener('load', () => {
    initializeFaceMesh();
    initializeCamera();
});
