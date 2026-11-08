# BELT Z — Idle TD

Prototype game mobile-web **360° hex territory tower defense** dựng bằng Vite + TypeScript + PixiJS, HUD React và Zustand. Game chạy theo portrait, điều khiển một tay, ưu tiên WebView di động; không thiết kế cho desktop/tablet.

## Chạy dự án

Yêu cầu: Node.js 20+ (đã kiểm tra với Node 24), npm.

```bash
cd belt-z
npm install
npm run dev
```

Mở `http://localhost:5173/`. Nếu chạy trên điện thoại trong cùng mạng LAN, mở địa chỉ IP của máy tính ở cổng `5173` (Vite đã bật `--host 0.0.0.0`).

Build production:

```bash
npm run build
npm run preview
```

Thư mục `vendor/pixelfx` đã được vendored gọn trong dự án (chỉ giữ core và các hiệu ứng đang dùng), nên có thể di chuyển hoặc copy riêng thư mục `belt-z` mà vẫn cài và build được.

## Điều khiển

- **Chạm ô trống quanh Trạm Chỉ Huy** để mở bảng xây trụ; chạm thẻ trụ rồi chạm **TRIỂN KHAI**.
- **Chạm trụ đã đặt** để nâng cấp, tiến hóa, gắn thẻ hoặc thu hồi.
- **Chạm ô viền vàng** khi có điểm mở rộng để chiếm lãnh thổ. Mỏ khoáng cho thu nhập thụ động; rương cho tài nguyên và thẻ bài.
- **Kéo ngang thanh trụ** trong bảng xây để xem toàn bộ 8 loại trụ.
- **Kéo bản đồ** để pan camera khi lãnh thổ mở rộng; **chụm hai ngón** để zoom in/out. Cụm nút bên phải: **+** phóng to, **−** thu nhỏ, **◎** về Trạm Chỉ Huy. Camera giữ mức zoom chiến thuật mặc định, không tự thu nhỏ khi lãnh thổ rộng ra.
- **Chạm kỹ năng** trên thanh tác chiến; với Oanh Kích Quỹ Đạo, chạm tiếp lên bản đồ để khóa mục tiêu.
- **Nút dock dưới cùng**: Xây trụ, Thẻ bài, Chỉ huy, Tái thiết Vành Đai. Hai nút trên cùng mở Trợ giúp và Cài đặt.

## Vòng lặp gameplay

1. Xây trụ tự động bắn quanh Trạm Chỉ Huy.
2. Dọn 6 raid mỗi Vòng: 4 raid thường, 1 raid elite, 1 raid boss. Giữa các raid có 15 giây chuẩn bị (22 giây trước boss) để xây dựng và nâng cấp.
3. Nhận mảnh kim loại, tinh thể, thẻ bài và điểm mở rộng.
4. Chiếm ô mới, mở khóa thêm trụ, nâng cấp và tiến hóa đội hình.
5. Hạ boss để mở Vòng Lãnh Thổ kế tiếp, thêm loại trụ/kỹ năng mới.
6. Khi tiến độ chững, dùng **Tái thiết Vành Đai** để đổi tiến độ lấy Tinh hoa và mua nâng cấp vĩnh viễn.

## Các hệ thống đã có

