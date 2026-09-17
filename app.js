(() => {
  "use strict";

  const data = window.CAMPUS_DATA;
  if (!data || !Array.isArray(data.companies)) return;

  const state = {
    query: "",
    zone: location.hash === "#foreign" ? "foreign" : "all",
    directions: new Set(),
    industry: "",
    city: "",
    ownership: "",
    hotOnly: false,
    sort: "recommended"
  };

  const els = {
    search: document.getElementById("searchInput"),
    heroCompanyCount: document.getElementById("heroCompanyCount"),
    heroForeignCount: document.getElementById("heroForeignCount"),
    navForeignCount: document.getElementById("navForeignCount"),
    statTotal: document.getElementById("statTotal"),
    statForeign: document.getElementById("statForeign"),
    statDirections: document.getElementById("statDirections"),
    statUpdated: document.getElementById("statUpdated"),
    dataNoteDate: document.getElementById("dataNoteDate"),
    directionGrid: document.getElementById("directionGrid"),
    directionFilters: document.getElementById("directionFilters"),
    industryFilter: document.getElementById("industryFilter"),
    cityFilter: document.getElementById("cityFilter"),
    ownershipFilter: document.getElementById("ownershipFilter"),
    hotOnly: document.getElementById("hotOnly"),
    clearFilters: document.getElementById("clearFilters"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultDescription: document.getElementById("resultDescription"),
    resultCount: document.getElementById("resultCount"),
    sortSelect: document.getElementById("sortSelect"),
    activeFilters: document.getElementById("activeFilters"),
    companyGrid: document.getElementById("companyGrid"),
    emptyState: document.getElementById("emptyState"),
    emptyReset: document.getElementById("emptyReset"),
    modal: document.getElementById("companyModal"),
    modalContent: document.getElementById("modalContent"),
    toast: document.getElementById("toast"),
    mobileFilterButton: document.getElementById("mobileFilterButton"),
    filtersPanel: document.getElementById("filtersPanel"),
    filterSummary: document.getElementById("filterSummary")
  };

  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("zh-CN");

  const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-CN"));

  const initialState = (company) => {
    const clean = String(company.name || company.en || "?").replace(/[^\p{L}\p{N}]/gu, "");
    return clean.slice(0, 2).toUpperCase() || "企";
  };

  const directionCount = (direction) => data.companies.filter((item) => item.directions.includes(direction)).length;

  const getFilteredCompanies = () => {
    const q = normalize(state.query);
    const result = data.companies.filter((company) => {
      if (state.zone === "foreign" && company.zone !== "foreign") return false;
      if (state.hotOnly && !company.hot) return false;
      if (state.industry && company.industry !== state.industry) return false;
      if (state.city && !company.cities.includes(state.city)) return false;
      if (state.ownership && company.ownership !== state.ownership) return false;
      if (state.directions.size && ![...state.directions].every((tag) => company.directions.includes(tag))) return false;
      if (!q) return true;
      const haystack = normalize([
        company.name,
        company.en,
        company.industry,
        company.ownership,
        company.hq,
        company.subzone,
        company.note,
        ...company.cities,
        ...company.directions
      ].join(" "));
      return haystack.includes(q);
    });

    return result.sort((a, b) => {
      if (state.sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      if (state.sort === "foreign") {
        if (a.zone !== b.zone) return a.zone === "foreign" ? -1 : 1;
        return a.name.localeCompare(b.name, "zh-CN");
      }
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (b.directions.length !== a.directions.length) return b.directions.length - a.directions.length;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  };

  const showToast = (message) => {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
  };

  const setOptions = (select, values) => {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  };

  const initStaticUI = () => {
    const foreignCount = data.companies.filter((item) => item.zone === "foreign").length;
    els.heroCompanyCount.textContent = data.companies.length;
    els.heroForeignCount.textContent = foreignCount;
    els.navForeignCount.textContent = foreignCount;
    els.statTotal.textContent = data.companies.length;
    els.statForeign.textContent = foreignCount;
    els.statDirections.textContent = data.directions.length;
    els.statUpdated.textContent = data.updatedAt.slice(5).replace("-", "/");
    els.dataNoteDate.textContent = `核验于 ${data.updatedAt}`;

    setOptions(els.industryFilter, uniqueSorted(data.companies.map((item) => item.industry)));
    setOptions(els.cityFilter, uniqueSorted(data.companies.flatMap((item) => item.cities)));
    setOptions(els.ownershipFilter, uniqueSorted(data.companies.map((item) => item.ownership)));

    els.directionGrid.innerHTML = data.directions.map((item) => `
      <button class="direction-card" type="button" data-direction-card="${escapeHTML(item.key)}">
        <div class="direction-card__top">
          <span class="direction-card__icon">${escapeHTML(item.key.slice(0, 1))}</span>
          <span class="direction-card__count">${directionCount(item.key)} 家</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.desc)}</p>
      </button>
    `).join("");

    els.directionFilters.innerHTML = data.directions.map((item) => `
      <button class="choice-chip" type="button" data-direction="${escapeHTML(item.key)}">${escapeHTML(item.key)}</button>
    `).join("");
  };

  const renderActiveFilters = () => {
    const pills = [];
    if (state.zone === "foreign") pills.push(["zone", "外企专区"]);
    [...state.directions].forEach((value) => pills.push(["direction", value]));
    if (state.industry) pills.push(["industry", state.industry]);
    if (state.city) pills.push(["city", state.city]);
    if (state.ownership) pills.push(["ownership", state.ownership]);
    if (state.hotOnly) pills.push(["hot", "优先关注"]);

    els.activeFilters.hidden = pills.length === 0;
    els.activeFilters.innerHTML = pills.map(([key, label]) => `
      <span class="filter-pill">${escapeHTML(label)}<button type="button" data-remove-filter="${key}" data-value="${escapeHTML(label)}" aria-label="移除 ${escapeHTML(label)}">×</button></span>
    `).join("");
  };

  const renderDirectionState = () => {
    document.querySelectorAll("[data-direction]").forEach((button) => {
      const active = state.directions.has(button.dataset.direction);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-direction-card]").forEach((button) => {
      const active = state.directions.has(button.dataset.directionCard);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const renderResultHeading = (count) => {
    const foreignMode = state.zone === "foreign";
    els.resultKicker.textContent = foreignMode ? "FOREIGN COMPANIES" : "ALL COMPANIES";
    els.resultTitle.textContent = foreignMode ? "外企专区" : "企业名录";
    els.resultDescription.textContent = foreignMode ? "外资、合资与国际化企业官方招聘入口" : "官方招聘入口与企业信息汇总";
    els.resultCount.textContent = `${count} 家`;
    els.filterSummary.textContent = foreignMode ? "当前仅查看外企专区" : "按方向、类型和城市组合筛选";
    document.querySelectorAll("[data-zone]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.zone === state.zone);
    });
  };

  const cardTemplate = (company, index) => {
    const primaryDirection = company.directions[0];
    return `
      <article class="company-card" style="animation-delay:${Math.min(index * 22, 240)}ms">
        <div class="company-card__top">
          <div class="company-card__identity">
            <span class="company-avatar ${company.zone === "foreign" ? "is-foreign" : ""}" aria-hidden="true">${escapeHTML(initialState(company))}</span>
            <div><h3 title="${escapeHTML(company.name)}">${escapeHTML(company.name)}</h3><span class="company-card__en" title="${escapeHTML(company.en)}">${escapeHTML(company.en)}</span></div>
          </div>
          <div class="company-card__flags">
            ${company.zone === "foreign" ? `<span class="flag flag--foreign">${escapeHTML(company.subzone || "外企")}</span>` : ""}
            ${company.hot ? `<span class="flag flag--hot">优先关注</span>` : ""}
          </div>
        </div>
        <div class="company-card__meta">
          <div class="company-meta"><small>行业</small><strong title="${escapeHTML(company.industry)}">${escapeHTML(company.industry)}</strong></div>
          <div class="company-meta"><small>企业性质</small><strong>${escapeHTML(company.ownership)}</strong></div>
          <div class="company-meta"><small>总部 / 地区</small><strong>${escapeHTML(company.hq)}</strong></div>
          <div class="company-meta"><small>主要城市</small><strong title="${escapeHTML(company.cities.join("、"))}">${escapeHTML(company.cities.slice(0, 3).join("、"))}${company.cities.length > 3 ? " 等" : ""}</strong></div>
        </div>
        <div class="direction-tags">
          ${company.directions.map((tag) => `<span class="direction-tag ${tag === primaryDirection ? "is-primary" : ""}">${escapeHTML(tag)}</span>`).join("")}
        </div>
        <p class="company-card__note">${escapeHTML(company.note)}</p>
        <div class="company-card__actions">
          <a class="button button--primary" href="${escapeHTML(company.applyUrl)}" target="_blank" rel="noopener noreferrer">打开官方入口</a>
          <button class="button button--secondary" type="button" data-company-detail="${index}">详情</button>
        </div>
        <div class="company-card__verified"><span>2027 届方向参考</span><span>核验 ${escapeHTML(company.verified)}</span></div>
      </article>
    `;
  };

  const renderCompanies = () => {
    const companies = getFilteredCompanies();
    renderResultHeading(companies.length);
    renderActiveFilters();
    renderDirectionState();
    els.companyGrid.innerHTML = companies.map(cardTemplate).join("");
    els.emptyState.hidden = companies.length !== 0;
    els.companyGrid.hidden = companies.length === 0;
    els.companyGrid.querySelectorAll("[data-company-detail]").forEach((button) => {
      button.addEventListener("click", () => openModal(companies[Number(button.dataset.companyDetail)]));
    });
  };

  const detailTemplate = (company) => `
    <div class="modal-hero">
      <div class="modal-hero__identity">
        <span class="company-avatar ${company.zone === "foreign" ? "is-foreign" : ""}" aria-hidden="true">${escapeHTML(initialState(company))}</span>
        <div><h2 id="modalTitle">${escapeHTML(company.name)}</h2><p>${escapeHTML(company.en)}</p></div>
      </div>
      <div class="modal-hero__tags">
        <span>${company.zone === "foreign" ? escapeHTML(company.subzone || "外企") : "国内企业"}</span>
        <span>${escapeHTML(company.ownership)}</span>
        <span>${escapeHTML(company.industry)}</span>
        ${company.hot ? "<span>优先关注</span>" : ""}
      </div>
    </div>
    <div class="modal-body">
      <div class="modal-grid">
        <div class="modal-detail"><small>总部 / 地区</small><strong>${escapeHTML(company.hq)}</strong></div>
        <div class="modal-detail"><small>招聘范围</small><strong>2027 届秋招 / 校招官网</strong></div>
        <div class="modal-detail"><small>匹配方向</small><strong>${escapeHTML(company.directions.join("、"))}</strong></div>
        <div class="modal-detail"><small>主要城市</small><strong>${escapeHTML(company.cities.join("、"))}</strong></div>
      </div>
      <p class="modal-note">${escapeHTML(company.note)}</p>
      <div class="modal-actions">
        <a class="button button--primary button--wide" href="${escapeHTML(company.applyUrl)}" target="_blank" rel="noopener noreferrer">打开官方入口 ↗</a>
        ${company.officialUrl ? `<a class="button button--secondary button--wide" href="${escapeHTML(company.officialUrl)}" target="_blank" rel="noopener noreferrer">企业官网</a>` : ""}
      </div>
      <p class="modal-warning">首版数据用于方向筛选和企业发现，不代表企业当前一定开放 2027 届岗位。具体项目、开放时间、工作地点和截止时间，请以官方招聘页实时信息为准。最近核验：${escapeHTML(company.verified)}。</p>
    </div>
  `;

  const openModal = (company) => {
    if (!company) return;
    els.modalContent.innerHTML = detailTemplate(company);
    els.modal.hidden = false;
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    els.modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  const resetFilters = (keepZone = true) => {
    state.query = "";
    state.directions.clear();
    state.industry = "";
    state.city = "";
    state.ownership = "";
    state.hotOnly = false;
    if (!keepZone) state.zone = "all";
    els.search.value = "";
    els.industryFilter.value = "";
    els.cityFilter.value = "";
    els.ownershipFilter.value = "";
    els.hotOnly.checked = false;
    els.filtersPanel.classList.remove("is-open");
    els.mobileFilterButton.setAttribute("aria-expanded", "false");
    renderCompanies();
  };

  const scrollToDirectory = () => document.getElementById("directory").scrollIntoView({ behavior: "smooth", block: "start" });

  const toggleDirection = (direction) => {
    if (state.directions.has(direction)) state.directions.delete(direction);
    else state.directions.add(direction);
    renderCompanies();
    scrollToDirectory();
  };

  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCompanies();
  });

  document.querySelectorAll("[data-zone]").forEach((button) => {
    button.addEventListener("click", () => {
      state.zone = button.dataset.zone;
      if (state.zone === "foreign") history.replaceState(null, "", "#foreign");
      else history.replaceState(null, "", location.pathname + location.search);
      renderCompanies();
      scrollToDirectory();
    });
  });

  document.querySelectorAll("[data-shortcut-direction]").forEach((button) => {
    button.addEventListener("click", () => toggleDirection(button.dataset.shortcutDirection));
  });

  els.directionGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-direction-card]");
    if (button) toggleDirection(button.dataset.directionCard);
  });

  els.directionFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-direction]");
    if (button) toggleDirection(button.dataset.direction);
  });

  els.industryFilter.addEventListener("change", (event) => { state.industry = event.target.value; renderCompanies(); });
  els.cityFilter.addEventListener("change", (event) => { state.city = event.target.value; renderCompanies(); });
  els.ownershipFilter.addEventListener("change", (event) => { state.ownership = event.target.value; renderCompanies(); });
  els.hotOnly.addEventListener("change", (event) => { state.hotOnly = event.target.checked; renderCompanies(); });
  els.sortSelect.addEventListener("change", (event) => { state.sort = event.target.value; renderCompanies(); });
  els.clearFilters.addEventListener("click", () => resetFilters(true));
  els.emptyReset.addEventListener("click", () => resetFilters(true));

  els.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) return;
    const key = button.dataset.removeFilter;
    if (key === "zone") state.zone = "all";
    if (key === "direction") state.directions.delete(button.dataset.value);
    if (key === "industry") { state.industry = ""; els.industryFilter.value = ""; }
    if (key === "city") { state.city = ""; els.cityFilter.value = ""; }
    if (key === "ownership") { state.ownership = ""; els.ownershipFilter.value = ""; }
    if (key === "hot") { state.hotOnly = false; els.hotOnly.checked = false; }
    renderCompanies();
  });

  els.mobileFilterButton.addEventListener("click", () => {
    const open = !els.filtersPanel.classList.contains("is-open");
    els.filtersPanel.classList.toggle("is-open", open);
    els.mobileFilterButton.setAttribute("aria-expanded", String(open));
  });

  els.modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      els.filtersPanel.classList.remove("is-open");
      els.mobileFilterButton.setAttribute("aria-expanded", "false");
    }
    const tag = document.activeElement?.tagName;
    if (event.key === "/" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
      event.preventDefault();
      els.search.focus();
    }
  });

  initStaticUI();
  renderCompanies();
})();

