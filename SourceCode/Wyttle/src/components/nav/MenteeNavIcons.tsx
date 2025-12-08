import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type NavIconProps = {
  size?: number;
  color: string;
};

export function UsersAltIcon({ size = 24, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12.3,12.22A4.92,4.92,0,0,0,14,8.5a5,5,0,0,0-10,0,4.92,4.92,0,0,0,1.7,3.72A8,8,0,0,0,1,19.5a1,1,0,0,0,2,0,6,6,0,0,1,12,0,1,1,0,0,0,2,0A8,8,0,0,0,12.3,12.22ZM9,11.5a3,3,0,1,1,3-3A3,3,0,0,1,9,11.5Zm9.74.32A5,5,0,0,0,15,3.5a1,1,0,0,0,0,2,3,3,0,0,1,3,3,3,3,0,0,1-1.5,2.59,1,1,0,0,0-.5.84,1,1,0,0,0,.45.86l.39.26.13.07a7,7,0,0,1,4,6.38,1,1,0,0,0,2,0A9,9,0,0,0,18.74,11.82Z"
        fill={color}
      />
    </Svg>
  );
}

export function StackIcon({ size = 24, color }: NavIconProps) {
  // Slightly scale down the path so this icon doesn't appear larger
  // than the others, while still using the same canvas size.
  const scale = 0.88;
  const translate = (24 - 24 * scale) / 2; // center after scaling

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M 22,17 H 2 c -1.33333275,0 -1.33333275,2 0,2 h 20 c 1.333333,0 1.333333,-2 0,-2 z m 0,4 H 2 c -1.33333275,0 -1.33333275,2 0,2 h 20 c 1.333333,0 1.333333,-2 0,-2 z M 20,1 H 4 C 2.3431458,1 1,2.3431458 1,4 v 8 c 0,1.656854 1.3431458,3 3,3 h 16 c 1.656854,0 3,-1.343146 3,-3 V 4 C 23,2.3431458 21.656854,1 20,1 Z m 1,11 c 0,0.552285 -0.447715,1 -1,1 H 4 C 3.4477153,13 3,12.552285 3,12 V 4 C 3,3.4477153 3.4477153,3 4,3 h 16 c 0.552285,0 1,0.4477153 1,1 z"
        fill={color}
        transform={`translate(${translate} ${translate}) scale(${scale})`}
      />
    </Svg>
  );
}

export function GraduationIcon({ size = 24, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M21.49,10.19l-1-.55h0l-9-5-.11,0a1.06,1.06,0,0,0-.19-.06l-.19,0-.18,0a1.17,1.17,0,0,0-.2.06l-.11,0-9,5a1,1,0,0,0,0,1.74L4,12.76V17.5a3,3,0,0,0,3,3h8a3,3,0,0,0,3-3V12.76l2-1.12V14.5a1,1,0,0,0,2,0V11.06A1,1,0,0,0,21.49,10.19ZM16,17.5a1,1,0,0,1-1,1H7a1,1,0,0,1-1-1V13.87l4.51,2.5.15.06.09,0a1,1,0,0,0,.25,0h0a1,1,0,0,0,.25,0l.09,0a.47.47,0,0,0,.15-.06L16,13.87Zm-5-3.14L4.06,10.5,11,6.64l6.94,3.86Z"
        fill={color}
      />
    </Svg>
  );
}

export function SettingIcon({ size = 24, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M19.9 12.66a1 1 0 0 1 0-1.32l1.28-1.44a1 1 0 0 0 .12-1.17l-2-3.46a1 1 0 0 0-1.07-.48l-1.88.38a1 1 0 0 1-1.15-.66l-.61-1.83a1 1 0 0 0-.95-.68h-4a1 1 0 0 0-1 .68l-.56 1.83a1 1 0 0 1-1.15.66L5 4.79a1 1 0 0 0-1 .48L2 8.73a1 1 0 0 0 .1 1.17l1.27 1.44a1 1 0 0 1 0 1.32L2.1 14.1a1 1 0 0 0-.1 1.17l2 3.46a1 1 0 0 0 1.07.48l1.88-.38a1 1 0 0 1 1.15.66l.61 1.83a1 1 0 0 0 1 .68h4a1 1 0 0 0 .95-.68l.61-1.83a1 1 0 0 1 1.15-.66l1.88.38a1 1 0 0 0 1.07-.48l2-3.46a1 1 0 0 0-.12-1.17ZM18.41 14l.8.9-1.28 2.22-1.18-.24a3 3 0 0 0-3.45 2L12.92 20h-2.56L10 18.86a3 3 0 0 0-3.45-2l-1.18.24-1.3-2.21.8-.9a3 3 0 0 0 0-4l-.8-.9 1.28-2.2 1.18.24a3 3 0 0 0 3.45-2L10.36 4h2.56l.38 1.14a3 3 0 0 0 3.45 2l1.18-.24 1.28 2.22-.8.9a3 3 0 0 0 0 3.98Zm-6.77-6a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2Z"
        fill={color}
      />
    </Svg>
  );
}
