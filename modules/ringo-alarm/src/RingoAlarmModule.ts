import { requireOptionalNativeModule } from 'expo';
import type { RingoAlarmNativeModule } from './RingoAlarm.types';

/**
 * The Android alarm engine is optional so the app can still run in Expo Go and
 * on iOS. All call sites must handle `null` and fall back to notifications.
 */
const RingoAlarm = requireOptionalNativeModule<RingoAlarmNativeModule>('RingoAlarm');

export default RingoAlarm;
export * from './RingoAlarm.types';
