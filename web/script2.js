let faceMesh, camera;
const videoElement = document.getElementsByClassName("input_video")[0];
videoElement.style.transform = "scaleX(-1)";

const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");
const colorDisplay = document.getElementsByClassName("color-display")[0];
const errorMessageElement = document.getElementById("error-message");
const progressBox1 = document.getElementsByClassName("progress-box-1")[0];
const progressBox2 = document.getElementsByClassName("progress-box-2")[0];
const startScanButton = document.getElementById("start-scan-button");
const backToHomeButton = document.getElementById("homepage-button");

const progressCircle = document.getElementById("progress-circle");
const progressValue = document.getElementById("progress-value");
const scanProgressMessage = document.getElementById("scan-progress-message");
let analysisActive = false;
let rgbValues = { r: [], g: [], b: [] };
let frameCount = 0;
let startTime;
let capturedFrame = null;
let userEmail = null;
let userName = null;
let userGender = null;
let userUid = null;
let userHeight = null;
let userWeight = null;
let userWaist = null;
let userAge = null;
let fpsStartTime = null;
let scanInterval = null;

let lastFrameTime = Date.now();
let frameSkip = 2; // Process every third frame
let frameCounter = 0;

function sendMessageToFlutter(message) {
  window.parent.postMessage(message, "*");
}

function showErrorDialog(message) {
  const errorDialog = document.getElementById("error-dialog");

  const errorDialogMessage = document.getElementById("error-dialog-message");

  errorDialogMessage.textContent = message;

  errorDialog.style.display = "block";
}

function closeErrorDialog() {
  const errorDialog = document.getElementById("error-dialog");

  errorDialog.style.display = "none";
}

function showLoadingIndicator() {
  document.getElementById("loading-indicator").style.display = "block";
  document.querySelector("body").style.overflow = "hidden";
}

function hideLoadingIndicator() {
  document.getElementById("loading-indicator").style.display = "none";
  document.querySelector("body").style.overflow = "auto";
}

window.addEventListener("message", function (event) {
  console.log(event);
  console.log(`FROM [addEventListener] ${event.data}`);
  if (event.data.includes("waist:")) {
    userWaist = Number(event.data.split(":")[1]);
  }
  if (event.data.includes("height:")) {
    userHeight = Number(event.data.split(":")[1]);
  }
  if (event.data.includes("weight:")) {
    userWeight = Number(event.data.split(":")[1]);
  }
  if (event.data.includes("age:")) {
    userAge = Number(event.data.split(":")[1]);
  }
  if (event.data.includes("email:")) {
    userEmail = event.data.split(":")[1];
  }
  if (event.data.includes("name:")) {
    userName = event.data.split(":")[1];
  }
  if (event.data.includes("gender:")) {
    userGender = event.data.split(":")[1];
  }
  if (event.data.includes("uid:")) {
    userUid = event.data.split(":")[1];
  }
});

window.customEmailFunction = function (data) {
  console.log(data);
};

// Initialize face mesh
function initializeFaceMesh() {
  try {
    faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false, // Disable refining landmarks
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onResults);

    console.log("FaceMesh initialized");
  } catch (error) {
    console.error("Error initializing FaceMesh:", error);
  }
}

function captureCompressAndEncode(image, quality = 0.7) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function onResults(results) {
  frameCounter++;
  if (frameCounter % frameSkip !== 0) return; // Skip frames based on frameSkip

  if (results.multiFaceLandmarks.length === 0) {
    initValues();
    showErrorDialog("No face detected.\nPlace your face in front of camera.");
    return;
  } else {
    closeErrorDialog();
  }

  if (!analysisActive) return;

  frameCount++;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.scale(-1, 1);
  canvasCtx.translate(-canvasElement.width, 0);

  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
      });
      // Only draw essential elements to reduce processing load
      // Remove or comment out other unnecessary drawing functions
    }
  }
  canvasCtx.restore();
}

