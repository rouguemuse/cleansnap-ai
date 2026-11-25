/**
 * CleanSnap Studio — 5-Layer Intelligent Instructional & Feature Discovery Engine
 *
 * Implements:
 * - Internal Feature Inventory (`FEATURE_INVENTORY`)
 * - Layer A: First-Launch Welcome & 3 Entry Points (`WELCOME_CONFIG`)
 * - Layer B: Event-Driven Contextual Instructional Hints (`CONTEXTUAL_HINTS`)
 * - Layer C: Context-Sensitive Instructional Status Bar (`resolveContextualStatusBar`)
 * - Layer D: Rich Technical Control Guides & Guide Mode (`RICH_CONTROL_GUIDES`)
 * - Layer E: Interactive Technique Library with Project Isolation (`TECHNIQUE_LIBRARY`)
 */

export const INSTRUCTIONAL_STORAGE_KEY = 'cleansnap_instructional_state_v1';

export const DEFAULT_INSTRUCTIONAL_STATE = {
  welcomeCompleted: false,
  autoHintsEnabled: true,
  guideModeEnabled: false,
  seenHints: {},
  dismissedHints: {},
  completedActions: {},
  lastEvent: 'initial_load'
};

/**
 * 1. Complete Internal Feature Inventory
 */
export const FEATURE_INVENTORY = [
  {
    id: 'batch_import_ingestion',
    category: 'Ingestion',
    name: 'Single & Batch Folder Photo Import',
    discoverability: 'high',
    requiresPriorKnowledge: false,
    summary: 'Ingests single images or folders (.PNG, .JPG, .WEBP, .AVIF, .HEIC) with <5ms acknowledgment and SHA-256 deduplication.',
    relatedFeatures: ['neural_saliency_cutout', 'contact_sheet_filmstrip']
  },
  {
    id: 'neural_saliency_cutout',
    category: 'Segmentation',
    name: 'On-Device U²-Net Neural Saliency & Bilateral Edge Snap',
    discoverability: 'high',
    requiresPriorKnowledge: false,
    summary: 'Runs 320×320 U²-Net ONNX inference locally in WebAssembly and snaps alpha boundaries to full-resolution RGB edges.',
    relatedFeatures: ['edge_brush_refiner', 'color_decontamination']
  },
  {
    id: 'studio_environment_compositor',
    category: 'Transformation',
    name: '11 Studio Backdrop Environments & Contact Shadow Compositor',
    discoverability: 'high',
    requiresPriorKnowledge: false,
    summary: 'Stages extracted subjects into 5 included studio backdrops and 6 industry-specific backdrop packs with realistic floor occlusion.',
    relatedFeatures: ['before_after_comparison_slider', 'subject_surface_polish']
  },
  {
    id: 'before_after_comparison_slider',
    category: 'Inspection',
    name: 'Coordinate-Aligned Before / After Split Comparison Stage',
    discoverability: 'high',
    requiresPriorKnowledge: false,
    summary: 'Interactive split-screen divider (pointer drag + ArrowLeft/ArrowRight/Home/End keys) in shared 4:3 coordinate space.',
    relatedFeatures: ['studio_environment_compositor', 'edge_brush_refiner']
  },
  {
    id: 'edge_brush_refiner',
    category: 'Refinement',
    name: 'Sub-Pixel Manual Edge Refiner (+ Restore / - Erase / 400% Pan & Zoom)',
    discoverability: 'medium',
    requiresPriorKnowledge: true,
    summary: 'Non-destructive alpha mask painting workspace with 20-step Undo/Redo, adjustable brush size (4–120px), and hardness (10–100%).',
    relatedFeatures: ['ruby_mask_inspector', 'morphological_expand_choke', 'edge_feathering', 'color_decontamination']
  },
  {
    id: 'ruby_mask_inspector',
    category: 'Inspection',
    name: 'Ruby Mask & Contrast Backdrop Inspection Modes',
    discoverability: 'low',
    requiresPriorKnowledge: true,
    summary: 'Switches the refinement viewport between Checkerboard, Ruby Mask Overlay, Dark Void, Light Paper, and Active Studio Backdrop.',
    relatedFeatures: ['edge_brush_refiner']
  },
  {
    id: 'morphological_expand_choke',
    category: 'Refinement',
    name: 'Morphological Mask Expand / Contract (-10px to +10px)',
    discoverability: 'low',
    requiresPriorKnowledge: true,
    summary: 'Uniformly dilates (+px) or erodes (-px) the entire alpha silhouette boundary to eliminate 1–2px outer fringes.',
    relatedFeatures: ['edge_feathering', 'color_decontamination']
  },
  {
    id: 'edge_feathering',
    category: 'Refinement',
    name: 'Separable Gaussian Edge Feathering (0px to 10px)',
    discoverability: 'medium',
    requiresPriorKnowledge: true,
    summary: 'Softens hard binary cutout transitions so hair, fabric, and curved surfaces blend naturally into new studio backdrops.',
    relatedFeatures: ['morphological_expand_choke', 'color_decontamination']
  },
  {
    id: 'color_decontamination',
    category: 'Refinement',
    name: 'Foreground RGB Color-Bleed Decontamination (0% to 100%)',
    discoverability: 'low',
    requiresPriorKnowledge: true,
    summary: 'Replaces background color spill (e.g. chroma green or bright concrete reflection) on semi-transparent boundary pixels with interior foreground color.',
    relatedFeatures: ['edge_feathering', 'edge_brush_refiner']
  },
  {
    id: 'vector_clipped_svg_export',
    category: 'Export',
    name: 'Vector-Clipped .SVG Export (Embedded PNG + Marching-Squares Cutline Path)',
    discoverability: 'medium',
    requiresPriorKnowledge: true,
    summary: 'Traces a closed Marching-Squares vector <clipPath> contour around the full-resolution transparent PNG for vinyl cutters, stickers, and Figma.',
    relatedFeatures: ['batch_zip_export_vault']
  },
  {
    id: 'batch_zip_export_vault',
    category: 'Export',
    name: 'Batch .ZIP Export Vault',
    discoverability: 'medium',
    requiresPriorKnowledge: false,
    summary: 'Packages all completed cutouts and vector-clipped .SVG assets into a single organized .ZIP archive (Pro entitlement).',
    relatedFeatures: ['vector_clipped_svg_export']
  }
];

