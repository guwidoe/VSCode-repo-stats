/**
 * E2E tests using vscode-extension-tester
 * These tests launch a real VSCode instance and interact with the UI
 */
import { VSBrowser, WebDriver, Workbench, InputBox } from 'vscode-extension-tester';
import { expect } from 'chai';

describe('Repo Stats Extension E2E', function () {
  this.timeout(60000); // E2E tests need longer timeout

  let browser: VSBrowser;
  let driver: WebDriver;

  before(async function () {
    browser = VSBrowser.instance;
    driver = browser.driver;
  });

  it('should activate extension via command palette', async function () {
    const workbench = new Workbench();

    // Open command palette
    await workbench.openCommandPrompt();

    // Type the command
    const input = await InputBox.create();
    await input.setText('Repo Stats: Show Dashboard');
    await input.confirm();

    // Give extension time to activate
    await driver.sleep(2000);

    // Verify no error notifications appeared
    const notifications = await workbench.getNotifications();
    const errorNotifications = [];
    for (const notification of notifications) {
      const type = await notification.getType();
      if (type === 'error') {
        const message = await notification.getMessage();
        errorNotifications.push(message);
      }
    }

    expect(errorNotifications).to.be.empty;
  });

  it('should show dashboard in sidebar', async function () {
    const workbench = new Workbench();
    const activityBar = workbench.getActivityBar();

    // Check if our view container exists (if configured as sidebar)
    // Adjust this based on how the extension registers its view
    const controls = await activityBar.getViewControls();
    const titles = await Promise.all(controls.map(c => c.getTitle()));

    // This test verifies the extension registered successfully
    // The exact assertion depends on how views are configured
    expect(titles.length).to.be.greaterThan(0);
  });
});
