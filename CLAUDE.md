# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm start` (Expo dev tools)
- **Run on Android**: `npm run android` (requires Android Studio/emulator or device)
- **Run on iOS**: `npm run ios` (requires Xcode/simulator or device)
- **Run on web**: `npm run web`
- **Run tests**: `npm test` (Jest with jest-expo preset)
- **Run a single test**: `npm test -- -t "test name pattern"`
- **Pre-Android setup**: `npm run preandroid` (generates google-services.json)

## Project Structure & Architecture

### Core Directories
- `components/` - Reusable UI components (ChatListCard, InviteListCard, etc.)
- `screens/` - Screen-level components (ChatScreen.js, InvitesScreen.js, etc.)
- `hooks/` - Custom React hooks (useChatsList, useChatThread, useMarkRead)
- `utils/` - Utility functions and constants (Constants.js, responsive.js, typography.js, backendAuth.js, etc.)
- `assets/` - Images, icons, fonts
- `__tests__/` - Test files

### Navigation & State
- Uses React Navigation (native-stack) for screen transitions
- State management primarily via React hooks and context
- Firebase for authentication, messaging, and real-time data
- Custom backend API via `utils/backendAuth` for invites, matches, etc.

### Key Features
- **Chat System**: Real-time messaging with Firebase, message threading, read receipts
- **Invites/Matching**: Swipe-based invitation system (similar to dating apps) with premium features
- **Profiles**: Detailed user profiles with LinkedIn integration, education, work experience
- **Paywall**: Free vs premium tier restrictions on invitations
- **Push Notifications**: Firebase Cloud Messaging integration
- **Analytics**: Custom event logging via `utils/swipeMonetization`

### Styling & Responsiveness
- Uses `StyleSheet.create` with responsive scaling functions (`vw`, `vh`, `moderateScale`, `responsiveFont`)
- Centralized theme colors in style definitions
- Platform-specific typography via `withPlatformFontStyles`

### Important Files
- `App.js` - Root component (not shown but typical entry point)
- `utils/Constants.js` - Base URLs and API endpoints
- `utils/firebaseAuth.js` - Firebase token handling
- `screens/ChatScreen.js` - Main chat interface (where tab styling was recently fixed)
- `screens/InvitesScreen.js` - Invitation swiping interface

### Development Notes
- Requires Expo SDK 55.0.0 - follow exact versioned docs
- Firebase configuration needed (google-services.json for Android, GoogleService-Info.plist for iOS)
- Backend API must be running for full functionality
- Test with real devices for push notifications and camera features