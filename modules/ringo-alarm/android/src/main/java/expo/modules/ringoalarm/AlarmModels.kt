package expo.modules.ringoalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.net.Uri

data class StoredAlarm(
  val alarmKey: String,
  val reminderId: String,
  val triggerAt: Long,
  val occurrenceAt: Long,
  val title: String,
  val message: String,
  val repeatType: String,
  val repeatDays: List<Int>,
  val anchorDay: Int,
  val hour: Int,
  val minute: Int,
  val priority: String,
  val ringtone: String,
  val snoozeMinutes: Int,
  val repeatMissedCall: Boolean,
  val isSnooze: Boolean,
  val isFollowUp: Boolean,
  val timezone: String,
  val localYear: Int,
  val localMonth: Int,
  val localDay: Int,
) {
  fun toJson(): org.json.JSONObject = org.json.JSONObject().apply {
    put("alarmKey", alarmKey)
    put("reminderId", reminderId)
    put("triggerAt", triggerAt)
    put("occurrenceAt", occurrenceAt)
    put("title", title)
    put("message", message)
    put("repeatType", repeatType)
    put("repeatDays", org.json.JSONArray(repeatDays))
    put("anchorDay", anchorDay)
    put("hour", hour)
    put("minute", minute)
    put("priority", priority)
    put("ringtone", ringtone)
    put("snoozeMinutes", snoozeMinutes)
    put("repeatMissedCall", repeatMissedCall)
    put("isSnooze", isSnooze)
    put("isFollowUp", isFollowUp)
    put("timezone", timezone)
    put("localYear", localYear)
    put("localMonth", localMonth)
    put("localDay", localDay)
  }

  companion object {
    fun fromJson(json: org.json.JSONObject): StoredAlarm {
      val daysArray = json.optJSONArray("repeatDays") ?: org.json.JSONArray()
      val days = mutableListOf<Int>()
      for (i in 0 until daysArray.length()) {
        days.add(daysArray.optInt(i))
      }
      return StoredAlarm(
        alarmKey = json.getString("alarmKey"),
        reminderId = json.getString("reminderId"),
        triggerAt = json.optLong("triggerAt", json.getLong("occurrenceAt")),
        occurrenceAt = json.getLong("occurrenceAt"),
        title = json.optString("title", "RINGO"),
        message = json.optString("message", ""),
        repeatType = json.optString("repeatType", "never"),
        repeatDays = days,
        anchorDay = json.optInt("anchorDay", 0),
        hour = json.optInt("hour", 0),
        minute = json.optInt("minute", 0),
        priority = json.optString("priority", "normal"),
        ringtone = json.optString("ringtone", "default"),
        snoozeMinutes = json.optInt("snoozeMinutes", 10),
        repeatMissedCall = json.optBoolean("repeatMissedCall", false),
        isSnooze = json.optBoolean("isSnooze", false),
        isFollowUp = json.optBoolean("isFollowUp", false),
        timezone = json.optString("timezone", ""),
        localYear = json.optInt("localYear", 0),
        localMonth = json.optInt("localMonth", 0),
        localDay = json.optInt("localDay", 0),
      )
    }

    fun fromMap(map: Map<String, Any?>): StoredAlarm {
      val repeatDaysRaw = map["repeatDays"]
      val days = when (repeatDaysRaw) {
        is List<*> -> repeatDaysRaw.mapNotNull { (it as? Number)?.toInt() }
        is String -> parseDays(repeatDaysRaw)
        else -> emptyList()
      }
      val occurrence = (map["occurrenceAt"] as? Number)?.toLong()
        ?: (map["scheduledAt"] as? Number)?.toLong()
        ?: 0L
      val calendar = java.util.Calendar.getInstance().apply { timeInMillis = occurrence }
      return StoredAlarm(
        alarmKey = "${map["id"]?.toString() ?: "unknown"}:main",
        reminderId = map["id"]?.toString() ?: "unknown",
        triggerAt = occurrence,
        occurrenceAt = occurrence,
        title = map["title"]?.toString() ?: "",
        message = map["message"]?.toString() ?: "",
        repeatType = map["repeatType"]?.toString() ?: "never",
        repeatDays = days,
        anchorDay = (map["anchorDay"] as? Number)?.toInt() ?: calendar.get(java.util.Calendar.DAY_OF_MONTH),
        hour = (map["hour"] as? Number)?.toInt() ?: calendar.get(java.util.Calendar.HOUR_OF_DAY),
        minute = (map["minute"] as? Number)?.toInt() ?: calendar.get(java.util.Calendar.MINUTE),
        priority = map["priority"]?.toString() ?: "normal",
        ringtone = map["ringtone"]?.toString() ?: "default",
        snoozeMinutes = (map["snoozeMinutes"] as? Number)?.toInt() ?: 10,
        repeatMissedCall = map["repeatMissedCall"] == true,
        isSnooze = false,
        isFollowUp = false,
        timezone = map["timezone"]?.toString() ?: java.util.TimeZone.getDefault().id,
        localYear = calendar.get(java.util.Calendar.YEAR),
        localMonth = calendar.get(java.util.Calendar.MONTH),
        localDay = calendar.get(java.util.Calendar.DAY_OF_MONTH),
      )
    }

    private fun parseDays(value: String): List<Int> {
      return try {
        val array = org.json.JSONArray(value)
        (0 until array.length()).map { array.optInt(it) }.filter { it in 0..6 }
      } catch (_: Exception) {
        emptyList()
      }
    }
  }
}

