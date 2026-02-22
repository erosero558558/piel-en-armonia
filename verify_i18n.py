import os
from playwright.sync_api import sync_playwright

def verify_i18n():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://127.0.0.1:8080")

            # Wait for content to load
            page.wait_for_timeout(2000)

            # Screenshot Spanish
            page.screenshot(path="verification_es.png")

            # Click EN button
            page.click("button[data-lang='en']")
            page.wait_for_timeout(1000)

            # Screenshot English
            page.screenshot(path="verification_en.png")

            # Check Chatbot
            chat_toggle = page.locator(".chatbot-toggle")
            if chat_toggle.is_visible():
                chat_toggle.click()
                page.wait_for_timeout(1000)
                page.screenshot(path="verification_chat_en.png")

                # Verify text
                welcome_msg = page.locator("[data-i18n='chat_welcome_message']")
                if welcome_msg.is_visible():
                    print(f"Chat welcome: {welcome_msg.inner_text()}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_i18n()
