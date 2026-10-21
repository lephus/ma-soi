# Ma Sói – Quản trò tự động

Web app quản trò Ma Sói: một điện thoại đặt giữa bàn đọc lời dẫn bằng tiếng Việt, gọi từng vai ban đêm,
đếm giờ thảo luận và bỏ phiếu, để cả nhóm đều được chơi mà không cần người làm quản trò.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # test luật chơi
npm run build      # bản build trong dist/
```

Muốn mở trên điện thoại cùng mạng wifi thì chạy `npm run dev -- --host` rồi mở địa chỉ IP mà Vite in ra.
Hai tính năng cần HTTPS: giữ màn hình luôn sáng và cài app ra màn hình chính.
Muốn có HTTPS thì đưa thư mục `dist/` lên một dịch vụ hosting có HTTPS (Vercel, Netlify, GitHub Pages...).

## Cách chơi

1. Nhập tên người chơi và chọn bộ bài (có sẵn nút gợi ý theo số người).
2. Chuyền máy cho từng người. Mỗi người bấm vào tên mình, bấm giữ để xem vai, rồi chuyền tiếp.
3. Đặt máy giữa bàn. Máy đọc lời dẫn. Ban đêm vai nào được gọi thì người đó cầm máy chọn rồi đặt máy xuống.
4. Ban ngày máy đếm giờ thảo luận và bỏ phiếu. Sau đó một người chọn trên máy ai bị treo cổ.

Vai đã chết vẫn được gọi, máy chờ một khoảng ngẫu nhiên rồi mới gọi vai tiếp theo, để không ai đoán ra ai đã chết.

Các mốc thời gian, giọng đọc, tốc độ đọc và việc có công bố vai người chết hay không đều chỉnh trong ⚙️ Cài đặt.

## Vai hiện có

Dân làng, Ma Sói, Tiên tri, Bảo vệ, Phù thủy, Thợ săn.

## Giọng đọc

App dùng giọng đọc có sẵn trên máy (Web Speech API), không cần mạng.

- iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt.
- Android: cài "Dịch vụ lời nói của Google" và tải giọng Tiếng Việt.

## Cấu trúc

- `src/game/`: luật chơi (`engine.ts`), vai (`roles.ts`), lời dẫn (`script.ts`), cài đặt, lưu ván và hoàn tác (`store.ts`).
- `src/tts/narrator.ts`: đọc lời dẫn, tạm dừng, chờ theo thời gian.
- `src/ui/`: các màn hình.