/**
 * Layer A: First-Launch Welcome Configuration
 */
export const WELCOME_CONFIG = {
  eyebrow: 'WELCOME TO CLEANSNAP STUDIO · ON-DEVICE CREATIVE WORKSTATION',
  title: 'Studio Subject Extraction, Edge Refinement & Vector Cutlines',
  subtitle:
    'CleanSnap isolates subjects 100% locally on your device, removes background color spill, composites onto 11 studio environments, and exports full-resolution .PNG, .JPG, and vector-clipped .SVG cutlines.',
  showcaseExamples: [
    {
      id: 'vs_figure_greenscreen',
      title: 'Chroma & Studio Rig Removal',
      problem: 'Raw studio C-stands, lighting flags, and green floor spill around boots.',
      outcome: 'Clean figure extraction with decontaminated edges and natural contact shadows.',
      beforeImg: '/samples/figure_greenscreen_before.jpg',
      afterImg: '/samples/figure_greenscreen_after.jpg'
    },
    {
      id: 'user_wax_letter',
      title: 'Fine Deckled Paper & Typography',
      problem: 'Complex wood grain, brass key, and warm candle spill along fibrous paper edges.',
      outcome: 'Crisp deckled parchment silhouette preserved without blurring fine calligraphy.',
      beforeImg: '/samples/wax_letter_before.jpg',
      afterImg: '/samples/wax_letter_after.jpg'
    },
    {
      id: 'user_sports_coupe',
      title: 'Automotive Reflection & Shadow Isolation',
      problem: 'Dark cyclorama floor merging with gloss-black fenders and tire treads.',
      outcome: 'Sharp bodywork separation staged on an architectural studio backdrop.',
      beforeImg: '/samples/sports_coupe_before.jpg',
      afterImg: '/samples/sports_coupe_after.jpg'
    }
  ],
  workflowPillars: [
    {
      step: '01',
      title: 'Import & Extract Locally',
      detail: 'Drop photos or folders. Your original source is always preserved untouched.'
    },
    {
      step: '02',
      title: 'Compare & Stage Backdrops',
      detail: 'Scrub the split divider across 11 studio environments or transparent alpha.'
    },
    {
      step: '03',
      title: 'Refine Intricate Boundaries',
      detail: 'Use Ruby Mask view, + / - brushes, choke, and color decontamination.'
    },
    {
      step: '04',
      title: 'Export .PNG, .JPG & Vector .SVG',
      detail: 'Includes 3 free clean trial exports; unlock Studio Pro ($19) for unlimited & batch .ZIP.'
    }
  ]
};

