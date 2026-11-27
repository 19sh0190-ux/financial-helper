(() => {
  "use strict";

  // Shared helpers keep display formatting and input guards consistent across all tools.
  const byId = (id) => document.getElementById(id);
  const readNumber = (id) => {
    const value = Number(byId(id).value);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatMoney = (value, digits = 2) => `₹${Number.isFinite(value) ? value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—"}`;
  const setText = (id, value) => { byId(id).textContent = value; };
  let toastTimer;
  let deferredInstallPrompt = null;

  function showToast(message) {
    window.clearTimeout(toastTimer);
    setText("toastMessage", message);
    const toast = byId("toast");
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("visible"));
    toastTimer = window.setTimeout(hideToast, 5200);
  }

  function hideToast() {
    const toast = byId("toast");
    toast.classList.remove("visible");
    window.setTimeout(() => { if (!toast.classList.contains("visible")) toast.hidden = true; }, 220);
  }

  function getProducts() {
    const unit = byId("measurementUnit").value;
    const products = ["A", "B"].map((suffix) => {
      const sticker = readNumber(`price${suffix}`);
      const discount = clamp(readNumber(`discount${suffix}`), 0, 100);
      const fee = readNumber(`fee${suffix}`);
      const quantity = readNumber(`quantity${suffix}`);
      const net = sticker * (1 - discount / 100) + fee;
      const perUnit = quantity > 0 ? net / quantity : null;
      return { suffix, net, perUnit, quantity, unit, brand: byId(`brand${suffix}`).value.trim() || `Option ${suffix}` };
    });
    return products;
  }

  // Tool 1: the net cost includes discount and fees; the comparison never mixes measurement units.
  function calculateUnitPrices() {
    const unit = byId("measurementUnit").value;
    const unitLabel = unit === "pieces" ? "piece" : unit;
    document.querySelectorAll(".unit-abbr").forEach((node) => { node.textContent = unitLabel; });
    const [a, b] = getProducts();
    [a, b].forEach((product) => {
      setText(`net${product.suffix}`, formatMoney(product.net));
      setText(`unit${product.suffix}`, product.perUnit === null ? "Enter quantity" : `${formatMoney(product.perUnit, 4)} / ${unitLabel}`);
    });

    const valid = a.perUnit !== null && b.perUnit !== null;
    const tie = valid && Math.abs(a.perUnit - b.perUnit) < 1e-9;
    const winner = valid && !tie ? (a.perUnit < b.perUnit ? a : b) : null;
    [a, b].forEach((product) => {
      const isWinner = Boolean(winner && winner.suffix === product.suffix);
      byId(`optionCard${product.suffix}`).classList.toggle("winner", isWinner);
      byId(`badge${product.suffix}`).hidden = !isWinner;
    });

    const maxUnit = valid ? Math.max(a.perUnit, b.perUnit, Number.EPSILON) : 1;
    byId("priceBarA").style.width = `${valid ? Math.max(3, (a.perUnit / maxUnit) * 100) : 0}%`;
    byId("priceBarB").style.width = `${valid ? Math.max(3, (b.perUnit / maxUnit) * 100) : 0}%`;
    byId("priceBarA").classList.toggle("secondary", Boolean(winner && winner.suffix !== "A"));
    byId("priceBarB").classList.toggle("secondary", Boolean(winner && winner.suffix !== "B"));

    if (!valid) {
      setText("unitWinner", "Add a quantity above zero to compare these options.");
      setText("unitSaving", "Both products need a valid net quantity.");
      setText("smartSavingsValue", "—");
      setText("smartSavingsMeta", "Enter both quantities to discover savings");
      byId("savingsPill").classList.remove("savings-active");
      return;
    }
    if (tie) {
      setText("unitWinner", "A perfect tie. Both options cost the same per unit.");
      setText("unitSaving", `Each costs ${formatMoney(a.perUnit, 4)} per ${unitLabel}.`);
      setText("smartSavingsValue", "₹0.00");
      setText("smartSavingsMeta", "Same price per unit");
      byId("savingsPill").classList.remove("savings-active");
      return;
    }

    const higher = winner === a ? b : a;
    const difference = higher.perUnit - winner.perUnit;
    const savedPercent = higher.perUnit > 0 ? (difference / higher.perUnit) * 100 : 0;
    const scale = unit === "g" ? 1000 : unit === "ml" ? 1000 : 100;
    const scaleLabel = unit === "g" ? "kg" : unit === "ml" ? "L" : "100 pcs";
    const scaledSaving = difference * scale;
    setText("unitWinner", `${winner.brand} wins at ${formatMoney(winner.perUnit, 4)} per ${unitLabel}.`);
    setText("unitSaving", `${savedPercent.toFixed(1)}% lower per unit · ${formatMoney(scaledSaving)} saved per ${scaleLabel}`);
    setText("smartSavingsValue", `${savedPercent.toFixed(1)}%`);
    setText("smartSavingsMeta", `${formatMoney(scaledSaving)} saved per ${scaleLabel}`);
    byId("savingsPill").classList.add("savings-active");
  }

  // Tool 2: calculate what a free-item or capped-cashback promotion actually costs.
  function calculateOffers() {
    const buy = readNumber("buyX");
    const free = readNumber("getY");
    const price = readNumber("itemPrice");
    const totalItems = buy + free;
    const bill = buy * price;
    setText("bogoDiscount", totalItems > 0 ? `${((free / totalItems) * 100).toFixed(1)}%` : "—");
    setText("bogoUnit", totalItems > 0 ? formatMoney(bill / totalItems) : "—");
    setText("bogoBill", formatMoney(bill));
    setText("bogoCount", String(totalItems));

    const cartBill = readNumber("cartBill");
    const advertisedPct = readNumber("cashbackPct");
    const cap = readNumber("cashbackCap");
    const actual = Math.min(cartBill * (advertisedPct / 100), cap);
    const actualPct = cartBill > 0 ? (actual / cartBill) * 100 : null;
    setText("advertisedPct", `${advertisedPct.toFixed(1)}%`);
    setText("actualCashback", formatMoney(actual));
    setText("cashbackDiscount", actualPct === null ? "—" : `${actualPct.toFixed(1)}%`);
    setText("netPayable", formatMoney(Math.max(0, cartBill - actual)));
    setText("cashbackComparison", actualPct === null ? "Add a cart bill to compare" : `${actualPct.toFixed(1)}% actual rate`);
    byId("cashbackVisual").style.width = advertisedPct > 0 && actualPct !== null ? `${clamp((actualPct / advertisedPct) * 100, 0, 100)}%` : "0%";
  }

  // Tool 3: checked tactics update both the tactile cards and the five-step risk meter.
  function calculateTrapScore() {
    const checks = [...document.querySelectorAll("[data-trap]")];
    const count = checks.filter((check) => check.checked).length;
    const level = count === 0 ? "low" : count <= 2 ? "medium" : "high";
    setText("trapCount", String(count));
    document.querySelectorAll("[data-risk-segment]").forEach((segment, index) => {
      segment.classList.remove("active", "low", "medium", "high");
      if (index < count) segment.classList.add("active", level);
    });
    checks.forEach((check) => {
      const card = check.closest(".trap-card");
      card.classList.toggle("is-checked", check.checked);
      card.classList.toggle("high-risk", check.checked && level === "high");
    });
    const badge = byId("riskBadge");
    badge.className = `risk-badge ${level === "low" ? "" : level}`;
    if (count === 0) {
      setText("riskBadge", "SAFE & TRANSPARENT");
      setText("riskMessage", "No tactics selected. Keep comparing the actual price and product details.");
    } else if (count <= 2) {
      setText("riskBadge", "MODERATE NUDGE · DOUBLE CHECK");
      setText("riskMessage", "A few warning signs are present. Read the terms and compare another seller.");
    } else {
      setText("riskBadge", "HIGH ALERT · 24-HOUR PAUSE");
      setText("riskMessage", "Several pressure tactics are present. Step away and wait 24 hours before deciding.");
    }
    byId("riskProgress").setAttribute("aria-valuenow", String(count));
  }

  // Tool 4: a per-use estimate and compound-growth comparison make opportunity cost tangible.
  function calculateValue() {
    const cost = readNumber("totalCost");
    const uses = readNumber("estimatedUses");
    const perUse = uses > 0 ? cost / uses : null;
    const future = cost * (1.08 ** 5);
    setText("costPerUse", perUse === null ? "Enter uses" : formatMoney(perUse));
    setText("opportunityCost", formatMoney(future));
    setText("spendToday", formatMoney(cost));
    setText("investedValue", formatMoney(future));
    const barMax = Math.max(future, cost, 1);
    byId("spendBar").style.width = `${Math.max(3, (cost / barMax) * 100)}%`;
    byId("investedBar").style.width = `${Math.max(3, (future / barMax) * 100)}%`;
    const isWant = byId("purchaseCategory").value === "want";
    const cooldown = isWant && perUse !== null && perUse > 100;
    byId("cooldownAlert").hidden = !cooldown;
    byId("valueNote").hidden = cooldown;
    if (uses === 0) {
      byId("valueNote").hidden = false;
      setText("valueNote", "Enter at least one realistic use to calculate cost per use.");
    } else if (!cooldown) {
      setText("valueNote", isWant ? "Does your estimate of how often you will use it feel realistic?" : "For an essential purchase, check that this fits your available budget.");
    }
  }

  // Every tool is recalculated from one guarded event boundary so input mistakes stay recoverable.
  function recalculateAll() {
    try {
      calculateUnitPrices();
      calculateOffers();
      calculateTrapScore();
      calculateValue();
    } catch (error) {
      console.error("Smart Buyer calculation error:", error);
      showToast("A calculation could not be updated. Check the entered values and try again.");
    }
  }

  function activateTab(name, focus = false) {
    document.querySelectorAll("[data-tab]").forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  const presets = {
    rice: { unit: "g", A: ["Grain House", 365, 5, 0, 5000], B: ["Value Basket", 299, 0, 0, 4000] },
    snacks: { unit: "g", A: ["Crunch Club", 30, 0, 0, 60], B: ["Snack Stop", 28, 0, 0, 45] },
    local: { unit: "pieces", A: ["CloudMart", 159, 10, 39, 1], B: ["Corner Store", 180, 0, 0, 1] }
  };

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    byId("measurementUnit").value = preset.unit;
    ["A", "B"].forEach((suffix) => {
      const [brand, price, discount, fee, quantity] = preset[suffix];
      byId(`brand${suffix}`).value = brand;
      byId(`price${suffix}`).value = price;
      byId(`discount${suffix}`).value = discount;
      byId(`fee${suffix}`).value = fee;
      byId(`quantity${suffix}`).value = quantity;
    });
    document.querySelectorAll("[data-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.preset === name)));
    calculateUnitPrices();
  }

  function resetApp() {
    document.querySelectorAll("input").forEach((input) => {
      if (input.type === "checkbox" || input.type === "radio") input.checked = input.defaultChecked;
      else input.value = input.defaultValue;
    });
    document.querySelectorAll("select").forEach((select) => { select.value = select.options[0].value; });
    document.querySelectorAll("[data-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.preset === "rice")));
    document.querySelectorAll("[data-category]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === "want")));
    byId("estimatedUses").value = "20";
    activateTab("unit");
    recalculateAll();
    showToast("Everything is reset to the sample comparison.");
  }

  function shareSummary() {
    const report = [
      "Smart Buyer: Best Deal Finder",
      `Unit Price: ${byId("unitWinner").textContent}`,
      `Marketing Trap Score: ${byId("trapCount").textContent} / 5 traps`,
      `Value Check Cost-Per-Use: ${byId("costPerUse").textContent}`
    ].join("\n");
    const textarea = document.createElement("textarea");
    textarea.value = report;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    textarea.remove();
    showToast(copied ? "Summary copied. Paste it into your project notes or message." : "This browser blocked clipboard access. Try Share summary in a browser that allows copying.");
  }

  function makeManifestUrl() {
    const iconSvg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='38' fill='#07140d'/><path d='M28 34h17l19 91a12 12 0 0 0 12 10h65a12 12 0 0 0 12-9l16-62H58' fill='none' stroke='#34d399' stroke-width='11' stroke-linecap='round' stroke-linejoin='round'/><circle cx='83' cy='158' r='10' fill='#34d399'/><circle cx='142' cy='158' r='10' fill='#34d399'/></svg>";
    const icon = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
    const manifest = { name: "Smart Buyer: Best Deal Finder", short_name: "Smart Buyer", start_url: window.location.href, scope: new URL(".", window.location.href).href, display: "standalone", background_color: "#050806", theme_color: "#050806", icons: [{ src: icon, sizes: "192x192 512x512", type: "image/svg+xml", purpose: "any" }] };
    return `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
  }

  // A hosted build can embed its split assets into the requested single-file download.
  async function downloadStandaloneFile() {
    try {
      const [cssResponse, jsResponse] = await Promise.all([fetch("./styles.css"), fetch("./app.js")]);
      if (!cssResponse.ok || !jsResponse.ok) throw new Error("App source files are unavailable");
      const [cssText, jsText] = await Promise.all([cssResponse.text(), jsResponse.text()]);
      const standalone = document.documentElement.cloneNode(true);
      const cssLink = standalone.querySelector('link[href="./styles.css"]');
      const inlineStyle = document.createElement("style");
      inlineStyle.textContent = cssText;
      cssLink.replaceWith(inlineStyle);
      const appScript = standalone.querySelector('script[src="./app.js"]');
      const inlineScript = document.createElement("script");
      inlineScript.textContent = jsText;
      appScript.replaceWith(inlineScript);
      standalone.querySelector('link[rel="manifest"]').href = makeManifestUrl();
      const blob = new Blob(["<!doctype html>\n", standalone.outerHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Smart-Buyer-Deal-Finder-App.html";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      showToast("App file downloaded. Open it on your device, then choose Add to Home Screen or Install App in the browser menu.");
    } catch (error) {
      console.error("Standalone download failed:", error);
      showToast("For the standalone download, open this app from its HTTPS website and try again. On a hosted app, use Add to Home Screen in your browser.");
    }
  }

  function installOrDownload() {
    if (!deferredInstallPrompt) {
      downloadStandaloneFile();
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      showToast(choice.outcome === "accepted" ? "Smart Buyer was added to your apps." : "Install dismissed. You can try again from this button.");
    }).catch(() => downloadStandaloneFile()).finally(() => { deferredInstallPrompt = null; });
  }

  function bindEvents() {
    document.addEventListener("input", recalculateAll);
    document.addEventListener("change", recalculateAll);
    document.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll("[data-tab]")];
        const nextIndex = (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        activateTab(tabs[nextIndex].dataset.tab, true);
      });
    });
    document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.category;
        byId("purchaseCategory").value = category;
        document.querySelectorAll("[data-category]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        calculateValue();
      });
    });
    document.querySelectorAll("[data-uses]").forEach((button) => button.addEventListener("click", () => {
      byId("estimatedUses").value = button.dataset.uses;
      calculateValue();
    }));
    byId("resetButton").addEventListener("click", resetApp);
    byId("shareButton").addEventListener("click", shareSummary);
    byId("installButton").addEventListener("click", installOrDownload);
    byId("toastClose").addEventListener("click", hideToast);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      showToast("Smart Buyer was installed successfully.");
    });
  }

  function registerOfflineSupport() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.register("./service-worker.js").catch((error) => console.info("Offline support is unavailable here:", error));
  }

  function initialize() {
    bindEvents();
    recalculateAll();
    registerOfflineSupport();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
  window.addEventListener("load", recalculateAll, { once: true });
})();