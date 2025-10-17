# 🎵 VibeTune

<div align="center">
  <img src="public/VIBETUNE FULL.png" alt="VibeTune Full Logo" width="400"/>
  
  <br><br>
  
  <img src="public/VibeTune WBG.png" alt="VibeTune Logo" width="200"/>
  
  <br><br>
  
  **Real-time Music Synchronization Platform**
  
  *Listen together, stay in sync, create memories*
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.0-blue.svg)](https://reactjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-Server-green.svg)](https://nodejs.org/)
  [![Vite](https://img.shields.io/badge/Vite-Build%20Tool-purple.svg)](https://vitejs.dev/)
</div>

---

## 📖 What is VibeTune?

VibeTune is a revolutionary real-time music synchronization platform that allows multiple users to listen to music together, perfectly synchronized, from anywhere in the world. Whether you're hosting a virtual party, studying with friends, or just want to share your favorite tracks, VibeTune creates a seamless shared listening experience.

### 🎯 **Core Concept**
Imagine Spotify's collaborative playlists, but with **real-time synchronization** - when one person plays, pauses, or skips a song, everyone else experiences it simultaneously. No more "wait, what song are you on?" moments!

---

## ✨ Key Features

### 🎵 **Real-time Music Synchronization**
- **Instant Sync**: All users hear the same song at the exact same time
- **Seamless Playback**: No interruptions when new songs are added
- **Smart Queue Management**: Play next, delete, and reorder songs in real-time
- **Skip Controls**: Next/previous buttons work for everyone simultaneously
- **Progress Sync**: Seek bar updates across all users in real-time

### 👥 **Social Features**
- **Live User List**: See who's currently in the room with real-time updates
- **Chat System**: Communicate with other listeners while music plays
- **Room Codes**: Easy 6-character codes for sharing rooms with friends
- **Auto-cleanup**: Users are automatically removed when they leave
- **User Presence**: Know when friends join or leave the room

### 🎨 **Beautiful Modern UI**
- **Spotify-inspired Design**: Clean, professional interface with green accent colors
- **Glossy Effects**: Modern glassmorphism design with smooth animations
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile devices
- **Dark Theme**: Easy on the eyes for long listening sessions
- **Hover Animations**: Interactive elements with smooth transitions

### 📁 **Advanced File Management**
- **MP3 Upload**: Drag & drop support for audio files
- **Batch Upload**: Add multiple songs at once
- **Automatic Duration Detection**: No manual input required
- **File Validation**: Ensures only supported audio formats are uploaded
- **Error Handling**: Graceful handling of upload failures and network issues

### 🔧 **Technical Excellence**
- **Lightning Fast**: 200ms polling for near-instant synchronization
- **Robust Error Handling**: Automatic retries and fallback mechanisms
- **Cross-browser Support**: Works on Chrome, Firefox, Safari, and Edge
- **Mobile Optimized**: Touch-friendly controls and responsive design
- **Offline Resilience**: Graceful degradation when network is unstable

---
## 🎮 User Guide

### **Creating Your First Room**
1. **Enter Username**: Choose a display name for yourself
2. **Click "Create New Room"**: Generate a unique 6-character room code
3. **Share the Code**: Send the room code to friends (e.g., "ABC123")
4. **Start Listening**: Upload songs and begin your shared experience

### **Joining a Friend's Room**
1. **Enter Username**: Your display name in the room
2. **Enter Room Code**: The 6-character code your friend shared
3. **Click "Join Room"**: You'll be instantly connected
4. **Start Chatting**: Use the chat to communicate with other listeners

### **Managing Your Music**
- **Upload Songs**: Click "Upload MP3" to add your music files
- **Play Music**: Click the ▶️ button next to any song to start playing
- **Queue Management**: Use ⬆️ to move songs to play next, 🗑️ to delete
- **Skip Songs**: Use the footer controls to skip forward/backward
- **Chat**: Type messages to communicate with other users

### **Advanced Features**
- **Auto-play Next**: Songs automatically advance when they end
- **Real-time Sync**: All actions are synchronized across users
- **User Presence**: See who's online and when they join/leave
- **Responsive Design**: Works on any device size
---

## 🏗️ How It Works

### **Architecture Overview**
VibeTune uses a hybrid architecture combining modern web technologies:

1. **Frontend (React + Vite)**: Fast, responsive user interface
2. **Backend (Node.js + Express)**: Real-time synchronization server
3. **Database (Supabase)**: User management, chat, and room data
4. **Storage (Supabase Storage)**: Audio file hosting and management

### **Synchronization Technology**
- **HTTP Polling**: Lightweight, reliable real-time updates every 200ms
- **State Management**: React Context API for efficient state sharing
- **Event Broadcasting**: Changes are instantly propagated to all users
- **Conflict Resolution**: Smart handling of simultaneous user actions

### **Data Flow**
```
User Action → Local State Update → Server Broadcast → Other Users Update
```

---

## 🚀 Getting Started

### **Prerequisites**
Before you begin, ensure you have:
- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Supabase account** - [Sign up here](https://supabase.com/)
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)

### **Installation Steps**

#### 1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/vibetune.git
cd vibetune
```

#### 2. **Install Dependencies**
```bash
# Install main application dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

#### 3. **Set Up Supabase Database**
1. Create a new project in [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to SQL Editor and run the schema from `supabase-schema.sql`
3. Create a public storage bucket named `songs`
4. Copy your project URL and anon key

#### 4. **Configure Environment Variables**
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 5. **Start the Application**
```bash
# Terminal 1: Start the main application
npm run dev

# Terminal 2: Start the synchronization server
cd server
npm start
```

#### 6. **Open in Browser**
Navigate to `http://localhost:5173` and start using VibeTune!

---

## 🔧 Technical Details

### **Frontend Stack**
- **React 18**: Latest React with concurrent features
- **Vite**: Lightning-fast build tool and dev server
- **React Router**: Client-side routing for navigation
- **Context API**: Efficient state management without Redux
- **Custom Hooks**: Reusable logic for authentication and playback

### **Backend Stack**
- **Node.js**: JavaScript runtime for server-side logic
- **Express**: Minimal web framework for API endpoints
- **CORS**: Cross-origin resource sharing for web compatibility
- **Rate Limiting**: Protection against abuse and spam

### **Database & Storage**
- **Supabase**: Backend-as-a-Service for rapid development
- **PostgreSQL**: Robust relational database for user data
- **Real-time Subscriptions**: Live updates for chat and user presence
- **Row Level Security**: Secure data access and user isolation
- **Storage API**: Efficient file upload and management

### **Synchronization System**
- **HTTP Polling**: 200ms intervals for real-time updates
- **State Reconciliation**: Smart conflict resolution
- **Event Broadcasting**: Efficient change propagation
- **Fallback Mechanisms**: Graceful degradation on network issues

---

## 📁 Project Structure

```
vibetune/
├── public/                    # Static assets
│   ├── VibeTune WBG.png      # Logo without background
│   ├── VIBETUNE FULL.png     # Full logo with text
│   └── music img.png         # Default album artwork
├── src/                      # Source code
│   ├── components/           # Reusable UI components
│   │   └── ErrorBoundary.jsx # Error handling component
│   ├── contexts/            # React context providers
│   │   ├── AuthContext.jsx  # User authentication
│   │   └── PlaybackContext.jsx # Music playback state
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.js       # Authentication logic
│   │   └── usePlayback.js   # Playback controls
│   ├── lib/                 # External library configurations
│   │   └── supabase.js      # Supabase client setup
│   ├── pages/               # Main application pages
│   │   ├── Home.jsx         # Landing page
│   │   └── Room.jsx         # Main room interface
│   ├── utils/               # Utility functions
│   │   ├── media-resolver.js # Audio file handling
│   │   ├── queueManager.js  # Queue management logic
│   │   └── serverSync.js    # Real-time synchronization
│   ├── App.jsx              # Main application component
│   ├── App.css              # Global styles
│   └── main.jsx             # Application entry point
├── server/                  # Backend server
│   ├── server.js            # Express server implementation
│   ├── package.json         # Server dependencies
│   └── node_modules/        # Server packages
├── supabase-schema.sql      # Database schema
├── SUPABASE_SETUP.md        # Detailed setup instructions
├── package.json             # Main application dependencies
├── vite.config.js           # Vite configuration
└── README.md                # This file
```

---

## 🐛 Troubleshooting

### **Common Issues & Solutions**

#### **Songs Not Playing**
- **Check File Format**: Ensure files are MP3, WAV, or other supported formats
- **Verify File Integrity**: Make sure the audio file isn't corrupted
- **Browser Compatibility**: Try a different browser (Chrome recommended)
- **Network Issues**: Check your internet connection stability

#### **Synchronization Problems**
- **Server Status**: Ensure the sync server is running on port 3001
- **Network Connectivity**: Check if all users have stable internet
- **Room Code**: Verify everyone is using the same room code
- **Browser Refresh**: Try refreshing the page to reconnect

#### **Upload Failures**
- **File Size**: Check if file is under 50MB limit
- **Supabase Permissions**: Verify storage bucket is public
- **File Format**: Ensure file is a supported audio format
- **Network Stability**: Upload requires stable connection

#### **User Interface Issues**
- **Browser Cache**: Clear browser cache and reload
- **JavaScript Errors**: Check browser console for error messages
- **Responsive Design**: Try different screen sizes or devices
- **CSS Loading**: Ensure all stylesheets are loading properly

### **Getting Help**
1. **Check Console**: Open browser developer tools for error messages
2. **Network Tab**: Monitor network requests for failed connections
3. **GitHub Issues**: Report bugs on the project's issue tracker
4. **Community Support**: Join discussions for user-to-user help

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### **Ways to Contribute**
- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new functionality
- **Code Contributions**: Submit pull requests for improvements
- **Documentation**: Help improve guides and tutorials
- **Testing**: Test on different devices and browsers

### **Development Workflow**
1. **Fork the Repository**: Create your own copy
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Make Changes**: Implement your improvements
4. **Test Thoroughly**: Ensure everything works correctly
5. **Commit Changes**: `git commit -m 'Add amazing feature'`
6. **Push to Branch**: `git push origin feature/amazing-feature`
7. **Open Pull Request**: Submit for review and merge

### **Code Standards**
- **ESLint**: Follow the project's linting rules
- **Prettier**: Maintain consistent code formatting
- **Comments**: Document complex logic and functions
- **Testing**: Add tests for new features when possible

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### **What This Means**
- ✅ **Commercial Use**: Use in commercial projects
- ✅ **Modification**: Modify and adapt the code
- ✅ **Distribution**: Share and distribute freely
- ✅ **Private Use**: Use in private projects
- ❌ **Liability**: No warranty or liability provided
- ❌ **Trademark**: Cannot use the VibeTune name/trademark

---

## 🙏 Acknowledgments

### **Technologies & Services**
- **Supabase**: Amazing backend-as-a-service platform
- **React Team**: Incredible JavaScript framework
- **Vite**: Lightning-fast build tool and dev server
- **Node.js**: Powerful server-side JavaScript runtime
- **Express**: Minimal and flexible web framework

### **Design Inspiration**
- **Spotify**: UI/UX design patterns and color schemes
- **Modern Web Design**: Glassmorphism and gradient trends
- **Music Streaming**: User experience best practices

### **Community**
- **Open Source Contributors**: Everyone who helps improve the project
- **Beta Testers**: Users who provide feedback and bug reports
- **Music Lovers**: The community that makes this project meaningful

---

## 📞 Support & Contact

### **Stay Updated**
- **Watch Repository**: Get notified of new releases
- **Star Project**: Show your support and bookmark
- **Follow Updates**: Check for new features and improvements

### **Feedback**
We value your feedback! Whether it's:
- 🐛 **Bug Reports**: Help us fix issues
- 💡 **Feature Ideas**: Suggest new functionality
- 📖 **Documentation**: Help improve guides
- ⭐ **Reviews**: Share your experience

---

<div align="center">
  <h3>🎵 Made with ❤️ for Music Lovers 🎵</h3>
  <p><em>Bringing people together through the power of music</em></p>
  <p>© 2025 VibeTune. All rights reserved.</p>
  
  <br>
  
  <p>
    <strong>Ready to start your musical journey?</strong><br>
    <a href="#-getting-started">Get Started Now →</a>
  </p>
</div>