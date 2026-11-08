import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CARD_DEFS,
  CHAPTERS,
  COMMANDERS,
  PRESTIGE_NODES,
  RARITY_COLOR,
  RARITY_LABEL,
  RARITY_ORDER,
  SKILLS,
  TOWERS,
  cardValue,
  chapterDef,
  fmt,
  prestigeNodeCost,
  timeFmt,
} from '../game/config';
import { totalTowerLevels } from '../game/economy';
import { useUI } from '../game/store';
import type { CardInstance, Rarity, SaveState, TowerSave } from '../game/types';
import { resetAll } from '../game/engine';
import { getGame } from './access';
import { IconChevron, IconClose, IconCrystal, IconEssence, IconLock, IconMetal, IconTech } from './icons';

const RARITY_CLASS: Record<string, string> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};

const statText = (defId: string, rarity: Rarity) => {
  const def = CARD_DEFS[defId];
  if (!def) return '';
  const value = cardValue(def, rarity);
  if (def.stat === 'splash') return `+${value.toFixed(1)} bán kính nổ`;
  const label =
    def.stat === 'damage'
      ? 'sát thương'
      : def.stat === 'rate'
        ? 'tốc độ bắn'
        : def.stat === 'range'
          ? 'tầm bắn'
          : def.stat === 'stun'
            ? 'cơ hội choáng'
            : 'làm chậm';
  return `+${(value * 100).toFixed(1)}% ${label}`;
};

