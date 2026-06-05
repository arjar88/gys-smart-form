const DEFAULT_WIX_URL = "https://www.gysmortgage.com/_functions/submitDeal";

export async function submitDeal(payload) {
  const url = import.meta.env.VITE_WIX_SUBMIT_URL || DEFAULT_WIX_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from submission server.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Submission failed. Please try again.");
  }

  return data;
}
