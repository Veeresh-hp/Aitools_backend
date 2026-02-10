import os
import cv2
import numpy as np
import requests

# AI Models Configuration
MODELS = {
    "fast": {
        "name": "fsrcnn",
        "filename": "fscrcnn_x4.pb", # Note: Kept typo to match existing file on disk if present
        "url": "https://github.com/Saafke/FSRCNN_Tensorflow/raw/master/models/FSRCNN_x4.pb",
        "scale": 4,
        "desc": "Fast AI (FSRCNN)"
    },
    "quality": {
        "name": "edsr",
        "filename": "edsr_x4.pb",
        "url": "https://github.com/Saafke/EDSR_Tensorflow/raw/master/models/EDSR_x4.pb",
        "scale": 4,
        "desc": "Premium AI (EDSR)"
    }
}

def download_model(mode="fast"):
    config = MODELS[mode]
    model_path = os.path.join(os.path.dirname(__file__), config["filename"])
    
    if not os.path.exists(model_path):
        print(f"Downloading {config['desc']} model...")
        response = requests.get(config["url"], stream=True)
        with open(model_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Model downloaded successfully.")
    return model_path

def premium_ai_upscale(input_path, output_path, mode="fast", target_width=3840):
    # Default to fast if invalid mode provided
    if mode not in MODELS:
        mode = "fast"
        
    print(f"Starting Enhancement using {MODELS[mode]['desc']}...")
    model_path = download_model(mode)
    
    # 1. Load Image
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Could not read image at {input_path}")
        return

    # 2. Pre-processing
    print("Pre-processing: Cleaning image noise...")
    if mode == "fast":
        # Lighter denoising for speed
        denoised = cv2.bilateralFilter(img, d=5, sigmaColor=30, sigmaSpace=30)
    else:
        # Stronger denoising for quality (EDSR)
        denoised = cv2.bilateralFilter(img, d=7, sigmaColor=50, sigmaSpace=50)

    # 3. Scale Calculation
    h, w = denoised.shape[:2]
    model_scale = MODELS[mode]["scale"]
    required_input_width = target_width // model_scale
    
    if w != required_input_width:
        scale = required_input_width / w
        img_for_ai = cv2.resize(denoised, (required_input_width, int(h * scale)), interpolation=cv2.INTER_CUBIC)
    else:
        img_for_ai = denoised

    # 4. AI Upscale
    print(f"Applying AI Super-Resolution ({MODELS[mode]['name']})...")
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model_path)
    sr.setModel(MODELS[mode]["name"], model_scale)
    
    # Process AI upscale
    ai_output = sr.upsample(img_for_ai)

    # 5. Fusion Pipeline
    print("Fusion Stage: Blending for natural photorealistic quality...")
    traditional_upscale = cv2.resize(img_for_ai, (ai_output.shape[1], ai_output.shape[0]), interpolation=cv2.INTER_LANCZOS4)
    
    if mode == "fast":
        # Simple blend for speed
        final_output = cv2.addWeighted(ai_output, 0.80, traditional_upscale, 0.20, 0)
    else:
        # Detailed blend for quality
        final_output = cv2.addWeighted(ai_output, 0.85, traditional_upscale, 0.15, 0)
        
        # Extra sharpening for quality mode
        gaussian_blur = cv2.GaussianBlur(final_output, (0, 0), 3)
        final_output = cv2.addWeighted(final_output, 1.2, gaussian_blur, -0.2, 0)

    # 7. Save output
    print(f"Final Output Resolution: {final_output.shape[1]}x{final_output.shape[0]}")
    cv2.imwrite(output_path, final_output, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"Success! Saved Enhanced Image to: {output_path}")
    return output_path

if __name__ == "__main__":
    # Test block handled via args if needed, but primarily used as module
    pass
