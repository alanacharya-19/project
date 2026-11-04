package expo.modules.ringoalarm

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object AlarmNotifier {
  private const val CHANNEL_PREFIX = "ringo_call_"
  private const val CHANNEL_VERSION = "v2"
  private val channels = listOf("default", "alarm", "ringtone", "silent")

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    for (style in channels) {
      val id = channelId(style)
      if (manager.getNotificationChannel(id) != null) continue
      val soundUri = if (style == "silent") null else soundFor(context, style)
      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val channel = NotificationChannel(
        id,
        "RINGO reminder calls",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Incoming reminder calls from RINGO"
        setSound(soundUri, audioAttributes)
        enableVibration(style != "silent")
        vibrationPattern = longArrayOf(0, 350, 250, 350)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        setShowBadge(false)
        setBypassDnd(false)
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun channelId(style: String): String = "$CHANNEL_PREFIX${style}_$CHANNEL_VERSION"

  private fun soundFor(context: Context, style: String): Uri {
    return when (style) {
      "alarm" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      "ringtone" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      else -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    } ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
  }

  fun notificationId(reminderId: String): Int = reminderId.hashCode() and 0x7fffffff

  fun post(context: Context, alarm: StoredAlarm) {
    ensureChannels(context)
    val incoming = activityIntent(context, alarm, active = false)
      ?: return
    val accept = activityIntent(context, alarm, active = true)
    val snooze = broadcastIntent(context, AlarmReceiver.ACTION_SNOOZE, alarm)
    val decline = broadcastIntent(context, AlarmReceiver.ACTION_DECLINE, alarm)
    val dismiss = broadcastIntent(context, AlarmReceiver.ACTION_DISMISS, alarm)
    val ringtone = alarm.ringtone.ifBlank { "default" }
    val channelId = channelId(ringtone)
    val style = NotificationCompat.BigTextStyle().bigText(
      if (alarm.message.isBlank()) alarm.title else alarm.message,
    )
    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ringo_notification)
      .setColor(0xFFFF6B4A)
      .setContentTitle("RINGO")
      .setContentText(alarm.title)
      .setSubText(
        if (alarm.isFollowUp) "Missed reminder · calling again" else "Reminder call",
      )
      .setStyle(style)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(incoming)
      .setDeleteIntent(dismiss)
      .setAutoCancel(true)
      .setOngoing(false)
      .setWhen(alarm.occurrenceAt)
      .setShowWhen(true)
      .setFullScreenIntent(incoming, true)
      .addAction(android.R.drawable.ic_menu_call, "Accept", accept)
      .addAction(android.R.drawable.ic_menu_recent_history, "Snooze", snooze)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", decline)

    if (ringtone != "silent" && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      val uri = soundFor(context, ringtone)
      builder.setSound(uri)
      builder.setVibrate(longArrayOf(0, 350, 250, 350))
    }
    try {
      NotificationManagerCompat.from(context).notify(notificationId(alarm.reminderId), builder.build())
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS was revoked. The event log still records the call.
    }
  }

  fun cancel(context: Context, reminderId: String) {
    try {
      NotificationManagerCompat.from(context).cancel(notificationId(reminderId))
    } catch (_: SecurityException) {
      // Ignore revoked permission.
    }
  }

  private fun broadcastIntent(context: Context, action: String, alarm: StoredAlarm): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      this.action = action
      putExtra("alarmKey", alarm.alarmKey)
      putExtra("alarm", alarm.toJson().toString())
      putExtra("reminderId", alarm.reminderId)
    }
    val requestCode = "${alarm.reminderId}:$action".hashCode()
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun activityIntent(context: Context, alarm: StoredAlarm, active: Boolean): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    val route = if (active) "active" else "incoming"
    val uri = Uri.parse("ringo:///$route/${Uri.encode(alarm.reminderId)}?at=${alarm.occurrenceAt}")
    launch.action = Intent.ACTION_VIEW
    launch.data = uri
    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_CLEAR_TOP,
    )
    val requestCode = "${alarm.reminderId}:${if (active) "active" else "incoming"}".hashCode()
    return PendingIntent.getActivity(
      context,
      requestCode,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}

object AlarmScheduler {
  fun scheduleMain(context: Context, alarm: StoredAlarm): Map<String, Any?> {
    // Editing or replacing a reminder cancels its previous series, snooze and follow-up.
    cancelAllForReminder(context, alarm.reminderId)
    val normalized = normalize(alarm)
    AlarmStore.put(context, normalized)
    setAlarm(context, normalized)
    return capabilities(context)
  }

