# kolable-like-test

一頁式網站：輸入 `appId`，查詢該 app 的會員總數。

## 使用方式

1. 建立環境變數

```bash
cp .env.example .env
```

2. 在 `.env` 填入資料庫連線

- `POSTGRES_URL`：Lodestar DB
- `JWT_SECRET`：任意字串即可（此頁面流程不會驗證 token）

3. 安裝與啟動

```bash
npm install
npm run dev
```

4. 開啟 `http://localhost:3000`

## 技術說明

- 後端使用 `express`
- 使用 Git repo 套件 `lodestar-sdk`（`git@github.com:urfit-tech/lodestar-sdk.git`）
- API：`GET /api/member-count?appId=<id>`
- 查詢流程：
  - `sdk.appService.getApp(appId)` 驗證 app 是否存在
  - `sdk.dataSource.getRepository(Member).count({ where: { appId } })` 取得會員數