/**
 * Layer B: Event-Driven Contextual Instructional Hints
 */
export const CONTEXTUAL_HINTS = {
  after_import: {
    id: 'after_import',
    anchor: 'contact-sheet',
    title: 'Original Source Preserved',
    message:
      'Your original is preserved. Explore different studio environments and edge refinements without modifying your source file.',
    shortcut: 'Click any Contact Sheet card to switch active artwork'
  },
  after_first_transform: {
    id: 'after_first_transform',
    anchor: 'comparison-stage',
    title: 'Inspect Transformation Alignment',
    message:
      'Drag the divider to compare your original and transformed artwork, or use the Left / Right arrow keys for fine 2% steps.',
    shortcut: '← / → Arrow Keys (Hold Shift for 10% jumps)'
  },
  enter_refine_mode: {
    id: 'enter_refine_mode',
    anchor: 'refiner-toolbar',
    title: 'Non-Destructive Edge Refinement',
    message:
      'Restore missing artwork (+ Brush) or remove unwanted background areas (- Erase) before exporting. Switch to Ruby Mask to spot stray edge pixels.',
    shortcut: 'Ctrl+Z / Ctrl+Y to Undo or Redo brush strokes'
  },
  select_brush_tool: {
    id: 'select_brush_tool',
    anchor: 'refiner-sliders',
    title: 'Precision Around Fine Details',
    message:
      'Use a smaller brush (6–18px) around typography, straps, and intricate details. Lower Mask Expand (-1px to -2px) to tighten a bright outer halo.',
    shortcut: 'Zoom up to 400% for sub-pixel accuracy'
  },
  select_export_format: {
    id: 'select_export_format',
    anchor: 'export-controls',
    title: 'Choosing the Right Export Format',
    message:
      'Studio .JPG flattens the active backdrop; Transparent .PNG preserves full 8-bit alpha; Vector-Clipped .SVG embeds the cutout inside a Marching-Squares vector <clipPath> contour for stickers and print.',
    shortcut: '3 clean trial exports included · Unlimited with Pro'
  }
};

/**
 * Layer C: Context-Sensitive Instructional Status Bar Resolver
 */
