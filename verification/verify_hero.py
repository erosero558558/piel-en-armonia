from playwright.sync_api import sync_playwright

def verify_hero():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8000")

        # Wait for hero content to be visible
        page.wait_for_selector(".hero-content")

        # Take a screenshot of the hero section
        hero = page.locator(".hero")
        hero.screenshot(path="verification/hero_screenshot.png")

        print("Screenshot saved to verification/hero_screenshot.png")
        browser.close()

if __name__ == "__main__":
    verify_hero()
