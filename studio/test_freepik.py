from Freepik_img import resolve_with_browser

url = "https://www.freepik.com/premium-ai-image/man-with-glasses-sweater_57660150.htm#fromView=search&page=10&position=17&uuid=330b8d3d-fa6b-4f5c-8f3d-d85ba4594321&query=Ai+generated+man"
print(f"Testing URL: {url}")
resolved = resolve_with_browser(url)
print(f"Resolved URL: {resolved}")
