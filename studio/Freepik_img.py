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
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
        version, _ = winreg.QueryValueEx(key, "version")
        main_version = int(version.split('.')[0])
        return main_version
    except Exception as e:
        print(f"⚠️ Could not detect Chrome version: {e}")
        return None

def resolve_with_browser(url):
    print(f"🔍 Inspecting page with Browser: {url}")
    
    # Lazy load dependencies
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    
    options = uc.ChromeOptions()
    
    # Headless arguments for server environment
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    version = get_chrome_version()
    print(f"Detected Chrome Version: {version}")
    
    driver = None
    try:
        # Check for Linux/Nixpacks Chromium location
        chrome_bin = shutil.which("chromium") or shutil.which("google-chrome")
        if chrome_bin:
            options.binary_location = chrome_bin
            
        if version:
            driver = uc.Chrome(options=options, version_main=version)
        else:
            driver = uc.Chrome(options=options)
            
        driver.set_page_load_timeout(30)
        driver.get(url)
        time.sleep(7) # Wait for Cloudflare/heavy JS loading
        
        # Try multiple meta tag possibilities for best image source
        selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[property="og:image:secure_url"]',
            'img[data-cy="image-viewer-content"]',  # Common scraper target
            '.image-container img', # Another common container
            '#main-image',
            'img[src*="img.freepik.com/premium-"]', # Direct source check
            'img[src*="img.freepik.com/free-"]'
        ]
        
        image_url = None
        for selector in selectors:
            try:
                if selector.startswith('meta'):
                    element = driver.find_element(By.CSS_SELECTOR, selector)
                    content = element.get_attribute('content')
                else:
                    element = driver.find_element(By.CSS_SELECTOR, selector)
                    content = element.get_attribute('src')
                
                if content and content.startswith('http') and 'favicon' not in content:
                    # Filter out small thumbnails if possible
                    if 'size=626' in content: 
                         # Try to find a larger version if we grabbed a thumbnail
                         content = content.replace('size=626', 'size=338').replace('width=626', 'width=2000') # Naive attempt, but sometimes works
                    
                    image_url = content
                    print(f"🎯 Found image URL via {selector}: {image_url}")
                    break
            except:
                continue
        
        if image_url:
            return image_url
            
        print("⚠️ All selectors failed. Dumping all meta tags for debug...")
        try:
            metas = driver.find_elements(By.TAG_NAME, "meta")
            for m in metas:
                name = m.get_attribute("name") or m.get_attribute("property")
                content = m.get_attribute("content")
                if name and "image" in name.lower():
                    print(f"   Found meta: {name} = {content}")
        except:
            pass

        print("⚠️ Trying fallback to ANY large Freepik image.")
        # Fallback: look for ANY img.freepik.com image that looks like a content image
        imgs = driver.find_elements(By.TAG_NAME, 'img')
        best_candidate = None
        max_width = 0
        
        for img in imgs:
            src = img.get_attribute('src')
            if src and 'img.freepik.com' in src and 'favicon' not in src:
                # Check for size if possible
                try:
                    width = int(img.get_attribute('naturalWidth') or 0)
                    if width > max_width and width > 400: # Filter for large images
                        max_width = width
                        best_candidate = src
                except:
                    pass
                
                # Check for AI/Premium indicators if size check fails
                if not best_candidate and ('/premium-' in src or '/ai-' in src or 'view' in src):
                     best_candidate = src

        if best_candidate:
            print(f"💡 Fallback best candidate: {best_candidate}")
            return best_candidate

        if best_candidate:
            print(f"💡 Fallback best candidate: {best_candidate}")
            return best_candidate

        # Logging failure details
        print(f"❌ Failed to resolve. Page Title: {driver.title}")
        print(f"❌ Current URL: {driver.current_url}")
        
        # Check for Cloudflare/Blocking
        page_source = driver.page_source.lower()
        if "cloudflare" in page_source or "just a moment" in driver.title.lower():
            print("🚫 Cloudflare Block Detected")

        return None # Return None to trigger error handling in server.py
            
    except Exception as e:
        print(f"🔥 Browser Error resolving {url}: {e}")
        # Debug screenshot on failure
        if driver:
             try:
                driver.save_screenshot("debug_failed_headless.png")
                print("📸 Saved debug_failed_headless.png")
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
                print(f"📂 Saving to: {file_path}")
                async with aiofiles.open(file_path, "wb") as f:
                    async for chunk in response.content.iter_chunked(8192):
                        await f.write(chunk)
                
                if os.path.exists(file_path):
                    size = os.path.getsize(file_path)
                    print(f"✅ Downloaded: {filename} (Size: {size} bytes)")
                    print(f"📍 Full Path: {os.path.abspath(file_path)}")
                else:
                    print(f"❌ File missing after download: {file_path}")
            else:
                print(f"❌ Failed to download image ({response.status}): {resolved_url}")
    except Exception as e:
        print(f"⚠️ Error downloading {resolved_url}: {e}")

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
