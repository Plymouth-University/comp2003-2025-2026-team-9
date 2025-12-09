import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export type DiscoveryIconProps = SvgProps & {
  size?: number;
  color?: string;
};

const DEFAULT_COLOR = '#6563FF';

export function HandshakeCircleIcon(props: DiscoveryIconProps) {
  const { size = 40, color = DEFAULT_COLOR, ...rest } = props;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      {...rest}
    >
      {/* Outer circle */}
      <Path
        d="M12 2A10 10 0 1 0 22 12 10 10 0 0 0 12 2Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
      />

      {/* Simple handshake shape */}
      <Path
        d="M7.2 13.3L9.1 15.2a1.4 1.4 0 0 0 2 0l1.1-1.1 1.5 1.5a1 1 0 0 0 1.4-1.4l-2.3-2.3-1.2 1.2-1.8-1.8 1.2-1.2-1.6-1.6-2.2 2.2"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BlockIcon(props: DiscoveryIconProps) {
  const { size = 32, color = DEFAULT_COLOR, ...rest } = props;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      {...rest}
    >
      <Path
        d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,0,1-8-8A7.92,7.92,0,0,1,5.69,7.1L16.9,18.31A7.92,7.92,0,0,1,12,20Zm6.31-3.1L7.1,5.69A7.92,7.92,0,0,1,12,4a8,8,0,0,1,8,8A7.92,7.92,0,0,1,18.31,16.9Z"
        fill={color}
      />
    </Svg>
  );
}
