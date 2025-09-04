from playwright.sync_api import Page, expect
import os

def test_fixes(page: Page):
    try:
        # Test hero header
        print("Navigating to home page...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(5000)
        print("Page loaded.")

        print("Looking for hero header...")
        hero_header = page.locator(".banner")
        expect(hero_header).to_be_visible()
        print("Hero header found.")

        print("Taking screenshot of hero header...")
        hero_screenshot_path = "jules-scratch/verification/hero_header.png"
        hero_header.screenshot(path=hero_screenshot_path)
        print(f"Screenshot saved to {hero_screenshot_path}")

        # Verify that the file was created
        if os.path.exists(hero_screenshot_path):
            print("Hero header screenshot file created successfully.")
        else:
            print("Error: Hero header screenshot file not created.")

        # Test mobile nav
        print("Setting mobile viewport...")
        page.set_viewport_size({"width": 375, "height": 667})
        print("Viewport set.")

        print("Navigating to home page again for mobile...")
        page.goto("http://localhost:3000/")
        page.wait_for_timeout(5000)
        print("Page loaded for mobile.")

        print("Looking for navigation bar...")
        nav_bar = page.locator("#navbar")
        expect(nav_bar).to_be_visible()
        print("Navigation bar found.")

        print("Taking screenshot of mobile nav...")
        mobile_screenshot_path = "jules-scratch/verification/mobile_nav.png"
        nav_bar.screenshot(path=mobile_screenshot_path)
        print(f"Screenshot saved to {mobile_screenshot_path}")

        # Verify that the file was created
        if os.path.exists(mobile_screenshot_path):
            print("Mobile nav screenshot file created successfully.")
        else:
            print("Error: Mobile nav screenshot file not created.")

    except Exception as e:
        print(f"An error occurred: {e}")
