import { registerPlugin, Capacitor } from '@capacitor/core';

const NativeBackground = registerPlugin('NativeBackground');

export function setNativeBackground(hexColor) {
  if (!Capacitor.isNativePlatform()) return;
  NativeBackground.setColor({ color: hexColor }).catch(() => {});
}