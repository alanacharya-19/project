package expo.modules.ringoalarm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RingoAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RingoAlarm")

    AsyncFunction("setValueAsync") { value: String ->
    }
  }
}
