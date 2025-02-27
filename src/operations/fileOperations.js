const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { createFileWithAnimation, updateFileWithAnimation } = require('./fileAnimations');
const { VisualEditorManager } = require('../visualization/VisualEditorManager');

/**
 * Update files in the workspace with true character-by-character typing animation
 * @param {object} updateStructure - The JSON structure with updates
 * @param {VisualEditorManager} visualEditor - The visual editor manager
 * @returns {Promise<string>} - A message indicating the result
 */
async function updateProjectInWorkspace(updateStructure, visualEditor) {
  try {
    // Check if we have a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return "No workspace is open. Please open a folder first.";
    }

    // Use the first workspace folder
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    if (!updateStructure.updates || !Array.isArray(updateStructure.updates)) {
      return "No updates specified in the structure.";
    }
    
    let updatedFiles = 0;
    let createdFiles = 0;
    
    for (const update of updateStructure.updates) {
      if (update.type !== "file" || !update.path) {
        continue;
      }
      
      const filePath = path.join(rootPath, update.path);
      const dirPath = path.dirname(filePath);
      
      // Ensure the directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const isNewFile = !fs.existsSync(filePath);
      let oldContent = '';
      
      // If updating existing file, read its content
      if (!isNewFile) {
        try {
          oldContent = fs.readFileSync(filePath, 'utf8');
          await visualEditor.showOperationStart('Updating', filePath);
          
          // Update file character by character
          await updateFileWithAnimation(filePath, oldContent, update.content || '');
          updatedFiles++;
          
          // Notify about operation completion
          await visualEditor.showOperationComplete('Update', filePath);
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      } else {
        await visualEditor.showOperationStart('Creating', filePath);
        
        // Create file with character-by-character animation
        await createFileWithAnimation(filePath, update.content || '', visualEditor);
        createdFiles++;
        
        // Notify about operation completion
        await visualEditor.showOperationComplete('Create', filePath);
      }
    }
    
    return `Project updated successfully. Created ${createdFiles} new files and updated ${updatedFiles} existing files.`;
  } catch (error) {
    console.error("Error updating project:", error);
    return `Error updating project: ${error.message}`;
  }
}

/**
 * Search for and modify specific code patterns in workspace files, with visual feedback
 * @param {object} modifyStructure - The JSON structure with modifications to apply
 * @param {VisualEditorManager} visualEditor - The visual editor manager
 * @returns {Promise<string>} - A message indicating the result
 */
async function searchAndModifyInWorkspace(modifyStructure, visualEditor) {
  try {
    // Check if we have a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return "No workspace is open. Please open a folder first.";
    }

    // Use the first workspace folder
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    if (!modifyStructure.modifications || !Array.isArray(modifyStructure.modifications)) {
      return "No modifications specified in the structure.";
    }
    
    let modifiedFiles = 0;
    let totalModifications = 0;
    
    for (const fileModification of modifyStructure.modifications) {
      if (!fileModification.path || !fileModification.patterns) {
        continue;
      }
      
      const filePath = path.join(rootPath, fileModification.path);
      
      // Skip if file doesn't exist
      if (!fs.existsSync(filePath)) {
        console.log(`File does not exist: ${filePath}`);
        continue;
      }
      
      // Show operation starting
      await visualEditor.showOperationStart('Modifying', filePath);
      
      // Read file content
      let fileContent;
      try {
        fileContent = fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        continue;
      }
      
      let originalContent = fileContent;
      let modified = false;
      
      // Apply each pattern replacement
      for (const pattern of fileModification.patterns) {
        if (!pattern.find) continue;
        
        // Determine if the pattern is a regex or string
        let regex;
        try {
          // Check if the pattern appears to be a regex (has special characters)
          if (pattern.find.startsWith('/') && 
              (pattern.find.endsWith('/') || pattern.find.endsWith('/g') || pattern.find.endsWith('/i'))) {
            // Extract the pattern and flags
            const matches = pattern.find.match(/^\/(.*?)\/([gimuy]*)$/);
            if (matches) {
              regex = new RegExp(matches[1], matches[2]);
            } else {
              regex = new RegExp(pattern.find.replace(/^\/|\/[gimuy]*$/g, ''));
            }
          } else {
            // Escape special characters for a literal string search
            regex = new RegExp(pattern.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          }
          
          // Replace in the content
          const replacement = pattern.replace || '';
          const previousContent = fileContent;
          fileContent = fileContent.replace(regex, replacement);
          
          // Check if any replacements were made
          if (previousContent !== fileContent) {
            modified = true;
            totalModifications++;
          }
        } catch (error) {
          console.error(`Error applying pattern ${pattern.find}:`, error);
        }
      }
      
      // Only write the file if modifications were made
      if (modified) {
        try {
          fs.writeFileSync(filePath, fileContent);
          await visualEditor.highlightChanges(filePath, originalContent, fileContent);
          modifiedFiles++;
          visualEditor.showOperationComplete('Modify', filePath);
        } catch (error) {
          console.error(`Error writing to file ${filePath}:`, error);
        }
      }
    }
    
    return `Search and modify completed. Made ${totalModifications} modifications across ${modifiedFiles} file(s).`;
  } catch (error) {
    console.error("Error during search and modify:", error);
    return `Error during search and modify: ${error.message}`;
  }
}

