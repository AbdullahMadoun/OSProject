---
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2eb'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2e3037'
  outline: '#859398'
  outline-variant: '#3c494e'
  surface-tint: '#3cd7ff'
  primary: '#a8e8ff'
  on-primary: '#003642'
  primary-container: '#00d4ff'
  on-primary-container: '#00586b'
  inverse-primary: '#00677e'
  secondary: '#f5fff5'
  on-secondary: '#003920'
  secondary-container: '#00ffa3'
  on-secondary-container: '#007146'
  tertiary: '#8aedff'
  on-tertiary: '#00363d'
  tertiary-container: '#00d6ee'
  on-tertiary-container: '#005963'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b4ebff'
  primary-fixed-dim: '#3cd7ff'
  on-primary-fixed: '#001f27'
  on-primary-fixed-variant: '#004e5f'
  secondary-fixed: '#52ffac'
  secondary-fixed-dim: '#00e290'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005231'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#10131a'
  on-background: '#e1e2eb'
  surface-variant: '#32353c'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-stats:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-padding: 32px
  gutter: 20px
---

## Brand & Style

This design system is engineered for high-performance utility and aesthetic precision, drawing inspiration from industry-leading developer tools like Linear and Raycast. The brand personality is deeply technical yet approachable, emphasizing "the beauty of logic."

The design style blends **Minimalism** with **Glassmorphism**. It utilizes a dark, monochromatic foundation to reduce cognitive load while employing vibrant, luminescent accents to highlight computational progress and state changes. Every element is designed to feel like a high-end physical hardware interface translated into a digital medium, characterized by generous whitespace, hairline borders, and subtle glows that suggest depth and activity within the "machine."

## Colors

The palette is anchored by a deep charcoal-navy (`#0B0E14`) which provides the necessary contrast for the neon-inspired accents. The primary interaction language uses a gradient flow from Electric Blue to Teal, symbolizing the movement of data.

Algorithm-specific coding is critical for cognitive mapping in the simulator:
- **FCFS:** Solid Blue for reliability.
- **SJF:** Crisp Green for efficiency.
- **Round Robin:** Vibrant Orange for cycle distinction.
- **Priority:** Deep Purple for high-status tasks.

Gradients should be used sparingly for primary actions and "active state" indicators (e.g., the currently executing CPU process) to maintain a premium, focused environment.

## Typography

This design system relies on **Inter** for its neutral, systematic clarity. It ensures that complex data tables and Gantt charts remain readable even at smaller sizes.

To emphasize the technical nature of a CPU simulator, **Space Grotesk** (or a similar geometric mono-sans) should be used for numerical data, process IDs, and millisecond counters. This creates a distinct visual separation between "instructional" text and "computed" data. Use tight tracking on headlines to mimic the "Linear" aesthetic, and generous line-height on body copy to ensure the interface feels airy despite the dark theme.

## Layout & Spacing

The layout philosophy follows a **fixed-grid** system for the primary dashboard, ensuring that the simulation timeline remains stable and predictable.

- Use a 12-column grid for the main layout.
- Vertical rhythm is based on a 4px baseline, ensuring all elements align to a consistent technical scale.
- **Generous Whitespace:** Components are intentionally isolated using large margins (`xl` / 48px) to prevent the UI from feeling cluttered, even when multiple scheduling algorithms are being compared simultaneously.

## Elevation & Depth

Depth in this design system is achieved through **Glassmorphism** and light-based hierarchy rather than heavy shadows.

- **Surface 1 (Base):** The #0B0E14 background.
- **Surface 2 (Cards):** A semi-transparent layer (`rgba(255,255,255, 0.03)`) with a `20px` backdrop-blur.
- **Borders:** Every card and input uses a 1px solid border (`rgba(255,255,255, 0.08)`).
- **Inner Glow:** Interactive elements feature a subtle 1px inner stroke on the top edge to simulate "edge-lighting" from above.
- **Outer Glow:** Active processes in the Gantt chart should emit a soft, localized drop-shadow of their own accent color (e.g., a Blue glow for an active FCFS task) with a 15px blur and 0.2 opacity.

## Shapes

The shape language is "Soft-Technical." We use a conservative corner radius to maintain a professional, tool-like feel while avoiding the harshness of sharp corners.

- **Standard Components:** 0.25rem (4px) for small buttons and input fields.
- **Main Containers/Cards:** 0.75rem (12px) to define major sections of the simulator.
- **Process Blocks:** 2px radius for Gantt chart bars to maintain a dense, data-rich appearance.

## Components

### Buttons & Inputs
Buttons use a semi-transparent fill with high-contrast text. Primary actions (like "Start Simulation") utilize the Electric Blue to Cyan gradient. Input fields are minimalist—just a bottom border in the idle state, expanding to a full glassmorphic box on focus.

### Glassmorphic Cards
The central component for all simulator modules. They must include a subtle "noise" texture overlay at 2% opacity to break up digital banding and enhance the premium feel.

### Gantt Chart Bars
These represent the core data. They should be vibrant and use a slight vertical gradient (top-to-bottom) of their assigned algorithm color.

### Performance Chips
Small, pill-shaped indicators for "Waiting Time," "Turnaround Time," etc. Use a mono-font for the values and the label-caps style for headers.

### Additional Components
- **Step-Control:** A specialized playback bar with "Next Cycle," "Play," and "Reset" icons, styled with a high-intensity glow on the active "Play" button.
- **Process Queue List:** A vertical stack of slim cards with drag-and-drop handles, using subtle hover animations that translate the card 4px to the right.