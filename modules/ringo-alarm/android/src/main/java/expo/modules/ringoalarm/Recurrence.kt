package expo.modules.ringoalarm

import java.util.Calendar
import java.util.TimeZone

object Recurrence {
  fun computeNext(alarm: StoredAlarm, fromOccurrence: Long): Long? {
    if (alarm.repeatType == "never") return null
    val base = Calendar.getInstance().apply {
      timeInMillis = fromOccurrence
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    val next = base.clone() as Calendar
    when (alarm.repeatType) {
      "daily" -> next.add(Calendar.DAY_OF_YEAR, 1)
      "weekly" -> next.add(Calendar.DAY_OF_YEAR, 7)
      "weekdays" -> {
        do {
          next.add(Calendar.DAY_OF_YEAR, 1)
        } while (next.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || next.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY)
      }
      "weekends" -> {
        do {
          next.add(Calendar.DAY_OF_YEAR, 1)
        } while (next.get(Calendar.DAY_OF_WEEK) != Calendar.SATURDAY && next.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY)
      }
      "monthly" -> {
        next.set(Calendar.DAY_OF_MONTH, 1)
        next.add(Calendar.MONTH, 1)
        val lastDay = next.getActualMaximum(Calendar.DAY_OF_MONTH)
        next.set(Calendar.DAY_OF_MONTH, minOf(alarm.anchorDay, lastDay))
      }
      "custom" -> {
        val days = if (alarm.repeatDays.isEmpty()) {
          listOf(base.get(Calendar.DAY_OF_WEEK) - 1)
        } else {
          alarm.repeatDays
        }
        var guard = 0
        do {
          next.add(Calendar.DAY_OF_YEAR, 1)
          guard += 1
        } while (!days.contains(next.get(Calendar.DAY_OF_WEEK) - 1) && guard < 14)
      }
      else -> return null
    }
    next.set(Calendar.HOUR_OF_DAY, alarm.hour)
    next.set(Calendar.MINUTE, alarm.minute)
    next.set(Calendar.SECOND, 0)
    next.set(Calendar.MILLISECOND, 0)
    return next.timeInMillis
  }

  /**
   * Rebuilds an alarm's next trigger using the same wall-clock time in the
   * device's current timezone. Returns the trigger time.
   */
  fun rebuildForTimezone(alarm: StoredAlarm, now: Long): Long {
    if (alarm.isSnooze || alarm.isFollowUp) {
      return if (alarm.triggerAt <= now) now + 1000 else alarm.triggerAt
    }
    val local = Calendar.getInstance(TimeZone.getDefault()).apply {
      set(Calendar.YEAR, alarm.localYear)
      set(Calendar.MONTH, alarm.localMonth)
      set(Calendar.DAY_OF_MONTH, alarm.localDay)
      set(Calendar.HOUR_OF_DAY, alarm.hour)
      set(Calendar.MINUTE, alarm.minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if (local.timeInMillis > now) return local.timeInMillis
    var cursor = local.timeInMillis
    if (alarm.repeatType == "never") return cursor
    var guard = 0
    while (cursor <= now && guard < 500) {
      val candidate = computeNext(alarm, cursor) ?: return local.timeInMillis
      cursor = candidate
      guard += 1
    }
    return cursor
  }

  fun localFields(timeMillis: Long): Triple<Int, Int, Int> {
    val cal = Calendar.getInstance().apply { this.timeInMillis = timeMillis }
    return Triple(
      cal.get(Calendar.YEAR),
      cal.get(Calendar.MONTH),
      cal.get(Calendar.DAY_OF_MONTH),
    )
  }
}
