from playwright.sync_api import Page, expect

def test_dashboard_loads(page: Page):
    # Navigate to the dashboard page
    page.goto("http://localhost:3000/dashboard")

    # Check if the "Announcements" card is visible
    announcements_card = page.get_by_text("Announcements")
    expect(announcements_card).to_be_visible()

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/dashboard.png")
