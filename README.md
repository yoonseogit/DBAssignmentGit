데이터베이스 과제 안내

이번 데이터베이스 과제는 PostgreSQL을 활용한 웹 서비스 개발 프로젝트로 진행됩니다. 개발 과정에서는 Claude Code, Codex 등 AI 에이전트 도구를 자유롭게 활용하기 바랍니다.

학습 목표

본 과제는 다음 두 가지를 직접 구현하며 이해하는 데 목적이 있습니다.

웹 서비스가 DBMS와 어떻게 연동되어 동작하는지
백엔드에서 릴레이션(Relation), 쿼리(Query), 트랜잭션(Transaction)을 어떻게 정의하고 활용하는지
프론트엔드·백엔드 개발 경험이 부족하더라도 AI 도구의 도움을 받아 개발을 진행하고, 데이터베이스 연동의 핵심 부분을 이해할 수 있다면 충분합니다.

제출 기한: 6월 10일 (기말 시험일)

제출 항목:

본인의 GitHub 레포지토리
결과물을 설명하는 PPT
서비스 주소 (선택 사항)

## 프로젝트 주제

PostgreSQL을 활용한 간단한 문구 구매 사이트입니다. 사용자는 상품을 장바구니에 담고 주문할 수 있으며, 주문이 생성되면 상품 재고가 감소합니다. 관리자는 상품을 등록할 수 있습니다.

## 기술 스택

- Backend: Node.js, Express
- Database: PostgreSQL
- Frontend: HTML, CSS, JavaScript

## 주요 기능

- 회원가입
- 로그인 / 로그아웃
- 상품 목록 조회
- 장바구니 담기 / 삭제
- 주문 생성
- 주문 내역 조회
- 관리자 상품 등록
- 주문 생성 시 재고 확인 및 감소 트랜잭션 처리
- 회원가입 시 사용자와 장바구니 생성 트랜잭션 처리

## 테스트 계정

```text
사용자: user@example.com / user1234
사용자: kim@example.com / kim1234
관리자: admin@example.com / admin1234
```

## 릴레이션 구성

```text
users
- id PK
- name
- email
- password_hash
- role
- created_at

products
- id PK
- name
- description
- price
- stock
- status
- created_at
- updated_at

carts
- id PK
- user_id FK -> users.id
- created_at

cart_items
- id PK
- cart_id FK -> carts.id
- product_id FK -> products.id
- quantity
- created_at

orders
- id PK
- user_id FK -> users.id
- total_price
- status
- created_at
- updated_at

order_items
- id PK
- order_id FK -> orders.id
- product_id FK -> products.id
- quantity
- price
```

## 트랜잭션 처리

주문하기 기능은 다음 작업을 하나의 트랜잭션으로 처리합니다.

```text
1. 장바구니 상품 조회
2. 상품 재고 확인
3. orders 생성
4. order_items 생성
5. products.stock 감소
6. cart_items 삭제
```

중간에 재고 부족 등의 오류가 발생하면 전체 작업을 rollback합니다.

회원가입 기능도 다음 작업을 하나의 트랜잭션으로 처리합니다.

```text
1. users 생성
2. carts 생성
```

사용자는 가입 직후 바로 자신의 장바구니를 사용할 수 있습니다.

## 실행 방법

현재 프로젝트는 Windows 환경에서 portable Node.js와 Docker PostgreSQL로 실행할 수 있습니다.

```powershell
copy .env.example .env
docker start db-assignment-postgres
docker cp sql/schema.sql db-assignment-postgres:/tmp/schema.sql
docker cp sql/seed.sql db-assignment-postgres:/tmp/seed.sql
docker exec db-assignment-postgres psql -U postgres -d db_assignment_shop -f /tmp/schema.sql -f /tmp/seed.sql
tools\node\npm.cmd start
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

Node.js가 전역 설치된 환경이라면 다음 명령도 사용할 수 있습니다.

```bash
npm install
npm start
```
