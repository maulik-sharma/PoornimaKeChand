// @ts-check

/**
 * Fast2SMS client for sending SMS in India.
 * @param {{ phone: string, message: string }} options
 * @returns {Promise<{ success: boolean, requestId?: string }>}
 */
async function sendSMS({ phone, message }) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey || apiKey === "...") {
    console.warn("[SMS] FAST2SMS_API_KEY not configured. SMS skipped.");
    return { success: false, requestId: undefined };
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message,
        language: "english",
        flash: 0,
        numbers: phone.replace(/\D/g, ""),
      }),
    });

    const data = await response.json();
    return { success: data.return === true, requestId: data.request_id };
  } catch (err) {
    console.error("[SMS] Failed to send:", err);
    return { success: false };
  }
}

/** @type {Record<string, (...args: any[]) => string>} */
const NUDGE_TEMPLATES = {
  return: (name, topic, url) =>
    `Hi ${name}! 👋 You're doing great. Continue your lesson on "${topic}" today → ${url}`,

  streak7: (name, totalMins) =>
    `🔥 ${name} studied ${totalMins} minutes this week! That's the learning spirit. Keep the streak going!`,

  milestone: (name, completedTopic, score, nextTopic) =>
    `🎉 ${name} completed "${completedTopic}" with ${score}%! Next up: "${nextTopic}". Let's go!`,

  weakness: (name, topic) =>
    `📚 ${name}, "${topic}" needs a bit more practice. A quick 10-min session will make it stick!`,

  parentReport: (name, classGrade, modulesCompleted, avgScore, subjects, topicStudied) =>
    `AI Tutor Report for ${name} (Class ${classGrade}): Completed ${modulesCompleted} modules this week. Average score: ${avgScore}%. Active in: ${subjects}. Latest topic: ${topicStudied}.`,

  examCountdown: (name, daysLeft, completedPct, todayTopic) =>
    `⏰ ${name}, ${daysLeft} days to exams! You've covered ${completedPct}% of your plan. Today's focus: "${todayTopic}". You've got this! 💪`,
};

module.exports = { sendSMS, NUDGE_TEMPLATES };
