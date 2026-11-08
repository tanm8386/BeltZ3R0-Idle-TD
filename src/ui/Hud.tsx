import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CARD_DEFS,
  COMMANDERS,
  SKILLS,
  SYSTEM_HEX,
  SYSTEM_LABEL,
  TOWERS,
  TOWER_LIST,
  computeTower,
  fmt,
  fmtRate,
  miningMult,
  raidKindFor,
  towerEvolveCost,
  towerUpgradeCost,
} from '../game/config';
import { towerCtx } from '../game/economy';
import { WORLD_CELLS, mineYield } from '../game/hex';
import { useUI } from '../game/store';
import type { SaveState, SkillId, TowerSave } from '../game/types';
import { getGame } from './access';
import {
  IconBuild,
  IconCards,
  IconChevron,
  IconClose,
  IconCommander,
  IconCrystal,
  IconEmp,
  IconEssence,
  IconHelp,
  IconLock,
  IconMetal,
  IconOrbital,
  IconPrestige,
  IconRecenter,
  IconSettings,
  IconShield,
  IconTech,
  IconZoomIn,
  IconZoomOut,
} from './icons';

const RARITY_CLASS: Record<string, string> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};

const cardById = (save: SaveState, id: string) => save.cards.find((c) => c.id === id);

const towerAt = (save: SaveState, cell: string): TowerSave | undefined =>
  Object.values(save.towers).find((t) => t.cell === cell);

const displayStats = (save: SaveState, tower: TowerSave) => {
  const ctx = towerCtx(save);
  const cell = WORLD_CELLS.get(tower.cell);
  let amp = 0;
  if (cell) {
    for (const other of Object.values(save.towers)) {
      if (TOWERS[other.type].projectile !== 'amp') continue;
      const oc = WORLD_CELLS.get(other.cell);
      if (!oc) continue;
      const st = computeTower(other, ctx);
      const dx = cell.x - oc.x;
      const dy = cell.y - oc.y;
      if (dx * dx + dy * dy <= st.range * st.range) amp += st.buff;
    }
  }
  return computeTower(tower, { ...ctx, ampBuff: amp });
};

const phaseLabel = (hud: ReturnType<typeof useUI.getState>['hud'], save: SaveState): string => {
  if (hud.raidPhase === 'prep') {
    if (hud.chapter === 1 && hud.towerCount === 0 && !save.tutorial.done) return 'CHỜ XÂY TRỤ';
    return `TRIỂN KHAI ${Math.ceil(hud.phaseTimer)}s`;
  }
  if (hud.raidPhase === 'spawning') return `ĐANG ĐỔ BỘ · CÒN ${hud.spawnLeft}`;
  if (hud.raidPhase === 'clearing') return `DỌN DƯ · CÒN ${hud.enemiesAlive}`;
  if (hud.raidPhase === 'boss') return `GIAO CHIẾN BOSS`;
  return 'HOÀN TẤT';
};

function Resource({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="resource" style={{ '--res': color } as CSSProperties}>
      <span className="resource-icon">{icon}</span>
      <span className="resource-copy">
        <span className="resource-label">{label}</span>
        <span className="resource-value">{value}</span>
        {sub && <span className="resource-sub">{sub}</span>}
      </span>
    </div>
  );
}

