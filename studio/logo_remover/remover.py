import cv2
import numpy as np
import os
import onnxruntime as ort

class LamaInpainter:
    def __init__(self, model_path):
        self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        self.input_name_img = self.session.get_inputs()[0].name
        self.input_name_mask = self.session.get_inputs()[1].name
        self.output_name = self.session.get_outputs()[0].name

    def preprocess(self, img_rgb, mask):
        # Resize to 512x512
        img_512 = cv2.resize(img_rgb, (512, 512), interpolation=cv2.INTER_AREA)
        mask_512 = cv2.resize(mask, (512, 512), interpolation=cv2.INTER_NEAREST)

        # Normalize to 0-1 range float32
        img_512 = img_512.astype(np.float32) / 255.0
        mask_512 = mask_512.astype(np.float32) / 255.0
        
        # Ensure mask is (1, 1, 512, 512)
        if len(mask_512.shape) == 3:
            mask_512 = mask_512[:, :, 0]
        
        # Add batch and channel dimensions (NCHW)
        img_tensor = np.transpose(img_512, (2, 0, 1))[np.newaxis, ...]
        mask_tensor = mask_512[np.newaxis, np.newaxis, ...]

        return img_tensor, mask_tensor

    def postprocess(self, result, original_shape):
        # Result is (1, 3, 512, 512)
        result = np.squeeze(result, axis=0)
        result = np.transpose(result, (1, 2, 0))
        
        # Detect range: if already 0-255, don't multiply. If 0-1, multiply.
        if result.max() <= 1.2: 
            result = (result * 255).clip(0, 255).astype(np.uint8)
        else:
            result = result.clip(0, 255).astype(np.uint8)
        
        # Resize back to original dimensions
        result = cv2.resize(result, (original_shape[1], original_shape[0]), interpolation=cv2.INTER_LANCZOS4)
        
        return result

    def inpaint(self, img, mask):
        original_shape = img.shape
        
        # 1. Prepare RGB version for the AI model
        if len(original_shape) == 3 and original_shape[2] == 4:
            img_rgb_input = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
        elif len(original_shape) == 3 and original_shape[2] == 3:
            img_rgb_input = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        else:
            img_rgb_input = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

        # 2. Inference (on 512x512)
        img_pre, mask_pre = self.preprocess(img_rgb_input, mask)
        outputs = self.session.run([self.output_name], {
            self.input_name_img: img_pre,
            self.input_name_mask: mask_pre
        })
        
        # 3. Postprocess and Upscale (RGB)
        result_rgb = self.postprocess(outputs[0], original_shape)
        
        # 4. Professional Sharpening: Apply Unsharp Mask only to the result
        # This compensates for the upscale blur
        blur = cv2.GaussianBlur(result_rgb, (0, 0), 3)
        result_sharp_rgb = cv2.addWeighted(result_rgb, 1.6, blur, -0.6, 0)
        
        # 5. BIT-PERFECT SURGICAL REPLACEMENT
        # We start with the ABSOLUTE ORIGINAL image (binary bytes)
        # and only overwrite the pixels within the mask.
        final_result = img.copy()
        
        # Align mask to original resolution
        if mask.shape[:2] != original_shape[:2]:
            mask_aligned = cv2.resize(mask, (original_shape[1], original_shape[0]), interpolation=cv2.INTER_NEAREST)
        else:
            mask_aligned = mask
            
        # Binary threshold the mask for surgical precision
        _, mask_bool = cv2.threshold(mask_aligned, 10, 255, cv2.THRESH_BINARY)
        
        # Convert sharpened result to appropriate format (BGR or BGRA)
        if len(original_shape) == 3 and original_shape[2] == 4:
            result_bgr = cv2.cvtColor(result_sharp_rgb, cv2.COLOR_RGB2BGR)
            # Re-attach original alpha to the replacement pixels
            replacement = cv2.merge([result_bgr[:,:,0], result_bgr[:,:,1], result_bgr[:,:,2], img[:,:,3]])
        elif len(original_shape) == 3 and original_shape[2] == 3:
            replacement = cv2.cvtColor(result_sharp_rgb, cv2.COLOR_RGB2BGR)
        else:
            replacement = cv2.cvtColor(result_sharp_rgb, cv2.COLOR_RGB2GRAY)

        # Apply surgical replacement where mask is active
        # This keeps non-masked pixels bit-for-bit identical to the original
        final_result[mask_bool > 0] = replacement[mask_bool > 0]
            
        return final_result

