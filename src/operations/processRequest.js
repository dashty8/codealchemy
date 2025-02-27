const vscode = require('vscode');
const { VisualEditorManager } = require('../visualization/VisualEditorManager');
const { determineAction, callBedrockLLM, callBedrockForUpdates, callBedrockForSearchAndModify, callBedrockForDeletes } = require('../api/bedrock');
const { getCurrentProjectStructure } = require('../api/bedrock');
const { updateProjectInWorkspace, searchAndModifyInWorkspace, deleteItemsInWorkspace, createProjectInWorkspace } = require('./fileOperations');
const { configureAnimationSpeed } = require('../ui/animation');

/**
 * Process user request based on determined action
 * @param {string} userPrompt - The user's request
 * @returns {Promise<string>} - Result message
 */
async function processUserRequest(userPrompt) {
  try {
    // Create visual editor for feedback
    const visualEditor = new VisualEditorManager();
    
    // Configure animation speed based on settings
    configureAnimationSpeed(visualEditor);
    
    // Determine action to take
    const action = await determineAction(userPrompt);
    console.log(`Determined action: ${action}`);
    
    if (action === "create") {
      // Create new project structure
      const projectStructure = await callBedrockLLM(userPrompt);
      const result = await createProjectInWorkspace(projectStructure, visualEditor);
      return result;
    } 
    else if (action === "update") {
      // Get current project structure
      const currentStructure = await getCurrentProjectStructure();
      
      // Get updates based on current structure and user prompt
      const updateStructure = await callBedrockForUpdates(userPrompt, currentStructure);
      
      // Apply the updates
      const result = await updateProjectInWorkspace(updateStructure, visualEditor);
      return result;
    }
    else if (action === "search_and_modify") {
      // Get current project structure
      const currentStructure = await getCurrentProjectStructure();
      
      // Get search and modify instructions
      const modifyStructure = await callBedrockForSearchAndModify(userPrompt, currentStructure);
      
      // Apply the targeted modifications
      const result = await searchAndModifyInWorkspace(modifyStructure, visualEditor);
      return result;
    }
    else if (action === "delete") {
      // Get current project structure
      const currentStructure = await getCurrentProjectStructure();
      
      // Get delete instructions based on current structure and user prompt
      const deleteStructure = await callBedrockForDeletes(userPrompt, currentStructure);
      
      // Apply the deletions
      const result = await deleteItemsInWorkspace(deleteStructure, visualEditor);
      return result;
    }
    else {
      return "Unknown action determined. Please try again with a clearer request.";
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return `Error processing request: ${error.message}`;
  }
}

module.exports = { processUserRequest };