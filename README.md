# Blueprint Highlighter

A React-based tool for highlighting and annotating blueprints with RFI (Request for Information) capabilities.

## Local Development Setup

### Prerequisites
- Node.js (version 18 or higher)
- npm

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy the `.env` file and add your API keys
   - Update `GEMINI_API_KEY` with your actual API key

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Preview production build:**
   ```bash
   npm run preview
   ```

### Features
- Upload and view blueprint images
- Draw rectangles and shapes on blueprints
- Create RFI (Request for Information) annotations
- Zoom and pan functionality
- Multiple tool selection (pen, shapes, arrows, text, etc.)

### Development Notes
- The app uses Vite for fast development and building
- Tailwind CSS is loaded via CDN for styling
- TypeScript is configured for type safety
- The app is configured to run on port 3000