export function resolveContextualStatusBar({
  isProcessingBatch = false,
  progressMsg = '',
  activeTab = 'cleaner',
  stageMode = 'compare',
  brushMode = 'erase',
  refinerBgMode = 'checkerboard',
  hoveredControl = null,
  backdropStyle = 'corkboard',
  activeBackdropLabel = 'Cork Bulletin Board',
  entitlementState = { isProValid: false },
  trialState = { remainingCount: 3, maxAllowance: 3 }
}) {
  const trialBadge = entitlementState?.isProValid
    ? 'PRO ACTIVE · Unlimited Full-Res & Batch Exports'
    : `Free Trial: ${trialState?.remainingCount ?? 3} of ${trialState?.maxAllowance ?? 3} clean exports remaining`;

  if (isProcessingBatch) {
    return {
      feature: 'Processing Pipeline',
      guidance:
        progressMsg ||
        'Running local U²-Net ONNX neural segmentation and bilateral high-res edge snap. Existing completed items remain interactive.',
      shortcut: 'Click Cancel Remaining Batch to stop queued items',
      trialBadge
    };
  }

  if (hoveredControl && RICH_CONTROL_GUIDES[hoveredControl]) {
    const g = RICH_CONTROL_GUIDES[hoveredControl];
    return {
      feature: g.title,
      guidance: `${g.whatItDoes} ${g.tradeOffs}`,
      shortcut: g.shortcut || 'Toggle Guide Mode (?) for full technical notes',
      trialBadge
    };
  }

  if (activeTab === 'vault') {
    return {
      feature: 'Export Vault (.PNG / .SVG / .ZIP)',
      guidance:
        'Export individual transparent alpha .PNGs, Marching-Squares vector-clipped .SVG cutline files, or package all completed assets into a single batch .ZIP archive.',
      shortcut: 'Batch .ZIP archiving requires Studio Pro ($19)',
      trialBadge
    };
  }

  if (stageMode === 'refine') {
    if (refinerBgMode === 'mask') {
      return {
        feature: 'Mask Inspection (Ruby Overlay)',
        guidance:
          'Inspect which portions of the artwork are retained (full clarity) or removed (crimson ruby tint). Switch back to Checkerboard or Studio Backdrop to verify composite lighting.',
        shortcut: 'Use + Restore or - Erase directly on the Ruby Mask',
        trialBadge
      };
    }
    if (brushMode === 'add') {
      return {
        feature: 'Restore Artwork (+ Brush)',
        guidance:
          'Paint over missing foreground details, thin straps, or typography to restore them to the selection. Click "Apply Edge Refinement to Scene" when finished.',
        shortcut: 'Ctrl+Z Undo · Reduce Brush Size for fine linework',
        trialBadge
      };
    }
    if (brushMode === 'erase') {
      return {
        feature: 'Remove Background (- Eraser)',
        guidance:
          'Brush over unwanted interior background pockets or edge remnants. Reduce brush size around fine details and use Color Decontamination to purge background color spill.',
        shortcut: 'Ctrl+Z Undo · Switch to Pan Hand to move around at 400% zoom',
        trialBadge
      };
    }
    return {
      feature: 'Pan Viewport (Hand Tool)',
      guidance:
        'Drag the canvas to inspect distant corners while zoomed in. Switch back to + Restore or - Erase to modify the alpha mask.',
      shortcut: 'Click 100% Reset to recenter the viewport',
      trialBadge
    };
  }

  return {
    feature: `Comparison Slider (${activeBackdropLabel})`,
    guidance:
      backdropStyle === 'transparent'
        ? 'Drag the divider to compare your original photo against the zero-background transparent alpha cutout.'
        : `Drag the divider to inspect differences between the original source and the ${activeBackdropLabel} studio composite.`,
    shortcut: '← / → Arrow Keys to nudge split · Click Refine Edges for brush touch-ups',
    trialBadge
  };
}

/**
 * Layer D: Rich Technical Control Explanations (Used by Rich Tooltips & Guide Mode)
 */
