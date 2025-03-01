const AWS = require('aws-sdk');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');


const model_ARN = process.env.AWS_BEDROCK_MODEL_ID;


/**
 * Determines the action to take based on user prompt
 * @param {string} userPrompt - The user's project description
 * @returns {Promise<string>} - Action to take: "create", "update", "search_and_modify", or "delete"
 */
async function determineAction(userPrompt) {
  try {
    // Verify credentials are available
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials not found. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are defined in your .env file.');
    }
    

    // Configure AWS SDK with the verified credentials
    AWS.config.update({
      credentials: new AWS.Credentials(accessKey, secretKey),
      region: 'us-east-1'
    });

    // Initialize the Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();

    const systemPrompt = `You are an assistant that determines the appropriate action to take based on a user's project request.
    Given the user's prompt, analyze what they want to do with careful nuance:
    
    1. CREATE: Generate a new project or add new files to an existing project
    2. UPDATE: Modify existing files by adding or changing content
    3. SEARCH_AND_MODIFY: Find specific code patterns across the project and modify them (e.g., "delete all carousel references")
    4. DELETE: Remove entire files or directories from the project
    
    Be precise in distinguishing between DELETE (removing entire files) and SEARCH_AND_MODIFY (removing specific code within files).
    
    Examples:
    - "Create a React app" → CREATE
    - "Add a login component" → UPDATE
    - "Remove all carousel references" → SEARCH_AND_MODIFY
    - "Delete the test directory" → DELETE
    
    Return ONLY a JSON object with this format: {"action":"create"} or {"action":"update"} or {"action":"search_and_modify"} or {"action":"delete"}
    
    IMPORTANT: Your response must ONLY contain valid JSON with NO additional text, comments, or explanations.`;

    const params = {
      modelId: model_ARN,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nUser request: ${userPrompt}`
          }
        ],
        temperature: 0.2,
        top_p: 0.9
      })
    };

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract the text response
    let jsonText;
    if (responseBody.content && Array.isArray(responseBody.content)) {
      jsonText = responseBody.content[0].text;
    } else if (responseBody.completion) {
      jsonText = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    console.log("Action determination response:", jsonText);
    
    // Parse the JSON response
    try {
      const actionObj = JSON.parse(jsonText);
      if (actionObj && actionObj.action && ['create', 'update', 'search_and_modify', 'delete'].includes(actionObj.action)) {
        return actionObj.action;
      } else {
        console.log("Invalid action format, defaulting to create");
        return "create";
      }
    } catch (e) {
      console.log("Error parsing action JSON, defaulting to create:", e);
      return "create";
    }
  } catch (error) {
    console.error('Error determining action:', error);
    return "create"; // Default to create on error
  }
}


/**
 * Call AWS Bedrock to generate project structure
 * @param {string} userPrompt - The user's project description
 * @returns {Promise<object>} - JSON structure for the project
 */
async function callBedrockLLM(userPrompt) {
  try {
    // Verify credentials are available
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials not found. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are defined in your .env file.');
    }

    // Configure AWS SDK with the verified credentials
    AWS.config.update({
      credentials: new AWS.Credentials(accessKey, secretKey),
      region: 'us-east-1'
    });

    // Initialize the Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();

    const systemPrompt = `You are a helpful assistant that generates project structures based on user requirements. 
    Given a description of a project, create a JSON structure that represents the required folders and files.
    
    The JSON structure should follow this format:
    {
      "projectName": "name-of-project",
      "structure": [
        {
          "type": "folder",
          "name": "folderName",
          "children": [
            {
              "type": "file",
              "name": "fileName.extension",
              "content": "// Optional initial content for the file"
            }
          ]
        }
      ]
    }
    
    IMPORTANT: Your response must ONLY contain valid JSON with NO additional text, comments, or explanations before or after the JSON. Do not include markdown code blocks or any other formatting. Return ONLY the raw JSON object.
    
    Be comprehensive and include all necessary files for the described project. For specific frameworks like React, 
    include appropriate configuration files, component structure, etc.`;

    const params = {
      modelId: model_ARN,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nProject request: ${userPrompt}`
          }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    };

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // For newer Claude models on Bedrock
    let jsonText;
    if (responseBody.content && Array.isArray(responseBody.content)) {
      jsonText = responseBody.content[0].text;
    } else if (responseBody.completion) {
      // For older Claude models
      jsonText = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    console.log("Raw response from Bedrock:", jsonText.substring(0, 200) + '...');
    
    try {
      // Try to parse the response directly as JSON
      return JSON.parse(jsonText);
    } catch (e) {
      // If direct parsing fails, try to extract JSON content more thoroughly
      
      // First, look for JSON between markdown code blocks
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (err) {
          // Still not valid, continue to next approach
          console.log("Failed to parse JSON from code block", err);
        }
      }
      
      // Next, try to find anything that looks like a complete JSON object
      const potentialJson = jsonText.match(/({[\s\S]*})/);
      if (potentialJson && potentialJson[0]) {
        try {
          return JSON.parse(potentialJson[0].trim());
        } catch (err) {
          // Still not valid
          console.log("Failed to parse JSON from regex match", err);
        }
      }
      
      // If we still haven't found valid JSON, try one more approach:
      // Look for the first opening brace and last closing brace
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonCandidate = jsonText.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonCandidate);
        } catch (err) {
          // All attempts failed
          console.log("Failed to parse JSON from braces extraction", err);
        }
      }
      
      // If all attempts fail, throw a more descriptive error
      throw new Error(`Could not parse valid JSON from the response. Raw response: ${jsonText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error calling Bedrock LLM:', error);
    throw error;
  }
}


/**
 * Get current project structure to provide context to LLM
 * @returns {Promise<object>} - Current project structure
 */
async function getCurrentProjectStructure() {
  try {
    // Check if we have a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace is open");
    }

    // Use the first workspace folder
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // Function to recursively scan directory and build structure
    async function scanDirectory(dirPath, relativePath = '') {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = [];
      
      for (const entry of entries) {
        // Skip node_modules and hidden files/directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          const children = await scanDirectory(entryPath, entryRelativePath);
          result.push({
            type: 'folder',
            name: entry.name,
            path: entryRelativePath,
            children: children
          });
        } else {
          // For files, include a preview of content (first few lines)
          let content = '';
          try {
            const fileContent = fs.readFileSync(entryPath, 'utf8');
            // Only include content for text files, and limit to first 1000 chars
            if (fileContent.length < 10000 && !isBinaryFile(entry.name)) {
              content = fileContent.substring(0, 1000);
              if (fileContent.length > 1000) {
                content += '... (content truncated)';
              }
            }
          } catch (e) {
            content = '(Unable to read file content)';
          }
          
          result.push({
            type: 'file',
            name: entry.name,
            path: entryRelativePath,
            content: content
          });
        }
      }
      
      return result;
    }
    
    // Simple check for binary files based on extension
    function isBinaryFile(filename) {
      const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.exe', '.dll'];
      const ext = path.extname(filename).toLowerCase();
      return binaryExtensions.includes(ext);
    }
    
    const projectStructure = await scanDirectory(rootPath);
    return {
      projectName: path.basename(rootPath),
      structure: projectStructure
    };
  } catch (error) {
    console.error("Error getting current project structure:", error);
    throw error;
  }
}

/**
 * Call AWS Bedrock to update existing files based on the project structure
 * @param {string} userPrompt - The user's update request
 * @param {object} currentStructure - Current project structure
 * @returns {Promise<object>} - JSON with files to update
 */
async function callBedrockForUpdates(userPrompt, currentStructure) {
  try {
    // Verify credentials are available
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials not found. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are defined in your .env file.');
    }

    // Configure AWS SDK with the verified credentials
    AWS.config.update({
      credentials: new AWS.Credentials(accessKey, secretKey),
      region: 'us-east-1'
    });

    // Initialize the Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();

    const systemPrompt = `You are a helpful assistant that updates existing project structures based on user requirements.
    
    Given the current project structure and a user's update request, create a JSON structure that represents
    the files that need to be updated or added. ONLY include files that need to be changed or created.
    
    The JSON structure should follow this format:
    {
      "updates": [
        {
          "type": "file", 
          "path": "relative/path/to/file.ext",
          "content": "Updated or new content for the file",
          "action": "update" // or "create" if it's a new file
        }
      ]
    }
    
    IMPORTANT: Your response must ONLY contain valid JSON with NO additional text, comments, or explanations.
    Return ONLY the raw JSON object. Focus on the specific changes requested by the user.`;

    // Convert current structure to a string format that's easier to process
    const structureStr = JSON.stringify(currentStructure, null, 2);

    const params = {
      modelId: model_ARN,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nCurrent project structure:\n${structureStr}\n\nUpdate request: ${userPrompt}`
          }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    };

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract the text response
    let jsonText;
    if (responseBody.content && Array.isArray(responseBody.content)) {
      jsonText = responseBody.content[0].text;
    } else if (responseBody.completion) {
      jsonText = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    console.log("Raw update response from Bedrock:", jsonText.substring(0, 200) + '...');
    
    // Use the same JSON parsing approach as in callBedrockLLM
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      // Extract JSON using regex if direct parsing fails
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (err) {
          console.log("Failed to parse JSON from code block", err);
        }
      }
      
      // Try other extraction methods
      const potentialJson = jsonText.match(/({[\s\S]*})/);
      if (potentialJson && potentialJson[0]) {
        try {
          return JSON.parse(potentialJson[0].trim());
        } catch (err) {
          console.log("Failed to parse JSON from regex match", err);
        }
      }
      
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonCandidate = jsonText.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonCandidate);
        } catch (err) {
          console.log("Failed to parse JSON from braces extraction", err);
        }
      }
      
      throw new Error(`Could not parse valid JSON from the update response.`);
    }
  } catch (error) {
    console.error('Error calling Bedrock for updates:', error);
    throw error;
  }
}