function ModalShell({
  kicker,
  title,
  children,
  footer,
  onClose,
  locked = false,
  wide = false,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  locked?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`modal-backdrop ${locked ? 'locked' : ''}`} onPointerDown={() => !locked && onClose?.()}>
      <div
        className={`modal-frame ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="modal-topline" />
        <header className="modal-header">
          <div>
            <span className="modal-kicker">{kicker}</span>
            <h1>{title}</h1>
          </div>
          {!locked && onClose && (
            <button className="panel-close" aria-label="Đóng" onClick={onClose}>
              <IconClose size={17} />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

const towerById = (save: SaveState, id: string | null): TowerSave | undefined =>
  id ? save.towers[id] : undefined;

const equippedIds = (save: SaveState) => {
  const set = new Set<string>();
  for (const t of Object.values(save.towers)) for (const id of t.cards) set.add(id);
  return set;
};

function CardsModal() {
  const save = useUI((s) => s.save);
  const targetId = useUI((s) => s.cardsTarget);
  const closeModal = useUI((s) => s.closeModal);
  const openCards = useUI((s) => s.openCards);
  const toast = useUI((s) => s.toast);
  const target = towerById(save, targetId);
  const game = getGame();
  const equipped = useMemo(() => equippedIds(save), [save]);
  const slots = target ? 1 + (target.tier > 0 ? 1 : 0) : 0;

  const groups = useMemo(() => {
    const map = new Map<string, CardInstance[]>();
    for (const card of save.cards) {
      const key = `${card.defId}::${card.rarity}`;
      const arr = map.get(key) ?? [];
      arr.push(card);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, cards]) => ({ key, cards, defId: cards[0].defId, rarity: cards[0].rarity }))
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.defId.localeCompare(b.defId));
  }, [save.cards]);

  const towers = Object.values(save.towers).filter((t) => t.cards.length < 1 + (t.tier > 0 ? 1 : 0));

  return (
    <ModalShell
      kicker="KHO THẺ NĂNG LỰC // PERSIST QUA PRESTIGE"
      title={target ? 'GẮN THẺ CHO TRỤ' : 'KHO THẺ NĂNG LỰC'}
      onClose={closeModal}
      footer={
        <div className="modal-footer-split">
          <span className="footer-note">Thẻ đã gắn sẽ trở về kho khi trụ bị thu hồi hoặc Prestige.</span>
          <button className="btn ghost small" onClick={closeModal}>ĐÓNG</button>
        </div>
      }
    >
      {target ? (
        <div className="target-banner">
          <div>
            <span className="micro">ĐANG GẮN</span>
            <strong>{TOWERS[target.type].name}</strong>
          </div>
          <div className="slot-dots">
            {Array.from({ length: slots }, (_, i) => {
              const card = save.cards.find((c) => c.id === target.cards[i]);
              return (
                <span key={i} className={`slot-dot ${card ? 'filled' : ''} ${card ? RARITY_CLASS[card.rarity] : ''}`}>
                  {card ? CARD_DEFS[card.defId]?.name ?? 'THẺ' : 'TRỐNG'}
                </span>
              );
            })}
          </div>
          <button className="btn ghost tiny" onClick={() => openCards(null)}>ĐỔI TRỤ</button>
        </div>
      ) : (
        <div className="picker-block">
          <div className="section-label">CHỌN TRỤ ĐỂ GẮN THẺ</div>
          {towers.length === 0 ? (
            <p className="empty-note">Chưa có trụ nào còn ô trống. Xây thêm trụ hoặc tiến hóa trụ đã có.</p>
          ) : (
            <div className="tower-picker">
              {towers.map((t) => (
                <button key={t.id} className="picker-chip" onClick={() => openCards(t.id)}>
                  <span className={`picker-accent system-${TOWERS[t.type].system}`} />
                  <strong>{TOWERS[t.type].name}</strong>
                  <span>{t.cards.length}/{1 + (t.tier > 0 ? 1 : 0)} THẺ</span>
                  <IconChevron size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {target && target.cards.length > 0 && (
        <div className="equipped-block">
          <div className="section-label">ĐANG GẮN</div>
          <div className="equipped-list">
            {target.cards.map((cardId) => {
              const card = save.cards.find((c) => c.id === cardId);
              if (!card) return null;
              return (
                <div key={card.id} className={`equipped-card ${RARITY_CLASS[card.rarity]}`} style={{ '--rarity': RARITY_COLOR[card.rarity] } as CSSProperties}>
                  <div>
                    <strong>{CARD_DEFS[card.defId]?.name}</strong>
                    <span>{statText(card.defId, card.rarity)}</span>
                  </div>
                  <button className="btn ghost tiny" onClick={() => game?.unequipCard(target.id, card.id)}>GỠ</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="collection-block">
        <div className="section-label">
          {target ? 'THẺ CÓ SẴN' : `TOÀN BỘ KHO · ${save.cards.length} THẺ`}
        </div>
        {groups.length === 0 && (
          <p className="empty-note">Kho trống. Chiếm ô rương hoặc hạ boss để nhận thẻ.</p>
        )}
        <div className="card-grid">
          {groups.map(({ key, cards, defId, rarity }) => {
            const def = CARD_DEFS[defId];
            const available = cards.filter((c) => !equipped.has(c.id));
            const equippedCount = cards.length - available.length;
            const canEquip = target && available.length > 0 && target.cards.length < slots;
            return (
              <article key={key} className={`card-item ${RARITY_CLASS[rarity]}`} style={{ '--rarity': RARITY_COLOR[rarity] } as CSSProperties}>
                <div className="card-head">
                  <span className="card-rarity">{RARITY_LABEL[rarity]}</span>
                  <span className="card-count">×{cards.length}</span>
                </div>
                <h3>{def?.name ?? defId}</h3>
                <p className="card-stat">{statText(defId, rarity)}</p>
                <p className="card-desc">{def?.desc}</p>
                <div className="card-foot">
                  <span className="card-owned">{equippedCount > 0 ? `ĐANG GẮN ${equippedCount}` : `SẴN SÀNG ${available.length}`}</span>
                  <div className="card-actions">
                    {target && (
                      <button
                        className="btn ghost tiny"
                        disabled={!canEquip}
                        onClick={() => available[0] && game?.equipCard(target.id, available[0].id)}
                      >
                        {target.cards.length >= slots ? 'HẾT Ô' : available.length ? 'GẮN' : 'ĐÃ GẮN'}
                      </button>
                    )}
                    {available.length >= 3 && (
                      <button className="btn ghost tiny merge" onClick={() => game?.mergeCards(defId, rarity)}>
                        HỢP NHẤT 3
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {!target && (
        <p className="hint-text">Mở khóa thêm ô thẻ bằng cách Tiến hóa trụ ở Vòng 5. Thẻ không mất khi Prestige.</p>
      )}
    </ModalShell>
  );
}

function CommanderModal() {
  const save = useUI((s) => s.save);
  const closeModal = useUI((s) => s.closeModal);
  const game = getGame();
  return (
    <ModalShell
      kicker="BIÊN CHẾ CHỈ HUY // 1 CHỈ HUY HOẠT ĐỘNG"
      title="CHỌN CHỈ HUY"
      onClose={closeModal}
      footer={
        <div className="modal-footer-split">
          <span className="footer-note">Đổi chỉ huy không tốn tài nguyên. Buff áp dụng toàn lãnh thổ.</span>
          <button className="btn ghost small" onClick={closeModal}>ĐÓNG</button>
        </div>
      }
    >
      <div className="commander-list">
        {(Object.keys(COMMANDERS) as (keyof typeof COMMANDERS)[]).map((id) => {
          const c = COMMANDERS[id];
          const unlocked = save.commanders.includes(id);
          const active = save.activeCommander === id;
          return (
            <article key={id} className={`commander-card ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}`} style={{ '--cmd': c.color } as CSSProperties}>
              <div className="commander-portrait">
                <span>{id === 'vanguard' ? 'V' : id === 'engineer' ? 'E' : 'W'}</span>
              </div>
              <div className="commander-body">
                <span className="commander-title">{c.title}</span>
                <h3>{c.name}</h3>
                <p>{c.aura}</p>
                <span className="commander-unlock">{unlocked ? (active ? 'ĐANG CHỈ HUY' : 'ĐÃ MỞ KHÓA') : c.unlock}</span>
              </div>
              <button
                className={`btn ${active ? 'active-btn' : 'primary'} small`}
                disabled={!unlocked || active}
                onClick={() => game?.setCommander(id)}
              >
                {!unlocked ? <><IconLock size={13} /> KHÓA</> : active ? 'HOẠT ĐỘNG' : 'BỔ NHIỆM'}
              </button>
            </article>
          );
        })}
      </div>
      <div className="section-label">KỸ NĂNG CHỦ ĐỘNG DÙNG CHUNG</div>
      <div className="skill-summary">
        {(Object.keys(SKILLS) as (keyof typeof SKILLS)[]).map((id) => (
          <div key={id} className="skill-summary-row">
            <span className="skill-summary-name">{SKILLS[id].name}</span>
            <span>{SKILLS[id].desc}</span>
            <span className="skill-summary-lock">{save.chapter >= SKILLS[id].unlock ? `CD ${SKILLS[id].cooldown}s` : `VÒNG ${SKILLS[id].unlock}`}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function PrestigeModal() {
  const save = useUI((s) => s.save);
  const closeModal = useUI((s) => s.closeModal);
  const [confirming, setConfirming] = useState(false);
  const game = getGame();
  const gain = Math.floor((save.chapter - 1) * 4 + save.raidIndex * 0.5 + save.claimed.length * 0.15 + totalTowerLevels(save) * 0.3 + save.prestige.count * 2);
  const can = save.chapter >= 3 && gain > 0;
  const essence = save.resources.essence;

  return (
    <ModalShell
      kicker="GIAO THỨC TÁI THIẾT // RESET LÃNH THỔ"
      title="TÁI THIẾT VÀNH ĐAI"
      onClose={closeModal}
      wide
      footer={
        <div className="modal-footer-split">
          <span className="footer-note">Thẻ bài được giữ lại. Trụ, cấp, tiến hóa và Vòng hiện tại bị reset.</span>
          <button className="btn ghost small" onClick={closeModal}>HỦY</button>
        </div>
      }
    >
      <div className="prestige-hero">
        <div>
          <span className="micro">TINH HOA DỰ KIẾN</span>
          <div className="prestige-gain">
            <IconEssence size={22} />
            <strong>+{can ? gain : 0}</strong>
          </div>
          <p>Hiện có {fmt(essence)} Tinh hoa Vành Đai · Prestige lần {save.prestige.count + 1}</p>
        </div>
        <div className="prestige-readout">
          <div><span>VÒNG</span><strong>{save.chapter}</strong></div>
          <div><span>LÃNH THỔ</span><strong>{save.claimed.length}</strong></div>
          <div><span>TỔNG CẤP TRỤ</span><strong>{totalTowerLevels(save)}</strong></div>
          <div><span>THẺ GIỮ LẠI</span><strong>{save.cards.length}</strong></div>
        </div>
      </div>

      {!can && (
        <div className="warning-box">
          <IconLock size={16} />
          Đạt Vòng Lãnh Thổ 3 và tích lũy tiến độ trước khi Tái thiết. Tinh hoa chỉ nhận được khi reset.
        </div>
      )}

      <div className="prestige-action">
        {!confirming ? (
          <button className="btn danger" disabled={!can} onClick={() => setConfirming(true)}>
            TÁI THIẾT · NHẬN {can ? gain : 0} TINH HOA
          </button>
        ) : (
          <div className="confirm-row">
            <span>Toàn bộ lãnh thổ, trụ và Vòng sẽ reset. Xác nhận?</span>
            <button className="btn danger" onClick={() => game?.doPrestige()}>XÁC NHẬN RESET</button>
            <button className="btn ghost small" onClick={() => setConfirming(false)}>QUAY LẠI</button>
          </div>
        )}
      </div>

      <div className="section-label">CÂY CÔNG NGHỆ VĨNH VIỄN <span className="essence-balance">TINH HOA {fmt(essence)}</span></div>
      <div className="prestige-tree">
        {(Object.keys(PRESTIGE_NODES) as (keyof typeof PRESTIGE_NODES)[]).map((id) => {
          const node = PRESTIGE_NODES[id];
          const level = save.prestige.upgrades[id];
          const cost = prestigeNodeCost(id, level);
          const maxed = level >= node.max;
          return (
            <article key={id} className={`prestige-node ${maxed ? 'maxed' : ''}`}>
              <div className="node-head">
                <div>
                  <span className="node-level">CẤP {level}/{node.max}</span>
                  <h3>{node.name}</h3>
                </div>
                <span className="node-cost">{maxed ? 'TỐI ĐA' : `${cost} TH`}</span>
              </div>
              <p>{node.desc}</p>
              <div className="node-bar"><span style={{ width: `${(level / node.max) * 100}%` }} /></div>
              <button
                className="btn ghost small"
                disabled={maxed || essence < cost}
                onClick={() => game?.buyPrestigeNode(id)}
              >
                {maxed ? 'ĐÃ TỐI ĐA' : 'NÂNG CẤP'}
              </button>
            </article>
          );
        })}
      </div>
    </ModalShell>
  );
}

function SettingsModal() {
  const save = useUI((s) => s.save);
  const closeModal = useUI((s) => s.closeModal);
  const toast = useUI((s) => s.toast);
  const [resetConfirm, setResetConfirm] = useState(false);
  const game = getGame();

  return (
    <ModalShell
      kicker="CẤU HÌNH HỆ THỐNG // TRẠM CHỈ HUY"
      title="CÀI ĐẶT"
      onClose={closeModal}
      footer={
        <div className="modal-footer-split">
          <span className="footer-note">Save cục bộ trên thiết bị · WebView storage</span>
          <button className="btn ghost small" onClick={() => game?.forceSave()}>LƯU NGAY</button>
        </div>
      }
    >
      <div className="settings-list">
        <label className="setting-row">
          <div><strong>Hiện tầm bắn</strong><span>Luôn vẽ vòng tầm bắn của mọi trụ.</span></div>
          <button
            className={`toggle ${save.settings.showRanges ? 'on' : ''}`}
            aria-pressed={save.settings.showRanges}
            onClick={() => game?.setSetting('showRanges', !save.settings.showRanges)}
          >
            <span />
          </button>
        </label>
        <div className="setting-row static">
          <div><strong>Chế độ hiển thị</strong><span>Portrait WebView · điều khiển một tay.</span></div>
          <span className="setting-value">360° HEX</span>
        </div>
        <div className="setting-row static">
          <div><strong>Lưu tự động</strong><span>Mỗi 10 giây và khi thoát ứng dụng.</span></div>
          <span className="setting-value">BẬT</span>
        </div>
      </div>

      <div className="section-label">NHẬT KÝ CHIẾN DỊCH</div>
      <div className="stat-grid settings-stats">
        <div><span>THỜI GIAN CHƠI</span><strong>{timeFmt(save.playTime)}</strong></div>
        <div><span>RAID ĐÃ DỌN</span><strong>{save.stats.raidsCleared}</strong></div>
        <div><span>HẠ GỤC</span><strong>{fmt(save.stats.kills)}</strong></div>
        <div><span>BOSS HẠ</span><strong>{save.stats.bosses}</strong></div>
        <div><span>VÒNG CAO NHẤT</span><strong>{save.stats.bestChapter}</strong></div>
        <div><span>PRESTIGE</span><strong>{save.prestige.count}</strong></div>
      </div>

      <div className="section-label">DỮ LIỆU</div>
      <div className="settings-actions">
        <button className="btn ghost small" onClick={() => game?.forceSave()}>LƯU TIẾN ĐỘ</button>
        <button
          className={`btn ghost small danger-ghost ${resetConfirm ? 'confirm' : ''}`}
          onClick={() => {
            if (resetConfirm) {
              resetAll();
            } else {
              setResetConfirm(true);
              toast('Chạm lần nữa để xóa toàn bộ save.', 'warn');
            }
          }}
        >
          {resetConfirm ? 'XÁC NHẬN XÓA SAVE' : 'XÓA TOÀN BỘ SAVE'}
        </button>
      </div>

      <details className="dev-tools">
        <summary>CÔNG CỤ PHÁT TRIỂN</summary>
        <div className="dev-grid">
          <button className="btn ghost tiny" onClick={() => game?.debugAdd()}>+ TÀI NGUYÊN</button>
          <button className="btn ghost tiny" onClick={() => game?.debugShield()}>BẬT KHIÊN 30S</button>
          <button className="btn ghost tiny" onClick={() => game?.debugKillAll()}>DIỆT TOÀN BỘ ĐỊCH</button>
          <button className="btn ghost tiny" onClick={() => game?.debugAdvance()}>TIẾN 1 VÒNG</button>
        </div>
        <p className="hint-text">Công cụ chỉ dùng cho prototype. Không có trong bản phát hành.</p>
      </details>
    </ModalShell>
  );
}

function OfflineModal() {
  const offline = useUI((s) => s.offline);
  const game = getGame();
  if (!offline) return null;
  const capped = offline.elapsedReal > offline.cappedSeconds + 1;
  return (
    <ModalShell
      kicker="BÁO CÁO VẮNG MẶT // LÃNH THỔ ĐÓNG BĂNG"
      title="TRONG LÚC BẠN VẮNG MẶT"
      locked
      footer={
        <button className="btn primary wide-btn" onClick={() => game?.claimOffline()}>
          NHẬN TIẾP TẾ · TIẾP TỤC CHIẾN DỊCH
        </button>
      }
    >
      <p className="offline-lead">
        Vành đai vẫn giữ vững. Không có ô lãnh thổ nào bị mất trong {timeFmt(offline.elapsedReal)} vắng mặt.
      </p>
      <div className="offline-resources">
        <div className="offline-res">
          <IconMetal size={20} />
          <span>KIM LOẠI</span>
          <strong>+{fmt(offline.metal)}</strong>
        </div>
        <div className="offline-res">
          <IconCrystal size={20} />
          <span>TINH THỂ</span>
          <strong>+{fmt(offline.crystal)}</strong>
        </div>
        <div className="offline-res">
          <IconTech size={20} />
          <span>RAID ĐÃ ĐẨY LÙI</span>
          <strong>{offline.raids}</strong>
        </div>
      </div>
      <div className="offline-time">
        <span>Thời gian tính thưởng: <strong>{timeFmt(offline.seconds)}</strong></span>
        <span>Trần offline: <strong>{timeFmt(offline.cappedSeconds)}</strong></span>
      </div>
      {capped && <div className="warning-box">Đã chạm trần tích lũy offline. Nâng cấp “Kho Dự Trữ Vành Đai” để tăng giờ.</div>}
    </ModalShell>
  );
}

function ChestModal() {
  const chest = useUI((s) => s.chest);
  const closeModal = useUI((s) => s.closeModal);
  if (!chest) return null;
  return (
    <ModalShell
      kicker="RƯƠNG TIẾP TẾ // ĐÃ THU HỒI"
      title="KHOANG HÀNG MỞ"
      onClose={closeModal}
      footer={<button className="btn primary wide-btn" onClick={closeModal}>ĐÓNG KHOANG HÀNG</button>}
    >
      <div className="chest-reward-grid">
        <div><IconMetal size={20} /><span>KIM LOẠI</span><strong>+{fmt(chest.metal)}</strong></div>
        <div><IconCrystal size={20} /><span>TINH THỂ</span><strong>+{fmt(chest.crystal)}</strong></div>
      </div>
      <div className="section-label">THẺ THU ĐƯỢC</div>
      <div className="chest-cards">
        {chest.cards.map((c, i) => (
          <div key={i} className="chest-card">
            <span>{c.rarity}</span>
            <strong>{c.name}</strong>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>
      <p className="hint-text">Thẻ được giữ trong kho và không mất khi Prestige. Vào THẺ BÀI để gắn vào trụ.</p>
    </ModalShell>
  );
}

function HelpModal() {
  const save = useUI((s) => s.save);
  const closeModal = useUI((s) => s.closeModal);
  return (
    <ModalShell
      kicker="SỔ TAY CHỈ HUY // BELT Z"
      title="HƯỚNG DẪN CHIẾN DỊCH"
      onClose={closeModal}
      footer={<button className="btn ghost small" onClick={closeModal}>ĐÓNG SỔ TAY</button>}
    >
      <div className="help-section">
        <div className="section-label">VÒNG LẶP</div>
        <ol className="help-list">
          <li><strong>Chạm ô trống</strong> quanh Trạm Chỉ Huy để đặt trụ tự bắn.</li>
          <li><strong>Dọn raid</strong> để nhận tài nguyên và điểm mở rộng.</li>
          <li><strong>Chạm ô viền vàng</strong> để mở rộng lãnh thổ — chiếm mỏ, rương và ô trụ.</li>
          <li><strong>Nâng cấp</strong> trụ, gắn thẻ, chọn chỉ huy, dùng kỹ năng khi raid đông.</li>
        </ol>
      </div>
      <div className="help-section">
        <div className="section-label">QUÁI LỌT</div>
        <p>Quái chạm tới Trạm Chỉ Huy sẽ bị loại khỏi raid. Bạn không mất ô lãnh thổ hay trụ — nhưng tỉ lệ hạ địch giảm, kéo theo thưởng raid và điểm mở rộng ít đi.</p>
      </div>
      <div className="help-section">
        <div className="section-label">OFFLINE</div>
        <p>Lãnh thổ đóng băng khi vắng mặt — không mất ô, không có đợt tăng cường trả đũa. Tài nguyên tích lũy tối đa 6 giờ (nới bằng Prestige).</p>
      </div>
      <div className="help-section">
        <div className="section-label">LỘ TRÌNH VÒNG</div>
        <div className="chapter-roadmap">
          {CHAPTERS.map((c) => (
            <div key={c.id} className={`roadmap-row ${save.chapter >= c.id ? 'reached' : ''}`}>
              <span className="roadmap-num">{String(c.id).padStart(2, '0')}</span>
              <div>
                <strong>{c.name}</strong>
                <span>{c.tag} · {c.unlock}</span>
              </div>
              {save.chapter >= c.id && <span className="roadmap-check">ĐÃ TỚI</span>}
            </div>
          ))}
        </div>
        <p className="hint-text">Hiện tại: Vòng {save.chapter} — {chapterDef(save.chapter).name}. Mỗi Vòng có 6 raid: 4 thường, 1 elite, 1 boss.</p>
      </div>
      <div className="help-section">
        <div className="section-label">ĐIỀU KHIỂN</div>
        <p>Chỉ cảm ứng. Chạm để chọn/xây/mở rương. <strong>Kéo bản đồ</strong> để di chuyển camera, <strong>chụm hai ngón</strong> để zoom in/out; cụm nút bên phải gồm <strong>+</strong> phóng to, <strong>−</strong> thu nhỏ và <strong>◎</strong> về Trạm Chỉ Huy. Chạm kỹ năng OANH KÍCH rồi chạm bản đồ để khóa mục tiêu. Mọi bảng đều tạm dừng chiến đấu.</p>
      </div>
    </ModalShell>
  );
}

export function Modals() {
  const modal = useUI((s) => s.modal);
  const closeModal = useUI((s) => s.closeModal);
  if (modal === 'none') return null;
  if (modal === 'cards') return <CardsModal />;
  if (modal === 'commander') return <CommanderModal />;
  if (modal === 'prestige') return <PrestigeModal />;
  if (modal === 'settings') return <SettingsModal />;
  if (modal === 'offline') return <OfflineModal />;
  if (modal === 'chest') return <ChestModal />;
  if (modal === 'help') return <HelpModal />;
  return (
    <ModalShell kicker="HỆ THỐNG" title="KHÔNG CÓ DỮ LIỆU" onClose={closeModal}>
      <p className="empty-note">Màn hình này chưa được cấu hình.</p>
    </ModalShell>
  );
}