function TopConsole() {
  const hud = useUI((s) => s.hud);
  const save = useUI((s) => s.save);
  const openModal = useUI((s) => s.openModal);
  const marks = useMemo(() => Array.from({ length: 6 }, (_, i) => raidKindFor(i)), []);
  const chapterNum = String(hud.chapter).padStart(2, '0');
  const raidNum = String(hud.raidIndex + 1).padStart(2, '0');

  return (
    <header className="top-console">
      <div className="brand-row">
        <div className="brand">
          <div className="brand-mark">
            <span>BZ</span>
          </div>
          <div className="brand-copy">
            <h1>BELT Z</h1>
            <p>IDLE TOWER DEFENSE // VÀNH ĐAI CUỐI</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-btn" aria-label="Trợ giúp" onClick={() => openModal('help')}>
            <IconHelp size={17} />
          </button>
          <button className="icon-btn" aria-label="Cài đặt" onClick={() => openModal('settings')}>
            <IconSettings size={18} />
          </button>
        </div>
      </div>

      <div className="resource-grid">
        <Resource icon={<IconMetal size={15} />} label="KIM LOẠI" value={fmt(hud.resources.metal)} sub={fmtRate(hud.income.metal)} color="#d7c3a2" />
        <Resource icon={<IconCrystal size={15} />} label="TINH THỂ" value={fmt(hud.resources.crystal)} sub={fmtRate(hud.income.crystal)} color="#5be6ef" />
        <Resource icon={<IconTech size={15} />} label="CÔNG NGHỆ" value={fmt(hud.resources.tech)} color="#b691ff" />
        <Resource icon={<IconEssence size={15} />} label="TINH HOA" value={fmt(hud.resources.essence)} color="#ffcf6b" />
      </div>

      <div className="chapter-line">
        <div className="chapter-id">
          <span className="micro">VÒNG LÃNH THỔ</span>
          <strong>
            {chapterNum}
            <span className="slash">/</span>
            <span className="chapter-name">{hud.chapterName}</span>
          </strong>
        </div>
        <div className="raid-meta">
          <span className="micro">RAID {raidNum}/06</span>
          <span className={`phase-chip phase-${hud.raidPhase}`}>{phaseLabel(hud, save)}</span>
        </div>
      </div>

      <div className="raid-track" aria-label={`Raid ${hud.raidIndex + 1} trên 6`}>
        {marks.map((kind, i) => {
          const state = i < hud.raidIndex ? 'done' : i === hud.raidIndex ? 'current' : 'future';
          return (
            <div key={i} className={`raid-mark ${kind} ${state}`}>
              <span className="raid-mark-label">{String(i + 1).padStart(2, '0')}</span>
              <span className="raid-mark-bar" />
              <span className="raid-mark-kind">{kind === 'boss' ? 'B' : kind === 'elite' ? 'E' : 'N'}</span>
            </div>
          );
        })}
        <div className={`resonance-chip ${hud.resonance ? 'on' : ''}`} title="Trang bị đủ 4 hệ trụ để cộng hưởng">
          <span className="res-dot" />
          {hud.resonance ? 'CỘNG HƯỞNG +5%' : 'CHƯA CỘNG HƯỞNG'}
        </div>
      </div>

      <span className="sr-only">
        {save.cards.length} thẻ, {hud.towerCount} trụ
      </span>
    </header>
  );
}

function BossBar() {
  const boss = useUI((s) => s.hud.boss);
  if (!boss) return null;
  const frac = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.max)));
  return (
    <div className="boss-bar">
      <div className="boss-title">
        <span className="boss-kicker">MỤC TIÊU ƯU TIÊN</span>
        <strong>{boss.name}</strong>
        <span className="boss-phase">PHA {boss.phase}</span>
      </div>
      <div className="boss-rail">
        <span style={{ width: `${frac * 100}%` }} />
        <i style={{ left: '33%' }} />
        <i style={{ left: '66%' }} />
      </div>
      <div className="boss-numbers">
        <span>{fmt(boss.hp)}</span>
        <span>/ {fmt(boss.max)}</span>
      </div>
    </div>
  );
}

const SKILL_ICONS: Record<SkillId, React.ReactNode> = {
  orbital: <IconOrbital size={20} />,
  emp: <IconEmp size={20} />,
  shield: <IconShield size={20} />,
};