export const RICH_CONTROL_GUIDES = {
  backdrop_select: {
    id: 'backdrop_select',
    title: 'Studio Environment & Alpha Cutout Selector',
    whatItDoes: 'Composites your isolated subject onto a calibrated 4:3 studio environment with procedural floor contact shadows, or outputs a pure transparent alpha channel.',
    whenUseful: 'Use environments 01–04 (or industry packs 06–11) for product listings and lookbooks; choose 05 Alpha Cutout when you need a transparent .PNG or die-cut .SVG.',
    valueEffect: 'Switching backdrops re-renders lighting falloff on demand without re-running neural segmentation.',
    tradeOffs: 'Environments 01–04/06–11 export as high-resolution .JPG composites; 05 Alpha Cutout exports as lossless 32-bit transparent .PNG.',
    related: 'Pairs with Subject Surface Polish and Color Decontamination.',
    shortcut: 'Instant on-demand switch'
  },
  brush_restore: {
    id: 'brush_restore',
    title: 'Restore Artwork Brush (+)',
    whatItDoes: 'Paints opaque foreground alpha (255) back into regions that automatic segmentation excluded.',
    whenUseful: 'Essential when thin dark cables, translucent glass rims, or fine typography strokes match the background tone.',
    valueEffect: 'Higher brush hardness creates crisp mechanical edges; lower hardness blends soft organic transitions.',
    tradeOffs: 'Over-painting beyond the subject boundary will reveal raw background pixels—use Ruby Mask view to verify.',
    related: 'Counterpart to Erase Background (-) and Undo (Ctrl+Z).',
    shortcut: 'Pointer drag on canvas'
  },
  brush_erase: {
    id: 'brush_erase',
    title: 'Remove Background Eraser (-)',
    whatItDoes: 'Zeroes out alpha values (0) under the brush cursor to remove trapped background islands.',
    whenUseful: 'Ideal for clearing background pockets inside wheel spokes, chair legs, handbag handles, or under arms.',
    valueEffect: 'Smaller brush radii (4–16px) allow surgical cleanup inside tight interior cutouts.',
    tradeOffs: 'Very soft hardness (<30%) near sharp edges can leave faint ghosting; use 70–85% hardness for hard goods.',
    related: 'Combine with Zoom In (+) and Ruby Mask Inspection.',
    shortcut: 'Pointer drag on canvas'
  },
  ruby_mask_mode: {
    id: 'ruby_mask_mode',
    title: 'Viewport Background & Ruby Mask Inspector',
    whatItDoes: 'Changes the inspection backdrop behind your cutout inside the Edge Refiner without altering the exported file.',
    whenUseful: 'Ruby Mask overlays removed areas in translucent crimson so you can see both the original context and the mask edge simultaneously.',
    valueEffect: 'Dark Void exposes bright white halos; Light Paper exposes dark shadow fringes; Ruby Mask reveals missed foreground details.',
    tradeOffs: 'Inspection modes are visual aids only—click "Apply Edge Refinement to Scene" to commit mask changes.',
    related: 'Works directly with Mask Expand/Contract and Color Decontamination.',
    shortcut: '5 instant inspection modes'
  },
  edge_expand: {
    id: 'edge_expand',
    title: 'Morphological Mask Expand / Contract (-10px to +10px)',
    whatItDoes: 'Uniformly shifts the entire alpha perimeter outward (+px dilation) or inward (-px erosion).',
    whenUseful: 'Set to -1px or -2px ("choke") to strip a thin 1px bright halo around the entire subject in one move.',
    valueEffect: 'Increasing (+px) recovers clipped outer contours; decreasing (-px) tightens the silhouette inward.',
    tradeOffs: 'Aggressive negative values (below -4px) can erode thin antennae, laces, or serif letterforms.',
    related: 'Best followed by 1–2px of Edge Feathering.',
    shortcut: 'Range: -10px to +10px'
  },
  edge_feather: {
    id: 'edge_feather',
    title: 'Separable Gaussian Edge Feathering (0px to 10px)',
    whatItDoes: 'Applies a smooth Gaussian falloff along the alpha boundary transition zone.',
    whenUseful: 'Prevents the harsh "cardboard cutout" look when compositing portraits, apparel, or soft goods onto new lighting environments.',
    valueEffect: '0px preserves razor-sharp pixel boundaries; 1–2px gives natural optical anti-aliasing; 4–10px creates a soft vignette blend.',
    tradeOffs: 'High feather values (>4px) can introduce background halo bleed unless Color Decontamination is enabled.',
    related: 'Directly complements Mask Expand/Contract and Color Decontamination.',
    shortcut: 'Default: 1px optical anti-alias'
  },
  color_decontam: {
    id: 'color_decontam',
    title: 'Foreground RGB Color-Bleed Decontamination (0%–100%)',
    whatItDoes: 'Reconstructs the true RGB color of semi-transparent edge pixels by sampling clean interior foreground pixels and purging background color spill.',
    whenUseful: 'Crucial for green-screen shoots, subjects photographed on bright concrete driveways, or dark coats against bright skies.',
    valueEffect: 'Higher percentages (75%–100%) aggressively neutralize green/white fringes; 0% leaves original edge RGB untouched.',
    tradeOffs: 'At 100% on multi-colored iridescent edges, interior color propagation may slightly flatten subtle rim-light hues.',
    related: 'Works hand-in-hand with Edge Feathering.',
    shortcut: 'Default: ON (85%)'
  },
  export_master_jpg_png: {
    id: 'export_master_jpg_png',
    title: 'Master Studio Composite (.JPG) / Alpha Cutout (.PNG)',
    whatItDoes: 'Exports the full-resolution processed scene in the active studio environment (.JPG) or transparent alpha channel (.PNG).',
    whenUseful: 'Use .JPG for ready-to-publish e-commerce, dealership, or rental catalog listings; use .PNG for layered design work.',
    valueEffect: 'Preserves full source resolution without preview watermarks.',
    tradeOffs: '.JPG flattens transparency onto the chosen backdrop; select "05 Alpha Cutout" or "Download Transparent Cutout (.PNG)" for transparency.',
    related: 'Consumes 1 credit on Free Trial (3 included); unlimited on Studio Pro.',
    shortcut: 'Ctrl+S / Cmd+S quick export'
  },
  export_vector_svg: {
    id: 'export_vector_svg',
    title: 'Vector-Clipped .SVG Export (PNG + Marching-Squares Cutline)',
    whatItDoes: 'Generates an .SVG document containing your full-resolution transparent PNG clipped by a mathematical Marching-Squares vector <clipPath> contour.',
    whenUseful: 'Built for die-cut sticker production (Roland VersaWorks, Cricut), Figma component masking, and scalable print layouts.',
    valueEffect: 'Provides a true closed vector perimeter path around the subject silhouette while retaining photorealistic interior texture.',
    tradeOffs: 'This is a vector-clipped high-res cutout (contour path + embedded raster), not a flat multi-color cartoon posterization.',
    related: 'Can be exported individually or packaged in bulk via the Export Vault (.ZIP).',
    shortcut: 'Compatible with Illustrator, Figma & vinyl cutters'
  },
  export_batch_zip: {
    id: 'export_batch_zip',
    title: 'Batch .ZIP Export Vault (Studio Pro)',
    whatItDoes: 'Packages every completed asset in your session into a single downloadable .ZIP archive organized by your custom folder name.',
    whenUseful: 'Saves hours when processing 10 to 200 inventory photos for a store launch or print run.',
    valueEffect: 'Bundles all vector-clipped .SVG cutline assets in one operation.',
    tradeOffs: 'Requires an active CleanSnap Studio Pro license ($19 one-time).',
    related: 'Accessible from Step 4 or the 03 Export Vault tab.',
    shortcut: 'Pro Entitlement Feature'
  }
};

