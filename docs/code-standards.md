# Code Standards

Tài liệu quy định coding convention và review workflow dùng chung cho project.
Architecture và module responsibility nằm trong tài liệu system architecture; workaround
của thư viện đặt cạnh code liên quan.

## 1. Language và tooling

TypeScript theo Google TypeScript Style Guide. Dùng tiếng Anh cho code, comment, commit
message và OpenAPI description. Nội dung trong `docs/`, `plans/` và `README.md` dùng tiếng
Việt, giữ technical term bằng tiếng Anh. Nội dung bản dịch i18n dùng ngôn ngữ tương ứng.

Project dùng oxlint cho lint, Prettier cho formatting, Vitest và Supertest cho test.
Script cụ thể được định nghĩa trong `package.json`.

| Command | Mục đích |
|---|---|
| `npm run lint` | Chạy oxlint trên `src/`, gồm type-aware check; warning làm command thất bại |
| `npm run typecheck` | Kiểm tra TypeScript type |
| `npm run format:check` | Kiểm tra formatting của TypeScript trong `src/` |
| `npm run format` | Ghi lại formatting bằng Prettier |
| `npm test` | Chạy test suite bằng Vitest |
| `npm run build` | Kiểm tra application build |

## 2. File naming và module organization

- File dùng **kebab-case**: `articles.service.ts`, `jwt-auth.guard.ts`.
- Dùng suffix theo trách nhiệm: `.controller.ts`, `.service.ts`, `.module.ts`, `.guard.ts`,
  `.interceptor.ts`, `.filter.ts`, `.pipe.ts`.
- Zod schema dùng suffix **`.schema.ts`**. Type của dữ liệu đã validate lấy bằng `z.infer`
  và khai cùng schema, tránh định nghĩa lại shape ở service.
- Test dùng suffix **`.spec.ts`**, đặt cạnh code được test.
- Mỗi file dưới 200 dòng. Khi vượt giới hạn, tách theo trách nhiệm.
- Mỗi module có một thư mục. Cross-module dependency tuân theo module boundaries trong
  tài liệu system architecture.

Project dùng ESM. Mọi relative import phải có extension **`.js`**, kể cả khi source là
file `.ts`. Dùng `import.meta.dirname` khi cần đường dẫn thư mục của module.

Không sửa generated Prisma Client trong `src/generated/prisma`. Thay đổi schema rồi chạy
`npm run db:generate`.

## 3. Database conventions

### Naming

| Thành phần | Convention | Ví dụ |
|---|---|---|
| Prisma model | Singular PascalCase | `User` |
| Prisma field | camelCase | `createdAt` |
| PostgreSQL table | Plural snake_case | `users` |
| PostgreSQL column | snake_case | `created_at`, `email` |

Dùng `@@map` cho table và `@map` cho column khi tên trong Prisma khác tên trong database.
Chỉ table dùng plural; column không cần chuyển thành plural.

Giữ naming convention mặc định của Prisma cho index và constraint theo tên đã map.
Ví dụ, unique index của `users.email` là `users_email_key`; unique index nhiều column có
dạng `<table>_<column1>_<column2>_key`.

### Timestamp

Mỗi model có `createdAt` và `updatedAt`, map sang `created_at` và `updated_at`.
Dùng PostgreSQL **`TIMESTAMPTZ(3)`** qua `@db.Timestamptz(3)` để lưu thời điểm tuyệt đối
với millisecond precision.

- `createdAt` dùng `@default(now())`.
- `updatedAt` dùng `@updatedAt`, được Prisma Client quản lý.
- Raw SQL phải tự cung cấp `updated_at` khi insert và cập nhật giá trị này khi update;
  `@updatedAt` không tạo database trigger.

Schema cụ thể nằm trong `prisma/schema.prisma`. Migration workflow và command nằm trong
`CLAUDE.md`.

## 4. Sunlint

Sunlint bắt buộc trước mỗi pull request và bổ sung cho oxlint. Không merge khi còn Sunlint
error; warning cần được review để xác định có phù hợp với code và architecture hay không.

Configuration nằm trong `.sunlint.json`, dùng preset `recommended`. Rule và exclusion lấy
từ configuration, không duy trì một danh sách riêng trong tài liệu này.

| Command | Mục đích |
|---|---|
| `npm run lint:sun` | Chạy Sunlint trên source theo configuration |
| `npm run lint:sun:report` | Xuất JSON report để đính kèm pull request |
| `npm run lint:sun:pr` | Chạy trên changed files |

Pin exact version của `@sun-asterisk/sunlint` trong devDependencies để kết quả giữa các lần
review nhất quán. Các dependency khác dùng version range theo convention của project.

## 5. Commit

Dùng Conventional Commits:

| Type | Khi dùng |
|---|---|
| `feat` | Thêm feature |
| `fix` | Sửa bug |
| `docs` | Thay đổi documentation |
| `refactor` | Thay đổi cấu trúc, giữ nguyên behavior |
| `test` | Thêm hoặc sửa test |
| `chore` | Thay đổi build, dependency hoặc configuration |

Mỗi commit có một thay đổi logic rõ ràng. Không gộp thay đổi không liên quan.
Không commit secret như `.env`, API key hoặc database credential.

## 6. Branch và pull request

Branch dùng dạng `feat/<milestone>-<slug>`, mở pull request vào `main`.
Scope theo milestone issue; giữ diff tập trung, ưu tiên mỗi pull request khoảng vài trăm dòng.

### Merge requirements

- Sunlint không có error, đính kèm kết quả.
- Lint và test pass.
- Đã self-review toàn bộ diff.
- Có ít nhất một approval.

### Review workflow

1. Yêu cầu Copilot review và xử lý các comment.
2. Self-review toàn bộ diff.
3. Gửi reviewer.

## 7. Phạm vi cập nhật tài liệu

Cập nhật khi project thay đổi coding convention, tooling command hoặc review workflow.
Feature mới tuân theo convention hiện có không cần bổ sung ghi chú vào tài liệu này.