function SkillRail() {
  const hud = useUI((s) => s.hud);
  const save = useUI((s) => s.save);
  const aiming = useUI((s) => s.aiming);
  const setAiming = useUI((s) => s.setAiming);
  const toast = useUI((s) => s.toast);
  const game = getGame();
  const skills = (Object.keys(SKILLS) as SkillId[]).filter((id) => save.chapter >= SKILLS[id].unlock);

  const activate = (id: SkillId) => {
    if (!game) return;
    if (id === 'orbital') {
      if (aiming === 'orbital') {
        setAiming(null);
        return;
      }
      if (!hud.skills.orbital.ready) {
        toast(`Oanh kích còn ${Math.ceil(hud.skills.orbital.remain)}s.`, 'warn');
        return;
      }
      setAiming('orbital');
      toast('CHẾ ĐỘ NGẮM — chạm bản đồ để gọi oanh kích.', 'info');
      return;
    }
    game.castSkill(id);
  };

  if (!skills.length) return null;
  return (
    <div className="skill-rail">
      {skills.map((id) => {
        const state = hud.skills[id];
        const frac = state.total > 0 ? Math.max(0, Math.min(1, state.remain / state.total)) : 0;
        const active = aiming === id;
        return (
          <button
            key={id}
            className={`skill-btn system-${TOWERS.railgun.system} ${state.ready ? 'ready' : 'cooling'} ${active ? 'aiming' : ''}`}
            style={{ '--skill': SKILLS[id].color } as CSSProperties}
            onClick={() => activate(id)}
            aria-label={`${SKILLS[id].name}${state.ready ? '' : `, còn ${Math.ceil(state.remain)} giây`}`}
          >
            <span className="skill-icon">{SKILL_ICONS[id]}</span>
            <span className="skill-label">{SKILLS[id].short}</span>
            {!state.ready && <span className="skill-cd">{Math.ceil(state.remain)}</span>}
            {!state.ready && <span className="skill-tint" style={{ height: `${frac * 100}%` }} />}
            {active && <span className="skill-aim-ring" />}
          </button>
        );
      })}
      {aiming === 'orbital' && (
        <button className="aiming-cancel" onClick={() => setAiming(null)}>
          HỦY NGẮM
        </button>
      )}
    </div>
  );
}

function TacticalRow() {
  const hud = useUI((s) => s.hud);
  const skillUnlock = useUI((s) => s.save.chapter);
  const hasSkill = (['orbital', 'emp', 'shield'] as SkillId[]).some((id) => skillUnlock >= SKILLS[id].unlock);
  return (
    <div className="tactical-row">
      {hasSkill ? <SkillRail /> : <div className="tactical-hint">{hud.towerCount === 0 ? 'CHẠM Ô TRỐNG ĐỂ XÂY TRỤ ĐẦU TIÊN' : 'TRẠM CHỈ HUY TRỰC CHIẾN'}</div>}
      <div className="tactical-right">
        {hud.claimTokens > 0 ? (
          <span className="token-chip">
            <span className="token-plus">+</span> MỞ RỘNG ×{hud.claimTokens}
          </span>
        ) : (
          <span className="token-chip muted">{hud.towerCount} TRỤ TRỰC CHIẾN</span>
        )}
      </div>
    </div>
  );
}

