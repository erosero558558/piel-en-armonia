from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1024}) # Desktop

        # Navigate to localhost:8000
        page.goto("http://localhost:8000/index.html")

        # Screenshot Hero
        hero_section = page.locator("#inicio")
        hero_section.screenshot(path="verification/hero_desktop.png")

        # Screenshot Showcase
        showcase_section = page.locator("#showcase")
        showcase_section.screenshot(path="verification/showcase_desktop.png")

        # Mobile View
        page.set_viewport_size({"width": 375, "height": 812})
        page.reload()

        # Screenshot Hero Mobile
        hero_section.screenshot(path="verification/hero_mobile.png")

        # Screenshot Showcase Mobile
        showcase_section.screenshot(path="verification/showcase_mobile.png")

        browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    run()
