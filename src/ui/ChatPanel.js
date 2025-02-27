const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');
const { processUserRequest } = require('../operations/processRequest.js');

/**
 * WebView Panel for Chat in the secondary sidebar
 */
class ChatPanel {
    static currentPanel = undefined;
    static viewType = 'codeAlchemyChat';
  
    static createOrShow(extensionUri, column = vscode.ViewColumn.Two) {
      if (ChatPanel.currentPanel) {
        ChatPanel.currentPanel.reveal(column);
        return;
      }
  
      const panel = vscode.window.createWebviewPanel(
        ChatPanel.viewType,
        'CodeAlchemy Chat',
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [extensionUri]
        }
      );
  
      ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }
  
    constructor(panel, extensionUri) {
      this._panel = panel;
      this._extensionUri = extensionUri;
      this._disposables = [];
  
      this._update();
  
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  
      this._panel.webview.onDidReceiveMessage(
        async message => {
          switch (message.command) {
            case 'sendMessage':
              try {
                // Show progress indicator
                this._panel.webview.postMessage({
                  command: 'receiveMessage',
                  text: "Processing your request...",
                  isProcessing: true
                });
                
                // Process the user request with action detection
                const result = await processUserRequest(message.text);
                
                // Echo the result back to the webview
                this._panel.webview.postMessage({
                  command: 'receiveMessage',
                  text: result,
                  isProcessing: false
                });
              } catch (error) {
                this._panel.webview.postMessage({
                  command: 'receiveMessage',
                  text: `Error: ${error.message}`,
                  isProcessing: false
                });
              }
              return;
          }
        },
        null,
        this._disposables
      );
    }
  
    _update() {
      const webview = this._panel.webview;
      this._panel.title = 'CodeAlchemy Chat';
      this._panel.webview.html = this._getHtmlForWebview(webview);
    }
  
    _getHtmlForWebview(webview) {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CodeAlchemy Chat</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
            }
            .container {
              display: flex;
              flex-direction: column;
              height: 100vh;
              max-width: 100%;
            }
            .header {
              padding: 10px 0;
              margin-bottom: 20px;
              border-bottom: 1px solid var(--vscode-panel-border);
            }
            .header h2 {
              margin: 0;
              color: var(--vscode-foreground);
            }
            .messages {
              flex: 1;
              overflow-y: auto;
              margin-bottom: 20px;
              padding: 10px;
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
            }
            .message {
              margin-bottom: 15px;
              padding: 10px 15px;
              border-radius: 4px;
              max-width: 85%;
              word-wrap: break-word;
            }
            .user-message {
              align-self: flex-end;
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              margin-left: auto;
            }
            .system-message {
              background-color: var(--vscode-editor-inactiveSelectionBackground);
              color: var(--vscode-editor-foreground);
            }
            .processing-message {
              border-left: 3px solid var(--vscode-progressBar-background);
              animation: pulse 1.5s infinite ease-in-out;
            }
            @keyframes pulse {
              0% { opacity: 0.7; }
              50% { opacity: 1; }
              100% { opacity: 0.7; }
            }
            .input-container {
              display: flex;
              margin-top: 10px;
            }
            #messageInput {
              flex: 1;
              padding: 10px;
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
              background-color: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
            }
            button {
              margin-left: 10px;
              padding: 10px 15px;
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background-color: var(--vscode-button-hoverBackground);
            }
            .loading {
              font-style: italic;
              color: var(--vscode-disabledForeground);
            }
            .file-operation {
              display: flex;
              align-items: center;
              margin: 8px 0;
              padding: 8px 10px;
              border-radius: 3px;
              background-color: var(--vscode-editor-lineHighlightBackground);
              animation: slideIn 0.3s ease-out;
            }
            .file-operation-icon {
              margin-right: 10px;
              font-size: 16px;
            }
            .file-operation-text {
              flex: 1;
              font-size: 14px;
            }
            .file-create {
              border-left: 3px solid #4CAF50;
            }
            .file-update {
              border-left: 3px solid #2196F3;
            }
            .file-delete {
              border-left: 3px solid #F44336;
            }
            .animation-in {
              animation: slideIn 0.3s ease-out;
            }
            @keyframes slideIn {
              0% { transform: translateX(-20px); opacity: 0; }
              100% { transform: translateX(0); opacity: 1; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>CodeAlchemy Assistant</h2>
            </div>
            <div class="messages" id="messages">
              <div class="message system-message">
                Welcome to CodeAlchemy! Tell me what you want to build, modify, or delete, and I'll help with the file structure. For example:
                <ul>
                  <li>"Create a React web app that displays a task list"</li>
                  <li>"Update my project to add user authentication"</li>
                  <li>"Remove all carousel references in my project"</li>
                  <li>"Delete all test files in my project"</li>
                </ul>
              </div>
            </div>
            <div class="input-container">
              <textarea id="messageInput" placeholder="Describe your project or changes..." rows="3"></textarea>
              <button id="sendButton">Send</button>
            </div>
          </div>
  
          <script>
            (function() {
              const vscode = acquireVsCodeApi();
              const messageContainer = document.getElementById('messages');
              const messageInput = document.getElementById('messageInput');
              const sendButton = document.getElementById('sendButton');
  
              // Add message to UI
              function addMessage(text, sender = 'system', isProcessing = false) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ' + (sender === 'user' ? 'user-message' : 'system-message');
                
                if (isProcessing) {
                  messageDiv.classList.add('processing-message');
                }
                
                messageDiv.classList.add('animation-in');
                messageDiv.textContent = text;
                messageContainer.appendChild(messageDiv);
                messageContainer.scrollTop = messageContainer.scrollHeight;
                
                return messageDiv;
              }
              
              // Add file operation display to UI
              function addFileOperation(operation, fileName) {
                const operationDiv = document.createElement('div');
                operationDiv.className = 'file-operation';
                
                // Add specific class based on operation type
                if (operation.toLowerCase().includes('create')) {
                  operationDiv.classList.add('file-create');
                } else if (operation.toLowerCase().includes('update') || operation.toLowerCase().includes('modify')) {
                  operationDiv.classList.add('file-update');
                } else if (operation.toLowerCase().includes('delete')) {
                  operationDiv.classList.add('file-delete');
                }
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'file-operation-icon';
                
                // Choose icon based on operation
                if (operation.toLowerCase().includes('create')) {
                  iconSpan.textContent = '📄';
                } else if (operation.toLowerCase().includes('update') || operation.toLowerCase().includes('modify')) {
                  iconSpan.textContent = '✏️';
                } else if (operation.toLowerCase().includes('delete')) {
                  iconSpan.textContent = '🗑️';
                } else {
                  iconSpan.textContent = '🔧';
                }
                
                const textSpan = document.createElement('span');
                textSpan.className = 'file-operation-text';
                textSpan.textContent = operation + ': ' + fileName;
                
                operationDiv.appendChild(iconSpan);
                operationDiv.appendChild(textSpan);
                messageContainer.appendChild(operationDiv);
                messageContainer.scrollTop = messageContainer.scrollHeight;
              }
  
              // Send message to extension
              function sendMessage() {
                const text = messageInput.value.trim();
                if (!text) return;
  
                // Add message to UI
                addMessage(text, 'user');
  
                // Send to extension
                vscode.postMessage({
                  command: 'sendMessage',
                  text: text
                });
  
                // Clear input
                messageInput.value = '';
              }
  
              // Set up event listeners
              sendButton.addEventListener('click', sendMessage);
              messageInput.addEventListener('keydown', event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              });
  
              // Handle messages from the extension
              window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'receiveMessage') {
                  addMessage(message.text, 'system', message.isProcessing);
                } else if (message.command === 'fileOperation') {
                  addFileOperation(message.operation, message.fileName);
                }
              });
            }());
          </script>
        </body>
        </html>
      `;
    }
  
    reveal(column) {
      this._panel.reveal(column);
    }
  
    dispose() {
      ChatPanel.currentPanel = undefined;
  
      this._panel.dispose();
  
      while (this._disposables.length) {
        const disposable = this._disposables.pop();
        if (disposable) {
          disposable.dispose();
        }
      }
    }
  }

  module.exports = { ChatPanel };