/**
 * Delete files/folders in the workspace based on the delete structure, with visual feedback
 * @param {object} deleteStructure - The JSON structure with items to delete
 * @param {VisualEditorManager} visualEditor - The visual editor manager
 * @returns {Promise<string>} - A message indicating the result
 */
async function deleteItemsInWorkspace(deleteStructure, visualEditor) {
  try {
    // Check if we have a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return "No workspace is open. Please open a folder first.";
    }

    // Use the first workspace folder
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    if (!deleteStructure.deletes || !Array.isArray(deleteStructure.deletes)) {
      return "No items specified for deletion.";
    }
    
    // Sort by path length in descending order to delete nested items first
    const sortedDeletes = [...deleteStructure.deletes].sort((a, b) => 
      b.path.length - a.path.length
    );
    
    let deletedFiles = 0;
    let deletedFolders = 0;
    
    for (const item of sortedDeletes) {
      if (!item.path) continue;
      
      const itemPath = path.join(rootPath, item.path);
      
      if (!fs.existsSync(itemPath)) {
        console.log(`Item does not exist: ${itemPath}`);
        continue;
      }
      
      const isDirectory = fs.statSync(itemPath).isDirectory();
      
      // Show operation starting
      if (isDirectory) {
        await visualEditor.showOperationStart('Deleting Directory', itemPath);
        fs.rmdirSync(itemPath, { recursive: true });
        deletedFolders++;
        visualEditor.showFileDeletion(itemPath);
      } else {
        await visualEditor.showOperationStart('Deleting File', itemPath);
        
        // Open the file briefly to show it being deleted
        try {
          const document = await vscode.workspace.openTextDocument(itemPath);
          await vscode.window.showTextDocument(document);
          
          // Short delay for visibility
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          fs.unlinkSync(itemPath);
          deletedFiles++;
          visualEditor.showFileDeletion(itemPath);
        } catch (error) {
          console.error(`Error visualizing deletion of ${itemPath}:`, error);
          fs.unlinkSync(itemPath);
          deletedFiles++;
          visualEditor.showFileDeletion(itemPath);
        }
      }
    }
    
    return `Deleted ${deletedFiles} files and ${deletedFolders} folders.`;
  } catch (error) {
    console.error("Error deleting items:", error);
    return `Error deleting items: ${error.message}`;
  }
}

/**
/**
 * Create all files and folders with character-by-character animation
 * @param {object} projectStructure - The JSON structure from Bedrock
 * @param {VisualEditorManager} visualEditor - The visual editor manager
 * @returns {Promise<string>} - A message indicating the result
 */
async function createProjectInWorkspace(projectStructure, visualEditor) {
  try {
    // Check if we have a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return "No workspace is open. Please open a folder first.";
    }

    // Use the first workspace folder
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // Function to recursively create the structure
    async function createStructure(items, basePath) {
      for (const item of items) {
        const itemPath = path.join(basePath, item.name);
        
        if (item.type === "folder") {
          // Create folder if it doesn't exist
          if (!fs.existsSync(itemPath)) {
            await visualEditor.showOperationStart('Creating Folder', itemPath);
            fs.mkdirSync(itemPath, { recursive: true });
            await visualEditor.showOperationComplete('Create Folder', itemPath);
          }
          
          // Process children if any
          if (item.children && Array.isArray(item.children)) {
            await createStructure(item.children, itemPath);
          }
        } else if (item.type === "file") {
          await visualEditor.showOperationStart('Creating File', itemPath);
          
          // Create file with character-by-character animation
          await createFileWithAnimation(itemPath, item.content || '', visualEditor);
          
          await visualEditor.showOperationComplete('Create File', itemPath);
        }
      }
    }
    
    // Start creating the structure
    await createStructure(projectStructure.structure, rootPath);
    
    // Open the main file in the editor if specified
    if (projectStructure.mainFile) {
      const mainFilePath = path.join(rootPath, projectStructure.mainFile);
      if (fs.existsSync(mainFilePath)) {
        const document = await vscode.workspace.openTextDocument(mainFilePath);
        await vscode.window.showTextDocument(document);
      }
    }
    
    return `Project "${projectStructure.projectName}" created successfully.`;
  } catch (error) {
    console.error("Error creating project:", error);
    return `Error creating project: ${error.message}`;
  }
}

module.exports = {
    updateProjectInWorkspace,
    searchAndModifyInWorkspace,
    deleteItemsInWorkspace,
    createProjectInWorkspace
  };