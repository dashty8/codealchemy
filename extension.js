const vscode = require('vscode');
const path = require('path');
const dotenv = require('dotenv');

// Import from modules
const { ChatViewProvider } = require('./src/ui/ChatViewProvider');
const { ChatPanel } = require('./src/ui/ChatPanel');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('CodeAlchemy extension is now active!');

  // Load environment variables
  const dotenvPath = path.join(__dirname, '.env');
  dotenv.config({ path: dotenvPath });

  // Register a command to open the chat panel
  const openChatCommand = vscode.commands.registerCommand('codealchemy.openChat', () => {
    ChatPanel.createOrShow(context.extensionUri);
  });

  // Register a command to show the chat panel in the secondary sidebar
  const showChatPanelCommand = vscode.commands.registerCommand('codealchemy.showChatPanel', () => {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.Two;
   
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.reveal(column);
    } else {
      ChatPanel.createOrShow(context.extensionUri, column);
    }
  });

  // Add a command to toggle visual feedback
  const toggleVisualFeedbackCommand = vscode.commands.registerCommand('codealchemy.toggleVisualFeedback', () => {
    const config = vscode.workspace.getConfiguration('codealchemy');
    const currentValue = config.get('visualFeedback');
    config.update('visualFeedback', !currentValue, true);
    vscode.window.showInformationMessage(`CodeAlchemy: Visual feedback ${!currentValue ? 'enabled' : 'disabled'}`);
  });

  context.subscriptions.push(openChatCommand, showChatPanelCommand, toggleVisualFeedbackCommand);

  // Register the custom view provider for the chat view
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codealchemy.chatView', provider)
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};