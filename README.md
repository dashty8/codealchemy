# CodeAlchemy

CodeAlchemy is a VS Code extension that uses AI to generate, modify, and delete code files based on natural language prompts.

## Features

- **Project Creation**: Generate entire project structures from descriptions
- **Code Updates**: Modify existing files with natural language requests
- **Code Refactoring**: Find and modify patterns across multiple files
- **Visual Feedback**: Watch files being created and modified with character-by-character animation

## Requirements

- VS Code 1.60.0 or higher
- AWS account with Bedrock access
- Environment variables for AWS credentials

## Installation

1. Clone this repository
2. Run `npm install`
3. Create a `.env` file with your AWS credentials
4. Press F5 to run the extension in development mode

## Usage

1. Open the CodeAlchemy panel from the activity bar
2. Type a request like "Create a React app with a login form"
3. Watch as files are created with visual feedback