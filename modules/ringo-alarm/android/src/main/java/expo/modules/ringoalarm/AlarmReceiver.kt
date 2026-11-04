package expo.modules.ringoalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action == null || action == ACTION_FIRE) {
      handleFire(context, intent)
      return
    }
    val alarm = readAlarm(intent) ?: return
    when (action) {
      ACTION_SNOOZE -> handleSnooze(context, alarm)
      ACTION_DECLINE -> handleDecline(context, alarm)
      ACTION_DISMISS -> handleDismiss(context, alarm)
      ACTION_ACCEPT -> handleAccept(context, alarm)
      else -> Unit
    }
  }

  private fun handleFire(context: Context, intent: Intent) {
    val alarmKey = intent.getStringExtra("alarmKey")
    var alarm = AlarmStore.get(context, alarmKey ?: "")
    if (alarm == null) {
      alarm = readAlarm(intent)
    }
    if (alarm == null) return

    AlarmStore.remove(context, alarm.alarmKey)
    AlarmNotifier.post(context, alarm)
    AlarmStore.appendEvent(context, "fired", alarm.reminderId, alarm.occurrenceAt, JSONObject().apply {
      put("isFollowUp", alarm.isFollowUp)
      put("isSnooze", alarm.isSnooze)
    })

    if (alarm.isSnooze || alarm.isFollowUp) return

    if (alarm.repeatType != "never") {
      var next = Recurrence.computeNext(alarm, alarm.occurrenceAt)
      var guard = 0
      while (next != null && next <= System.currentTimeMillis() && guard < 500) {
        next = Recurrence.computeNext(alarm, next)
        guard += 1
      }
      if (next != null) {
        AlarmScheduler.scheduleNext(context, alarm, next)
      }
    }

    if (alarm.repeatMissedCall) {
      AlarmScheduler.scheduleFollowUp(context, alarm)
    }
  }

  private fun handleAccept(context: Context, alarm: StoredAlarm) {
    AlarmScheduler.cancelFollowUp(context, alarm.reminderId)
    AlarmStore.appendEvent(context, "accepted", alarm.reminderId, alarm.occurrenceAt)
  }

  private fun handleDecline(context: Context, alarm: StoredAlarm) {
    AlarmScheduler.cancelFollowUp(context, alarm.reminderId)
    AlarmNotifier.cancel(context, alarm.reminderId)
    AlarmStore.appendEvent(context, "declined", alarm.reminderId, alarm.occurrenceAt)
  }

  private fun handleDismiss(context: Context, alarm: StoredAlarm) {
    AlarmScheduler.cancelFollowUp(context, alarm.reminderId)
    AlarmStore.appendEvent(context, "dismissed", alarm.reminderId, alarm.occurrenceAt)
  }

  private fun handleSnooze(context: Context, alarm: StoredAlarm) {
    AlarmScheduler.cancelFollowUp(context, alarm.reminderId)
    AlarmNotifier.cancel(context, alarm.reminderId)
    AlarmScheduler.scheduleSnooze(context, alarm, alarm.snoozeMinutes)
    AlarmStore.appendEvent(context, "snoozed", alarm.reminderId, alarm.occurrenceAt, JSONObject().apply {
      put("snoozeMinutes", alarm.snoozeMinutes)
    })
  }

  private fun readAlarm(intent: Intent): StoredAlarm? {
    val raw = intent.getStringExtra("alarm") ?: return null
    return try {
      StoredAlarm.fromJson(JSONObject(raw))
    } catch (_: Exception) {
      null
    }
  }

  companion object {
    const val ACTION_FIRE = "expo.modules.ringoalarm.FIRE"
    const val ACTION_ACCEPT = "expo.modules.ringoalarm.ACCEPT"
    const val ACTION_DECLINE = "expo.modules.ringoalarm.DECLINE"
    const val ACTION_SNOOZE = "expo.modules.ringoalarm.SNOOZE"
    const val ACTION_DISMISS = "expo.modules.ringoalarm.DISMISS"
  }
}
