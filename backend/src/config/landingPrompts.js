/**
 * Landing Generator Prompts Configuration
 *
 * Contains all Gemini prompts for generating each layer of each mechanic.
 * Based on docs/LAYER_ARCHITECTURE.md
 *
 * Key principles:
 * - WHITE BACKGROUND for transparency removal via Runware rembg
 * - Specific dimensions for each element type
 * - Style consistency through multi-turn chat context
 * - Text placement instructions for rotating elements
 */

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

export const THEMES = {
  candy: {
    name: 'Candy',
    colors: ['#FF69B4', '#FFD700', '#FF6347', '#00CED1', '#9370DB', '#FF1493'],
    style: 'bright candy colors, glossy finish, playful cartoon style, sugar-coated aesthetic',
    textStyle: 'bubble letters, 3D with candy gloss',
    decorations: 'lollipops, candies, sugar crystals, colorful sprinkles'
  },
  casino: {
    name: 'Casino',
    colors: ['#FFD700', '#DC143C', '#000000', '#228B22', '#C0C0C0', '#8B0000'],
    style: 'luxurious casino aesthetic, gold and red, velvet textures, elegant and premium',
    textStyle: '3D gold with black outline, metallic sheen',
    decorations: 'poker chips, playing cards, dice, golden ornaments, red velvet'
  },
  christmas: {
    name: 'Christmas',
    colors: ['#FF0000', '#00FF00', '#FFD700', '#FFFFFF', '#8B4513', '#DC143C'],
    style: 'festive Christmas theme, snow effects, cozy winter aesthetic, holiday magic',
    textStyle: 'candy cane stripes, snowy white with red',
    decorations: 'snowflakes, holly, bells, presents, ornaments, pine branches'
  },
  neon: {
    name: 'Neon',
    colors: ['#FF00FF', '#00FFFF', '#FF1493', '#7FFF00', '#FF4500', '#9400D3'],
    style: 'cyberpunk neon aesthetic, glowing edges, dark background contrast, futuristic',
    textStyle: 'neon glow effect, electric colors, glowing outlines',
    decorations: 'neon signs, light trails, geometric shapes, circuit patterns'
  },
  tropical: {
    name: 'Tropical',
    colors: ['#FF6B35', '#00D9FF', '#39FF14', '#FFD700', '#FF1493', '#00CED1'],
    style: 'vibrant tropical paradise, beach vibes, exotic fruits, sunny atmosphere',
    textStyle: 'bold tropical colors, sun-bleached effect',
    decorations: 'palm trees, coconuts, exotic flowers, pineapples, parrots'
  },
  egyptian: {
    name: 'Egyptian',
    colors: ['#FFD700', '#1E3A5F', '#D4AF37', '#2F4F4F', '#CD853F', '#000080'],
    style: 'ancient Egyptian pharaoh theme, golden artifacts, hieroglyphics, mystical',
    textStyle: 'hieroglyphic-inspired, gold with lapis lazuli blue',
    decorations: 'pyramids, scarabs, ankh symbols, pharaoh masks, lotus flowers'
  },
  pirate: {
    name: 'Pirate',
    colors: ['#8B4513', '#FFD700', '#000000', '#DC143C', '#DEB887', '#2F4F4F'],
    style: 'pirate treasure adventure, aged wood, treasure maps, nautical elements',
    textStyle: 'weathered gold, treasure chest style',
    decorations: 'treasure chests, skulls, anchors, ships, gold coins, maps'
  },
  space: {
    name: 'Space',
    colors: ['#9400D3', '#00BFFF', '#FFD700', '#FF1493', '#00FA9A', '#4169E1'],
    style: 'cosmic space adventure, stars, nebulas, sci-fi aesthetic, galactic',
    textStyle: 'holographic, starlight glow, cosmic shimmer',
    decorations: 'stars, planets, rockets, asteroids, UFOs, satellites'
  }
};

// =============================================================================
// WHEEL MECHANIC PROMPTS
// =============================================================================

