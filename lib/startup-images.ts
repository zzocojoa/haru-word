// CSS screen sizes and pixel ratios; distinct from the browser's visual viewport.
// Keep portrait and landscape assets together when adding another screen size.
const screens = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
  [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [420, 912, 3],
] as const;

export const startupImages = screens.flatMap(([width, height, scale]) =>
  (['portrait', 'landscape'] as const).map(orientation => {
    const landscape = orientation === 'landscape';
    const size = (w: number, h: number) => `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})`;
    return {
      url: `/startup/launch-${width}-${height}-${scale}-${orientation}.png`,
      // Match engines that report either fixed or rotated screen dimensions.
      media: landscape ? `${size(width, height)}, ${size(height, width)}` : size(width, height),
      width: (landscape ? height : width) * scale,
      height: (landscape ? width : height) * scale,
      scale,
    };
  }),
);
