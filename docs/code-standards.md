# Code Standards

Tài liệu quy định coding convention và review workflow dùng chung cho project.
Architecture và module responsibility nằm trong tài liệu system architecture; workaround
của thư viện đặt cạnh code liên quan.

## 1. Language và tooling

TypeScript theo Google TypeScript Style Guide. Dùng tiếng Anh cho code, comment, commit
message và OpenAPI description. Nội dung trong `docs/`, `plans/` và `README.md` dùng tiếng
Việt, giữ technical term bằng tiếng Anh. Nội dung bản dịch i18n dùng ngôn ngữ tương ứng.

Project dùng Oxlint cho lint, Oxfmt cho formatting và import sorting, Vitest và Supertest cho test.
Script cụ thể được định nghĩa trong `package.json`.

| Command | Mục đích |
|---|---|
| `npm run lint` | Chạy oxlint trên `src/`, gồm type-aware check; warning làm command thất bại |
| `npm run typecheck` | Kiểm tra TypeScript type |
| `npm run format:check` | Kiểm tra formatting của TypeScript trong `src/` |
| `npm run format` | Ghi lại formatting và tự động sắp xếp import bằng Oxfmt |
| `npm test` | Chạy test suite bằng Vitest |
| `npm run test:e2e` | Chạy end-to-end test trên database riêng; cần container đang chạy |
| `npm run build` | Kiểm tra application build |

## 2. Naming và module organization

### File

- File dùng **kebab-case**: `articles.service.ts`, `jwt-auth.guard.ts`.
- Dùng suffix theo trách nhiệm: `.controller.ts`, `.service.ts`, `.module.ts`, `.guard.ts`,
  `.interceptor.ts`, `.filter.ts`, `.pipe.ts`.
- Zod schema dùng suffix **`.schema.ts`**. Type của dữ liệu đã validate lấy bằng `z.infer`
  và khai cùng schema, tránh định nghĩa lại shape ở service.
- Unit test dùng suffix **`.spec.ts`**, đặt cạnh code được test. Mọi dependency ngoài
  process đều được thay bằng test double, nên `npm test` chạy được khi không có container nào.
- End-to-end test dùng suffix **`.e2e-spec.ts`**, cũng đặt cạnh code, boot application thật
  và gọi HTTP vào database riêng. Chạy bằng config riêng, `npm test` không quét tới.
- Helper dùng chung giữa nhiều suite dùng suffix **`.fixture.ts`** để `nest build` loại ra.
  Helper của một module đặt trong thư mục module đó; helper không thuộc module nào — boot
  application, dọn database, tạo tài khoản — đặt trong `src/testing/`, thư mục này bị loại
  khỏi build.
- Mỗi file dưới 200 dòng. Khi vượt giới hạn, tách theo trách nhiệm.
- Mỗi module có một thư mục. Cross-module dependency tuân theo module boundaries trong
  tài liệu system architecture.

Project dùng ESM. Mọi relative import phải có extension **`.js`**, kể cả khi source là
file `.ts`. Dùng `import.meta.dirname` khi cần đường dẫn thư mục của module.

Không sửa generated Prisma Client trong `src/generated/prisma`. Thay đổi schema rồi chạy
`npm run db:generate`.

### Identifier

| Thành phần | Convention | Ví dụ |
|---|---|---|
| Class | PascalCase; class giữ vai trò NestJS dùng suffix tương ứng | `UsersService`, `JwtAuthGuard` |
| Type, interface | PascalCase, không tiền tố `I` | `SafeUser`, `ErrorsBody` |
| Biến, parameter, property, hàm, method | camelCase | `currentUser`, `tokenFor` |
| Giá trị cố định có tên, injection token ở module-level | CONSTANT_CASE | `SALT_ROUNDS`, `REDIS_CLIENT` |
| Decorator | PascalCase | `CurrentUser`, `NoStore` |
| Property nhận qua DI | camelCase của class được inject | `usersService`, `prismaService` |

Tên boolean đọc như một điều kiện, chẳng hạn `isRevoked`, `isUniqueViolation`, `exists`;
không giới hạn vào một danh sách tiền tố cố định.

`const` chỉ ngăn gán lại binding, không quyết định cách đặt tên. CONSTANT_CASE dành cho giá trị
được chủ ý công bố như hằng số. Schema, function và object phục vụ implementation dùng camelCase,
kể cả khi khai ở module-level.

Service của chính module đặt tên theo generator của NestJS: `nest g resource` sinh ra
`usersService: UsersService`. Dự án mở rộng công thức đó cho mọi provider class được inject; khi
có nhiều instance cùng type, thêm vai trò để phân biệt. Dependency lấy qua injection token đặt
tên theo mục đích sử dụng, như `client: Redis` trong `RedisService`.

Method ném `HttpException` mang tên hẹp đúng bằng ngữ cảnh của exception. `currentUser` ném
401 là hợp lý vì tên đã khoá vào người đang đăng nhập; đặt tên rộng như `findOrFail` thì
caller sau sẽ nhận 401 ở chỗ đáng lẽ phải là 404.

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
- Toàn bộ check cấu hình trong [CI](../.github/workflows/ci.yml) phải pass, hiện gồm typecheck,
  build, test, Oxlint, Oxfmt và Sunlint.
- Đã self-review toàn bộ diff.
- Có ít nhất một approval.

### Review workflow

1. Yêu cầu Copilot review và xử lý các comment.
2. Self-review toàn bộ diff.
3. Gửi reviewer.

## 7. Phạm vi cập nhật tài liệu

Cập nhật khi project thay đổi coding convention, tooling command hoặc review workflow.
Feature mới tuân theo convention hiện có không cần bổ sung ghi chú vào tài liệu này.