export const WHEEL_PROMPTS = {
  /**
   * Generates wheel sectors WITH prize text
   * CRITICAL: Text must be part of this layer as it rotates with sectors
   */
  sectors: (theme, prizes = ['1500', '100', '50', '25', '10', '100', '50', '25'], currency = 'EUR') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '' : currency;
    const currencySuffix = currency === 'EUR' ? '' : '';

    const prizeList = prizes.map((prize, i) => {
      const sectorNum = i + 1;
      const isJackpot = i === 0;
      return `- Sector ${sectorNum}: "${currencySymbol}${prize}${currencySuffix}"${isJackpot ? ' (JACKPOT - largest, most prominent)' : ''}`;
    }).join('\n');

    return `Generate a fortune wheel with ${prizes.length} colored sectors on WHITE BACKGROUND.

STYLE: ${themeData.style}
COLOR PALETTE: Use these colors for alternating sectors: ${themeData.colors.slice(0, 4).join(', ')}

TEXT ON EACH SECTOR (clockwise from top):
${prizeList}

TEXT REQUIREMENTS:
- Text style: ${themeData.textStyle}
- Each prize text is ROTATED to follow the sector angle (text radiates outward from center)
- Text positioned in the OUTER HALF of each sector (not near center)
- Font: Bold, clearly readable, casino-style numerals
- Jackpot sector text is 30% larger than other sectors

WHEEL REQUIREMENTS:
- ${prizes.length} equal sectors (${360 / prizes.length} degrees each)
- Clean sector divisions with thin golden lines
- Wheel fills 90% of the frame
- NO outer frame (frame is separate layer)
- NO center button (button is separate layer)
- Small decorative elements: ${themeData.decorations}

TECHNICAL:
- Resolution: 1024x1024 pixels
- WHITE BACKGROUND (will be removed for transparency)
- High contrast text for readability`;
  },

  /**
   * Generates decorative outer frame
   * CRITICAL: Center must be COMPLETELY EMPTY
   */
  frame: (theme) => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a circular decorative frame for a fortune wheel on WHITE BACKGROUND.

STYLE: ${themeData.style} - SAME STYLE as the previous wheel sectors image.

FRAME DESIGN:
- Ornate circular border/ring shape
- The CENTER is COMPLETELY EMPTY (transparent hole for wheel to show through)
- Frame is a ring with inner radius ~40% and outer radius ~50% of image
- Decorative elements around the outer edge: ${themeData.decorations}
- Small lights/gems evenly spaced around the frame (16-24 lights)
- Golden metallic finish with depth and dimension

COLOR PALETTE: ${themeData.colors.slice(0, 3).join(', ')} with gold accents

TECHNICAL:
- Resolution: 1024x1024 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Frame should overlay perfectly on the sectors from previous image`;
  },

  /**
   * Generates pointer/arrow indicator
   */
  pointer: (theme) => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a pointer arrow for a fortune wheel on WHITE BACKGROUND.

STYLE: ${themeData.style} - SAME STYLE as previous wheel images.

POINTER DESIGN:
- Arrow shape pointing DOWNWARD
- Positioned to indicate winning sector from TOP of wheel
- 3D appearance with depth and shadow
- Gem or crystal at the tip for emphasis
- Golden/metallic base with decorative details
- Slight glow effect around the pointer

DECORATIONS: Small ${themeData.decorations} elements incorporated

TECHNICAL:
- Resolution: 512x512 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Pointer should be vertically centered, tip at bottom`;
  },

  /**
   * Generates center SPIN button
   */
  center: (theme, buttonText = 'SPIN') => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a circular button for the center of a fortune wheel on WHITE BACKGROUND.

STYLE: ${themeData.style} - SAME STYLE as previous wheel images.

BUTTON DESIGN:
- Circular 3D button shape
- Text "${buttonText}" in center (bold, clear, readable)
- Text style: ${themeData.textStyle}
- Glossy/shiny surface with highlight
- Beveled edges for 3D depth
- Outer ring decoration matching wheel frame
- Subtle pulsing glow effect suggested

COLOR: Primary gold with ${themeData.colors[0]} accents

TECHNICAL:
- Resolution: 512x512 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Button should fit perfectly in wheel center`;
  },

  /**
   * Generates background scene
   */
  background: (theme, layout = 'desktop') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const resolution = layout === 'desktop' ? '1920x1080' : '1080x1920';
    const orientation = layout === 'desktop' ? 'horizontal/landscape' : 'vertical/portrait';

    return `Generate a background scene for a fortune wheel landing page.

STYLE: ${themeData.style}
ORIENTATION: ${orientation}

SCENE COMPOSITION:
- Rich, immersive background that complements the wheel
- Central area slightly darker/subdued (wheel will overlay here)
- Decorative elements around edges: ${themeData.decorations}
- Subtle radial gradient from center (lighter) to edges (darker)
- Sparkles, light rays, or glow effects suggesting excitement
- DO NOT include any wheel elements (wheel overlays separately)

