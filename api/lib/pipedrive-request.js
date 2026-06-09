import { createLogger } from "./logger.js";

const log = createLogger("pipedrive-api");

function redactToken(url) {
  return url.replace(/api_token=[^&]+/g, "api_token=***");
}

export async function pipedriveRequest(label, url, options = {}) {
  const method = options.method || "GET";

  log.info("Pipedrive API request", {
    label,
    method,
    url: redactToken(url),
  });

  const res = await fetch(url, options);
  let data;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const pipedriveFailed = data && data.success === false;
  const httpFailed = !res.ok;

  if (httpFailed || pipedriveFailed) {
    log.error("Pipedrive API request failed", new Error(label), {
      label,
      method,
      status: res.status,
      error: data?.error || data?.error_info || res.statusText,
      response: data,
    });
    return { ok: false, data, status: res.status };
  }

  log.info("Pipedrive API request succeeded", {
    label,
    method,
    status: res.status,
    id: data?.data?.id,
  });

  return { ok: true, data, status: res.status };
}
