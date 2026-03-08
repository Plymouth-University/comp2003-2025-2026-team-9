import React from 'react';
import { Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const VIEWBOX_WIDTH = 200.28;
const CROPPED_VIEWBOX_Y = 15.82746;
const CROPPED_VIEWBOX_HEIGHT = 37.96313;
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390;

export type NavBlankShapeProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
  width?: number;
  showCenter?: boolean;
};

export function NavBlankShape({
  color = '#333f5c',
  style,
  width,
}: NavBlankShapeProps) {
  const windowWidth = Dimensions.get('window').width;
  const effectiveWidth = width ?? windowWidth;

  const widthScale = (effectiveWidth / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);

  const height = CROPPED_VIEWBOX_HEIGHT * scale;

  return (
    <Svg
      width={effectiveWidth}
      height={height}
      viewBox={`0 ${CROPPED_VIEWBOX_Y} ${VIEWBOX_WIDTH} ${CROPPED_VIEWBOX_HEIGHT}`}
      style={style}
    >
      <Path
        d="M 22.499919 259.28609 C 10.000001 258.99328 0 259.33363 0 259.33363 L 0 297.24759 L 100.13394 297.24759 L 100.13394 297.24966 L 200.29423 297.24966 L 200.29423 259.3357 C 200.29423 259.3357 190.29423 258.99586 177.79432 259.28867 L 177.79432 259.28815 C 165.2944 259.58096 150.29461 260.50694 140.29428 263.03986 C 120.07821 268.16026 117.38101 282.83071 100.83416 283.20349 C 100.60785 283.2083 100.38319 283.21073 100.16029 283.21124 L 100.16029 283.20918 C 99.928822 283.20882 99.695245 283.20642 99.460079 283.20142 C 82.913232 282.82864 80.216027 268.1582 59.999955 263.0378 C 49.999625 260.50488 34.999836 259.5789 22.499919 259.28609 z"
        fill={color}
        transform="translate(0,-243.45863)"
      />
    </Svg>
  );
}