INSERT INTO users (name, email, password_hash, role) VALUES
  ('관리자', 'admin@example.com', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270', 'ADMIN'),
  ('홍길동', 'user@example.com', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', 'USER'),
  ('김철수', 'kim@example.com', '2eea0e612d40dc38bad03de71dcfba856db5cff90a9e66f2d41afd5ccba15d22', 'USER');

INSERT INTO carts (user_id)
SELECT id FROM users;

INSERT INTO products (name, description, price, stock, status) VALUES
  ('노트 세트', '강의 필기용 줄노트 3권 세트', 6000, 20, 'ON_SALE'),
  ('검정 볼펜', '부드럽게 써지는 기본 볼펜', 1200, 100, 'ON_SALE'),
  ('형광펜 세트', '5색 형광펜 패키지', 4500, 30, 'ON_SALE'),
  ('파일 바인더', '과제 정리에 좋은 A4 바인더', 3500, 15, 'ON_SALE'),
  ('스티커 메모', '반복 학습용 점착 메모지', 2500, 40, 'ON_SALE');
