const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');
const { processUserRequest } = require('../operations/processRequest');

/**
 * Provides the webview content for the chat view in the sidebar
 */
class ChatViewProvider {
    constructor(extensionUri) {
      this.extensionUri = extensionUri;
      this._view = undefined;
    }
  
    resolveWebviewView(webviewView, context, token) {
      this._view = webviewView;
  
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.extensionUri]
      };
  
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  
      // Handle messages from the webview
      webviewView.webview.onDidReceiveMessage(async message => {
        if (message.command === 'sendMessage') {
          try {
            // Show progress indicator
            webviewView.webview.postMessage({
              command: 'receiveMessage',
              sender: 'system',
              text: "Processing your request...",
              isProcessing: true
            });
            
            // Process the user request
            const result = await processUserRequest(message.text);
            
            // Return the result to the webview
            webviewView.webview.postMessage({
              command: 'receiveMessage',
              sender: 'system',
              text: result,
              isProcessing: false
            });
          } catch (error) {
            webviewView.webview.postMessage({
              command: 'receiveMessage',
              sender: 'system',
              text: `Error: ${error.message}`,
              isProcessing: false
            });
          }
        }
      });
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
              padding: 10px;
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
            }
            .container {
              display: flex;
              flex-direction: column;
              height: 100vh;
              max-width: 100%;
            }
            .messages {
              flex: 1;
              overflow-y: auto;
              margin-bottom: 10px;
              padding: 10px;
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
            }
            .message {
              margin-bottom: 10px;
              padding: 8px 12px;
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
              padding: 8px;
              border: 1px solid var(--vscode-input-border);
              border-radius: 4px;
              background-color: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
            }
            button {
              margin-left: 10px;
              padding: 8px 12px;
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background-color: var(--vscode-button-hoverBackground);
            }
            .file-operation {
              display: flex;
              align-items: center;
              margin: 5px 0;
              padding: 5px;
              border-radius: 3px;
              background-color: var(--vscode-editor-lineHighlightBackground);
            }
            .file-operation-icon {
              margin-right: 5px;
            }
            .file-operation-text {
              flex: 1;
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
            <div class="messages" id="messages">
              <div class="message system-message">
                Welcome to CodeAlchemy! Describe what you want to build and I'll help create the file structure.
              </div>
            </div>
            <div class="input-container">
              <input type="text" id="messageInput" placeholder="Type your project description here...">
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
              function addMessage(text, sender, isProcessing = false) {
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
              
              // Add file operation to UI
              function addFileOperation(operation, fileName) {
                const operationDiv = document.createElement('div');
                operationDiv.className = 'file-operation animation-in';
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'file-operation-icon';
                
                if (operation === 'create') {
                  iconSpan.textContent = '📄 ';
                } else if (operation === 'update') {
                  iconSpan.textContent = '✏️ ';
                } else if (operation === 'delete') {
                  iconSpan.textContent = '🗑️ ';
                }
                
                const textSpan = document.createElement('span');
                textSpan.className = 'file-operation-text';
                textSpan.textContent = operation + ' ' + fileName;
                
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
                if (event.key === 'Enter') {
                  sendMessage();
                }
              });
  
              // Handle messages from the extension
              window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'receiveMessage') {
                  addMessage(message.text, message.sender || 'system', message.isProcessing);
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
  }

  module.exports = { ChatViewProvider };