/**
 * Layer E: Interactive Technique Library (4 Genuine Bundled Workflows with Project Isolation)
 */
export const TECHNIQUE_LIBRARY = [
  {
    id: 'tech_greenscreen_spill',
    sampleJobId: 'vs_figure_greenscreen',
    recommendedBackdrop: 'chalkboard',
    recommendedStageMode: 'refine',
    recommendedRefinerBg: 'mask',
    category: 'Chroma & Spill Cleanup',
    title: 'Removing Green-Screen & Studio Rig Contamination',
    problem:
      'Subjects shot on chroma-key cycloramas often retain neon-green light spill along boots, hair, and sleeves, plus C-stands and floor tape at the frame edges.',
    beforeImg: '/samples/figure_greenscreen_before.jpg',
    afterImg: '/samples/figure_greenscreen_after.jpg',
    relevantTools: ['Color Decontamination (85–95%)', 'Ruby Mask Inspector', 'Erase Background (-)'],
    workflowSteps: [
      'Open the subject in Refine Edges (Brush) and switch the viewport to Ruby Mask.',
      'Enable Color Decontamination at 85%–95% to purge green bounce light from semi-transparent boundary pixels.',
      'Set Mask Expand / Contract to -1px if a thin green rim persists, then composite onto a dark Belgian Slate Chalkboard to verify clean edges.'
    ]
  },
  {
    id: 'tech_deckled_typography',
    sampleJobId: 'user_wax_letter',
    recommendedBackdrop: 'corkboard',
    recommendedStageMode: 'refine',
    recommendedRefinerBg: 'dark',
    category: 'Fine Edges & Linework',
    title: 'Preserving Fibrous Paper Edges & Wax-Seal Details',
    problem:
      'Antique parchment, deckled stationery, and wax seals sit against warm wood tables that share similar amber/brown RGB values, risking clipped corners or overly soft edges.',
    beforeImg: '/samples/wax_letter_before.jpg',
    afterImg: '/samples/wax_letter_after.jpg',
    relevantTools: ['Restore Artwork (+ Brush, 12px)', 'Edge Feathering (1px)', 'Dark Void Inspection'],
    workflowSteps: [
      'Switch the Edge Refiner backdrop to Dark Void so the pale deckled paper perimeter stands out sharply.',
      'Keep Edge Feathering low (1px) to preserve the crisp organic paper tooth without blurring calligraphy.',
      'Use a small 12px Restore (+) brush at 80% hardness to bring back any subtle wax-seal crest highlights.'
    ]
  },
  {
    id: 'tech_automotive_reflections',
    sampleJobId: 'user_sports_coupe',
    recommendedBackdrop: 'chalkboard',
    recommendedStageMode: 'compare',
    recommendedRefinerBg: 'checkerboard',
    category: 'Reflective Hard Goods',
    title: 'Isolating Gloss-Black Automotive Bodywork & Tire Treads',
    problem:
      'Gloss-black vehicles reflect studio light bars and merge into dark showroom floors around the tires and front splitter.',
    beforeImg: '/samples/sports_coupe_before.jpg',
    afterImg: '/samples/sports_coupe_after.jpg',
    relevantTools: ['Before / After Comparison Slider', 'Subject Surface Polish (High)', 'Morphological Choke (-1px)'],
    workflowSteps: [
      'Use the Before / After Slider (or Left/Right arrow keys) to inspect mirror caps, wheel arches, and the lower front splitter.',
      'If floor reflections cling to the tire sidewall, open Refine Edges and use a firm (85% hardness) Eraser (-) along the contact patch.',
      'Stage on Belgian Slate Chalkboard or Wet Obsidian Cyclorama with Studio Polish set to High for deep paint contrast.'
    ]
  },
  {
    id: 'tech_vector_cutline_prep',
    sampleJobId: 'edr_tropical_slide',
    recommendedBackdrop: 'transparent',
    recommendedStageMode: 'compare',
    recommendedRefinerBg: 'checkerboard',
    category: 'Export & Die-Cut Print',
    title: 'Preparing Clean Silhouettes for Vector-Clipped .SVG & Transparent .PNG',
    problem:
      'Outdoor inventory photos contain wet concrete driveways, fences, and hoses. Die-cut sticker and catalog workflows require a watertight outer contour with zero stray islands.',
    beforeImg: '/samples/tropical_slide_before.jpg',
    afterImg: '/samples/tropical_slide_after.jpg',
    relevantTools: ['05 Alpha Cutout Mode', 'Vector-Clipped .SVG Export', 'Transparent .PNG Export'],
    workflowSteps: [
      'Select environment "05 — Alpha Cutout (.SVG / .PNG)" in Step 2 to inspect the subject over the transparency grid.',
      'Verify in Ruby Mask mode that no stray driveway pebbles remain detached from the main silhouette.',
      'Export as Transparent Cutout (.PNG) for web overlays or Vector-Clipped (.SVG) for Marching-Squares die-cut paths.'
    ]
  }
];

