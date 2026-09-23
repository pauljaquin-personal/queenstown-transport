const ZONES = [
  ["queenstown", "Queenstown"],
  ["fernhill", "Fernhill"],
  ["frankton", "Frankton"],
  ["hanleys-farm", "Hanley’s Farm"],
  ["jacks-point", "Jack’s Point"],
  ["kelvin-heights", "Kelvin Heights"],
  ["arthurs-point", "Arthurs Point"],
  ["shotover-country", "Shotover Country"],
  ["lake-hayes-estate", "Lake Hayes Estate"],
  ["arrowtown", "Arrowtown"],
];

function populate(select) {
  if (select.options.length) return;
  for (const [value, label] of ZONES) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

export function openCommuteDialog({ dialog, toast }) {
  const form = dialog.querySelector("#commute-form");
  const origin = dialog.querySelector("#commute-origin");
  const destination = dialog.querySelector("#commute-destination");
  const status = dialog.querySelector("#commute-status");
  populate(origin);
  populate(destination);
  if (!origin.value) origin.value = "queenstown";
  if (!destination.value) destination.value = "frankton";

  if (!form.dataset.ready) {
    form.dataset.ready = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      const modes = [...form.querySelectorAll('input[name="commute-mode"]:checked')].map((input) => input.value);
      if (!modes.length) {
        status.textContent = "Choose at least one travel mode.";
        return;
      }
      if (origin.value === destination.value) {
        status.textContent = "Choose two different areas.";
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Sharing…";
      try {
        const response = await fetch("/api/commutes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            origin: origin.value,
            destination: destination.value,
            modes,
            timeBand: dialog.querySelector("#commute-time").value,
            changeReason: dialog.querySelector("#commute-change").value || null,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 503 && result.error === "storage_not_configured") {
            status.textContent = "My Commute is ready, but anonymous collection storage is not connected yet.";
          } else {
            status.textContent = result.error || "Unable to share this commute right now.";
          }
          return;
        }
        form.reset();
        origin.value = "queenstown";
        destination.value = "frankton";
        status.textContent = "";
        dialog.close();
        toast("Thanks — your approximate commute was shared anonymously.");
      } catch {
        status.textContent = "Unable to share this commute right now. Please try again later.";
      } finally {
        submit.disabled = false;
        submit.textContent = "Share my anonymous commute";
      }
    });
  }
  dialog.showModal();
}
