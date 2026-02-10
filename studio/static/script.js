const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('result-area');
const imgBefore = document.getElementById('img-before');
const imgAfter = document.getElementById('img-after');
const comparisonContainer = document.getElementById('comparison-container');
const sliderHandle = document.querySelector('.slider-handle');
const beforeWrapper = document.querySelector('.image-wrapper.before');

// Drag & Drop
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleUpload(fileInput.files[0]);
});

let timerInterval;

async function handleUpload(file) {
    if (!file.type.startsWith('image/')) return alert('Please upload an image file');

    // Show loading
    uploadArea.classList.add('hidden');
    resultArea.classList.add('hidden');
    loading.classList.remove('hidden');

    // Reset and start timer
    const timerElement = document.getElementById('timer');
    const loadingModeText = document.getElementById('loading-mode-text');
    const mode = document.querySelector('input[name="enhance-mode"]:checked').value;
    
    loadingModeText.textContent = mode === 'fast' ? "Using Fast AI (FSRCNN)..." : "Using Premium AI (EDSR)...";

    let seconds = 0;
    timerElement.textContent = "Time Elapsed: 0s";
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        timerElement.textContent = `Time Elapsed: ${seconds}s`;
        
        if (mode === 'quality') {
             if (seconds > 10) timerElement.textContent += " (Warming up Premium Model...)";
             if (seconds > 30) timerElement.textContent += " (This takes longer for best quality...)";
        }
    }, 1000);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const controller = createController(); // Create new signal

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData, signal: controller.signal });
        const data = await response.json();

        clearInterval(timerInterval); // Stop timer

        if (data.error) throw new Error(data.error);

        // Setup Comparison
        imgBefore.onload = () => enhancerSlider.adjust(); // Ensure layout calculates after load
        imgBefore.src = data.original_url;
        imgAfter.src = data.enhanced_url;

        document.getElementById('download-btn').href = data.enhanced_url;
        
        loading.classList.add('hidden');
        resultArea.classList.remove('hidden');

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Upload cancelled');
            return; // Exit silently
        }
        clearInterval(timerInterval); // Stop timer on error
        alert('Error enhancing image: ' + error.message);
        location.reload();
    }
}

// Comparison Slider Logic
// ==========================================
// GENERIC COMPARISON SLIDER LOGIC
// ==========================================
class ComparisonSlider {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.imgBefore = this.container.querySelector('.before img');
        this.imgAfter = this.container.querySelector('.after img');
        this.sliderHandle = this.container.querySelector('.slider-handle');
        this.beforeWrapper = this.container.querySelector('.before');
        this.isDown = false;

        this.initEvents();
    }

    initEvents() {
        this.container.addEventListener('mousedown', (e) => { this.isDown = true; this.move(e); });
        window.addEventListener('mouseup', () => this.isDown = false);
        this.container.addEventListener('mousemove', (e) => { if (this.isDown) this.move(e); });

        this.container.addEventListener('touchstart', (e) => { this.isDown = true; this.move(e); });
        window.addEventListener('touchend', () => this.isDown = false);
        this.container.addEventListener('touchmove', (e) => { if (this.isDown) this.move(e); });

        window.addEventListener('resize', () => this.adjust());
        
        // Initial adjust when images load
        if(this.imgBefore) this.imgBefore.onload = () => this.adjust();
    }

    adjust() {
        const w = this.container.offsetWidth;
        this.imgBefore.style.width = w + 'px';
        this.imgAfter.style.width = w + 'px';
    }

    move(e) {
        const rect = this.container.getBoundingClientRect();
        let x = (e.clientX || e.touches[0].clientX) - rect.left;
        
        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;

        const percent = (x / rect.width) * 100;
        this.beforeWrapper.style.width = percent + "%";
        this.sliderHandle.style.left = percent + "%";
    }
}

// Initialize Sliders
const enhancerSlider = new ComparisonSlider('comparison-container');
const removerSlider = new ComparisonSlider('remover-comparison-container');



document.getElementById('reset-btn').addEventListener('click', () => {
    location.reload();
});

// ==========================================
// CANCELLATION LOGIC
// ==========================================
let currentController = null;

function createController() {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    return currentController;
}