ATMOSPHERE:
- Celebratory, exciting mood
- Depth through layered decorations
- Subtle particle effects (sparkles, stars, or theme-appropriate)

COLOR PALETTE: ${themeData.colors.join(', ')}

TECHNICAL:
- Resolution: ${resolution} pixels
- Full coverage, no white areas
- Optimized for web (not too complex/heavy)`;
  }
};

// =============================================================================
// BOXES MECHANIC PROMPTS
// =============================================================================

export const BOXES_PROMPTS = {
  /**
   * Generates closed gift box/treasure chest
   */
  boxClosed: (theme, boxStyle = 'gift') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const boxType = boxStyle === 'chest' ? 'treasure chest' : 'gift box';

    return `Generate a CLOSED ${boxType} on WHITE BACKGROUND.

STYLE: ${themeData.style}

BOX DESIGN:
- ${boxType === 'treasure chest' ? 'Wooden treasure chest with metal bands and lock' : 'Gift box with decorative ribbon and bow'}
- CLOSED position (lid down, sealed)
- 3D perspective view (slightly from above, angled)
- Mysterious glow emanating from seams (suggesting valuable contents)
- Decorative elements: ${themeData.decorations}

DETAILS:
- Rich textures (wood grain for chest, glossy paper for gift)
- Metallic accents (gold clasps, hinges, or ribbon)
- Subtle sparkles around the box
- Shadow beneath for grounding

COLOR PALETTE: ${themeData.colors.slice(0, 3).join(', ')}

TECHNICAL:
- Resolution: 512x512 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Box centered in frame with padding`;
  },

  /**
   * Generates open gift box/treasure chest
   */
  boxOpen: (theme, boxStyle = 'gift') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const boxType = boxStyle === 'chest' ? 'treasure chest' : 'gift box';

    return `Generate an OPEN ${boxType} on WHITE BACKGROUND.

STYLE: ${themeData.style} - SAME STYLE as the closed box from previous image.

BOX DESIGN:
- SAME ${boxType} but now OPEN (lid lifted/tilted back)
- Golden light rays bursting from inside
- Sparkles and glow effects emanating upward
- Visible glowing interior (suggesting treasure/prize)
- Same decorative elements as closed version

EFFECTS:
- Dramatic light burst from opening
- Floating sparkles/particles rising
- Energy/magic emanating from contents
- Excitement and reward feeling

TECHNICAL:
- Resolution: 512x512 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Same scale and position as closed box for animation swap`;
  },

  /**
   * Generates mascot character
   */
  character: (theme, characterType = 'mascot', emotion = 'excited') => {
    const themeData = THEMES[theme] || THEMES.casino;

    const characterDescriptions = {
      mascot: 'cute cartoon mascot creature',
      dealer: 'friendly casino dealer character',
      elf: 'cheerful holiday elf',
      pirate: 'friendly pirate character',
      alien: 'cute friendly alien',
      robot: 'friendly helper robot'
    };

    const emotionDescriptions = {
      excited: 'excited and celebratory expression, arms raised in joy',
      welcoming: 'warm welcoming pose, open arms inviting gesture',
      pointing: 'pointing toward the prize/game area',
      celebrating: 'jumping with joy, confetti celebration pose',
      winking: 'playful winking expression, thumbs up'
    };

    return `Generate a ${characterDescriptions[characterType] || characterDescriptions.mascot} on WHITE BACKGROUND.

STYLE: ${themeData.style}

CHARACTER DESIGN:
- ${emotionDescriptions[emotion] || emotionDescriptions.excited}
- Full body visible, slightly angled pose
- Appealing, friendly design suitable for all ages
- Outfit/accessories matching theme: ${themeData.decorations}
- Large expressive eyes

POSE & EXPRESSION:
- Dynamic, energetic pose
- Clearly conveys excitement about winning
- Character should "pop" and grab attention
- Looking toward viewer or toward game area

COLOR PALETTE: ${themeData.colors.slice(0, 4).join(', ')}

