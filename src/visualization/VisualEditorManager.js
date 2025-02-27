const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');

/**
 * Manages visual feedback for file operations with slowed-down visualization
 */
class VisualEditorManager {
  constructor() {
    this._decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      border: '1px solid rgba(0, 255, 0, 0.6)',
      borderRadius: '2px'
    });
    this._decorationTimeout = null;
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this._statusBarItem.text = "$(sync~spin) CodeAlchemy: Processing...";
    this._timeout = 500; // Delay between operations in ms
  }

  /**
   * Show visual indication that a file operation is starting
   * @param {string} operation - The operation being performed
   * @param {string} filePath - The file being operated on
   */
  async showOperationStart(operation, filePath) {
    // Update status bar and show notification
    this._statusBarItem.text = `$(sync~spin) CodeAlchemy: ${operation} ${path.basename(filePath)}...`;
    this._statusBarItem.show();
    
    // Add delay for visibility
    await new Promise(resolve => setTimeout(resolve, this._timeout));
    
    // Add notification
    vscode.window.showInformationMessage(`CodeAlchemy: ${operation} ${path.basename(filePath)}`);
    
    // Try to open the file if it exists
    if (fs.existsSync(filePath)) {
      try {
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
        
        // Clear any existing decorations
        this.clearDecorations(editor);
        
        // Add another delay for visibility
        await new Promise(resolve => setTimeout(resolve, this._timeout));
      } catch (error) {
        console.error(`Error opening file ${filePath}:`, error);
      }
    }
  }

  /**
   * Highlight changes in a file with character-by-character animation
   * @param {string} filePath - Path to the file
   * @param {string} oldContent - Original content
   * @param {string} newContent - New content after operation
   */
  async highlightChanges(filePath, oldContent, newContent) {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(document);
      
      // Find differences using diff-match-patch
      const dmp = new DiffMatchPatch();
      const diffs = dmp.diff_main(oldContent, newContent);
      dmp.diff_cleanupSemantic(diffs);
      
      // Apply changes gradually
      let currentPos = 0;
      
      for (const [operation, text] of diffs) {
        if (operation === 1) { // Insertion
          // Show character by character for insertions
          for (let i = 0; i < text.length; i++) {
            const startPos = document.positionAt(currentPos);
            const endPos = document.positionAt(currentPos + i + 1);
            
            const decoration = {
              range: new vscode.Range(startPos, endPos),
              hoverMessage: 'Added content'
            };
            
            editor.setDecorations(this._decorationType, [decoration]);
            
            // Short delay between characters
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          currentPos += text.length;
        } else if (operation === 0) { // Unchanged
          currentPos += text.length;
          // Add a small delay for unchanged sections too
          await new Promise(resolve => setTimeout(resolve, this._timeout / 5));
        }
        // No need to update position for deletions
      }
      
      // Keep decorations visible longer
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear decorations after a delay
      this.scheduleDecorationClear(editor, 5000);
    } catch (error) {
      console.error(`Error highlighting changes in ${filePath}:`, error);
    }
  }
  
  /**
   * Show visual feedback for a deleted file
   * @param {string} filePath - The file that was deleted
   */
  async showFileDeletion(filePath) {
    this._statusBarItem.text = `$(trash) CodeAlchemy: Deleting ${path.basename(filePath)}...`;
    this._statusBarItem.show();
    
    // Add delay for visibility
    await new Promise(resolve => setTimeout(resolve, this._timeout * 2));
    
    this._statusBarItem.text = `$(trash) CodeAlchemy: Deleted ${path.basename(filePath)}`;
    vscode.window.showInformationMessage(`CodeAlchemy: Deleted ${path.basename(filePath)}`);
    
    // Hide status bar after a few seconds
    setTimeout(() => {
      this._statusBarItem.hide();
    }, 3000);
  }
  
  /**
   * Show completion of an operation
   * @param {string} operation - The operation that completed
   * @param {string} filePath - The file that was operated on
   */
  async showOperationComplete(operation, filePath) {
    // Add delay before showing completion
    await new Promise(resolve => setTimeout(resolve, this._timeout));
    
    this._statusBarItem.text = `$(check) CodeAlchemy: ${operation} complete for ${path.basename(filePath)}`;
    
    // Hide status bar after a few seconds
    setTimeout(() => {
      this._statusBarItem.hide();
    }, 3000);
  }
  
  /**
   * Clear decorations from editor after a delay
   * @param {vscode.TextEditor} editor - The editor to clear decorations from
   * @param {number} delay - Delay in milliseconds
   */
  scheduleDecorationClear(editor, delay = 5000) {
    if (this._decorationTimeout) {
      clearTimeout(this._decorationTimeout);
    }
    
    this._decorationTimeout = setTimeout(() => {
      this.clearDecorations(editor);
    }, delay);
  }
  
  /**
   * Clear decorations from editor
   * @param {vscode.TextEditor} editor - The editor to clear decorations from
   */
  clearDecorations(editor) {
    editor.setDecorations(this._decorationType, []);
  }
  
  /**
   * Set the delay between operations
   * @param {number} timeout - Delay in milliseconds
   */
  setTimeout(timeout) {
    this._timeout = timeout;
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this._statusBarItem.dispose();
    if (this._decorationTimeout) {
      clearTimeout(this._decorationTimeout);
    }
  }
}

module.exports = { VisualEditorManager };