# Medium Clone API

Backend API cho một nền tảng xuất bản bài viết, triển khai theo
[RealWorld specification](https://realworld-docs.netlify.app/specifications/backend/endpoints/).
Chỉ làm API, không có giao diện.

## Yêu cầu

- Node.js 24 (dùng `nvm use` — phiên bản ghi trong `.nvmrc`)
- Docker và Docker Compose

## Chạy lần đầu

```bash
nvm use
npm install
cp .env.example .env
docker compose up -d          # PostgreSQL 17 + Redis 7
npm run db:generate           # sinh Prisma Client
npm run start:dev
```

Kiểm tra:

```bash
curl localhost:3000/api/hello                              # {"message":"Hello, world!"}
curl -H 'Accept-Language: vi' localhost:3000/api/hello      # {"message":"Xin chào!"}
```

API docs (Scalar): <http://localhost:3000/api/docs>

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run start:dev` | Chạy chế độ watch |
| `npm run start:prod` | Chạy bản đã build trong `dist/` |
| `npm run build` | Biên dịch sang `dist/` |
| `npm test` | Unit test (Vitest) |
| `npm run test:cov` | Unit test kèm coverage |
| `npm run typecheck` | `tsc --noEmit`, không sinh file |
| `npm run lint` | oxlint |
| `npm run format` | Prettier, ghi đè file |
| `npm run format:check` | Prettier, chỉ kiểm tra — đây là bản CI chạy |
| `npm run lint:sun` | Sunlint — bắt buộc 0 error trước khi mở pull request |
| `npm run lint:sun:pr` | Sunlint chỉ trên file đã đổi |
| `npm run lint:sun:report` | Xuất `sunlint-report.json` làm bằng chứng đính kèm PR |
| `npm run db:generate` | Sinh lại Prisma Client |
| `npm run db:migrate:add -- <tên>` | Tạo migration, chưa áp dụng |
| `npm run db:migrate:apply` | Áp dụng migration đang chờ |
| `npm run db:migrate:reset` | Xoá và dựng lại database |

## Cấu trúc

```
src/
├── config/     kiểm tra biến môi trường lúc khởi động
├── prisma/     PrismaService (Prisma 7 + driver adapter)
├── redis/      RedisService
├── i18n/       en/, vi/
└── hello/      GET /api/hello
prisma/         schema và migration
docs/           thiết kế hệ thống và quy tắc code
```

## Tài liệu

- [`docs/system-architecture.md`](docs/system-architecture.md) — stack, quy ước API, cấu trúc module, data model, quyết định thiết kế
- [`docs/code-standards.md`](docs/code-standards.md) — lint, đặt tên, commit, quy trình pull request
- [Issues](../../issues) — 10 milestone, mỗi cái một pull request
- [Project board](https://github.com/users/ducnt-0269/projects/4) — trạng thái từng milestone