- **Lãnh thổ 360°**: lưới hex pointy-top, mở rộng bằng điểm mở rộng; quái lọt không làm mất ô hay trụ.
- **8 trụ, 4 hệ**: Kinetic (Railgun, Pháo Mảnh), Energy (Laser, Plasma), Tech (Radar EMP, Hack Field), Support (Trạm Tiếp Năng, Tháp Khuếch Đại). Trụ tự động bắn; Support buff tốc bắn/sát thương cho trụ trong tầm. Tầm bắn cơ bản 76–100, tăng theo cấp; trụ tầm ngắn đổi lấy sát thương/tiện ích cao hơn.
- **Cộng hưởng đa hệ**: có đủ 4 hệ trụ đang hoạt động nhận +5% sát thương và tốc bắn toàn cục.
- **Nâng cấp & Evolve**: level 1–10; từ Vòng 5, trụ Cấp 5 có thể Evolve bằng 1 Công nghệ Alien + tinh thể, đổi ngoại hình, tăng chỉ số và mở ô thẻ thứ hai.
- **Thẻ bài**: 6 loại thẻ, 4 độ hiếm, gắn theo trụ, hợp nhất 3 thẻ cùng loại. Thẻ được giữ qua Prestige và trở về kho khi trụ bị thu hồi.
- **3 phe địch**: Thiên thạch (giáp, tách mảnh), Alien (khiên, tàng hình, đi lượn), Quái vật (máu trâu, hồi máu, sinh sản). Có elite và 3 boss với cơ chế nhiều pha.
- **3 kỹ năng chủ động**: Oanh Kích Quỹ Đạo (Vòng 1), EMP Toàn Vành Đai (Vòng 3), Khiên Khẩn Cấp (Vòng 5 — chặn mọi quái lọt trong 8 giây), đều có hồi chiêu.
- **3 Chỉ Huy**: Vanguard mặc định (+8% tốc bắn), Kỹ Sư Trưởng (mở ở Vòng 4, +20% khai thác), Warden (mở sau Prestige đầu, +10% tầm bắn và +5% sát thương toàn bộ trụ).
- **Quái lọt**: chạm Trạm Chỉ Huy sẽ bị loại khỏi raid; không mất lãnh thổ, chỉ giảm tỉ lệ hạ địch và thưởng raid.
- **Offline**: báo cáo sau 120 giây vắng mặt, trần 6 giờ mặc định, lãnh thổ đóng băng tuyệt đối, không có đợt trả đũa khi quay lại.
- **Prestige**: reset lãnh thổ/trụ/level/Vòng về trạng thái đầu, giữ thẻ bài, đổi tiến độ lấy Tinh hoa; cây nâng cấp gồm sát thương, offline, khai thác, hồi chiêu và trục lợi.
- **HUD quân sự**: bảng màu navy, chữ mono cho số liệu, accent Kinetic cam / Energy cyan / Tech tím / Support vàng; toast, boss bar, cảnh báo quái lọt, tutorial 3 bước.
- **Hiệu ứng pixel**: PixelFX cho hit spark, poof, zap, plasma, EMP, lightning, heal, chest, collect, level-up; sprite pixel vẽ procedural, không cần file ảnh.

## Cấu trúc chính

`src/game/` chứa mô phỏng và dữ liệu game:

- `engine.ts` — vòng lặp Pixi, chiến đấu, raid, mở rộng, skill, prestige, offline.
- `config.ts` — toàn bộ số liệu trụ/địch/chương/thẻ/skill/chỉ huy.
- `hex.ts` — lưới hex và ô có thể chiếm.
- `economy.ts`, `save.ts`, `store.ts`, `sprites.ts`, `vfx.ts`.

`src/ui/` chứa HUD React và modal. `src/styles.css` chứa toàn bộ layout mobile và theme quân sự.

## Lưu game & debug

- Save tự động mỗi 10 giây và khi ẩn tab, lưu trong `localStorage` với khóa `belt-z.idle-td.save.v1`. Hiện chưa có cloud sync/backend.
- **Cài đặt → CÔNG CỤ PHÁT TRIỂN** có các nút cộng tài nguyên, bật khiên 30 giây, diệt địch và tiến 1 Vòng để kiểm thử nhanh. Đây là công cụ prototype, không dành cho bản phát hành.
- **Cài đặt → XÓA TOÀN BỘ SAVE** để chơi lại từ đầu (cần xác nhận hai lần).

## Giới hạn của prototype

- Chưa có backend, tài khoản, cloud sync, IAP, quảng cáo, push notification hay cầu nối native WebView.
- Chưa có âm thanh; trường `sound` trong save được giữ chỗ cho bản sau.
- Cân bằng kinh tế/độ khó mới ở mức prototype: 3 raid đầu được thiết kế dễ để onboarding, các Vòng sau tăng dần nhưng chưa qua playtest dài.
- Chưa có animation sprite sheet cho nhân vật; trụ/địch dùng sprite procedural và hiệu ứng PixelFX.
- Chỉ hỗ trợ portrait; layout đã kiểm tra ở 390×844, 375×667 và 360×800.
- Chưa có leaderboard, sự kiện theo mùa, boss luân phiên hoặc nội dung Vòng 6+ ngoài lưới hiện tại.

## Kiểm tra build

```bash
npx tsc --noEmit
npm run build
```
