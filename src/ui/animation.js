const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');

/**
 * Get animation settings from configuration
 * @returns {Object} - Animation settings
 */
function getAnimationSettings() {
    const config = vscode.workspace.getConfiguration('codealchemy');
    return {
      enabled: config.get('animation.enabled', true),
      speed: config.get('animation.speed', 'normal')
    };
  }

  /**
 * Configure animation speed for visual feedback
 * @param {VisualEditorManager} visualEditor - The visual editor manager
 */
function configureAnimationSpeed(visualEditor) {
    const settings = getAnimationSettings();
    
    if (!settings.enabled) {
      // If animations are disabled, set minimal delays
      visualEditor.setTimeout(10);
      return;
    }
    
    // Set timeout based on speed setting
    switch (settings.speed) {
      case 'slow':
        visualEditor.setTimeout(1000);
        break;
      case 'normal':
        visualEditor.setTimeout(500);
        break;
      case 'fast':
        visualEditor.setTimeout(200);
        break;
      default:
        visualEditor.setTimeout(500);
    }
  }

  module.exports = { getAnimationSettings, configureAnimationSpeed };