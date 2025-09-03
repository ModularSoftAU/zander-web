from playwright.sync_api import Page, expect
import os

def test_hero_header(page: Page):
    try:
        print("Navigating to home page...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(5000)
        print("Page loaded.")

        print("Looking for hero header...")
        hero_header = page.locator(".banner")
        expect(hero_header).to_be_visible()
        print("Hero header found.")

        print("Taking screenshot...")
        screenshot_path = "jules-scratch/verification/hero_header.png"
        hero_header.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Verify that the file was created
        if os.path.exists(screenshot_path):
            print("Screenshot file created successfully.")
        else:
            print("Error: Screenshot file not created.")

    except Exception as e:
        print(f"An error occurred: {e}")

def test_mobile_nav(page: Page):
    try:
        print("Setting mobile viewport...")
        page.set_viewport_size({"width": 375, "height": 667})
        print("Viewport set.")

        print("Navigating to home page...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(5000)
        print("Page loaded.")

        print("Looking for navigation bar...")
        nav_bar = page.locator("#navbar")
        expect(nav_bar).to_be_visible()
        print("Navigation bar found.")

        print("Taking screenshot...")
        screenshot_path = "jules-scratch/verification/mobile_nav.png"
        nav_bar.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Verify that the file was created
        if os.path.exists(screenshot_path):
            print("Screenshot file created successfully.")
        else:
            print("Error: Screenshot file not created.")

    except Exception as e:
        print(f"An error occurred: {e}")