/**
 * Loads persisted instructional state from localStorage.
 */
export function loadInstructionalState(
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  if (!storage) return { ...DEFAULT_INSTRUCTIONAL_STATE };
  try {
    const raw = storage.getItem(INSTRUCTIONAL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INSTRUCTIONAL_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_INSTRUCTIONAL_STATE,
      ...parsed,
      seenHints: parsed?.seenHints || {},
      dismissedHints: parsed?.dismissedHints || {},
      completedActions: parsed?.completedActions || {}
    };
  } catch {
    return { ...DEFAULT_INSTRUCTIONAL_STATE };
  }
}

/**
 * Saves updated instructional state to localStorage.
 */
export function saveInstructionalState(
  nextState,
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  const merged = {
    ...DEFAULT_INSTRUCTIONAL_STATE,
    ...nextState
  };
  if (storage) {
    try {
      storage.setItem(INSTRUCTIONAL_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  }
  return merged;
}

/**
 * Resets all instructional progress (welcome modal, seen/dismissed hints, completed actions).
 */
export function resetInstructionalProgress(
  storage = typeof localStorage !== 'undefined' ? localStorage : null
) {
  const fresh = {
    ...DEFAULT_INSTRUCTIONAL_STATE,
    welcomeCompleted: false,
    seenHints: {},
    dismissedHints: {},
    completedActions: {}
  };
  return saveInstructionalState(fresh, storage);
}

/**
 * Determines which single contextual hint (if any) should be displayed for an event.
 * Never shows hints if autoHintsEnabled is false, if the hint was permanently dismissed,
 * or if the user has already completed the target action.
 */
export function resolveHintForEvent(eventKey, instructionalState) {
  if (!instructionalState?.autoHintsEnabled) return null;
  const hint = CONTEXTUAL_HINTS[eventKey];
  if (!hint) return null;
  if (instructionalState.dismissedHints?.[hint.id]) return null;
  return hint;
}
