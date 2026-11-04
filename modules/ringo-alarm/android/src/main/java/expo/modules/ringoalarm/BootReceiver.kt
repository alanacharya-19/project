package expo.modules.ringoalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED &&
      action != Intent.ACTION_TIME_CHANGED &&
      action != Intent.ACTION_TIMEZONE_CHANGED
    ) {
      return
    }
    val now = System.currentTimeMillis()
    val timezoneChanged = action == Intent.ACTION_TIMEZONE_CHANGED || action == Intent.ACTION_TIME_CHANGED
    val alarms = AlarmStore.all(context)
    for (alarm in alarms) {
      if (!alarm.isSnooze && !alarm.isFollowUp && timezoneChanged) {
        val rebuilt = Recurrence.rebuildForTimezone(alarm, now)
        if (rebuilt > now) {
          AlarmScheduler.rescheduleStored(context, alarm, rebuilt)
          continue
        }
      }
      if (alarm.triggerAt > now) {
        AlarmScheduler.rescheduleStored(context, alarm, alarm.triggerAt)
        continue
      }
      // The device was off or the timezone moved past this trigger. Deliver one
      // late call rather than silently losing it, then let the next recurrence run.
      val overdueBy = now - alarm.triggerAt
      if (overdueBy < 24 * 60 * 60 * 1000L) {
        AlarmScheduler.rescheduleStored(context, alarm, now + 8_000L)
      } else {
        if (alarm.repeatType != "never" && !alarm.isSnooze && !alarm.isFollowUp) {
          var next = Recurrence.computeNext(alarm, alarm.occurrenceAt)
          var guard = 0
          while (next != null && next <= now && guard < 500) {
            next = Recurrence.computeNext(alarm, next)
            guard += 1
          }
          if (next != null) {
            AlarmScheduler.scheduleNext(context, alarm, next)
          } else {
            AlarmStore.remove(context, alarm.alarmKey)
          }
        } else {
          AlarmStore.remove(context, alarm.alarmKey)
        }
      }
    }
  }
}
