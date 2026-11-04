import { registerWebModule, NativeModule } from 'expo';

// RingoAlarmModule is not available on the web platform.
class RingoAlarmModule extends NativeModule<{}> {}

export default registerWebModule(RingoAlarmModule, 'RingoAlarmModule');
