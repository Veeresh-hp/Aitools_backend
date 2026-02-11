import os
import shutil
import sys
import asyncio
import time
from urllib.parse import urlparse
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Add current directory to path to import enhancer
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from enhancer.enhance import premium_ai_upscale
from logo_remover.remover import remove_logo
from rembg import remove
from PIL import Image
import io

app = FastAPI()

# CORS for React Frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (Frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def health_check():
    return {"status": "healthy"}

@app.get("/api")
def read_root():
    return FileResponse("static/index.html")

@app.post("/api/remove-logo")
async def remove_logo_endpoint(
    image: UploadFile = File(...), 
    mask: UploadFile = File(None),
    auto_detect: bool = Form(False)
):
    # Save uploaded files with unique names
    timestamp = int(time.time())
    safe_filename = f"{timestamp}_{image.filename}"
    image_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    if auto_detect or mask is None:
        mask_path = "AUTO"
        print(f"Auto-detection mode enabled for {safe_filename}")
    else:
        mask_path = os.path.join(UPLOAD_DIR, f"mask_{safe_filename}")
        with open(mask_path, "wb") as buffer:
            shutil.copyfileobj(mask.file, buffer)
    
    # Generate output path
    # Generate output path
    filename_no_ext, file_extension = os.path.splitext(safe_filename)
    # Default to .jpg if no extension, otherwise keep original (normalize to lower)
    ext = file_extension.lower() if file_extension else ".jpg"
    output_filename = f"{filename_no_ext}_cleaned{ext}"
    output_path = os.path.join(UPLOAD_DIR, output_filename)
    
    # Run Logo Removal
    try:
        print(f"Removing logo from {image_path} using mask {mask_path} -> {output_path}")
        result = remove_logo(image_path, mask_path, output_path)
        
        if result:
            return {
                "original_url": f"/uploads/{safe_filename}",
                "cleaned_url": f"/uploads/{output_filename}"
            }
        else:
            return {"error": "Failed to remove logo"}
            
    except Exception as e:
        print(f"Error during logo removal: {e}")
        return {"error": str(e)}

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...), mode: str = Form("fast")):
    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Generate output path
    filename_no_ext = os.path.splitext(file.filename)[0]
    output_filename = f"{filename_no_ext}_enhanced.jpg"
    output_path = os.path.join(UPLOAD_DIR, output_filename)
    
    # Run Enhancement
    try:
        print(f"Enhancing {file_path} -> {output_path} (Mode: {mode})")
        premium_ai_upscale(file_path, output_path, mode=mode)
        
        return {
            "original_url": f"/uploads/{file.filename}",
            "enhanced_url": f"/uploads/{output_filename}"
        }
    except Exception as e:
        print(f"Error during enhancement: {e}")
        return {"error": str(e)}

# --------------------------------------------------------------------------------
# Freepik Downloader Endpoint
# --------------------------------------------------------------------------------
from Freepik_img import resolve_with_browser
import requests
from pydantic import BaseModel

class FreepikRequest(BaseModel):
    url: str

@app.post("/api/freepik")
async def freepik_download(request: FreepikRequest):
    try:
        url = request.url
        print(f"📥 Received Freepik URL: {url}")

        # 1. Resolve High-Res URL using Browser (Blocking, run in thread)
        # But first check if it's already a direct image
        def is_direct_image_link(u):
            from urllib.parse import urlparse
            path = urlparse(u).path.lower()
            return any(path.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif'])

        if is_direct_image_link(url):
            image_url = url
        else:
            image_url = await asyncio.to_thread(resolve_with_browser, url)
        
        if not image_url or (image_url == url and not is_direct_image_link(url)):
             return {"error": "Failed to resolve high-res image. Freepik might be blocking the request or the URL is restricted. Please try again or check the URL."}

        # 2. Download the Image Locally
        print(f"⬇️ Downloading High-Res Image: {image_url}")
        
        # Improved filename extraction for encoded URLs
        parsed_url = urlparse(image_url)
        path = parsed_url.path
        filename = os.path.basename(path)
        
        # Clean up filename (remove query params if any)
        if '?' in filename:
            filename = filename.split('?')[0]
            
        # Fallback for weird paths
        if not filename or len(filename) < 5 or '.' not in filename:
            filename = f"freepik_{int(time.time())}.jpg"
        
        # Ensure filename is safe (remove weird chars)
        import re
        filename = re.sub(r'[^\w\.-]', '_', filename)
        if len(filename) > 100:
            filename = filename[-100:]

        output_path = os.path.join(UPLOAD_DIR, filename)

        from Freepik_img import HEADERS
        with requests.get(image_url, headers=HEADERS, stream=True) as r:
            r.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        print(f"✅ Saved to: {output_path}")

        return {
            "original_url": url,
            "image_url": image_url,
            "download_url": f"/uploads/{filename}",
            "filename": filename
        }

    except Exception as e:
        print(f"❌ Freepik Error: {e}")
        return {"error": str(e)}

@app.get("/api/projects")
async def get_projects():
    try:
        files = []
        for f in os.listdir(UPLOAD_DIR):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                path = os.path.join(UPLOAD_DIR, f)
                stats = os.stat(path)
                files.append({
                    "name": f,
                    "url": f"/uploads/{f}",
                    "time": stats.st_mtime,
                    "size": stats.st_size
                })
        
        # Sort by newest first
        files.sort(key=lambda x: x['time'], reverse=True)
        return {"projects": files}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/api/delete-project/{filename}")
async def delete_project(filename: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            # Find and remove associated masks or cleaned versions if applicable
            # (Keep it simple for now and only delete the specific file requested)
            return {"message": f"Successfully deleted {filename}"}
        else:
            return {"error": "File not found"}
    except Exception as e:
        print(f"❌ Delete Error: {e}")
        return {"error": str(e)}

@app.delete("/api/delete-all-projects")
async def delete_all_projects():
    try:
        count = 0
        for f in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(file_path):
                os.remove(file_path)
                count += 1
        return {"message": f"Successfully deleted {count} projects"}
    except Exception as e:
        print(f"❌ Bulk Delete Error: {e}")
        return {"error": str(e)}

@app.post("/api/remove-bg")
async def remove_background(image: UploadFile = File(...)):
    try:
        # Save uploaded image
        filename = f"{int(time.time())}_{image.filename}"
        input_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        # Process with rembg
        with open(input_path, "rb") as f:
            input_data = f.read()
            
        # AI Matting
        output_data = remove(input_data)
        
        # Save as PNG to preserve transparency
        output_filename = f"{os.path.splitext(filename)[0]}_no_bg.png"
        output_path = os.path.join(UPLOAD_DIR, output_filename)
        
        with open(output_path, "wb") as f:
            f.write(output_data)
            
        return {
            "original_url": f"/uploads/{filename}",
            "cleaned_url": f"/uploads/{output_filename}",
            "filename": output_filename
        }
    except Exception as e:
        print(f"❌ BG Removal Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