function processFrame(image, landmarks) {
  const regions = {
    forehead: [10, 108, 151, 9, 336, 337, 338, 339, 340],
    rightCheek: [36, 31, 39, 0, 267, 269, 270, 409],
    leftCheek: [266, 261, 269, 230, 37, 39, 40, 185],
  };

  const allRegionsColors = [];

  for (const [regionName, indices] of Object.entries(regions)) {
    const regionPoints = indices.map((index) => ({
      x: landmarks[index].x * image.width,
      y: landmarks[index].y * image.height,
    }));

    const minX = Math.min(...regionPoints.map((p) => p.x));
    const maxX = Math.max(...regionPoints.map((p) => p.x));
    const minY = Math.min(...regionPoints.map((p) => p.y));
    const maxY = Math.max(...regionPoints.map((p) => p.y));

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = maxX - minX;
    tempCanvas.height = maxY - minY;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(
      image,
      minX,
      minY,
      tempCanvas.width,
      tempCanvas.height,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

    const imageData = tempCtx.getImageData(
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );
    const data = imageData.data;

    let sumR = 0,
      sumG = 0,
      sumB = 0,
      count = 0;
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
    const avgColor = allRegionsColors.reduce(
      (acc, color) => [
        acc[0] + color[0] / allRegionsColors.length,
        acc[1] + color[1] / allRegionsColors.length,
        acc[2] + color[2] / allRegionsColors.length,
      ],
      [0, 0, 0]
    );

    return avgColor.map(Math.round);
  }

  return null;
}

function startScan() {
  if (analysisActive) {
    analysisActive = false;

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    clearInterval(scanInterval);

    progressValue.textContent = "0%";
    progressCircle.style.background = `conic-gradient(
            #ccc 0deg,
            #ccc 360deg
        )`;

    startScanButton.textContent = "Start Scan";
    scanProgressMessage.style.display = "none";
    progressBox1.style.display = "flex";
    progressBox2.style.display = "none";
  } else {
    analysisActive = true;
    startTime = Date.now();
    frameCount = 0;
    fpsStartTime = Date.now();
    capturedFrame = null;
    rgbValues = { r: [], g: [], b: [] };

    scanProgressMessage.style.display = "block";
    progressBox2.style.display = "none";
    startScanButton.textContent = "Cancel";

    animateProgressBar();
  }
}

function initValues() {
  frameCount = 0;
  rgbValues = { r: [], g: [], b: [] };
  analysisActive = true;
  startTime = Date.now();
  frameCount = 0;
  fpsStartTime = Date.now();
  capturedFrame = null;

  rgbValues = { r: [], g: [], b: [] };

  scanProgressMessage.style.display = "block";

  progressBox2.style.display = "none";
}

function resetValues() {
  frameCount = 0;

  rgbValues = { r: [], g: [], b: [] };

  capturedFrame = null;

  progressValue.textContent = "0%";

  progressCircle.style.background = "conic-gradient(#ccc 0deg, #ccc 360deg)";

  colorDisplay.textContent = "";

  scanProgressMessage.textContent = "Scan in progress...";
}

function animateProgressBar() {
  const totalTime = 30000;
  const interval = 100;
  let progress = 0;

  const progressInterval = setInterval(() => {
    if (!analysisActive || progress >= 100) {
      clearInterval(progressInterval);
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      return;
    }

    progress = ((Date.now() - startTime) / totalTime) * 100;
    progressValue.textContent = `${Math.floor(progress)}%`;
    progressCircle.style.background = `conic-gradient(
            #4caf50 ${progress * 3.6}deg,
            #ccc ${progress * 3.6}deg
        )`;

    if (Date.now() - startTime >= totalTime) {
      analysisActive = false;
      console.log("Face analysis stopped after 30 seconds");
      console.log("Processing complete. RGB values:", rgbValues.r.length);

      checkCapturedFrameAndCallApi();

      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
  }, interval);
}

function updateFPS() {
  const now = Date.now();
  const deltaTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  const fps = Math.round(1 / deltaTime);

  const fpsValueElement = document.getElementById('fps-value');
  const fpsMessageElement = document.getElementById('fps-message');

  fpsValueElement.textContent = fps;

  if (fps < 30) {
    fpsMessageElement.style.color = 'red';
    document.getElementById('low-fps-message').style.display = 'block';
  } else {
    fpsMessageElement.style.color = '#333';
    document.getElementById('low-fps-message').style.display = 'none';
  }
}

function checkCapturedFrameAndCallApi() {
  if (capturedFrame != null) {
    callAPI();
  } else {
    setTimeout(checkCapturedFrameAndCallApi, 2000);
  }
}

function callAPI() {
  console.log(">>>>>callAPI");
  console.log(">>>>>callAPI Email:-- ", userEmail);
  console.log(">>>>>callAPI Gender:-- ", userGender);
  console.log(">>>>>callAPI Uid:-- ", userUid);
  console.log(">>>>>callAPI Name:-- ", userName);

  const elapsedTime = (Date.now() - fpsStartTime) / 1000;
  const fps = frameCount / elapsedTime;
  console.log(">>>>>callAPI FPS:-- ", fps);

  const apiUrl =
    "https://w428omuxvc.execute-api.ap-south-1.amazonaws.com/prod/process-rppg";
  const data = {
    redChannel: rgbValues.r,
    greenChannel: rgbValues.g,
    blueChannel: rgbValues.b,
    image: capturedFrame,
    metadata: {
      fps: Math.round(fps),
      user_id: userUid,
      gender: userGender,
      email: userEmail,
      fullname: userName,
      height: userHeight,
      weight: userWeight,
      waist: userWaist,
      age: userAge,
    },
  };

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("API Response:", data);
      console.log(data);

      switchProgressBoxes();
      sendMessageToFlutter("DONE");
    })
    .catch((error) => {
      console.error("Error calling API:", error);
      showErrorDialog("Error calling API: " + error.message);
    });
}

