// Re-export the native module. On web, it will be resolved to RingoAlarmModule.web.ts
// and on native platforms to RingoAlarmModule.ts
export { default } from './src/RingoAlarmModule';
export * from './src/RingoAlarm.types';
