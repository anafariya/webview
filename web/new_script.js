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

// Initialize face mesh
function initializeFaceMesh() {
    faceMesh = new FaceMesh({ locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }});
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);
}

// Initialize camera and always show video feed
function initializeCamera() {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });  // Send frames to face mesh when scanning
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
            errorMessageElement.textContent = 'Failed to start camera: ' + error.message;
        });
}

startScanButton.addEventListener('click', () => {
    startScan();
});

function startScan() {
    analysisActive = true;
    startTime = Date.now();
    frameCount = 0;
    rgbValues = { r: [], g: [], b: [] };

    // Show the scan progress message
    scanProgressMessage.style.display = 'block';
    progressBox2.style.display = 'none'; // Hide progress box 2 when starting scan

    // Start the progress bar animation
    animateProgressBar();
}

function animateProgressBar() {
    const totalTime = 30000; // 30 seconds
    const interval = 100; // Update every 100 ms
    let progress = 0;

    const progressInterval = setInterval(() => {
        if (!analysisActive || progress >= 100) {
            clearInterval(progressInterval);
            return;
        }

        progress = ((Date.now() - startTime) / totalTime) * 100;
        progressValue.textContent = `${Math.floor(progress)}%`;
        progressCircle.style.background = `conic-gradient(
            #4caf50 ${progress * 3.6}deg,
            #ccc ${progress * 3.6}deg
        )`;

        // Check if 30 seconds have passed
        if (Date.now() - startTime >= totalTime) {
            analysisActive = false;
            console.log('Face analysis stopped after 30 seconds');
            console.log("Processing complete. RGB values:", rgbValues);
            callAPI();
        }
    }, interval);
}

function onResults(results) {
    if (!analysisActive) return; // Skip processing if analysis is not active

    frameCount++;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
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
        }
    }
    canvasCtx.restore();
}

function callAPI() {
    console.log('>>>>>callAPI');

    const apiUrl = 'https://w428omuxvc.execute-api.ap-south-1.amazonaws.com/prod/process-rppg';
    const data = {
        redChannel: rgbValues.r,
        greenChannel: rgbValues.g,
        blueChannel: rgbValues.b,
        "metadata": {
            "fps": 30,
            "user_id": "Q2zm7hvypyWUng1TIfGELpMPKPt1",
            "gender": "Male",
            "email": "test@example.com",
            "fullname": "John Doe"
        }
    };

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        console.log('API Response:', data);
        switchProgressBoxes(); // Switch progress boxes after API call
    })
    .catch((error) => {
        console.error('Error calling API:', error);
    });
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

function switchProgressBoxes() {
    progressBox1.style.display = 'none';
    progressBox2.style.display = 'flex';
}

window.addEventListener('load', () => {
    // Initialize the camera and face mesh on page load
    initializeFaceMesh();
    initializeCamera();
});

// Error handling for camera access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(function (stream) {
        console.log('Camera access granted');
    })
    .catch(function (error) {
        console.error('Error accessing the camera:', error);
        errorMessageElement.textContent = 'Failed to access camera: ' + error.message;
    });