function initializeCamera() {
  return new Promise((resolve, reject) => {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
        updateFPS(); // Call updateFPS to show the current FPS
      },
      width: 1920, // Lower resolution to 1280x720 for better performance
      height: 1080, // Lower resolution to 1280x720 for better performance
    });
    camera
      .start()
      .then(() => {
        console.log("Camera started successfully");
        resolve();
        document.getElementById('current-resolution').textContent = 'Current Resolution: 1280x720'; // Update the displayed resolution
      })
      .catch((error) => {
        console.error("Error starting camera:", error);
        reject(error);
        showErrorDialog("Failed to start camera: Try updating your Browser");
      });
  });
}

function switchProgressBoxes() {
  progressBox1.style.display = "none";
  progressBox2.style.display = "flex";
}

startScanButton.addEventListener("click", startScan);

backToHomeButton.addEventListener("click", backToHome);

function backToHome() {
  sendMessageToFlutter("BACK_TO_HOME");
}

window.addEventListener("load", () => {
  showLoadingIndicator();
  initializeFaceMesh();
  initializeCamera()
    .then(() => {
      setTimeout(() => {
        hideLoadingIndicator();
        document.getElementsByClassName("progress-box-1")[0].style.display =
          "block";
        document.getElementById("fps-box").style.display = "block"; // Ensure FPS box is displayed
      }, 2000);
    })
    .catch((error) => {
      console.error("Error initializing camera:", error);
      hideLoadingIndicator();
      showErrorDialog("Failed to start camera: " + error.message);
    });
});

function clearCanvas() {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

function stopFaceMeshProcessing() {
  analysisActive = false;
  clearCanvas();
}

document
  .getElementById("error-dialog-close")
  .addEventListener("click", closeErrorDialog);

navigator.mediaDevices
  .getUserMedia({
    video: true,
  })
  .then(function (stream) {
    console.log("Camera access granted");
  })
  .catch(function (error) {
    console.error("Error accessing the camera:", error);
    errorMessageElement.textContent =
      "Failed to access camera: " + error.message;
  });
