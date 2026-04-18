/**
 * Schedules friendly, non-invasive periodic reminders to open the app and report.
 * Notifications are scheduled locally — no server required.
 * We schedule a batch for the next N days, replacing any existing batch on each call.
 * Frequency: max 1 per day, only at beach-friendly hours (10:00–19:00).
 */
import * as Notifications from "expo-notifications";

const REMINDER_IDENTIFIER_PREFIX = "w2b_reminder_";
const DAYS_AHEAD = 7;
// Only on these weekdays (0=Sun, 1=Mon, ...) — skip Mon/Tue when beaches are typically empty
const ALLOWED_WEEKDAYS = [3, 4, 5, 6, 0]; // Wed–Sun
const HOUR = 12; // noon
const MINUTE = 0;

const MESSAGES = [
  { title: "Com'è la spiaggia oggi? 🌊", body: "Apri l'app e segnala in 5 secondi. Aiuti migliaia di bagnanti!" },
  { title: "Missione della settimana 🎯", body: "Hai già segnalato? Completa la missione e guadagna punti!" },
  { title: "La mappa ha bisogno di te 🗺️", body: "Aggiungi una segnalazione rapida e tieni aggiornata la tua zona." },
  { title: "Folla o relax? 🏖️", body: "Condividi lo stato della spiaggia — bastano 5 secondi!" },
  { title: "Hai già segnalato oggi? 👀", body: "Gli altri utenti aspettano notizie dalla tua zona. Dai un'occhiata!" },
  { title: "Streak giornaliero 🔥", body: "Mantieni la streak e scala la classifica. Segnala oggi!" },
  { title: "Aggiorna la mappa 🌅", body: "Come sono le spiagge vicino a te? Un tap e tutti lo sanno." },
];

export async function schedulePeriodicReminders(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    // Cancel existing reminders to avoid duplicates
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => n.identifier.startsWith(REMINDER_IDENTIFIER_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const now = new Date();
    let scheduled = 0;

    for (let day = 1; day <= DAYS_AHEAD * 2 && scheduled < DAYS_AHEAD; day++) {
      const target = new Date(now);
      target.setDate(target.getDate() + day);
      target.setHours(HOUR, MINUTE, 0, 0);

      if (!ALLOWED_WEEKDAYS.includes(target.getDay())) continue;
      // Don't schedule if it's in the past
      if (target.getTime() <= now.getTime()) continue;

      const msg = MESSAGES[scheduled % MESSAGES.length];
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_IDENTIFIER_PREFIX}${day}`,
        content: {
          title: msg.title,
          body: msg.body,
          data: { type: "periodic_reminder" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
        },
      });
      scheduled++;
    }
  } catch {
    // Non-fatal
  }
}
