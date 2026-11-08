import { useEffect, useRef, useState } from 'react';
import { startGame } from './game/engine';
import { Hud } from './ui/Hud';
import { Modals } from './ui/Modals';

let booted = false;

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booted) return;
    booted = true;
    const host = hostRef.current;
    if (!host) return;
    startGame(host)
      .then(() => setReady(true))
      .catch((err: unknown) => {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <div className="app-root">
      <div className="game-host" ref={hostRef} />
      {ready && <Hud />}
      {ready && <Modals />}
      {!ready && !error && (
        <div className="boot-screen">
          <div className="boot-frame">
            <span className="boot-kicker">BELT Z // IDLE TOWER DEFENSE</span>
            <h1>KẾT NỐI VÀNH ĐAI</h1>
            <div className="boot-rail"><span /></div>
            <p>Đang khôi phục lưới lãnh thổ, trụ phòng thủ và nhật ký raid...</p>
            <div className="boot-coords">SECTOR 07 · EARTH ORBIT · 360°</div>
          </div>
        </div>
      )}
      {error && (
        <div className="boot-screen error-screen">
          <div className="boot-frame">
            <span className="boot-kicker error-kicker">LỖI KHỞI TẠO</span>
            <h1>KHÔNG THỂ KẾT NỐI</h1>
            <p>{error}</p>
            <p>Thử tải lại trang. Nếu vẫn lỗi, kiểm tra WebGL trong WebView.</p>
            <button className="btn primary" onClick={() => window.location.reload()}>TẢI LẠI</button>
          </div>
        </div>
      )}
    </div>
  );
}
