## 修改的 Requirements

### Requirement: status 篩選要對照 alert-status 值域做驗證

系統必須拒絕一個 `status` 查詢值(用在 `GET /alerts` 跟 `GET /machines/:id/alerts` 上),只要它逗號分隔的任一段不是 alert-status 集合(`ACTIVE`、`ACKNOWLEDGED`、`RESOLVED`)的成員,就回應 `400`、錯誤碼 `INVALID_QUERY_PARAMETER`,每一段都對照 schema 用的同一個常數驗證成員資格。

#### Scenario: 值域外的 status 被拒絕
- **當** client GET `/alerts?status=foo`(或 `?status=active`,大小寫錯誤)
- **則** 系統回應 `400`、錯誤碼 `INVALID_QUERY_PARAMETER`,而不是默默回傳空清單

#### Scenario: 多值列表裡有一段不合法就拒絕整個請求
- **當** client GET `/alerts?status=ACTIVE,foo`
- **則** 系統回應 `400`、錯誤碼 `INVALID_QUERY_PARAMETER`
