(() => {
  "use strict";

  const live = window.LIVE_JOBS;
  const companies = window.CAMPUS_DATA?.companies || [];
  const state = { query: "", directions: new Set(), limit: 12 };
  const els = {
    updated: document.getElementById("jobsUpdated"),
    sourceCount: document.getElementById("jobsSourceCount"),
    search: document.getElementById("jobSearchInput"),
    filters: document.getElementById("jobDirectionFilters"),
    count: document.getElementById("jobsResultCount"),
    grid: document.getElementById("jobGrid"),
    empty: document.getElementById("jobsEmpty"),
    more: document.getElementById("jobsMore")
  };
  const allDirections = ["销售", "采购", "供应链", "外贸", "管培生"];
  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value ?? "").toLowerCase().replace(/[\s\-—_/·（）()【】\[\]]/g, "");
  const companyKey = (value) => normalize(value)
    .replace(/集团$/g, "")
    .replace(/(股份有限公司|有限责任公司|有限公司|中国区|中国|控股|人才计划)$/g, "");

  if (!live || !Array.isArray(live.jobs) || !els.grid) return;

  const findCompany = (name) => {
    const key = companyKey(name);
    if (!key) return null;
    return companies.find((company) => {
      const other = companyKey(company.name);
      return other === key || other.includes(key) || key.includes(other);
    }) || null;
  };

  const matchedItems = () => live.jobs.map((job, index) => ({ ...job, index, company: findCompany(job.name) }));

  const filteredItems = () => {
    const q = normalize(state.query);
    return matchedItems().filter((item) => {
      if (state.directions.size && ![...state.directions].every((direction) => item.directions.includes(direction))) return false;
      if (!q) return true;
      return normalize([item.name, item.job, item.deadline, ...item.directions, item.company?.name, item.company?.industry].join(" ")).includes(q);
    });
  };

  const jobCard = (item) => `
    <article class="job-card">
      <div class="job-card__head">
        <div>
          <h3>${escapeHTML(item.name)}</h3>
          <p>${item.company ? `${escapeHTML(item.company.industry)} · ${escapeHTML(item.company.ownership)}` : "公开校招岗位"}</p>
        </div>
        <span class="job-card__deadline">${escapeHTML(item.deadline || "截止时间未公布")}</span>
      </div>
      <div class="job-card__tags">${item.directions.map((direction) => `<span>${escapeHTML(direction)}</span>`).join("")}</div>
      <p class="job-card__description">${escapeHTML(item.job || "岗位详情请查看原始信息表")}</p>
      <div class="job-card__bottom">
        <div class="job-card__code"><small>信息来源</small><strong>公开岗位汇总</strong></div>
        <div class="job-card__actions">
          ${item.company ? `<button class="button button--primary" type="button" data-job-company="${item.index}">查看企业</button>` : ""}
          <a class="button button--secondary" href="${escapeHTML(item.sourceUrl || live.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源</a>
        </div>
      </div>
    </article>
  `;

  const render = () => {
    const items = filteredItems();
    const visible = items.slice(0, state.limit);
    els.grid.innerHTML = visible.map(jobCard).join("");
    els.empty.hidden = items.length !== 0;
    els.grid.hidden = items.length === 0;
    els.count.textContent = `${items.length} 条`;
    els.more.hidden = items.length <= state.limit;
    els.more.textContent = `显示更多岗位（剩余 ${Math.max(items.length - state.limit, 0)} 条）`;
    els.filters.querySelectorAll("[data-job-direction]").forEach((button) => {
      const active = state.directions.has(button.dataset.jobDirection);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  els.updated.textContent = `更新于 ${live.updatedAt}`;
  els.sourceCount.textContent = `公开源 ${live.sourceTotal} 条`;
  els.filters.innerHTML = allDirections.map((direction) => `<button type="button" class="choice-chip" data-job-direction="${direction}">${direction}</button>`).join("");

  els.search.addEventListener("input", (event) => { state.query = event.target.value; state.limit = 12; render(); });
  els.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-job-direction]");
    if (!button) return;
    const value = button.dataset.jobDirection;
    if (state.directions.has(value)) state.directions.delete(value);
    else state.directions.add(value);
    state.limit = 12;
    render();
  });
  els.more.addEventListener("click", () => { state.limit += 12; render(); });
  els.grid.addEventListener("click", (event) => {
    const companyButton = event.target.closest("[data-job-company]");
    if (companyButton) {
      const item = matchedItems()[Number(companyButton.dataset.jobCompany)];
      if (!item?.company) return;
      const allZone = document.querySelector('.nav [data-zone="all"]');
      if (allZone && !allZone.classList.contains("is-active")) allZone.click();
      const search = document.getElementById("searchInput");
      if (search) {
        search.value = item.company.name;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.getElementById("directory")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  });

  render();
})();
