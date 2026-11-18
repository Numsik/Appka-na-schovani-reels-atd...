import { Platform, View } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

export type GuardState = {
  available: boolean;
  authorization: 'notDetermined' | 'denied' | 'approved';
  selectedAppCount: number;
  enabled: boolean;
  broadcasting: boolean;
  blockedUntil: number;
  lastDetectionAt: number;
};

type GuardModule = {
  getState(): GuardState;
  requestAuthorization(): Promise<GuardState>;
  selectInstagram(): Promise<GuardState>;
  setEnabled(enabled: boolean): Promise<GuardState>;
};

const native = Platform.OS === 'ios'
  ? requireOptionalNativeModule<GuardModule>('ReelsGuard') : null;

export const previewState: GuardState = {
  available: false, authorization: 'notDetermined', selectedAppCount: 0,
  enabled: false, broadcasting: false, blockedUntil: 0, lastDetectionAt: 0,
};

export function getGuardState(): GuardState {
  return native?.getState() ?? previewState;
}

function requireGuard(): GuardModule {
  if (!native || !native.getState().available) {
    throw new Error('Tato verze obsahuje náhled. Blokování je dostupné v plné verzi pro iPhone.');
  }
  return native;
}

export const requestAuthorization = () => requireGuard().requestAuthorization();
export const selectInstagram = () => requireGuard().selectInstagram();
export const setGuardEnabled = (enabled: boolean) => requireGuard().setEnabled(enabled);

const NativeBroadcastPicker = native
  ? requireNativeView('ReelsGuard') : null;

export function BroadcastPicker() {
  return NativeBroadcastPicker
    ? <NativeBroadcastPicker style={{ width: 56, height: 56 }} />
    : <View style={{ width: 56, height: 56 }} />;
}
