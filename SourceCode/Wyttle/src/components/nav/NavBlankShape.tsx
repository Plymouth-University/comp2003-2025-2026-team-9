import React from 'react';
import { Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const VIEWBOX_WIDTH = 200.31336;
const VIEWBOX_HEIGHT = 83.284325;
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

  const height = VIEWBOX_HEIGHT * scale;

  return (
    <Svg
      width={effectiveWidth}
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      style={style}
    >
      <Path
        d="M 22.499919,259.28609 C 10.000001,258.99328 0,259.33363 0,259.33363 v 35.44745 h -0.01912028 v 47.67047 H 200.29423 v -45.20189 -2.46858 -35.44538 c 0,0 -10,-0.33987 -22.49991,-0.047 v -5.2e-4 c -12.49992,0.29281 -27.49971,1.21879 -37.50004,3.75171 -20.21607,5.1204 -22.91327,19.79085 -39.46012,20.16363 -0.22631,0.005 -0.45097,0.007 -0.67387,0.008 v -0.002 c -0.231463,-3.6e-4 -0.465045,-0.003 -0.700211,-0.008 -16.546847,-0.37288 -19.244052,-15.04323 -39.460124,-20.16363 -10.00033,-2.53292 -25.000119,-3.45889 -37.500036,-3.7517 z"
        fill={color}
        transform="translate(0.01912028,-259.16723)"
      />
    </Svg>
  );
}