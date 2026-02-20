from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Route requests to admin-auth.php to simulate 2FA requirement
    def handle_auth(route):
        if "action=login" in route.request.url and "action=login-2fa" not in route.request.url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body='{"ok": true, "twoFactorRequired": true}'
            )
        else:
            route.continue_()

    page.route("**/admin-auth.php*", handle_auth)

    # Go to admin page
    page.goto("http://127.0.0.1:8008/admin.html")

    # Check initial state
    print("Checking initial state...")
    if not page.is_visible("#passwordGroup"):
        print("FAIL: Password group not visible initially")
    if page.is_visible("#group2FA"):
        print("FAIL: 2FA group visible initially")

    # Fill password and submit
    page.fill("#adminPassword", "anypassword")
    page.click("button[type='submit']")

    # Wait for 2FA group to appear
    print("Waiting for 2FA input...")
    try:
        page.wait_for_selector("#group2FA:not(.is-hidden)", timeout=5000)
        print("SUCCESS: 2FA group became visible")
    except:
        print("FAIL: 2FA group did not become visible")

    # Check if password group is hidden
    if page.locator("#passwordGroup").get_attribute("class") and "is-hidden" in page.locator("#passwordGroup").get_attribute("class"):
        print("SUCCESS: Password group hidden")
    else:
        print("FAIL: Password group not hidden")

    # Check button text
    btn_text = page.locator("#loginBtn").inner_text()
    if "Verificar" in btn_text:
        print("SUCCESS: Button text updated to Verificar")
    else:
        print(f"FAIL: Button text is '{btn_text}'")

    # Take screenshot
    page.screenshot(path="verification/2fa_ui_verification.png")
    print("Screenshot saved to verification/2fa_ui_verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