function cancelProcessing() {
    if (currentController) {
        currentController.abort();
        currentController = null;
    }
    clearInterval(timerInterval);
    
    // Hide loadings, Show Uploads
    loading.classList.add('hidden');
    removerLoading.classList.add('hidden');
    
    // Determine which tab is active to decide what to show
    if (document.getElementById('enhancer-tool').classList.contains('hidden')) {
        // Remover Tab is active
        // Don't fully reset, maybe they just want to stop and draw again?
        canvasContainer.classList.remove('hidden'); 
    } else {
        // Enhancer Tab
        uploadArea.classList.remove('hidden');
    }
}

document.getElementById('cancel-btn').addEventListener('click', cancelProcessing);
document.getElementById('remover-cancel-btn').addEventListener('click', cancelProcessing);


// ==========================================
// LOGO REMOVER LOGIC
// ==========================================

// Tabs Logic
const tabs = document.querySelectorAll('.tab-btn');
const tools = document.querySelectorAll('.tool-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Cancel any ongoing process logic
        cancelProcessing();

        // Switch Active Tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Switch Content
        const targetId = tab.getAttribute('data-tab');
        tools.forEach(tool => {
            if (tool.id === targetId) tool.classList.remove('hidden');
            else tool.classList.add('hidden');
        });
    });
});


// Remover Logic Vars
const removerUploadArea = document.getElementById('remover-upload-area');
const removerFileInput = document.getElementById('remover-file-input');
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('image-canvas');
const ctx = canvas.getContext('2d');
const brushSizeInput = document.getElementById('brush-size');
const clearMaskBtn = document.getElementById('clear-mask-btn');
const removeBtn = document.getElementById('remove-btn');
const removerLoading = document.getElementById('remover-loading');
const removerResult = document.getElementById('remover-result');
const removerImgResult = document.getElementById('remover-img-result');

const removerQueueContainer = document.getElementById('remover-queue');
let removerQueue = [];
let currentQueueIndex = -1;

let originalImage = new Image();
let isDrawing = false;
let currentFile = null;

// Remover Upload Handling
removerUploadArea.addEventListener('click', () => removerFileInput.click());
removerFileInput.addEventListener('change', () => {
    if (removerFileInput.files.length) handleRemoverFiles(removerFileInput.files);
});

function handleRemoverFiles(files) {
    // Add to queue (max 5)
    removerQueue = Array.from(files).slice(0, 5); 
    
    if (removerQueue.length === 0) return;
    
    renderQueue();
    selectQueueItem(0);
    
    removerUploadArea.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    removerQueueContainer.classList.remove('hidden');
}

function renderQueue() {
    removerQueueContainer.innerHTML = '';
    removerQueue.forEach((file, index) => {
        const img = document.createElement('img');
        img.className = 'queue-item';
        img.src = URL.createObjectURL(file);
        img.onclick = () => selectQueueItem(index);
        removerQueueContainer.appendChild(img);
    });
}

function selectQueueItem(index) {
    if (index < 0 || index >= removerQueue.length) return;
    
    currentQueueIndex = index;
    currentFile = removerQueue[index];
    
    // Highlight active
    document.querySelectorAll('.queue-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });

    loadImageToCanvas(currentFile);
}

function loadImageToCanvas(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            const maxWidth = 800;
            let w = originalImage.width;
            let h = originalImage.height;
            
            if (w > maxWidth) {
                h = Math.round(h * (maxWidth / w));
                w = maxWidth;
            }

            canvas.width = w;
            canvas.height = h;

            drawBaseImage();
            setTimeout(initMaskCanvas, 100);
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
// Removed old initRemover definition


function drawBaseImage() {
    // We draw the image, and then we will draw the MASK on top of it.
    // Actually for inpainting API, we need a separate mask. 
    // Visualize: Draw Image background. Draw Red semi-transparent brush on top.
    
    // For the backend, we need the MASK strictly black/white.
    // Strategy: 
    // 1. We see the image on canvas.
    // 2. We allow user to draw (Red lines).
    // 3. When submitting, we create a temporary canvas to generate the B/W mask.
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
}

// Drawing Logic
function startDraw(e) {
    isDrawing = true;
    draw(e);
}
function stopDraw() {
    isDrawing = false;
    ctx.beginPath(); // Reset path
}
function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    // Support touch and mouse
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineWidth = brushSizeInput.value;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Visual feedback: Red semi-transparent

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Store drawing strokes or just rely on canvas pixel data?
    // Relying on canvas pixel data means we can't separate image from mask easily 
    // unless we use layers.
    // SIMPLER APPROACH: Keep track of points or use a second off-screen canvas for the mask.
    
    drawMaskOnHiddenCanvas(x, y);
}

// Hidden Mask Canvas
const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d');

function initMaskCanvas() {
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.lineCap = 'round';
    maskCtx.strokeStyle = 'white';
}
// Hook this into initRemover
const originalInit = initRemover;
initRemover = function(file) {
    originalInit(file);
    setTimeout(initMaskCanvas, 100); // Wait for canvas sizing
}

function drawMaskOnHiddenCanvas(x, y) {
    maskCtx.lineWidth = brushSizeInput.value;
    maskCtx.lineTo(x, y);
    maskCtx.stroke();
    maskCtx.beginPath();
    maskCtx.moveTo(x, y);
}

// Events
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mousemove', draw);
// Touch
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
canvas.addEventListener('touchend', stopDraw);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });

clearMaskBtn.addEventListener('click', () => {
    drawBaseImage();
    initMaskCanvas();
});

// Toast Logic
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 3000);
}

function isMaskEmpty() {
    const pixelData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    // Check alpha channel (every 4th byte). If any is > 0, mask is not empty.
    for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) return false;
    }
    return true;
}

// 2. Remove Button Logic
removeBtn.addEventListener('click', async () => {
    // Validation
    if (isMaskEmpty()) {
        showToast("⚠️ Please paint over the area you want to remove first!", "error");
        return;
    }

    // 1. Get Mask Blob
    maskCanvas.toBlob(async (maskBlob) => {
        removerLoading.classList.remove('hidden');
        canvasContainer.classList.add('hidden');
        removerQueueContainer.classList.add('hidden'); // Hide queue during process

        const formData = new FormData();
        formData.append('image', currentFile);
        formData.append('mask', maskBlob, 'mask.png');

        const controller = createController();

        try {
            const response = await fetch('/remove-logo', { method: 'POST', body: formData, signal: controller.signal });
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            removerImgResult.src = data.cleaned_url;
            document.getElementById('remover-img-original').src = originalImage.src; // Set original for comparison
            
            document.getElementById('remover-download-btn').href = data.cleaned_url;

            removerLoading.classList.add('hidden');
            removerResult.classList.remove('hidden');
            
            // Adjust slider after images are visible
            setTimeout(() => removerSlider.adjust(), 100);
            
            showToast("Object removed successfully! ✨", "info");
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Removal cancelled');
                return;
            }
            showToast('Error: ' + error.message, "error");
            location.reload();
        }
    });
});


document.getElementById('remover-reset-btn').addEventListener('click', resetRemover);

function resetRemover() {
    // Stop any processing
    cancelProcessing();
    
    // Clear State
    currentFile = null;
    removerQueue = [];
    currentQueueIndex = -1;
    isDrawing = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // UI Reset
    removerResult.classList.add('hidden');
    canvasContainer.classList.add('hidden');
    removerQueueContainer.classList.add('hidden');
    removerLoading.classList.add('hidden');
    removerUploadArea.classList.remove('hidden');
    
    // Don't reload, keeping tab active
}

document.getElementById('remover-retry-btn').addEventListener('click', async () => {
    // Refine Logic: Use the Cleaned Result as the new "Original" to edit further
    const resultSrc = removerImgResult.src; // http://.../...jpg
    
    if (!resultSrc) return;

    try {
        // We need to convert this URL back to a File/Blob to treat it as 'currentFile'
        // for the next upload
        const res = await fetch(resultSrc);
        const blob = await res.blob();
        const file = new File([blob], "refined_image.jpg", { type: "image/jpeg" });
        
        // Update current file
        currentFile = file;
        
        // Re-init canvas with this new image
        originalImage = new Image();
        originalImage.onload = () => {
            // Update Canvas Dimensions if needed (should match, but safe to re-set)
             const maxWidth = 800;
            let w = originalImage.width;
            let h = originalImage.height;
            
            if (w > maxWidth) {
                h = Math.round(h * (maxWidth / w));
                w = maxWidth;
            }

            canvas.width = w;
            canvas.height = h;

            // Draw new base
            drawBaseImage();
            
            // Allow drawing a new mask
            initMaskCanvas(); 
            
            // Switch UI
            removerResult.classList.add('hidden');
            removerLoading.classList.add('hidden');
            canvasContainer.classList.remove('hidden');
        };
        originalImage.src = resultSrc;
        
    } catch (e) {
        alert("Failed to load image for refinement: " + e.message);
    }
});
