package expo.modules.ringoalarm

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RingoAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("RingoAlarm")

    OnCreate {
      appContext.reactContext?.let { AlarmNotifier.ensureChannels(it) }
    }

    AsyncFunction("scheduleAlarm") { payload: Map<String, Any?> ->
      AlarmNotifier.ensureChannels(context)
      AlarmScheduler.scheduleMain(context, StoredAlarm.fromMap(payload))
    }

    AsyncFunction("scheduleSnooze") { payload: Map<String, Any?>, minutes: Int ->
      AlarmScheduler.scheduleSnooze(context, StoredAlarm.fromMap(payload), minutes)
    }

    AsyncFunction("cancelAlarm") { reminderId: String ->
      AlarmScheduler.cancelAllForReminder(context, reminderId)
      AlarmNotifier.cancel(context, reminderId)
      null
    }

    AsyncFunction("cancelSnooze") { reminderId: String ->
      AlarmScheduler.cancelSnooze(context, reminderId)
      AlarmNotifier.cancel(context, reminderId)
      null
    }

    AsyncFunction("acknowledgeOccurrence") { reminderId: String ->
      AlarmScheduler.cancelFollowUp(context, reminderId)
      null
    }

    AsyncFunction("dismissNotification") { reminderId: String ->
      AlarmNotifier.cancel(context, reminderId)
      null
    }

    AsyncFunction("consumeEvents") {
      AlarmStore.consumeEvents(context)
    }

    AsyncFunction("getCapabilities") {
      AlarmCapabilities.snapshot(context)
    }

    AsyncFunction("openExactAlarmSettings") {
      AlarmCapabilities.openExactAlarmSettings(context)
      null
    }

    AsyncFunction("openFullScreenIntentSettings") {
      AlarmCapabilities.openFullScreenSettings(context)
      null
    }

    AsyncFunction("openNotificationSettings") {
      AlarmCapabilities.openNotificationSettings(context)
      null
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      AlarmCapabilities.openBatterySettings(context)
      null
    }
  }
}
