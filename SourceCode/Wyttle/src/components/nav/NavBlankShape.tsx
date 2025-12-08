import React from 'react';
import { Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const NAV_SCALE = 1.3;
// Design-time width used to clamp vertical scale so the bar height
// never grows beyond what looks good on a typical phone.
const BASE_NAV_WIDTH = 390; // px

export type NavBlankShapeProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Optional explicit width to render at. Falls back to window width.
   * This lets parents pass their measured layout width so the SVG
   * matches the actual nav bar width on web / tablets.
   */
  width?: number;
};

/**
 * SVG background that recreates nav-blank.svg as a scalable nav bar shape.
 *
 * On very wide screens (web / tablets), we clamp the vertical scale based on
 * the initial window width so the bar doesn't become excessively tall. This
 * makes it "flatter but longer" on large screens while keeping phone height.
 */
export function NavBlankShape({ color = '#333f5c', style, width }: NavBlankShapeProps) {
  const windowWidth = Dimensions.get('window').width;
  const effectiveWidth = width ?? windowWidth;

  // Natural uniform scale for the current nav width
  const widthScale = (effectiveWidth / VIEWBOX_WIDTH) * NAV_SCALE;
  // Baseline scale based on a fixed "design" width (approx phone width)
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  // Clamp so vertical scale never exceeds the design-time scale
  const scale = Math.min(widthScale, designScale);

  const height = VIEWBOX_HEIGHT * scale;

  return (
    <Svg
      width={effectiveWidth}
      height={height}
      viewBox="0 0 200.27968 53.78904"
      style={style}
    >
      <G transform="translate(0,-243.45863)">
        <Path
          d="m 200.27968,259.33363 c 0,0 -40.83271,-1.49945 -60.27968,3.70417 -14.5795,3.90119 -20.92738,20.60464 -40.539839,20.16311 C 82.913314,282.8284 80.216072,268.1582 60,263.0378 39.99934,257.97196 0,259.33363 0,259.33363 v 37.91404 h 200.27968 z"
          fill={color}
        />
      </G>
      <G transform="translate(0,15.83455)">
        {/* Center the circle horizontally based on the viewbox width */}
        <Circle cx={VIEWBOX_WIDTH / 2} cy={2.423655} r={18.258205} fill={color} />
      </G>
    </Svg>
  );
}
