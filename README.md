# 27 校招航线 · 手机版与岗位雷达

面向 2027 届秋招的企业与岗位导航，重点覆盖销售、采购、供应链、外贸和管培生方向。

## 当前功能

- 119 家重点企业，其中外企专区 53 家
- 支持按求职方向、行业、城市和企业性质筛选
- 单独的外企专区
- 已接入公开岗位源，自动筛选相关岗位并生成“岗位雷达”
- 每 6 小时自动刷新岗位数据
- 支持手机、平板和电脑访问
- 无数据库、无后端服务，适合直接部署到静态网站平台

## 文件说明

- `index.html`：网站入口
- `styles.css`、`jobs.css`：页面样式
- `app.js`：企业搜索和筛选
- `jobs.js`：岗位雷达搜索和筛选
- `data/companies.js`：企业数据
- `data/live-jobs.js`：自动生成的岗位数据
- `scripts/update_jobs.py`：岗位自动更新脚本
- `.github/workflows/update-jobs.yml`：GitHub 自动更新任务
- `.github/workflows/pages.yml`：GitHub Pages 自动部署

## 手机访问

电脑打开时，网站只能通过电脑本机地址访问。要让手机直接打开，需要满足以下任一条件：

1. 使用公网隧道提供临时链接。
2. 部署到 GitHub Pages、Vercel 或 Netlify，获得固定网址。

部署到 GitHub Pages 后，手机可以直接打开固定网址，并且 `.github/workflows/update-jobs.yml` 会每 6 小时自动刷新岗位数据。

## 自动更新说明

`scripts/update_jobs.py` 会读取公开的 27 届秋招信息汇总表，筛选销售、采购、供应链、外贸和管培生相关岗位，生成 `data/live-jobs.js` 和 `data/live-jobs.json`。

岗位信息可能随时调整或截止，正式投递前仍需以企业官方招聘页为准。