TECHNICAL:
- Resolution: 512x768 pixels (portrait orientation)
- WHITE BACKGROUND (will be removed for transparency)
- Character positioned for placement on left or right of screen`;
  },

  /**
   * Generates speech bubble
   */
  speechBubble: (theme, text = 'Choose a box!') => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a speech bubble on WHITE BACKGROUND.

STYLE: ${themeData.style}

BUBBLE DESIGN:
- Classic comic speech bubble shape
- Pointer/tail on left side (pointing toward character)
- Text inside: "${text}"
- Text style: ${themeData.textStyle}
- Decorative border matching theme
- Slight 3D depth/shadow effect

TEXT STYLING:
- Bold, clear, readable font
- Centered in bubble
- Exciting punctuation styling
- May include small decorative icons (stars, sparkles)

COLOR: White/cream bubble with ${themeData.colors[0]} border and text

TECHNICAL:
- Resolution: 512x256 pixels (landscape orientation)
- WHITE BACKGROUND (will be removed for transparency)`;
  },

  /**
   * Generates background for boxes mechanic
   */
  background: (theme, layout = 'desktop') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const resolution = layout === 'desktop' ? '1920x1080' : '1080x1920';
    const orientation = layout === 'desktop' ? 'horizontal/landscape' : 'vertical/portrait';

    return `Generate a background scene for a gift box selection game.

STYLE: ${themeData.style}
ORIENTATION: ${orientation}

SCENE COMPOSITION:
- Stage or showcase setting for gift boxes
- Central area clear for box placement (3 boxes typically)
- Decorative elements: ${themeData.decorations}
- Spotlight effects suggesting prize presentation
- Subtle confetti or sparkle particles
- DO NOT include any boxes (boxes overlay separately)

ATMOSPHERE:
- Game show or treasure room feeling
- Anticipation and excitement mood
- Rich, layered depth

COLOR PALETTE: ${themeData.colors.join(', ')}

TECHNICAL:
- Resolution: ${resolution} pixels
- Full coverage background
- Clear central area for box placement`;
  }
};

// =============================================================================
// CRASH / CHICKEN ROAD MECHANIC PROMPTS
// =============================================================================

export const CRASH_PROMPTS = {
  /**
   * Generates character in normal state
   */
  characterNormal: (theme, characterType = 'chicken') => {
    const themeData = THEMES[theme] || THEMES.casino;

    const characterDescriptions = {
      chicken: 'cute cartoon chicken character',
      frog: 'adorable frog character',
      runner: 'cartoon runner/athlete character',
      car: 'small cute cartoon car with face',
      rocket: 'friendly cartoon rocket with face'
    };

    return `Generate a ${characterDescriptions[characterType] || characterDescriptions.chicken} in NORMAL state on WHITE BACKGROUND.

STYLE: ${themeData.style}

CHARACTER DESIGN:
- ${characterDescriptions[characterType] || characterDescriptions.chicken}
- Standing/ready pose, alert and confident
- Happy, determined expression
- Full body, side-facing (ready to move right)
- Cute, appealing design

DETAILS:
- Clear outline for visibility against any background
- Slight shadow beneath for grounding
- Theme-appropriate accessories: small ${themeData.decorations} elements

COLOR PALETTE: ${themeData.colors.slice(0, 3).join(', ')}

TECHNICAL:
- Resolution: 256x256 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Character sized to fit road/path crossing game`;
  },

  /**
   * Generates character in lose/crash state
   */
  characterLose: (theme, characterType = 'chicken') => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a ${characterType} character in CRASHED/LOSE state on WHITE BACKGROUND.

STYLE: ${themeData.style} - SAME character as previous normal state image.

CHARACTER STATE:
- Same character but showing defeat/crash reaction
- Dizzy/dazed expression (spiral eyes, stars around head)
- Knocked over or tumbling pose
- Comedic rather than violent (family-friendly)
- Feathers/particles flying off (if chicken)

EFFECTS:
- Motion blur suggesting impact
- Small stars or swirls around head
- Exaggerated cartoon crash effect
- Still cute despite defeat

TECHNICAL:
- Resolution: 256x256 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Same scale as normal state for animation swap`;
  },

  /**
   * Generates road/crossing background
   */
  road: (theme, lanes = 5) => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a multi-lane road/crossing on WHITE BACKGROUND.

STYLE: ${themeData.style}

ROAD DESIGN:
- ${lanes} horizontal lanes/crossing paths
- Clear lane divisions (dashed lines or barriers)
- Start zone on left, finish zone on right
- Each lane clearly distinguishable
- Safe zones between lanes marked

ELEMENTS:
- Theme-appropriate lane decorations
- Multiplier increase indicators (1x, 1.5x, 2x, etc. zones)
- Danger zone markings
- Decorative borders: ${themeData.decorations}

COLOR PALETTE: Road neutral with ${themeData.colors.slice(0, 2).join(', ')} accents

TECHNICAL:
- Resolution: 1280x720 pixels (landscape)
- WHITE or themed BACKGROUND
- Clear paths for character movement`;
  },

  /**
   * Generates obstacle (car, bird, etc.)
   */
  obstacle: (theme, obstacleType = 'car', variant = 1) => {
    const themeData = THEMES[theme] || THEMES.casino;

    const obstacleDescriptions = {
      car: `cartoon car variant ${variant} (different color/style)`,
      truck: 'cartoon delivery truck',
      bus: 'cartoon bus',
      bird: 'swooping cartoon bird',
      boulder: 'rolling cartoon boulder',
      ufo: 'cartoon UFO/flying saucer'
    };

    return `Generate a ${obstacleDescriptions[obstacleType] || obstacleDescriptions.car} on WHITE BACKGROUND.

STYLE: ${themeData.style}

OBSTACLE DESIGN:
- ${obstacleDescriptions[obstacleType]}
- Moving LEFT to RIGHT direction
- Cute/cartoon style but clearly an obstacle
- Motion lines suggesting movement
- Variant ${variant} of ${obstacleType} (unique color scheme)

APPEARANCE:
- Distinct silhouette for quick recognition
- Bright colors for visibility
- Slightly menacing but still family-friendly

COLOR: Variant ${variant} color from ${themeData.colors.join(', ')}

TECHNICAL:
- Resolution: 256x128 pixels (landscape, vehicle proportions)
- WHITE BACKGROUND (will be removed for transparency)
- Facing/moving right`;
  },

  /**
   * Generates multiplier badge
   */
  multiplierBadge: (theme, multiplier = '2.5x') => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a multiplier badge showing "${multiplier}" on WHITE BACKGROUND.

