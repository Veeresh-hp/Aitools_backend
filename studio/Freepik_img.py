import asyncio
import aiohttp
import aiofiles
import os
import re
from urllib.parse import urlparse
# import undetected_chromedriver as uc
# from selenium.webdriver.common.by import By
import time
import shutil

# URLS = ["..."]

# Downloads folder (Windows)
# DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
# if not os.path.exists(DOWNLOAD_DIR):
#     os.makedirs(DOWNLOAD_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def get_chrome_version():
    """
    Detect Chrome version on Windows or Linux.
    Returns major version (int) or None.
    """
    # Windows
    if os.name == 'nt':
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
            version, _ = winreg.QueryValueEx(key, "version")
            return int(version.split('.')[0])
        except:
            pass

    # Linux / Fallback
    try:
        # Try asking the binary directly
        chrome_bin = shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chrome") or "/usr/bin/chromium"
        if not chrome_bin and os.path.exists("/root/.nix-profile/bin/chromium"):
             chrome_bin = "/root/.nix-profile/bin/chromium"
             
        if chrome_bin:
            import subprocess
            result = subprocess.run([chrome_bin, "--version"], capture_output=True, text=True)
            # Output format: "Chromium 121.0.6167.85 ..."
            output = result.stdout.strip()
            match = re.search(r"(\d+)\.\d+\.\d+\.\d+", output)
            if match:
                return int(match.group(1))
    except Exception as e:
        print(f"[WARN] Failed to detect Chrome version via subprocess: {e}")

    return None

def get_chrome_options():
    import undetected_chromedriver as uc
    options = uc.ChromeOptions()
    # options.add_argument("--headless=new") # Disabled to run with Xvfb
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,1024")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--incognito")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-application-cache")
    options.add_argument("--disk-cache-size=0")
    
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    options.add_argument(f"--user-agent={user_agent}")
    
    # Locate binary
    chrome_bin = shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chrome") or "/usr/bin/chromium"
    if not chrome_bin and os.path.exists("/root/.nix-profile/bin/chromium"):
            chrome_bin = "/root/.nix-profile/bin/chromium"
    
    if chrome_bin:
        options.binary_location = chrome_bin
    
    return options

