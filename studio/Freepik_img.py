import asyncio
import aiohttp
import aiofiles
import os
import re
from urllib.parse import urlparse
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
import time

# URLS = ["..."]

# Downloads folder (Windows)
DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

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
    options = uc.ChromeOptions()
    
    # Headless arguments for server environment
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
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
            'meta[property="og:image:secure_url"]'
        ]
        
        image_url = None
        for selector in selectors:
            try:
                meta = driver.find_element(By.CSS_SELECTOR, selector)
                content = meta.get_attribute('content')
                if content and content.startswith('http'):
                    image_url = content
                    print(f"🎯 Found image URL via {selector}: {image_url}")
                    break
            except:
                continue
        
        if image_url:
            return image_url
            
        print("⚠️ All meta selectors failed. Trying fallback to first large image.")
        # Fallback: look for 0_1.jpg or similar unwatermarked-ish patterns if they exist
        imgs = driver.find_elements(By.TAG_NAME, 'img')
        for img in imgs:
            src = img.get_attribute('src')
            if src and 'img.freepik.com' in src and ('-premium' in src or '_1.jpg' in src):
                print(f"💡 Fallback potential source: {src}")
                return src

        return url # Return original if absolutely nothing found
            
    except Exception as e:
        print(f"🔥 Browser Error resolving {url}: {e}")
        return url
    finally:
        if driver:
            try:
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
