import { NativeModule, requireNativeModule } from 'expo';

declare class RingoAlarmModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<RingoAlarmModule>('RingoAlarm');