STYLE: ${themeData.style}

BADGE DESIGN:
- Eye-catching badge/banner shape
- Large text: "${multiplier}"
- Text style: ${themeData.textStyle}
- Glowing/pulsing effect suggested
- Star burst or explosion shape behind

ELEMENTS:
- Metallic gold finish
- Sparkle effects
- 3D depth and shadow
- Small decorative elements: ${themeData.decorations}

TECHNICAL:
- Resolution: 256x256 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Badge should "pop" and grab attention`;
  },

  /**
   * Generates background for crash/road mechanic
   */
  background: (theme, layout = 'desktop') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const resolution = layout === 'desktop' ? '1920x1080' : '1080x1920';

    return `Generate a background scene for a road-crossing/crash game.

STYLE: ${themeData.style}
ORIENTATION: ${layout === 'desktop' ? 'horizontal/landscape' : 'vertical/portrait'}

SCENE:
- Road/path crossing environment
- Start area on left, prize area on right
- Atmospheric depth (buildings, scenery in distance)
- Theme decorations: ${themeData.decorations}
- DO NOT include road lanes (road overlays separately)

ATMOSPHERE:
- Exciting, adventurous mood
- Clear visual flow from left to right
- Sense of danger and reward

COLOR PALETTE: ${themeData.colors.join(', ')}

TECHNICAL:
- Resolution: ${resolution} pixels
- Full coverage background`;
  }
};

// =============================================================================
// TOWER / STACKER MECHANIC PROMPTS
// =============================================================================

export const TOWER_PROMPTS = {
  /**
   * Generates building block for stacking
   */
  buildingBlock: (theme, variant = 1) => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a building block for a stacking tower game on WHITE BACKGROUND.

STYLE: ${themeData.style}

BLOCK DESIGN:
- Rectangular building segment (wider than tall)
- 3D perspective (isometric-style)
- Variant ${variant} with unique appearance
- Windows, doors, or decorative patterns
- Construction/building aesthetic

DETAILS:
- Clear edges for stacking alignment
- Theme decorations: ${themeData.decorations}
- Distinct color: ${themeData.colors[variant % themeData.colors.length]}

TECHNICAL:
- Resolution: 512x256 pixels
- WHITE BACKGROUND (will be removed for transparency)
- Designed to stack vertically`;
  },

  /**
   * Generates crane hook
   */
  hook: (theme) => {
    const themeData = THEMES[theme] || THEMES.casino;

    return `Generate a crane hook for a stacking game on WHITE BACKGROUND.

STYLE: ${themeData.style}

HOOK DESIGN:
- Classic crane hook shape
- Metallic golden/steel appearance
- Rope or chain attachment at top
- Strong, industrial look
- Subtle glow effect

TECHNICAL:
- Resolution: 256x512 pixels (tall)
- WHITE BACKGROUND (will be removed for transparency)`;
  },

  /**
   * Generates sky background for tower
   */
  background: (theme, layout = 'desktop') => {
    const themeData = THEMES[theme] || THEMES.casino;
    const resolution = layout === 'desktop' ? '1920x1080' : '1080x1920';

    return `Generate a sky/cityscape background for a tower stacking game.

STYLE: ${themeData.style}
ORIENTATION: ${layout === 'desktop' ? 'horizontal/landscape' : 'vertical/portrait'}

SCENE:
- Sky background with clouds
- City skyline silhouette at bottom
- Sun or moon for atmosphere
- Height progression feeling (ground to sky)
- Theme decorations: ${themeData.decorations}

ATMOSPHERE:
- Upward aspiration feeling
- Achievement and height
- Dynamic sky with depth

COLOR PALETTE: Sky blues with ${themeData.colors.slice(0, 2).join(', ')} accents

TECHNICAL:
- Resolution: ${resolution} pixels
- Gradient sky (darker top, lighter horizon)`;
  }
};