  fun scheduleSnooze(context: Context, alarm: StoredAlarm, minutes: Int): Map<String, Any?> {
    val triggerAt = System.currentTimeMillis() + minutes.coerceIn(1, 60) * 60_000L
    val snoozeAlarm = alarm.copy(
      alarmKey = "${alarm.reminderId}:snooze:${System.currentTimeMillis()}",
      triggerAt = triggerAt,
      isSnooze = true,
      isFollowUp = false,
    )
    cancelSnooze(context, alarm.reminderId)
    AlarmStore.put(context, snoozeAlarm)
    setAlarm(context, snoozeAlarm)
    return capabilities(context)
  }

  fun scheduleFollowUp(context: Context, alarm: StoredAlarm) {
    val followUp = alarm.copy(
      alarmKey = "${alarm.reminderId}:followup:${alarm.occurrenceAt}",
      triggerAt = System.currentTimeMillis() + 2 * 60_000L,
      isFollowUp = true,
      isSnooze = false,
    )
    AlarmStore.put(context, followUp)
    setAlarm(context, followUp)
  }

  fun scheduleNext(context: Context, alarm: StoredAlarm, nextOccurrence: Long) {
    val nextAlarm = alarm.copy(
      alarmKey = "${alarm.reminderId}:main",
      triggerAt = nextOccurrence,
      occurrenceAt = nextOccurrence,
      isFollowUp = false,
      isSnooze = false,
    )
    val fields = Recurrence.localFields(nextOccurrence)
    val withLocal = nextAlarm.copy(
      localYear = fields.first,
      localMonth = fields.second,
      localDay = fields.third,
    )
    AlarmStore.put(context, withLocal)
    setAlarm(context, withLocal)
  }

  fun rescheduleStored(context: Context, alarm: StoredAlarm, triggerAt: Long) {
    val fields = Recurrence.localFields(alarm.occurrenceAt)
    val updated = alarm.copy(
      triggerAt = triggerAt,
      localYear = fields.first,
      localMonth = fields.second,
      localDay = fields.third,
    )
    AlarmStore.put(context, updated)
    setAlarm(context, updated)
  }

  fun setStoredWithoutCancel(context: Context, alarm: StoredAlarm, triggerAt: Long) {
    val updated = alarm.copy(triggerAt = triggerAt)
    AlarmStore.put(context, updated)
    setAlarm(context, updated)
  }

  fun cancelAllForReminder(context: Context, reminderId: String) {
    val existing = AlarmStore.all(context).filter { it.reminderId == reminderId }
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    existing.forEach { alarm ->
      manager.cancel(triggerPendingIntent(context, alarm))
    }
    AlarmStore.removeForReminderPrefix(context, reminderId)
  }

  fun cancelSnooze(context: Context, reminderId: String) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    AlarmStore.all(context)
      .filter { it.reminderId == reminderId && it.isSnooze }
      .forEach { alarm ->
        manager.cancel(triggerPendingIntent(context, alarm))
        AlarmStore.remove(context, alarm.alarmKey)
      }
  }

  fun cancelFollowUp(context: Context, reminderId: String) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    AlarmStore.all(context)
      .filter { it.reminderId == reminderId && it.isFollowUp }
      .forEach { alarm ->
        manager.cancel(triggerPendingIntent(context, alarm))
        AlarmStore.remove(context, alarm.alarmKey)
      }
  }

  fun setAlarm(context: Context, alarm: StoredAlarm) {
    AlarmNotifier.ensureChannels(context)
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = triggerPendingIntent(context, alarm)
    manager.cancel(pi)
    val trigger = maxOf(alarm.triggerAt, System.currentTimeMillis() + 1_000L)
    val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
    if (!canExact) {
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      try {
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(trigger, null), pi)
      } catch (_: SecurityException) {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
      }
    } else {
      manager.setExact(AlarmManager.RTC_WAKEUP, trigger, pi)
    }
  }

  private fun triggerPendingIntent(context: Context, alarm: StoredAlarm): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmReceiver.ACTION_FIRE
      putExtra("alarmKey", alarm.alarmKey)
      putExtra("alarm", alarm.toJson().toString())
      putExtra("reminderId", alarm.reminderId)
    }
    return PendingIntent.getBroadcast(
      context,
      alarm.alarmKey.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun normalize(alarm: StoredAlarm): StoredAlarm {
    val fields = Recurrence.localFields(alarm.occurrenceAt)
    return alarm.copy(
      triggerAt = alarm.occurrenceAt,
      localYear = fields.first,
      localMonth = fields.second,
      localDay = fields.third,
    )
  }

  private fun capabilities(context: Context): Map<String, Any?> =
    AlarmCapabilities.snapshot(context)
}
