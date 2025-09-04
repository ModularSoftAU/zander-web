from playwright.sync_api import Page, expect
import os

def test_hero_header(page: Page):
    try:
        print("Navigating to home page...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(10000)
        print("Page loaded.")

        print("Taking screenshot...")
        screenshot_path = "jules-scratch/verification/hero_header.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")

        # Verify that the file was created
        if os.path.exists(screenshot_path):
            print("Screenshot file created successfully.")
        else:
            print("Error: Screenshot file not created.")

    except Exception as e:
        print(f"An error occurred: {e}")