object AlarmStore {
  private const val PREFS = "ringo_alarm_store_v1"
  private const val ALARMS_KEY = "alarms"
  private const val EVENTS_KEY = "events"
  private const val MAX_EVENTS = 300
  private val lock = Any()

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Synchronized
  fun all(context: Context): List<StoredAlarm> {
    val raw = prefs(context).getString(ALARMS_KEY, "[]") ?: "[]"
    return try {
      val array = org.json.JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        try {
          StoredAlarm.fromJson(array.getJSONObject(index))
        } catch (_: Exception) {
          null
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  @Synchronized
  fun get(context: Context, alarmKey: String): StoredAlarm? =
    all(context).firstOrNull { it.alarmKey == alarmKey }

  @Synchronized
  fun put(context: Context, alarm: StoredAlarm) {
    val current = all(context).filterNot { it.alarmKey == alarm.alarmKey }.toMutableList()
    current.add(alarm)
    writeAll(context, current)
  }

  @Synchronized
  fun remove(context: Context, alarmKey: String) {
    writeAll(context, all(context).filterNot { it.alarmKey == alarmKey })
  }

  @Synchronized
  fun removeForReminder(context: Context, reminderId: String, onlySnooze: Boolean = false) {
    writeAll(
      context,
      all(context).filterNot {
        it.reminderId == reminderId && (!onlySnooze || it.isSnooze)
      },
    )
  }

  @Synchronized
  fun removeFollowUps(context: Context, reminderId: String) {
    writeAll(context, all(context).filterNot { it.reminderId == reminderId && it.isFollowUp })
  }

  @Synchronized
  fun removeForReminderPrefix(context: Context, reminderId: String) {
    writeAll(context, all(context).filterNot { it.reminderId == reminderId })
  }

  private fun writeAll(context: Context, alarms: List<StoredAlarm>) {
    val array = org.json.JSONArray()
    alarms.forEach { array.put(it.toJson()) }
    prefs(context).edit().putString(ALARMS_KEY, array.toString()).apply()
  }

  @Synchronized
  fun appendEvent(
    context: Context,
    type: String,
    reminderId: String,
    occurrenceAt: Long,
    extra: org.json.JSONObject? = null,
  ) {
    val raw = prefs(context).getString(EVENTS_KEY, "[]") ?: "[]"
    val array = try {
      org.json.JSONArray(raw)
    } catch (_: Exception) {
      org.json.JSONArray()
    }
    val event = org.json.JSONObject().apply {
      put("type", type)
      put("reminderId", reminderId)
      put("occurrenceAt", occurrenceAt)
      put("timestamp", System.currentTimeMillis())
      if (extra != null) {
        put("extra", extra)
      }
    }
    array.put(event)
    val trimmed = if (array.length() > MAX_EVENTS) {
      org.json.JSONArray().also { target ->
        for (i in array.length() - MAX_EVENTS until array.length()) target.put(array.get(i))
      }
    } else {
      array
    }
    prefs(context).edit().putString(EVENTS_KEY, trimmed.toString()).apply()
  }

  @Synchronized
  fun consumeEvents(context: Context): List<Map<String, Any?>> {
    val raw = prefs(context).getString(EVENTS_KEY, "[]") ?: "[]"
    prefs(context).edit().remove(EVENTS_KEY).apply()
    return try {
      val array = org.json.JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        try {
          val json = array.getJSONObject(index)
          mapOf(
            "type" to json.optString("type"),
            "reminderId" to json.optString("reminderId"),
            "occurrenceAt" to json.optLong("occurrenceAt"),
            "timestamp" to json.optLong("timestamp"),
            "extra" to json.optJSONObject("extra")?.let { extra ->
              extra.keys().asSequence().associateWith { key -> extra.opt(key) }
            },
          )
        } catch (_: Exception) {
          null
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }
}

object AlarmCapabilities {
  fun snapshot(context: Context): Map<String, Any?> {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
    val fullScreen = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
      notificationManager.canUseFullScreenIntent()
    val notificationsEnabled = notificationManager.areNotificationsEnabled()
    val batteryOptimized = !powerManager.isIgnoringBatteryOptimizations(context.packageName)
    val doNotDisturb = notificationManager.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL
    return mapOf(
      "nativeAndroid" to true,
      "exactAlarms" to exact,
      "fullScreenIntent" to fullScreen,
      "notificationsEnabled" to notificationsEnabled,
      "batteryOptimized" to batteryOptimized,
      "doNotDisturb" to doNotDisturb,
    )
  }

  fun openExactAlarmSettings(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !(context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()) {
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    } else {
      openAppSettings(context)
    }
  }

  fun openFullScreenSettings(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        return
      } catch (_: Exception) {
        // Fall through to app notification settings on devices without this screen.
      }
    }
    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  fun openNotificationSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  fun openBatterySettings(context: Context) {
    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (_: Exception) {
      openAppSettings(context)
    }
  }

  private fun openAppSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