class MultiScaleSegmenter:
    """
    Advanced pixel-level watermark segmentation using texture analysis, 
    frequency distribution, and structural pattern recognition.
    """
    def __init__(self, img):
        if len(img.shape) == 3 and img.shape[2] == 4:
            self.img_bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            self.gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
        elif len(img.shape) == 3 and img.shape[2] == 3:
            self.img_bgr = img.copy()
            self.gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            self.img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            self.gray = img.copy()

    def get_texture_mask(self):
        # Local variance/standard deviation to find semi-transparent textures
        local_mean = cv2.blur(self.gray.astype(np.float32), (11, 11))
        local_var = cv2.blur(self.gray.astype(np.float32)**2, (11, 11)) - local_mean**2
        local_std = np.sqrt(np.maximum(local_var, 0))
        local_std = (local_std / (local_std.max() + 1e-6) * 255).astype(np.uint8)
        # Lower threshold for faint watermarks
        _, mask = cv2.threshold(local_std, 40, 255, cv2.THRESH_BINARY)
        return mask

    def get_entropy_mask(self):
        # Local gradient entropy to find text-like structures
        dx = cv2.Sobel(self.gray, cv2.CV_32F, 1, 0, ksize=3)
        dy = cv2.Sobel(self.gray, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(dx, dy)
        # Normalize magnitude to find subtle edges
        mag = (mag / (mag.max() + 1e-6) * 255).astype(np.uint8)
        _, edges = cv2.threshold(mag, 20, 255, cv2.THRESH_BINARY)
        
        # Local density of edges
        density = cv2.blur(edges.astype(np.float32), (25, 25))
        density = (density / (density.max() + 1e-6) * 255).astype(np.uint8)
        _, mask = cv2.threshold(density, 30, 255, cv2.THRESH_BINARY)
        return mask

    def get_structural_mask(self):
        # MSER for text-like segment isolation
        mser = cv2.MSER_create(delta=3, min_area=30, max_area=15000)
        regions, _ = mser.detectRegions(self.gray)
        mask = np.zeros_like(self.gray)
        for p in regions:
            hull = cv2.convexHull(p.reshape(-1, 1, 2))
            cv2.fillPoly(mask, [hull], (255))
        return mask

    def get_pattern_mask(self):
        # Hough patterns specifically for diagonal crosshatch watermarks
        edges = cv2.Canny(self.gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=60, maxLineGap=20)
        mask = np.zeros_like(self.gray)
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                dx, dy = abs(x1 - x2), abs(y1 - y2)
                if dx > 30 and dy > 30:
                    slope = dy / (dx + 1e-6)
                    # Broad diagonal slope
                    if 0.3 < slope < 3.0: 
                        cv2.line(mask, (x1, y1), (x2, y2), 255, 10)
        return mask

    def protect_subjects(self):
        # Create a protection mask for faces and high-detail subjects
        # 1. Face Detection (Haar Cascades)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(self.gray, 1.1, 4)
        
        protection = np.zeros_like(self.gray)
        for (x, y, w, h) in faces:
            # Expand face region slightly for hair protection
            cv2.rectangle(protection, (x - w//4, y - h//3), (x + w + w//4, y + h), 255, -1)
            
        # 2. High-Frequency Subject Outlines (Canny)
        # We protect strong structural edges from being blurred
        edges = cv2.Canny(self.gray, 100, 200)
        edge_protection = cv2.dilate(edges, np.ones((5,5), np.uint8), iterations=3)
        
        # Combine protections
        final_protection = cv2.bitwise_or(protection, edge_protection)
        return final_protection

    def get_periodic_mask(self):
        # Specific detection for the diagonal watermark grid
        # 1. Detect lines with strict angle constraints
        edges = cv2.Canny(self.gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=150, maxLineGap=20)
        
        periodic_mask = np.zeros_like(self.gray)
        if lines is not None:
            angles = []
            valid_lines = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
                # Stock watermarks are usually 30, 45, or 60 degrees
                if 25 < angle < 65 or 115 < angle < 155:
                    angles.append(angle)
                    valid_lines.append(line[0])
            
            if len(valid_lines) > 5:
                # Find the dominant angle
                hist, bin_edges = np.histogram(angles, bins=18)
                dom_angle = bin_edges[np.argmax(hist)]
                
                for x1, y1, x2, y2 in valid_lines:
                    angle = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
                    if abs(angle - dom_angle) < 10:
                        cv2.line(periodic_mask, (x1, y1), (x2, y2), 255, 12)
        
        return periodic_mask

    def get_fft_mask(self):
        # 1. Frequency Domain Analysis to find periodic grids
        # Resize for speed to find global patterns
        small = cv2.resize(self.gray, (512, 512))
        f = np.fft.fft2(small)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-6)
        
        # 2. Find spikes (peaks) in frequency domain
        # Periodic watermarks appear as regular spikes around the center
        rows, cols = small.shape
        crow, ccol = rows // 2, cols // 2
        
        # Threshold the spectrum to find peaks
        _, peaks = cv2.threshold(magnitude_spectrum.astype(np.uint8), 200, 255, cv2.THRESH_BINARY)
        # Clear the DC component (center)
        cv2.circle(peaks, (ccol, crow), 10, 0, -1)
        
        # 3. If peaks exist, we have a periodic pattern
        mask_small = np.zeros_like(small)
        if np.sum(peaks) > 50:
            # Reconstruct which angles are dominant
            pts = np.argwhere(peaks > 0)
            for pt in pts:
                dy, dx = pt[0] - crow, pt[1] - ccol
                # This corresponds to a periodic signal in image space
                # We create a synthetic "signal mask" based on these frequencies
                # But for simplicity, we'll use this to boost the periodic detector
                pass 
        
        # Return a boost map for the periodic detector
        return peaks # Just a placeholder signal for now

    def refine_mask_bilateral(self, mask):
        # Refine mask to snap to image edges using Bilateral/Guided Filter
        # This prevents "bleeding" into non-target areas
        mask_f = mask.astype(np.float32) / 255.0
        # Use a large-sigma bilateral for edge preservation
        refined = cv2.bilateralFilter(mask_f, 9, 75, 75)
        # Re-threshold
        _, result = cv2.threshold((refined * 255).astype(np.uint8), 127, 255, cv2.THRESH_BINARY)
        return result

    def segment(self):
        # 1. Feature Extraction (Multi-Signal)
        texture = self.get_texture_mask()
        entropy = self.get_entropy_mask()
        structural = self.get_structural_mask()
        periodic = self.get_periodic_mask()
        protection = self.protect_subjects()

        # 2. Logic: Advanced Signal Fusion (VisualGPT Type)
        # Signal 1: High-Confidence Grid (Periodic + Texture)
        grid_signal = cv2.bitwise_and(texture, periodic)
        
        # Signal 2: Semantic Text (Entropy + Structural)
        text_signal = cv2.bitwise_and(entropy, structural)
        
        # Combined Candidate Mask
        watermark_raw = cv2.bitwise_or(grid_signal, text_signal)
        
        # 3. Selective Saliency (Only high-contrast items)
        saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
        _, s_map = saliency.computeSaliency(self.gray)
        s_map = (s_map * 255).astype("uint8")
        _, s_thresh = cv2.threshold(s_map, 80, 255, cv2.THRESH_BINARY)
        
        # Final Intersection
        mask_precise = cv2.bitwise_and(watermark_raw, s_thresh)
        
        # 4. Semantic Protection (Strict)
        # Zero out anywhere inside the protected zone
        mask_precise = cv2.bitwise_and(mask_precise, cv2.bitwise_not(protection))
        
        # 5. Morphological Structuring (Bridge gaps)
        # Use a combination of horizontal/vertical closing to handle text blocks
        k_h = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 4))
        k_v = cv2.getStructuringElement(cv2.MORPH_RECT, (4, 20))
        mask_precise = cv2.morphologyEx(mask_precise, cv2.MORPH_CLOSE, k_h)
        mask_precise = cv2.morphologyEx(mask_precise, cv2.MORPH_CLOSE, k_v)
        
        # 6. Bilateral Edge Snapping
        mask_final = self.refine_mask_bilateral(mask_precise)
        
        # 7. Area Analysis (Noise reduction)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_final, connectivity=8)
        mask_out = np.zeros_like(mask_final)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] >= 50: # More sensitive for detail
                mask_out[labels == i] = 255

        return cv2.dilate(mask_out, np.ones((5,5), np.uint8), iterations=1)

