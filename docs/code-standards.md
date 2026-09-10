# Code Standards

---

## 1. Ngôn ngữ và style

TypeScript theo [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).

Bộ công cụ do `nest new` sinh ra: **oxlint** (không phải ESLint) và Prettier, test bằng
**Vitest** (không phải Jest).

```
npm run lint      # oxlint src/ test/
npm run format    # Prettier ghi đè
npm test          # Vitest
npm run test:e2e  # Vitest, config riêng
```

---

## 2. Sunlint

Bắt buộc trước mỗi pull request. Không được merge khi còn rule mức `error`.
Rule mức `warning` khuyến khích sửa.

Cài dạng devDependency, **ghim cứng phiên bản** — không dùng `^`. Kết quả lint đính kèm
pull request làm bằng chứng, nên phiên bản trôi giữa các lần chạy sẽ cho số liệu lệch.
Đây là ngoại lệ duy nhất: mọi package khác dùng range bình thường.

```jsonc
"devDependencies": { "@sun-asterisk/sunlint": "<phiên bản chính xác, xem package.json>" },
"scripts": {
  "lint:sun":        "sunlint --all --input=src",
  "lint:sun:report": "sunlint --all --input=src --output-summary=sunlint-report.json",
  "lint:sun:pr":     "sunlint --all --changed-files"
}
```

Preset `recommended`. `lint:sun:report` xuất JSON có số error/warning, điểm chất lượng,
tên nhánh và commit hash — dùng làm bằng chứng đính kèm.

Sunlint **không thay thế** oxlint của dự án. Hai công cụ chạy song song, mục đích khác nhau:
oxlint lúc viết code, Sunlint trước khi mở pull request. Sunlint gói sẵn ESLint trong
`dependencies` của nó nên vẫn chạy được dù dự án không cài ESLint.

File cấu hình là **`.sunlint.json`** — đứng đầu thứ tự tìm kiếm của cả hai loader.
Preset `recommended` chỉ có 3 rule ở mức error (S001, S002, S017 — đều là security),
nên yêu cầu "0 error" là khả thi.

---

## 3. Đặt tên và tổ chức file

- Tên file **kebab-case**: `articles.service.ts`, `jwt-auth.guard.ts`
- Theo quy ước hậu tố của NestJS: `.controller.ts`, `.service.ts`, `.module.ts`,
  `.dto.ts`, `.guard.ts`, `.interceptor.ts`, `.filter.ts`
- Mỗi file **dưới 200 dòng**. Vượt thì tách theo trách nhiệm, không tách cho đủ số
- Một module một thư mục, nội dung module không rò rỉ ra ngoài qua import chéo —
  ranh giới phụ thuộc quy định ở `system-architecture.md` §3

---

## 4. Commit

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     tính năng mới
fix:      sửa lỗi
docs:     tài liệu
refactor: đổi cấu trúc, không đổi hành vi
test:     thêm hoặc sửa test
chore:    build, dependency, cấu hình
```

Mỗi commit gói đúng một thay đổi logic. Không gộp nhiều việc không liên quan.

Không đưa secret vào repository: file `.env`, API key, thông tin kết nối database.

---

## 5. Branch và pull request

Nhánh `feat/<milestone>-<slug>`, mở pull request vào `main`.

Giữ mỗi pull request trong khoảng vài trăm dòng thay đổi. Pull request lớn khó review
và dễ lọt lỗi.

### Điều kiện merge

- Sunlint 0 error, đính kèm kết quả
- `npm run lint` và test xanh
- Đã tự review lại diff của chính mình
- Có ít nhất một approve

### Thứ tự review

1. Yêu cầu Copilot review, xử lý hết comment
2. Tự review lại toàn bộ diff
3. Gửi reviewer