/**
 * Call AWS Bedrock to find and modify code patterns
 * @param {string} userPrompt - The user's modification request
 * @param {object} currentStructure - Current project structure
 * @returns {Promise<object>} - JSON with files to modify
 */
async function callBedrockForSearchAndModify(userPrompt, currentStructure) {
  try {
    // Verify credentials are available
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials not found. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are defined in your .env file.');
    }

    // Configure AWS SDK with the verified credentials
    AWS.config.update({
      credentials: new AWS.Credentials(accessKey, secretKey),
      region: 'us-east-1'
    });

    // Initialize the Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();

    const systemPrompt = `You are a helpful assistant that identifies specific code patterns to search for and modify.
    
    Given the current project structure and a user's request to find and modify/remove specific code patterns, 
    create a JSON structure that specifies which files to search and what patterns to find and replace.
    
    The JSON structure should follow this format:
    {
      "modifications": [
        {
          "path": "relative/path/to/file.ext",
          "patterns": [
            {
              "find": "regex or exact string pattern to find",
              "replace": "replacement string (can be empty to delete)"
            }
          ]
        }
      ]
    }
    
    For the "find" patterns, you should provide patterns that are specific enough to match only the code
    that needs to be modified, but flexible enough to account for variations like whitespace or indentation.
    
    IMPORTANT: Only include files that are likely to contain the patterns mentioned in the user request.
    Your response must ONLY contain valid JSON with NO additional text, comments, or explanations.`;

    // Convert current structure to a string format that's easier to process
    const structureStr = JSON.stringify(currentStructure, null, 2);

    const params = {
      modelId: model_ARN,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nCurrent project structure:\n${structureStr}\n\nSearch and modify request: ${userPrompt}`
          }
        ],
        temperature: 0.4,
        top_p: 0.9
      })
    };

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract the text response
    let jsonText;
    if (responseBody.content && Array.isArray(responseBody.content)) {
      jsonText = responseBody.content[0].text;
    } else if (responseBody.completion) {
      jsonText = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    console.log("Raw search and modify response from Bedrock:", jsonText.substring(0, 200) + '...');
    
    // Parse the JSON response using the same approach as in other functions
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      // Extract JSON using regex if direct parsing fails
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (err) {
          console.log("Failed to parse JSON from code block", err);
        }
      }
      
      // Try other extraction methods
      const potentialJson = jsonText.match(/({[\s\S]*})/);
      if (potentialJson && potentialJson[0]) {
        try {
          return JSON.parse(potentialJson[0].trim());
        } catch (err) {
          console.log("Failed to parse JSON from regex match", err);
        }
      }
      
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonCandidate = jsonText.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonCandidate);
        } catch (err) {
          console.log("Failed to parse JSON from braces extraction", err);
        }
      }
      
      throw new Error(`Could not parse valid JSON from the search and modify response.`);
    }
  } catch (error) {
    console.error('Error calling Bedrock for search and modify:', error);
    throw error;
  }
}

/**
 * Call AWS Bedrock to determine files to delete
 * @param {string} userPrompt - The user's delete request
 * @param {object} currentStructure - Current project structure
 * @returns {Promise<object>} - JSON with files to delete
 */
async function callBedrockForDeletes(userPrompt, currentStructure) {
  try {
    // Verify credentials are available
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS credentials not found. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are defined in your .env file.');
    }

    // Configure AWS SDK with the verified credentials
    AWS.config.update({
      credentials: new AWS.Credentials(accessKey, secretKey),
      region: 'us-east-1'
    });

    // Initialize the Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();

    const systemPrompt = `You are a helpful assistant that determines which files to delete based on user requirements.
    
    Given the current project structure and a user's delete request, create a JSON structure that represents
    the files or folders that need to be deleted.
    
    The JSON structure should follow this format:
    {
      "deletes": [
        {
          "type": "file", // or "folder"
          "path": "relative/path/to/file.ext"
        }
      ]
    }
    
    IMPORTANT: Your response must ONLY contain valid JSON with NO additional text, comments, or explanations.
    Return ONLY the raw JSON object. Be very careful with delete operations - only include items that the user
    explicitly wants to remove.`;

    // Convert current structure to a string format that's easier to process
    const structureStr = JSON.stringify(currentStructure, null, 2);

    const params = {
      modelId: model_ARN,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nCurrent project structure:\n${structureStr}\n\nDelete request: ${userPrompt}`
          }
        ],
        temperature: 0.3,
        top_p: 0.9
      })
    };

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract the text response
    let jsonText;
    if (responseBody.content && Array.isArray(responseBody.content)) {
      jsonText = responseBody.content[0].text;
    } else if (responseBody.completion) {
      jsonText = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    console.log("Raw delete response from Bedrock:", jsonText.substring(0, 200) + '...');
    
    // Parse the JSON response using the same approach as in other functions
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      // Extract JSON using regex if direct parsing fails
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (err) {
          console.log("Failed to parse JSON from code block", err);
        }
      }
      
      // Try other extraction methods as in the other functions
      const potentialJson = jsonText.match(/({[\s\S]*})/);
      if (potentialJson && potentialJson[0]) {
        try {
          return JSON.parse(potentialJson[0].trim());
        } catch (err) {
          console.log("Failed to parse JSON from regex match", err);
        }
      }
      
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonCandidate = jsonText.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonCandidate);
        } catch (err) {
          console.log("Failed to parse JSON from braces extraction", err);
        }
      }
      
      throw new Error(`Could not parse valid JSON from the delete response.`);
    }
  } catch (error) {
    console.error('Error calling Bedrock for deletes:', error);
    throw error;
  }
}

module.exports = {
    determineAction,
    callBedrockLLM,
    getCurrentProjectStructure,
    callBedrockForUpdates,
    callBedrockForSearchAndModify,
    callBedrockForDeletes
  };
