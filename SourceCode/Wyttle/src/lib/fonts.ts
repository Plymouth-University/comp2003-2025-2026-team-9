import { Platform } from 'react-native';

export type FontFamily = 'Montserrat' | 'SpaceGrotesk' | 'Verdana' | 'GlacialIndifference';

function weightName(weight: string): string {
  switch (weight) {
    case '100':
      return 'Thin';
    case '200':
      return 'ExtraLight';
    case '300':
      return 'Light';
    case '400':
      return 'Regular';
    case '500':
      return 'Medium';
    case '600':
      return 'SemiBold';
    case '700':
      return 'Bold';
    case '800':
      return 'ExtraBold';
    case '900':
      return 'Black';
    default:
      return 'Regular';
  }
}

function iosFace(
  family: FontFamily,
  weight: string,
  italic = false,
): string {
  if (family === 'Verdana') {
    if (weight === '700' && italic) return 'Verdana-BoldItalic';
    if (weight === '700') return 'Verdana-Bold';
    if (italic) return 'Verdana-Italic';
    return 'Verdana';
  }

  if (family === 'Montserrat') {
    if (italic) {
      switch (weight) {
        case '300':
          return 'Montserrat-LightItalic';
        case '500':
          return 'Montserrat-MediumItalic';
        case '600':
          return 'Montserrat-SemiBoldItalic';
        case '700':
          return 'Montserrat-BoldItalic';
        case '400':
        default:
          return 'Montserrat-Italic';
      }
    }
    switch (weight) {
      case '300':
        return 'Montserrat-Light';
      case '500':
        return 'Montserrat-Medium';
      case '600':
        return 'Montserrat-SemiBold';
      case '700':
        return 'Montserrat-Bold';
      case '400':
      default:
        return 'Montserrat-Regular';
    }
  }

  if (family === 'SpaceGrotesk') {
    switch (weight) {
      case '300':
        return 'SpaceGrotesk-Light';
      case '500':
        return 'SpaceGrotesk-Medium';
      case '600':
        return 'SpaceGrotesk-SemiBold';
      case '700':
        return 'SpaceGrotesk-Bold';
      case '400':
      default:
        return 'SpaceGrotesk-Regular';
    }
  }

  if (family === 'GlacialIndifference') {
    switch (weight) {
      case '700':
        return 'GlacialIndifference-Bold';
      case '400':
      default:
        return 'GlacialIndifference-Regular';
    }
  }

  // Fallback
  const name = weightName(weight);
  const suffix = italic ? 'Italic' : '';
  return `${family}-${name}${suffix}`;
}

/**
 * Cross-platform font style helper.
 *
 * Usage:
 *   <Text style={font('SpaceGrotesk', '400')} />
 *   <Text style={font('GlacialIndifference', '700')} />
 */
export function font(
  family: FontFamily,
  weight: string = '400',
  italic: boolean = false,
): { fontFamily: string; fontWeight?: any; fontStyle?: 'normal' | 'italic' } {
  if (Platform.OS === 'android') {
    if (family === 'GlacialIndifference') {
      const numeric = parseInt(weight, 10);
      const isBold = !isNaN(numeric) ? numeric >= 700 : false;
      return {
        fontFamily: isBold ? 'GlacialIndifference-Bold' : 'GlacialIndifference-Regular',
        fontWeight: 'normal',
      };
    }

    return {
      fontFamily: family,
      fontWeight: weight as any,
      fontStyle: italic ? 'italic' : 'normal',
    };
  }

  return { fontFamily: iosFace(family, weight, italic) };
}