function BuildPanel({ cell, save }: { cell: string; save: SaveState }) {
  const game = getGame();
  const toast = useUI((s) => s.toast);
  const [picked, setPicked] = useState<string | null>(null);
  const metal = save.resources.metal;

  const build = (type: (typeof TOWER_LIST)[number]['type']) => {
    if (!game) return;
    if (game.buildTower(cell, type)) setPicked(null);
  };

  return (
    <div className="selection-panel build-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Ô TRỤ TRỐNG</span>
          <h2>CHỌN HỆ PHÒNG THỦ</h2>
        </div>
        <div className="panel-head-right">
          <span className="metal-readout">{fmt(metal)} KL</span>
          <button className="panel-close" aria-label="Đóng" onClick={() => useUI.getState().setSelection(null)}>
            <IconClose size={15} />
          </button>
        </div>
      </div>
      <div className="build-scroll">
        {TOWER_LIST.map((def) => {
          const locked = save.chapter < def.unlockChapter;
          const poor = metal < def.cost;
          const selected = picked === def.type;
          return (
            <button
              key={def.type}
              className={`build-card ${locked ? 'locked' : ''} ${poor && !locked ? 'poor' : ''} ${selected ? 'picked' : ''}`}
              style={{ '--accent': SYSTEM_HEX[def.system] } as CSSProperties}
              onClick={() => {
                if (locked) {
                  toast(`Mở khóa ở Vòng ${def.unlockChapter}.`, 'warn');
                  return;
                }
                setPicked(def.type);
              }}
            >
              <span className="build-system">{SYSTEM_LABEL[def.system]}</span>
              <span className="build-name">{def.name}</span>
              <span className="build-role">{def.role}</span>
              <span className="build-cost">
                {locked ? <><IconLock size={12} /> VÒNG {def.unlockChapter}</> : <>{fmt(def.cost)} KL</>}
              </span>
              {selected && <span className="build-confirm">TAP LẦN NỮA ĐỂ XÂY</span>}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="build-action-row">
          <span className="build-note">
            {TOWERS[picked as keyof typeof TOWERS].name} · {TOWERS[picked as keyof typeof TOWERS].role}
          </span>
          <button
            className="btn primary"
            disabled={metal < TOWERS[picked as keyof typeof TOWERS].cost}
            onClick={() => build(picked as keyof typeof TOWERS)}
          >
            TRIỂN KHAI · {fmt(TOWERS[picked as keyof typeof TOWERS].cost)} KL
          </button>
        </div>
      )}
    </div>
  );
}

function TowerPanel({ tower, save }: { tower: TowerSave; save: SaveState }) {
  const game = getGame();
  const [confirmScrap, setConfirmScrap] = useState(false);
  const def = TOWERS[tower.type];
  const stats = displayStats(save, tower);
  const upgradeCost = towerUpgradeCost(tower);
  const evolveCost = towerEvolveCost(tower);
  const slots = 1 + (tower.tier > 0 ? 1 : 0);
  const cell = WORLD_CELLS.get(tower.cell);
  const canEvolve = tower.tier === 0 && tower.level >= 5 && save.chapter >= 5 && save.resources.crystal >= evolveCost && save.resources.tech >= 1;
  const equipped = tower.cards.map((id) => cardById(save, id)).filter(Boolean);

  useEffect(() => setConfirmScrap(false), [tower.id]);

  return (
    <div className="selection-panel tower-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker" style={{ color: SYSTEM_HEX[def.system] }}>
            {SYSTEM_LABEL[def.system]} // CẤP {tower.level} {tower.tier > 0 ? '// TIẾN HÓA' : ''}
          </span>
          <h2>{def.name}</h2>
          <p className="panel-sub">{def.role} · {def.desc}</p>
        </div>
        <div className="panel-head-right">
          <span className="cell-coord">{cell ? `R${cell.ring}` : ''}</span>
          <button className="panel-close" aria-label="Đóng" onClick={() => useUI.getState().setSelection(null)}>
            <IconClose size={15} />
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div><span>SÁT THƯƠNG</span><strong>{stats.damage > 0 ? fmt(stats.damage) : '—'}</strong></div>
        <div><span>DPS</span><strong>{stats.dps > 0 ? fmt(stats.dps) : '—'}</strong></div>
        <div><span>TẦM BẮN</span><strong>{Math.round(stats.range)}</strong></div>
        <div><span>NHỊP</span><strong>{stats.interval > 0 ? `${stats.interval.toFixed(2)}s` : 'LIÊN TỤC'}</strong></div>
      </div>

      {def.projectile === 'amp' || def.projectile === 'repair' ? (
        <div className="support-readout">
          {def.projectile === 'amp'
            ? `+${Math.round(stats.buff * 100)}% sát thương cho trụ trong tầm`
            : `+${Math.round(stats.auraRate * 100)}% tốc độ bắn cho trụ trong tầm`}
        </div>
      ) : null}

      <div className="tower-actions">
        <button
          className="btn primary"
          disabled={tower.level >= 10 || save.resources.metal < upgradeCost}
          onClick={() => game?.upgradeTower(tower.id)}
        >
          <span>NÂNG CẤP</span>
          <small>{tower.level >= 10 ? 'TỐI ĐA' : `${fmt(upgradeCost)} KL`}</small>
        </button>
        <button
          className="btn evolve"
          disabled={!canEvolve}
          onClick={() => game?.evolveTower(tower.id)}
          title={save.chapter < 5 ? 'Mở khóa ở Vòng 5' : tower.level < 5 ? 'Cần Cấp 5' : 'Cần 1 Công nghệ + tinh thể'}
        >
          <span>TIẾN HÓA</span>
          <small>
            {tower.tier > 0 ? 'ĐÃ TIẾN HÓA' : save.chapter < 5 ? 'VÒNG 5' : `${evolveCost} TT + 1 CN`}
          </small>
        </button>
      </div>

      <div className="cards-line">
        <span className="cards-line-label">THẺ GẮN {equipped.length}/{slots}</span>
        <div className="equipped-mini">
          {equipped.map((card) => {
            if (!card) return null;
            const cdef = CARD_DEFS[card.defId];
            return (
              <button
                key={card.id}
                className={`mini-card ${RARITY_CLASS[card.rarity]}`}
                title={`${cdef.name} — chạm để gỡ`}
                onClick={() => game?.unequipCard(tower.id, card.id)}
              >
                {cdef.name}
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, slots - equipped.length) }, (_, i) => (
            <span key={`empty-${i}`} className="mini-card empty">TRỐNG</span>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => useUI.getState().openCards(tower.id)}>
          <IconCards size={14} /> QUẢN LÝ THẺ
        </button>
      </div>

      <div className="panel-foot">
        <span className="hint-text">
          {tower.tier > 0 ? 'Đã mở khóa ô thẻ thứ hai.' : 'Tiến hóa ở Cấp 5 để mở ô thẻ thứ hai.'}
        </span>
        <button
          className={`btn danger-ghost tiny ${confirmScrap ? 'confirm' : ''}`}
          onClick={() => {
            if (!game) return;
            if (confirmScrap) game.dismantleTower(tower.id);
            else setConfirmScrap(true);
          }}
        >
          {confirmScrap ? 'XÁC NHẬN THU HỒI' : 'THU HỒI TRỤ'}
        </button>
      </div>
    </div>
  );
}

function InfoPanel({ cellKey, save }: { cellKey: string; save: SaveState }) {
  const cell = WORLD_CELLS.get(cellKey);
  if (!cell) return null;
  const close = () => useUI.getState().setSelection(null);
  if (cell.kind === 'hq') {
    return (
      <div className="selection-panel info-panel">
        <div className="panel-head">
          <div><span className="panel-kicker">TRUNG TÂM CHỈ HUY</span><h2>TRẠM CHỈ HUY VÀNH ĐAI</h2></div>
          <button className="panel-close" onClick={close}><IconClose size={15} /></button>
        </div>
        <p className="panel-sub">Trái Đất được bảo vệ bởi mạng lưới trụ tự hành. Mở rộng lãnh thổ để chiếm mỏ khoáng và rương tiếp tế.</p>
        <div className="stat-grid">
          <div><span>LÃNH THỔ</span><strong>{save.claimed.length} Ô</strong></div>
          <div><span>RAID ĐÃ DỌN</span><strong>{save.stats.raidsCleared}</strong></div>
          <div><span>HẠ GỤC</span><strong>{fmt(save.stats.kills)}</strong></div>
          <div><span>PRESTIGE</span><strong>{save.prestige.count}</strong></div>
        </div>
      </div>
    );
  }
  if (!save.claimed.includes(cellKey)) {
    return (
      <div className="selection-panel info-panel">
        <div className="panel-head">
          <div><span className="panel-kicker">NGOÀI BIÊN GIỚI</span><h2>VÙNG CHƯA KHÁM PHÁ</h2></div>
          <button className="panel-close" onClick={close}><IconClose size={15} /></button>
        </div>
        <p className="panel-sub">Cần điểm mở rộng và một ô biên giới liền kề để chiếm vùng này.</p>
      </div>
    );
  }
  if (cell.kind === 'mine') {
    const base = mineYield(cell.ring);
    const mul = miningMult(save.prestige.upgrades) * (save.activeCommander === 'engineer' ? 1.2 : 1);
    return (
      <div className="selection-panel info-panel">
        <div className="panel-head">
          <div><span className="panel-kicker">TÀI NGUYÊN THỤ ĐỘNG</span><h2>MỎ KHOÁNG VÀNH ĐAI</h2></div>
          <button className="panel-close" onClick={close}><IconClose size={15} /></button>
        </div>
        <div className="stat-grid">
          <div><span>KIM LOẠI</span><strong>+{fmtRate(base.metal * mul)}</strong></div>
          <div><span>TINH THỂ</span><strong>+{(base.crystal * mul).toFixed(2)}/s</strong></div>
          <div><span>VÒNG</span><strong>R{cell.ring}</strong></div>
          <div><span>TRẠNG THÁI</span><strong>AN TOÀN</strong></div>
        </div>
        <p className="panel-sub">Mỏ khoáng tiếp tục sản xuất khi offline. Vành đai không bao giờ mất ô khi bạn vắng mặt.</p>
      </div>
    );
  }
  if (cell.kind === 'chest') {
    const opened = save.openedChests.includes(cell.key);
    return (
      <div className="selection-panel info-panel">
        <div className="panel-head">
          <div><span className="panel-kicker">TIẾP TẾ</span><h2>RƯƠNG VẬN CHUYỂN</h2></div>
          <button className="panel-close" onClick={close}><IconClose size={15} /></button>
        </div>
        <p className="panel-sub">{opened ? 'Rương đã được khai thác. Không còn gì bên trong.' : 'Rương mở ngay khi bạn chiếm ô này.'}</p>
      </div>
    );
  }
  if (cell.kind === 'slot') {
    return (
      <div className="selection-panel info-panel">
        <div className="panel-head">
          <div><span className="panel-kicker">Ô TRỤ</span><h2>VỊ TRÍ TRỐNG</h2></div>
          <button className="panel-close" onClick={close}><IconClose size={15} /></button>
        </div>
        <p className="panel-sub">Đã có trụ tại ô này.</p>
      </div>
    );
  }
  return (
    <div className="selection-panel info-panel">
      <div className="panel-head">
        <div><span className="panel-kicker">Ô TRUNG CHUYỂN</span><h2>VÙNG KIỂM SOÁT</h2></div>
        <button className="panel-close" onClick={close}><IconClose size={15} /></button>
      </div>
      <p className="panel-sub">Ô này mở rộng chu vi phòng thủ nhưng không thể đặt trụ. Hãy chiếm các ô có biểu tượng ô trụ.</p>
    </div>
  );
}

function SelectionLayer() {
  const selection = useUI((s) => s.selection);
  const save = useUI((s) => s.save);
  if (!selection) return null;
  const cell = WORLD_CELLS.get(selection);
  if (!cell) return null;
  const tower = towerAt(save, selection);
  if (tower) return <TowerPanel tower={tower} save={save} />;
  if (cell.kind === 'slot' && save.claimed.includes(selection)) return <BuildPanel cell={selection} save={save} />;
  return <InfoPanel cellKey={selection} save={save} />;
}

function TutorialBanner() {
  const save = useUI((s) => s.save);
  const towerCount = useUI((s) => s.hud.towerCount);
  if (save.tutorial.done) return null;
  const step = save.tutorial.step;
  const copy =
    step === 0
      ? 'BƯỚC 1/3 — CHẠM MỘT Ô TRỐNG QUANH TRẠM, CHỌN RAILGUN ĐỂ ĐẶT TRỤ.'
      : step === 1
        ? 'BƯỚC 2/3 — CHẠM TRỤ VỪA ĐẶT VÀ NÂNG LÊN CẤP 2.'
        : step === 2
          ? 'BƯỚC 3/3 — DÙNG OANH KÍCH QUỸ ĐẠO KHI RAID ĐÔNG.'
          : 'HƯỚNG DẪN HOÀN TẤT — TIẾP TỤC MỞ RỘNG VÀNH ĐAI.';
  return (
    <div className={`tutorial-banner ${towerCount === 0 && step === 0 ? 'pulse' : ''}`}>
      <span className="tutorial-tag">HƯỚNG DẪN</span>
      <span>{copy}</span>
    </div>
  );
}

function Dock() {
  const save = useUI((s) => s.save);
  const selection = useUI((s) => s.selection);
  const tower = selection ? towerAt(save, selection) : undefined;
  const claimTokens = useUI((s) => s.hud.claimTokens);
  const toast = useUI((s) => s.toast);
  const openCards = useUI((s) => s.openCards);
  const openModal = useUI((s) => s.openModal);
  const setSelection = useUI((s) => s.setSelection);

  const focusBuild = () => {
    const openSlot = [...WORLD_CELLS.values()].find(
      (c) => c.kind === 'slot' && save.claimed.includes(c.key) && !towerAt(save, c.key),
    );
    if (openSlot) {
      setSelection(openSlot.key);
      return;
    }
    if (claimTokens > 0) toast('Chạm ô viền vàng để mở rộng lãnh thổ và mở ô trụ mới.', 'info');
    else toast('Không còn ô trụ trống. Dọn raid để nhận điểm mở rộng.', 'warn');
  };

  const canPrestige = save.chapter >= 3;
  return (
    <nav className="dock" aria-label="Điều khiển chính">
      <button className={`dock-btn ${save.tutorial.step === 0 && !save.tutorial.done ? 'pulse' : ''}`} onClick={focusBuild}>
        <IconBuild size={20} />
        <span>XÂY TRỤ</span>
      </button>
      <button className={`dock-btn ${tower ? 'context' : ''}`} onClick={() => openCards(tower?.id ?? null)}>
        <IconCards size={20} />
        <span>THẺ BÀI</span>
        {save.cards.length > 0 && <i className="dock-badge">{save.cards.length}</i>}
      </button>
      <button className="dock-btn" onClick={() => openModal('commander')}>
        <IconCommander size={20} />
        <span>CHỈ HUY</span>
        <i className="dock-dot" style={{ background: COMMANDERS[save.activeCommander].color }} />
      </button>
      <button className={`dock-btn ${canPrestige ? 'prestige-ready' : ''}`} onClick={() => openModal('prestige')}>
        <IconPrestige size={20} />
        <span>TÁI THIẾT</span>
        {save.prestige.count > 0 && <i className="dock-badge">{save.prestige.count}</i>}
      </button>
    </nav>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toast-mark" />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function Hud() {
  const aiming = useUI((s) => s.aiming);
  const boss = useUI((s) => s.hud.boss);
  return (
    <div className={`hud-layer ${boss ? 'has-boss' : ''}`}>
      <TopConsole />
      <div className="camera-tools">
        <button className="icon-btn" aria-label="Phóng to" title="Phóng to" onClick={() => getGame()?.zoomIn()}>
          <IconZoomIn size={17} />
        </button>
        <button className="icon-btn" aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => getGame()?.zoomOut()}>
          <IconZoomOut size={17} />
        </button>
        <button className="icon-btn" aria-label="Về Trạm Chỉ Huy" title="Về Trạm Chỉ Huy" onClick={() => getGame()?.recenterCamera()}>
          <IconRecenter size={17} />
        </button>
      </div>
      <BossBar />
      <Toasts />
      <div className="bottom-stack">
        {aiming === 'orbital' && (
          <div className="aiming-banner">
            <span className="aiming-cross" />
            CHẾ ĐỘ OANH KÍCH — CHẠM BẢN ĐỒ ĐỂ KHÓA MỤC TIÊU
            <button onClick={() => useUI.getState().setAiming(null)}>HỦY</button>
          </div>
        )}
        <TutorialBanner />
        <SelectionLayer />
        <div className="command-strip">
          <TacticalRow />
          <Dock />
        </div>
      </div>
    </div>
  );
}