// =============================================================================
// MAIN EXPORT - ALL PROMPTS ORGANIZED BY MECHANIC
// =============================================================================

export const LANDING_PROMPTS = {
  wheel: WHEEL_PROMPTS,
  boxes: BOXES_PROMPTS,
  crash: CRASH_PROMPTS,
  tower: TOWER_PROMPTS
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all layer names for a mechanic
 */
export const getMechanicLayers = (mechanic) => {
  const layers = {
    wheel: ['sectors', 'frame', 'pointer', 'center', 'background'],
    boxes: ['boxClosed', 'boxOpen', 'character', 'speechBubble', 'background'],
    crash: ['characterNormal', 'characterLose', 'road', 'obstacle', 'multiplierBadge', 'background'],
    tower: ['buildingBlock', 'hook', 'background']
  };
  return layers[mechanic] || [];
};

/**
 * Get prompt function for a specific layer
 */
export const getLayerPrompt = (mechanic, layer) => {
  const prompts = LANDING_PROMPTS[mechanic];
  if (!prompts) return null;
  return prompts[layer] || null;
};

/**
 * Get all available themes
 */
export const getAvailableThemes = () => {
  return Object.keys(THEMES);
};

/**
 * Get theme data by name
 */
export const getThemeData = (themeName) => {
  return THEMES[themeName] || THEMES.casino;
};

/**
 * Generate all prompts for a mechanic with given theme
 */
export const generateMechanicPrompts = (mechanic, theme, options = {}) => {
  const layers = getMechanicLayers(mechanic);
  const prompts = {};

  layers.forEach(layer => {
    const promptFn = getLayerPrompt(mechanic, layer);
    if (promptFn) {
      // Apply options based on layer type
      switch (layer) {
        case 'sectors':
          prompts[layer] = promptFn(theme, options.prizes, options.currency);
          break;
        case 'center':
          prompts[layer] = promptFn(theme, options.buttonText);
          break;
        case 'character':
        case 'characterNormal':
        case 'characterLose':
          prompts[layer] = promptFn(theme, options.characterType, options.emotion);
          break;
        case 'boxClosed':
        case 'boxOpen':
          prompts[layer] = promptFn(theme, options.boxStyle);
          break;
        case 'obstacle':
          prompts[layer] = promptFn(theme, options.obstacleType, options.variant);
          break;
        case 'multiplierBadge':
          prompts[layer] = promptFn(theme, options.multiplier);
          break;
        case 'speechBubble':
          prompts[layer] = promptFn(theme, options.speechText);
          break;
        case 'road':
          prompts[layer] = promptFn(theme, options.lanes);
          break;
        case 'buildingBlock':
          prompts[layer] = promptFn(theme, options.variant);
          break;
        case 'background':
          prompts[layer] = promptFn(theme, options.layout);
          break;
        default:
          prompts[layer] = promptFn(theme);
      }
    }
  });

  return prompts;
};

export default {
  THEMES,
  LANDING_PROMPTS,
  WHEEL_PROMPTS,
  BOXES_PROMPTS,
  CRASH_PROMPTS,
  TOWER_PROMPTS,
  getMechanicLayers,
  getLayerPrompt,
  getAvailableThemes,
  getThemeData,
  generateMechanicPrompts
};