def resolve_with_browser(url):
    print(f"[INFO] Inspecting page with Browser: {url}")
    
    # Lazy load dependencies
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    
    version = get_chrome_version()
    print(f"Detected Chrome Version: {version}")
    
    # Check for system chromedriver
    driver_executable_path = shutil.which("chromedriver") or "/usr/bin/chromedriver"
    if not driver_executable_path and os.path.exists("/root/.nix-profile/bin/chromedriver"):
        driver_executable_path = "/root/.nix-profile/bin/chromedriver"
        
    if driver_executable_path:
        print(f"Using system chromedriver at: {driver_executable_path}")
    
    driver = None
    try:
        # Initialize driver
        try:
            options = get_chrome_options() # Get fresh options
            if driver_executable_path:
                 # Use system driver if available
                 driver = uc.Chrome(options=options, driver_executable_path=driver_executable_path, version_main=version if version else 119)
            elif version:
                driver = uc.Chrome(options=options, version_main=version)
            else:
                # Try fixed version first for stability
                driver = uc.Chrome(options=options, version_main=119)
        except Exception as e:
            print(f"[WARN] Driver init failed with specific version: {e}")
            print("[INFO] Retrying with default options (no version_main)...")
            # CRITICAL FIX: Create NEW options object for retry
            options_retry = get_chrome_options()
            if driver_executable_path:
                 driver = uc.Chrome(options=options_retry, driver_executable_path=driver_executable_path)
            else:
                 driver = uc.Chrome(options=options_retry)
            
        driver.set_page_load_timeout(60) # Increased timeout
        driver.get(url)
        
        # Check for immediate block
        title = driver.title.lower()
        print(f"[DEBUG] Page Title: {title}")
        if "just a moment" in title or "cloudflare" in title:
             print(f"[BLOCK] Cloudflare detected immediately on {url}")
             return None

        # Enhanced waiting strategy
        print("Waiting for page load...")
        time.sleep(8) # Longer wait for headful + xvfb
        
        # Try to scroll down to trigger lazy loading
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight/3);")
        time.sleep(3)
        
        # Try multiple meta tag possibilities for best image source
        selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[property="og:image:secure_url"]',
            'div.image-container img', 
            'img[data-cy="image-viewer-content"]',  
            '#main-image',
            'link[rel="preload"][as="image"]', 
            'img[src*="img.freepik.com/premium-"]', 
            'img[src*="img.freepik.com/free-"]',
        ]
        
        image_url = None
        for selector in selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for element in elements:
                    if selector.startswith('meta') or selector.startswith('link'):
                        content = element.get_attribute('content') if selector.startswith('meta') else element.get_attribute('href')
                    else:
                        content = element.get_attribute('src')
                    
                    if content and content.startswith('http') and 'favicon' not in content:
                        # Filter out small thumbnails if possible
                        if 'size=626' in content: 
                             # Try to find a larger version if we grabbed a thumbnail
                             content = content.replace('size=626', 'size=338').replace('width=626', 'width=2000') 
                        
                        image_url = content
                        print(f"[SUCCESS] Found candidate via {selector}: {image_url}")
                        # If we found a meta image, it's usually the best one. Stop.
                        if 'og:image' in selector or 'twitter:image' in selector:
                            return image_url
                        
                        # Otherwise, keep looking but break inner loop
                        break
                
                if image_url:
                     break
            except:
                continue
        
        if image_url:
            return image_url

        print("[WARN] Selectors failed. Checking all images...")
        # Fallback: look for ANY img.freepik.com image that looks like a content image
        imgs = driver.find_elements(By.TAG_NAME, 'img')
        best_candidate = None
        max_size = 0
        
        for img in imgs:
            src = img.get_attribute('src')
            if src and 'img.freepik.com' in src and 'favicon' not in src:
                # Check for visual size if possible
                try:
                    width = int(img.get_attribute('naturalWidth') or 0)
                    height = int(img.get_attribute('naturalHeight') or 0)
                    size = width * height
                    
                    if size > max_size and width > 400: # Filter for large images
                        max_size = size
                        best_candidate = src
                except:
                    pass
                
                # Check for AI/Premium indicators if size check fails or is 0 (lazy load)
                if not best_candidate and ('/premium-' in src or '/ai-' in src or 'view' in src):
                     best_candidate = src

        if best_candidate:
            print(f"[INFO] Fallback best candidate: {best_candidate}")
            return best_candidate

        if best_candidate:
            print(f"[INFO] Fallback best candidate: {best_candidate}")
            return best_candidate

        # Logging failure details
        print(f"[ERROR] Failed to resolve. Page Title: {driver.title}")
        print(f"[ERROR] Current URL: {driver.current_url}")
        
        # Check for Cloudflare/Blocking
        page_source = driver.page_source.lower()
        if "cloudflare" in page_source or "just a moment" in driver.title.lower() or "challenge" in page_source:
            print("[BLOCK] Cloudflare Block Detected")

        return None # Return None to trigger error handling in server.py
            
    except Exception as e:
        print(f"[ERROR] Browser Error resolving {url}: {e}")
        # Debug screenshot on failure
        if driver:
             try:
                driver.save_screenshot("debug_failed_headless.png")
                print("[INFO] Saved debug_failed_headless.png")
             except: pass
        return url
    finally:
        if driver:
            try:
                # Force kill to prevent hanging processes
                driver.quit()
            except:
                pass

def is_direct_image(url):
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif'])

async def resolve_image_url(session, url):
    if is_direct_image(url):
        return url
        
    if "freepik.com" in url:
        # Run blocking browser in a separate thread
        return await asyncio.to_thread(resolve_with_browser, url)
    return url

async def download_image(session, url):
    # First resolve the URL if it's a page
    resolved_url = await resolve_image_url(session, url)
    
    # Parse filename from resolved URL, ignoring query params
    filename = os.path.basename(urlparse(resolved_url).path)
    if not filename or '.' not in filename:
        filename = f"freepik_{int(time.time())}.jpg"
        
    file_path = os.path.join(DOWNLOAD_DIR, filename)

    try:
        async with session.get(resolved_url) as response:
            if response.status == 200:
                print(f"[INFO] Saving to: {file_path}")
                async with aiofiles.open(file_path, "wb") as f:
                    async for chunk in response.content.iter_chunked(8192):
                        await f.write(chunk)
                
                if os.path.exists(file_path):
                    size = os.path.getsize(file_path)
                    print(f"[SUCCESS] Downloaded: {filename} (Size: {size} bytes)")
                    print(f"[INFO] Full Path: {os.path.abspath(file_path)}")
                else:
                    print(f"[ERROR] File missing after download: {file_path}")
            else:
                print(f"[ERROR] Failed to download image ({response.status}): {resolved_url}")
    except Exception as e:
        print(f"[WARN] Error downloading {resolved_url}: {e}")

async def main():
    # Example usage
    URLS = [input("Enter the URL of the image: ")]
    connector = aiohttp.TCPConnector(limit=10)
    async with aiohttp.ClientSession(headers=HEADERS, connector=connector) as session:
        tasks = [download_image(session, url) for url in URLS]
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
