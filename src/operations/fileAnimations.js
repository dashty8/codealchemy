const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');
const { DiffMatchPatch } = require('../utils/DiffMatchPatch');

/**
* Create file content character by character for visual effect
 * @param {string} filePath - Path to the file
 * @param {string} content - Content to write
 * @param {VisualEditorManager} visualEditor - Visual editor manager
 */
async function createFileWithAnimation(filePath, content, visualEditor) {
  // Make sure the directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Create empty file first
  fs.writeFileSync(filePath, '');
  
  try {
    // Open the file
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document);
    
    // Get animation speed settings
    const settings = getAnimationSettings();
    const charDelay = settings.speed === 'slow' ? 25 : 
                     settings.speed === 'normal' ? 10 : 5;
    
    // Write content character by character
    let currentText = '';
    
    for (let i = 0; i < content.length; i++) {
      currentText += content[i];
      
      // Create a new edit for each character
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), currentText);
      await vscode.workspace.applyEdit(edit);
      
      // Delay between characters
      await new Promise(resolve => setTimeout(resolve, charDelay));
    }
  } catch (error) {
    console.error(`Error animating file creation for ${filePath}:`, error);
    // Fall back to regular file write
    fs.writeFileSync(filePath, content);
  }
}


/**
 * Update file content character by character for visual effect
 * @param {string} filePath - Path to the file
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content
 */
async function updateFileWithAnimation(filePath, oldContent, newContent) {
    try {
      // Open the file
      const document = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(document);
      
      // Get animation speed settings
      const settings = getAnimationSettings();
      const charDelay = settings.speed === 'slow' ? 25 : 
                       settings.speed === 'normal' ? 10 : 5;
      
      // Find the differences to show character by character replacement
      const dmp = new DiffMatchPatch();
      const diffs = dmp.diff_main(oldContent, newContent);
      dmp.diff_cleanupSemantic(diffs);
      
      // Start with the old content
      let currentContent = oldContent;
      
      // Process each diff operation
      for (const [operation, text] of diffs) {
        if (operation === 0) {
          // Unchanged text, skip ahead
          continue;
        } else if (operation === 1) {
          // Insertion - add characters one by one
          const insertPosition = currentContent.length;
          
          for (let i = 0; i < text.length; i++) {
            // Calculate position to insert at
            const position = document.positionAt(insertPosition + i);
            
            // Create edit to insert single character
            const edit = new vscode.WorkspaceEdit();
            edit.insert(document.uri, position, text[i]);
            await vscode.workspace.applyEdit(edit);
            
            // Update current content
            currentContent = currentContent.slice(0, insertPosition + i) + 
                            text[i] + 
                            currentContent.slice(insertPosition + i);
            
            // Delay between characters
            await new Promise(resolve => setTimeout(resolve, charDelay));
          }
        } else if (operation === -1) {
          // Deletion - delete characters one by one
          const deleteStartPosition = currentContent.indexOf(text);
          
          if (deleteStartPosition !== -1) {
            for (let i = text.length - 1; i >= 0; i--) {
              // Calculate range to delete (single character)
              const startPos = document.positionAt(deleteStartPosition + i);
              const endPos = document.positionAt(deleteStartPosition + i + 1);
              
              // Create edit to delete single character
              const edit = new vscode.WorkspaceEdit();
              edit.delete(document.uri, new vscode.Range(startPos, endPos));
              await vscode.workspace.applyEdit(edit);
              
              // Update current content
              currentContent = currentContent.slice(0, deleteStartPosition + i) + 
                              currentContent.slice(deleteStartPosition + i + 1);
              
              // Delay between characters
              await new Promise(resolve => setTimeout(resolve, charDelay));
            }
          }
        }
      }
      
      // Final verification to ensure the file has the correct content
      if (document.getText() !== newContent) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newContent);
        await vscode.workspace.applyEdit(edit);
      }
    } catch (error) {
      console.error(`Error animating file update for ${filePath}:`, error);
      // Fall back to regular file write
      fs.writeFileSync(filePath, newContent);
    }
  }

  module.exports = { createFileWithAnimation, updateFileWithAnimation };