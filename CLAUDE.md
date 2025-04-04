# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Check linting
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run tsc` - Type check with TypeScript

## Code Style Guidelines
- **Formatting**: Use Prettier with tabWidth: 4, printWidth: 80, double quotes, JSX single quotes
- **Imports**: Order by: React imports, third-party libraries, local components, utilities, types
- **Components**: Use functional components with hooks, props defined with TypeScript interfaces
- **Naming**: PascalCase for components/interfaces, camelCase for variables/functions
- **Types**: Use TypeScript strictly with explicit return types
- **Error Handling**: Use try/catch blocks with user-friendly messages
- **File Structure**: Components in src/components, hooks in src/hooks, utilities in src/utils
- **State Management**: Use React hooks (useState, useContext, useReducer) for state

## Project Overview
Whisper-web is a React application for transcribing audio using the KB-Whisper model, with support for recording, uploading, or providing URLs to audio files. The app focuses on Swedish transcription.