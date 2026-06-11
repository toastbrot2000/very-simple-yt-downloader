// labels for known resolution buckets
const HEIGHT_LABELS = {
  4320: "8K (4320p)",
  2160: "4K (2160p)",
  1440: "2K (1440p)",
  1080: "1080p",
  720: "720p",
  480: "480p",
  360: "360p",
  240: "240p",
  144: "144p",
};

function labelForHeight(h) {
  return HEIGHT_LABELS[h] || `${h}p`;
}

// survives a refresh so an in-flight download can be picked back up
const TASK_STORAGE_KEY = "ytdl-active-task";

// consecutive failed polls before giving up (~15s at 1s per poll)
const MAX_POLL_FAILURES = 15;

document.addEventListener("DOMContentLoaded", () => {
  const formatRadios = document.querySelectorAll('input[name="format"]');
  const qualityGroup = document.getElementById("qualityGroup");
  const qualitySelect = document.getElementById("qualitySelect");
  const qualityIcon = document.getElementById("qualityIcon");
  const qualitySpinner = document.getElementById("qualitySpinner");
  const videoInfo = document.getElementById("videoInfo");
  const urlInput = document.getElementById("urlInput");

  const downloadBtn = document.getElementById("downloadBtn");
  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const btnSpinner = document.getElementById("btnSpinner");

  const statusContainer = document.getElementById("statusContainer");
  const progressBox = document.getElementById("progressBox");
  const processingBox = document.getElementById("processingBox");
  const processingMessage = document.getElementById("processingMessage");
  const progressBar = document.getElementById("progressBar");
  const statusMessage = document.getElementById("statusMessage");
  const percentage = document.getElementById("percentage");
  const errorContainer = document.getElementById("errorContainer");
  const errorMessage = document.getElementById("errorMessage");
  const noticeContainer = document.getElementById("noticeContainer");
  const noticeMessage = document.getElementById("noticeMessage");

  // fallback options used when probing fails
  const defaultOptionsHtml = qualitySelect.innerHTML;

  let lastProbedUrl = null;
  let probeController = null;
  let debounceTimer = null;

  function isMp4Selected() {
    const checked = document.querySelector('input[name="format"]:checked');
    return checked && checked.value === "mp4";
  }

  function setSelectState(disabled, placeholder) {
    qualitySelect.disabled = disabled;
    if (placeholder) {
      qualitySelect.innerHTML = `<option value="best">${placeholder}</option>`;
    }
  }

  // swap the icon for a spinner while a probe is in flight
  function setProbing(probing) {
    qualityIcon.classList.toggle("hidden", probing);
    qualitySpinner.classList.toggle("hidden", !probing);
  }

  // state is "valid", "invalid" or "hidden"; the probe doubles as a link validity check
  function setVideoInfo(state, text) {
    if (!videoInfo) return;
    if (state === "hidden") {
      videoInfo.className = "video-info hidden";
      videoInfo.textContent = "";
      return;
    }
    const icon = state === "valid" ? "fa-circle-check" : "fa-circle-exclamation";
    videoInfo.className = `video-info ${state}`;
    videoInfo.innerHTML = `<i class="fas ${icon}"></i><span class="title"></span>`;
    videoInfo.querySelector(".title").textContent = text; // textContent avoids html injection
  }

  function populateOptions(heights) {
    const preserved = qualitySelect.value;
    let html = '<option value="best">Best Quality</option>';
    heights.forEach((h) => {
      html += `<option value="${h}">${labelForHeight(h)}</option>`;
    });
    qualitySelect.innerHTML = html;
    qualitySelect.disabled = false;
    // keep the previous choice if it still exists
    if ([...qualitySelect.options].some((o) => o.value === preserved)) {
      qualitySelect.value = preserved;
    }
  }

  async function probeFormats(url) {
    if (!url || url === lastProbedUrl) return;
    lastProbedUrl = url;

    // cancel any in-flight probe for an older url
    if (probeController) probeController.abort();
    const controller = new AbortController();
    probeController = controller;

    setSelectState(true, "Loading available qualities…");
    setProbing(true);
    setVideoInfo("hidden");

    try {
      const res = await fetch("/api/formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("probe failed");
      const data = await res.json();

      // a resolved title confirms the link is a real, reachable video
      setVideoInfo("valid", data.title || "Video found");

      if (data.heights && data.heights.length) {
        populateOptions(data.heights);
      } else {
        // extraction worked but exposed no heights, fall back to the static list
        qualitySelect.innerHTML = defaultOptionsHtml;
        qualitySelect.disabled = false;
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      // probe failed: restore the static list and flag that we couldn't verify the link
      lastProbedUrl = null; // allow a retry on next change
      qualitySelect.innerHTML = defaultOptionsHtml;
      qualitySelect.disabled = false;
      setVideoInfo(
        "invalid",
        "Couldn't verify this link. it may be private, removed, or not a supported video.",
      );
    } finally {
      // only clear the spinner if a newer probe hasn't taken over
      if (probeController === controller) setProbing(false);
    }
  }

  // keep the quality selector hidden until mp4 is chosen and a url is entered
  function updateQualityVisibility() {
    const url = urlInput.value.trim();
    const show = isMp4Selected() && url !== "";
    qualityGroup.classList.toggle("hidden", !show);

    // reveal straight into the spinner for an unprobed url so it doesn't flash the default list
    if (show && url !== lastProbedUrl) {
      setSelectState(true, "Loading available qualities…");
      setProbing(true);
      setVideoInfo("hidden");
    }
  }

  function maybeProbe() {
    if (!isMp4Selected()) return;
    const url = urlInput.value.trim();
    if (!url) return;
    probeFormats(url);
  }

  formatRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateQualityVisibility();
      maybeProbe();
    });
  });

  // change fires on blur/enter; the debounced input handler catches pastes
  urlInput.addEventListener("change", () => {
    updateQualityVisibility();
    maybeProbe();
  });
  urlInput.addEventListener("input", () => {
    updateQualityVisibility();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(maybeProbe, 700);
  });

  // ---------------------------------------------------------------------
  // download flow
  // ---------------------------------------------------------------------

  function showError(msg) {
    errorContainer.classList.remove("hidden");
    errorMessage.textContent = msg;
  }

  function showNotice(msg) {
    noticeContainer.classList.remove("hidden");
    noticeMessage.textContent = msg;
  }

  function setBusy() {
    downloadBtn.disabled = true;
    btnText.textContent = "Processing...";
    btnIcon.style.display = "none";
    btnSpinner.style.display = "block";
  }

  function resetButton() {
    downloadBtn.disabled = false;
    btnText.textContent = "Download";
    btnIcon.style.display = "inline-block";
    btnSpinner.style.display = "none";
  }

  // fastapi validation errors put an array of objects in detail
  function detailToMessage(detail, fallback) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => d && d.msg).filter(Boolean);
      if (msgs.length) return msgs.join("; ");
    }
    return fallback;
  }

  function showSpinnerStatus(text) {
    progressBox.classList.add("hidden");
    processingBox.classList.remove("hidden");
    processingMessage.textContent = text;
  }

  function triggerFileDownload(taskId) {
    const link = document.createElement("a");
    link.href = `/api/download_file/${taskId}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function finishTask() {
    sessionStorage.removeItem(TASK_STORAGE_KEY);
    resetButton();
    statusContainer.classList.add("hidden");
  }

  function pollProgress(taskId) {
    let failures = 0;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${taskId}`);
        if (!res.ok) throw new Error(`Progress check failed (${res.status})`);
        failures = 0;

        const progressData = await res.json();

        if (progressData.status === "queued") {
          showSpinnerStatus("Waiting in queue…");
        } else if (progressData.status === "starting") {
          showSpinnerStatus("Starting download…");
        } else if (progressData.status === "downloading") {
          progressBox.classList.remove("hidden");
          processingBox.classList.add("hidden");

          const percent = progressData.progress || 0;
          progressBar.style.width = percent + "%";
          percentage.textContent = Math.round(percent) + "%";
          statusMessage.textContent = `Downloading: ${progressData.filename || "..."}`;
        } else if (progressData.status === "processing") {
          showSpinnerStatus("Processing file (converting / merging)…");
        } else if (progressData.status === "finished") {
          clearInterval(interval);
          // trigger the file download via a temporary anchor
          triggerFileDownload(taskId);
          finishTask();
        } else if (progressData.status === "error") {
          clearInterval(interval);
          finishTask();
          showError(progressData.error || "Unknown error occurred");
        }
      } catch (err) {
        // tolerate transient hiccups, but don't poll a dead task forever
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) {
          clearInterval(interval);
          console.error(err);
          finishTask();
          showError("Lost connection to the server. The download may have been interrupted.");
        }
      }
    }, 1000);
  }

  async function startDownload() {
    const url = urlInput.value.trim();
    const format = document.querySelector('input[name="format"]:checked').value;
    const quality = qualitySelect.value;

    errorContainer.classList.add("hidden");
    noticeContainer.classList.add("hidden");
    statusContainer.classList.add("hidden");
    progressBar.style.width = "0%";

    if (!url) {
      showError("Please enter a valid video URL");
      return;
    }

    setBusy();

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, format_type: format, quality: quality }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.task_id) {
        showError(detailToMessage(data.detail, `Request failed (status ${response.status})`));
        resetButton();
        return;
      }

      const taskId = data.task_id;
      sessionStorage.setItem(TASK_STORAGE_KEY, taskId);

      // e.g. a single video pulled out of a playlist/mix
      if (data.notice) {
        showNotice(data.notice);
      }

      statusContainer.classList.remove("hidden");
      showSpinnerStatus("Waiting in queue…");
      pollProgress(taskId);
    } catch (error) {
      showError("Failed to start download: " + error.message);
      resetButton();
    }
  }

  downloadBtn.addEventListener("click", startDownload);

  // pick an in-flight download back up after a page refresh
  (async () => {
    const storedId = sessionStorage.getItem(TASK_STORAGE_KEY);
    if (!storedId) return;

    try {
      const res = await fetch(`/api/progress/${storedId}`);
      if (!res.ok) {
        // unknown task (server restarted or already cleaned up); forget it
        sessionStorage.removeItem(TASK_STORAGE_KEY);
        return;
      }
      const data = await res.json();

      if (data.status === "finished") {
        triggerFileDownload(storedId);
        finishTask();
      } else if (data.status === "error") {
        finishTask();
        showError(data.error || "Unknown error occurred");
      } else {
        // still running: re-enter the progress UI
        setBusy();
        statusContainer.classList.remove("hidden");
        showSpinnerStatus("Reconnecting…");
        pollProgress(storedId);
      }
    } catch {
      // server unreachable right now; keep the stored id for the next load
    }
  })();
});
