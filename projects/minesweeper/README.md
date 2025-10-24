# Minesweeper

A classic minesweeper game implementation built for the AI Demo Playground sandbox environment.

## Features

- **Three difficulty levels:**
  - Easy: 9×9 grid with 10 mines
  - Medium: 16×16 grid with 40 mines
  - Hard: 16×30 grid with 99 mines

- **Core gameplay:**
  - Left-click to reveal cells
  - Right-click to place/remove flags
  - Number indicators show adjacent mine count
  - Recursive reveal for empty cells
  - First click is always safe (mines placed after first interaction)

- **Game statistics:**
  - Real-time mine counter (total mines minus flags placed)
  - Timer that starts on first click
  - Win/lose message overlay with final time

- **Visual feedback:**
  - Color-coded numbers (1-8)
  - Hover effects on unrevealed cells
  - Exploded mine animation
  - Status badges and indicators

## Technical Implementation

### Architecture

- **Pure vanilla JavaScript** - No framework dependencies
- **Shadow DOM compatible** - Uses `document.currentScript.getRootNode()` for DOM queries
- **Self-contained** - All styles and logic in a single HTML file
- **Automatic cleanup** - Timers and event listeners managed by sandbox environment

### Game Logic

#### Board Initialization
```javascript
// Board uses 2D arrays for state tracking:
// - board[row][col]: -1 for mine, 0-8 for adjacent mine count
// - revealed[row][col]: boolean for cell visibility
// - flagged[row][col]: boolean for flag placement
```

#### Mine Placement Algorithm
- Generates random mine positions after first click
- Ensures first clicked cell and surrounding 8 cells are safe
- Calculates adjacent mine counts for all non-mine cells

#### Reveal Logic
- Single cell reveal checks for mines
- Empty cell (0 adjacent mines) triggers recursive flood-fill reveal
- Game ends on mine reveal or when all safe cells are revealed

#### Timer Management
- Uses `setInterval` for 1-second updates
- Starts on first cell interaction
- Stops on win/lose conditions
- Automatically cleaned up by sandbox instrumentation

### CSS Grid Layout

The game board uses CSS Grid for precise cell positioning:
```css
.game-board {
  display: grid;
  grid-template-columns: repeat(cols, 30px);
  grid-template-rows: repeat(rows, 30px);
  gap: 2px;
}
```

Each cell is a fixed 30×30px flex container for centered content.

### Event Handling

- **Click events**: Attached to individual cells for reveal logic
- **Context menu events**: Prevented on game board, handled for flag placement
- **Button clicks**: Difficulty selection and new game restart
- **Event delegation**: Not used; each cell gets direct handlers for simplicity

### State Management

Game state is stored in a single object:
```javascript
state = {
  difficulty: 'easy',
  rows: 9,
  cols: 9,
  mines: 10,
  board: [],        // 2D array of cell values
  revealed: [],     // 2D array of revealed states
  flagged: [],      // 2D array of flag states
  gameOver: false,
  gameWon: false,
  firstClick: true,
  timer: 0,
  timerInterval: null
}
```

### Shadow DOM Considerations

- Uses `sandboxRoot` for all DOM queries
- Styles scoped with `:host` selector
- Transparent body background for parent inheritance
- Position absolute for overlay (not fixed)
- All resources auto-cleaned on navigation

## Color Scheme

The design uses a dark theme with blue accents:
- Background: `#0f172a` (deep slate)
- Primary: `#60a5fa` (sky blue)
- Borders: `#334155` (slate gray)
- Cell background: `#334155` (slate)
- Revealed cells: `#1e293b` (darker slate)

Number colors use semantic rainbow coding (1=blue, 2=green, 3=red, etc.)

## Browser Compatibility

- Requires ES6+ JavaScript support
- CSS Grid and Flexbox required
- Tested in modern Chrome, Firefox, Safari, Edge
- Emoji rendering for mines (💣) and flags (🚩)

## Known Limitations

- No keyboard controls (mouse/touch only)
- No undo/redo functionality
- No save/load game state
- No difficulty customization beyond presets
- Timer doesn't pause when tab is hidden

## Future Enhancements

Possible improvements:
- Keyboard navigation with arrow keys
- Quick-reveal with middle-click on numbers
- Chord clicking (reveal all adjacent when flags match)
- Best time tracking per difficulty
- Custom board size/mine count
- Mobile touch improvements
- Sound effects
- Animation polish

## Development

Built using:
- Claude Sonnet 4.5 AI assistant
- Shadow DOM sandbox architecture
- Vanilla JavaScript (ES6+)
- CSS3 Grid and Flexbox
- No build tools or transpilation

## License

Part of the AI Demo Playground project.