def auto_detect_mask(img):
    segmenter = MultiScaleSegmenter(img)
    return segmenter.segment()

def remove_logo(image_path, mask_path, output_path):
    """
    Highly accurate Watermark Elimination system.
    """
    try:
        model_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(model_dir, "models", "lama.onnx")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Lama model not found at {model_path}")
            
        inpainter = LamaInpainter(model_path)
        img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
        
        if mask_path == "AUTO":
            mask = auto_detect_mask(img)
        else:
            mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        if img is None or mask is None:
            raise ValueError("Loading failed.")

        # Prepare Mask (Strict threshold)
        _, mask = cv2.threshold(mask, 15, 255, cv2.THRESH_BINARY)
        mask = cv2.dilate(mask, np.ones((5,5), np.uint8), iterations=1)

        print(f"Executing Deep Reconstruction...")
        result = inpainter.inpaint(img, mask)

        # Meta-preservation save
        if output_path.lower().endswith(('.jpg', '.jpeg')):
             cv2.imwrite(output_path, result, [int(cv2.IMWRITE_JPEG_QUALITY), 100])
        else:
             cv2.imwrite(output_path, result)
             
        return output_path

    except Exception as e:
        print(f"System Error: {e}")
        return None

if __name__ == "__main__":
    print("AI Remover Module ready.")
