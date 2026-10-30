'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Copy, ExternalLink, FileSpreadsheet, GitBranch, History, Layers3, LayoutGrid, ListFilter, Menu, Monitor, Package, PanelLeftClose, RefreshCw, Rocket, Search, ShieldCheck, Smartphone, Sparkles, Timer, X } from 'lucide-react';
import type { Feature, Platform, Release, Stage, Status, TimelineData } from '@/lib/types';
import { addDays, bangkokToday, canStartMerge, daysBetween, featureDate, formatDate, PLATFORM_LABEL, selectFeatures, sourceLink, STAGE_LABEL, STATUS_LABEL } from '@/lib/timeline';

type View = 'timeline' | 'releases' | 'history';
const LEGEND = ['dev', 'qa', 'integration', 'cut', 'production', 'release'] as const;
function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className={`platform-badge platform-${platform}`}>{platform === 'web' ? <Monitor size={11} /> : platform === 'app' ? <Smartphone size={11} /> : platform === 'shared' ? <Layers3 size={11} /> : null}{PLATFORM_LABEL[platform]}</span>;
}
function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status}`}><i />{STATUS_LABEL[status]}</span>;
}
function ClockText({ value }: { value: string }) {
  return <>{new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value))}</>;
}
function endOf(feature: Feature): string {
  return feature.stages.map(s => s.end).sort().at(-1) || '';
}
function stageTitle(stage: Stage) {
  return `${STAGE_LABEL[stage.kind]} · ${formatDate(stage.start)}${stage.end !== stage.start ? ` – ${formatDate(stage.end)}` : ''}${stage.note ? ` · ${stage.note}` : ''}${stage.tentative ? ' (Tentative)' : ''}`;
}

export default function Dashboard({ initialData }: { initialData: TimelineData }) {
  const [data, setData] = useState(initialData);
  const [savedBuilds, setSavedBuilds] = useState<Record<string, string>>({});
  useEffect(() => { fetch('/api/builds').then(r => r.ok ? r.json() : Promise.reject()).then(setSavedBuilds).catch(() => {}); }, []);
  const [view, setView] = useState<View>('timeline');
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [today, setToday] = useState(() => bangkokToday());
  const currentYear = Number(today.slice(0, 4));
  const years = [...new Set(data.features.map(f => f.year))].sort((a, b) => b - a);
  const [year, setYear] = useState(String(years.find(y => y <= currentYear) || years[0] || currentYear));
  const [historyMode, setHistoryMode] = useState<'deployed' | 'plans'>('plans');
  const [includePast, setIncludePast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [selected, setSelected] = useState<Feature | Release | null>(null);
  const [help, setHelp] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const monday = (date: string) => addDays(date, -((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const [anchor, setAnchor] = useState(() => addDays(monday(today), -7));
  const [toast, setToast] = useState('');
  const refreshingRef = useRef(false);

  async function refresh(manual = false) {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/timeline${manual ? '?refresh=1' : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(40000) });
      if (!response.ok) throw new Error();
      const next = await response.json() as TimelineData;
      setData(next);
      setRefreshError('');
      if (manual && next.source.mode === 'live') setToast('อัปเดตข้อมูลจาก Google Sheet แล้ว');
    } catch { setRefreshError('รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่อ่านได้'); }
    finally { refreshingRef.current = false; setRefreshing(false); setToday(bangkokToday()); }
  }
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    return () => clearInterval(timer);
    // refresh reads no changing render state; the ref prevents duplicate requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);

  const filtered = useMemo(() => selectFeatures(data.features, { view: 'all', today, platform, query, year: year === 'all' ? undefined : Number(year) }), [data.features, today, platform, query, year]);
  const current = filtered.filter(f => f.status !== 'deployed');
  const datedPast = (f: Feature) => !!endOf(f) && endOf(f) < today;
  const focused = current.filter(f => includePast || !datedPast(f) || f.status !== 'unknown');
  const historyFeatures = historyMode === 'deployed' ? filtered.filter(f => f.status === 'deployed') : filtered.filter(datedPast);
  const shown = view === 'history' ? historyFeatures : focused;
  const shownIds = new Set(shown.map(f => f.id));
  const relevantReleases = data.releases.filter(r => r.features.some(f => shownIds.has(f.id)));
  const filteredIds = new Set(filtered.map(f => f.id));
  const filteredReleases = data.releases.filter(r => r.features.some(f => filteredIds.has(f.id)));
  const upcoming = filteredReleases.filter(r => r.date && r.date >= today && r.status !== 'deployed').sort((a, b) => a.date!.localeCompare(b.date!));
  const nextRelease = upcoming[0];
  const inProgress = focused.filter(f => f.stages.some(s => s.start <= today && s.end >= today) || ['merging', 'testing'].includes(f.status));
  const ready = filteredReleases.filter(r => r.status === 'done' && r.images.length > 0);
  const pending = current.filter(f => f.status === 'unknown').length;

  function navigate(next: View) { setView(next); setMobileNav(false); if (next === 'history') setYear('all'); else setYear(String(years.find(y => y <= currentYear) || years[0])); }
  async function copyImage(text: string) {
    try { await navigator.clipboard.writeText(text); setToast('คัดลอกเลข image/build แล้ว'); }
    catch { setToast('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอก'); }
  }
  function showFeature(feature: Feature) { setSelected(feature); }
  function resetFilters() { setQuery(''); setPlatform('all'); setYear(view === 'history' ? 'all' : String(currentYear)); }

  return <div className="app-shell">
    {mobileNav && <button className="nav-scrim" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a href="/" className="brand" aria-label="Release room หน้าแรก"><span className="brand-mark"><Layers3 size={23} strokeWidth={2.1} /></span><span>release<span className="brand-light">room</span><small>FRONTEND WORKSPACE</small></span></a>
      <div className="workspace"><span className="workspace-avatar">FE</span><span><b>Frontend team</b><small>App & Web development</small></span><ChevronDown size={14} /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="เมนูหลัก">
        <button className={view === 'timeline' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('timeline')}><CalendarDays size={18} /><span>Timeline</span><span className="nav-count">{focused.length}</span></button>
        <button className={view === 'releases' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('releases')}><Rocket size={18} /><span>Release board</span></button>
        <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('history')}><History size={18} /><span>ประวัติย้อนหลัง</span></button>
      </nav>
      <div className="nav-caption source-caption">CONNECTED SOURCE</div>
      <a className="source-nav" href={data.source.url} target="_blank" rel="noreferrer"><FileSpreadsheet size={18} /><span>Deploy Plan<small>Google Sheets</small></span><ArrowUpRight size={14} /></a>
      <div className="sidebar-bottom"><div className="sheet-note"><span className="sheet-note-icon"><RefreshCw size={16} /></span><b>แก้แผนใน Sheet ได้เลย</b><p>Timeline จะอัปเดตตามชีต<br />ทุก 1 นาทีขณะเปิดหน้านี้</p><a href={data.source.url} target="_blank" rel="noreferrer">เปิด Google Sheet <ArrowUpRight size={12} /></a></div>
        <button className="help-nav" onClick={() => setHelp(true)}><CircleHelp size={17} />วิธีอ่าน Timeline<ArrowUpRight size={14} /></button>
        <div className="team-footer"><span className="team-avatar">FE</span><div><b>Frontend workspace</b><small>Read-only view</small></div><ShieldCheck size={16} /></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="เปิดเมนู" onClick={() => setMobileNav(true)}><Menu size={20} /></button><PanelLeftClose className="desktop-menu" size={17} /><span className="breadcrumb-parent">Workspace</span><ChevronRight size={13} /><b>Release planning</b></div><div className="topbar-right"><span className="read-only"><ShieldCheck size={13} />Read-only</span><span className="topbar-divider" /><span className="topbar-team">FE</span></div></header>
      <main id="main-content">
        <div className="page-heading"><div><div className="eyebrow"><span /> ONE PLAN. EVERY RELEASE.</div><h1>{view === 'history' ? 'Release history' : view === 'releases' ? 'Release board' : 'FE release timeline'}<span className="year-pill">{year === 'all' ? 'ALL YEARS' : year}</span></h1><p>{view === 'history' ? 'ย้อนดูแผนที่ผ่านมา และรอบที่ทีมยืนยันว่า deploy แล้ว' : 'เห็นแผนเดียวกัน ตั้งแต่เริ่มพัฒนา จนถึงวันที่ปล่อย App และ Web'}</p></div><a className="sheet-button" href={data.source.url} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิดต้นฉบับ Sheet<ArrowUpRight size={15} /></a></div>
        <div className="sync-line"><span className={`live-dot ${data.source.mode === 'live' ? '' : 'warning-dot'}`} /><b>{data.source.mode === 'live' ? 'เชื่อมต่อ Google Sheets แล้ว' : data.source.mode === 'cached' ? 'ข้อมูลที่อ่านสำเร็จล่าสุด' : 'สำเนาข้อมูลจาก Sheet'}</b><span className="sync-dot">·</span><span>อัปเดต <ClockText value={data.source.fetchedAt} /> น.</span><button onClick={() => void refresh(true)} disabled={refreshing} className="refresh-link"><RefreshCw size={12} className={refreshing ? 'spin' : ''} />{refreshing ? 'กำลังอัปเดต' : 'รีเฟรช'}</button></div>
        {(refreshError || data.source.warning) && <div className="warning-banner" role="status"><Clock3 size={16} />{refreshError || data.source.warning}</div>}

        <section className="metrics" aria-label="ภาพรวมแผนงาน">
          <Metric label="งานในแผนปัจจุบัน" value={focused.length} unit="งาน" icon={<Layers3 size={19} />} detail="รวม App และ Web" tone="blue" />
          <Metric label="กำลังดำเนินการตามแผน" value={inProgress.length} unit="งาน" icon={<Timer size={19} />} detail="มีช่วงงานครอบคลุมวันนี้" tone="purple" />
          <Metric label="รอบ release ถัดไป" value={upcoming.length} unit="รอบ" icon={<Rocket size={19} />} detail={nextRelease?.date ? `ใกล้ที่สุด ${formatDate(nextRelease.date)}` : 'รอกำหนดวันในชีต'} tone="orange" />
          <Metric label="พร้อมส่งต่อให้ SA" value={ready.length} unit="รอบ" icon={<CheckCheck size={19} />} detail="สถานะ Done ที่ยืนยันในชีต" tone="green" />
        </section>

        {view !== 'history' && nextRelease && <section className="next-release"><div className="next-release-icon"><Rocket size={22} /></div><div className="next-release-copy"><div className="section-eyebrow">NEXT ON THE CALENDAR <span>ตามแผนใน Sheet</span></div><h2>{formatDate(nextRelease.date, true)}<span>·</span>{nextRelease.features.length} {nextRelease.features.length > 1 ? 'features' : 'feature'}</h2><p>{nextRelease.features.map(f => f.title).join(' · ')}</p></div><div className="next-release-right"><span className="countdown">อีก {daysBetween(today, nextRelease.date!)} วัน</span><button onClick={() => setSelected(nextRelease)}>ดูรอบ release<ArrowRight size={15} /></button></div></section>}

        <section className="planning-section">
          <div className="section-top"><div className="view-tabs" role="tablist" aria-label="มุมมองแผนงาน"><button role="tab" aria-selected={view === 'timeline'} onClick={() => navigate('timeline')} className={view === 'timeline' ? 'selected' : ''}><CalendarDays size={16} />Timeline</button><button role="tab" aria-selected={view === 'releases'} onClick={() => navigate('releases')} className={view === 'releases' ? 'selected' : ''}><LayoutGrid size={16} />Releases</button><button role="tab" aria-selected={view === 'history'} onClick={() => navigate('history')} className={view === 'history' ? 'selected' : ''}><History size={16} />History</button></div><span className="section-counter">{shown.length} งาน{view !== 'releases' ? 'ในมุมมองนี้' : ` · ${relevantReleases.length} รอบ`}</span></div>
          <div className="filters"><label className="search-input"><Search size={16} /><input aria-label="ค้นหางานหรือ release" placeholder="ค้นหางาน หรือ release..." value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="ล้างคำค้นหา" onClick={() => setQuery('')}><X size={13} /></button>}</label><span className="filter-divider" /><div className="platform-filters" aria-label="กรอง platform">{[['all', 'ทั้งหมด'], ['web', 'Web'], ['app', 'App']].map(([value, label]) => <button key={value} aria-pressed={platform === value} className={platform === value ? 'selected' : ''} onClick={() => setPlatform(value)}>{value === 'web' ? <Monitor size={13} /> : value === 'app' ? <Smartphone size={13} /> : null}{label}</button>)}</div><div className="filter-spacer" /><label className="select-wrap"><CalendarDays size={14} /><select aria-label="เลือกปีแผน" value={year} onChange={e => setYear(e.target.value)}><option value="all">ทุกปี</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown size={13} /></label>{view !== 'history' && <button className={`filter-toggle ${includePast ? 'selected' : ''}`} onClick={() => setIncludePast(!includePast)} aria-pressed={includePast}><ListFilter size={14} />รวมแผนที่ผ่านมา</button>}</div>

          {view === 'history' && <div className="history-controls"><div className="segmented"><button className={historyMode === 'plans' ? 'selected' : ''} onClick={() => setHistoryMode('plans')}>แผนที่ผ่านมา</button><button className={historyMode === 'deployed' ? 'selected' : ''} onClick={() => setHistoryMode('deployed')}>ยืนยัน Deployed แล้ว</button></div><p>{historyMode === 'plans' ? 'วันที่ตามแผนผ่านไปแล้ว ยังไม่ถือว่า deploy สำเร็จจนกว่าทีมจะยืนยัน' : 'แสดงเฉพาะงานที่มีสถานะ Deployed หรือ Released ในชีต'}</p></div>}

          {view === 'timeline' && <><div className="timeline-toolbar"><div className="date-navigator"><button className="icon-button" aria-label="ช่วงก่อนหน้า" onClick={() => setAnchor(addDays(anchor, -28))}><ChevronLeft size={16} /></button><span>{formatDate(anchor)} – {formatDate(addDays(anchor, weeks * 7 - 1), true)}</span><button className="icon-button" aria-label="ช่วงถัดไป" onClick={() => setAnchor(addDays(anchor, 28))}><ChevronRight size={16} /></button><button className="today-button" onClick={() => setAnchor(addDays(monday(today), -7))}>วันนี้</button></div><div className="timeline-controls"><div className="legend">{LEGEND.filter(k => k !== 'integration').map(kind => <span key={kind}><i className={`legend-dot ${kind}`} />{kind === 'dev' ? 'Dev FE' : kind === 'production' ? 'Deploy' : kind === 'release' ? 'Release' : STAGE_LABEL[kind]}</span>)}</div><select aria-label="จำนวนสัปดาห์ที่แสดง" value={weeks} onChange={e => setWeeks(Number(e.target.value))}><option value={4}>4 สัปดาห์</option><option value={8}>8 สัปดาห์</option><option value={12}>12 สัปดาห์</option></select></div></div><Timeline features={shown} anchor={anchor} weeks={weeks} today={today} onSelect={showFeature} /></>}
          {view === 'releases' && <div className="release-grid">{relevantReleases.map(release => <ReleaseCard key={release.id} release={release} all={data.releases} onOpen={() => setSelected(release)} />)}</div>}
          {view === 'history' && <div className="history-list">{historyFeatures.map(feature => <button key={feature.id} className="history-row" onClick={() => showFeature(feature)}><span className="history-icon"><History size={17} /></span><span className="history-name"><b>{feature.title}</b><small>{feature.sheetTitle} · {feature.version || 'ยังไม่ระบุ version'}</small></span><PlatformBadge platform={feature.platform} /><span className="history-date">{formatDate(featureDate(feature) || endOf(feature), true)}</span><StatusBadge status={feature.status} /><ChevronRight size={16} /></button>)}</div>}
          {!shown.length && <div className="empty-state"><span><Search size={25} /></span><h3>{view === 'history' && historyMode === 'deployed' ? 'ยังไม่มีการยืนยัน Deployed ในชีต' : 'ไม่พบงานในมุมมองนี้'}</h3><p>{view === 'history' && historyMode === 'deployed' ? 'เมื่อทีมระบุสถานะแล้ว งานจะแสดงเป็นประวัติที่นี่' : 'ลองเปลี่ยนตัวกรอง หรือเปิดดูแผนที่ผ่านมา'}</p><button onClick={resetFilters}>ล้างตัวกรอง</button></div>}
          <div className="table-footer"><span><FileSpreadsheet size={13} />ข้อมูลจาก {year === 'all' ? 'Project timeline ทุกปี' : `Project timeline ${year}`}</span><span>คลิกที่งานเพื่อดูรายละเอียด <ArrowUpRight size={12} /></span></div>
        </section>

        {view !== 'history' && pending > 0 && <div className="data-note"><span className="data-note-icon"><CircleHelp size={17} /></span><div><b>วันที่ในแผน กับสถานะจริง เป็นคนละเรื่องกัน</b><p>มี {pending} งานที่ชีตยังไม่ระบุสถานะรอบ release · เว็บจะไม่ถือว่า Done หรือ Deployed จากวันที่ที่ผ่านไป</p></div><button onClick={() => setHelp(true)}>วิธีระบุสถานะ<ArrowUpRight size={14} /></button></div>}
        <footer className="page-footer"><span>Release room<span>·</span>One source of truth for your team.</span><span><span className="live-dot" />Google Sheets เป็นข้อมูลหลัก</span></footer>
      </main>
    </div>
    {selected && <DetailDrawer selected={selected} all={data.releases} onClose={() => setSelected(null)} onCopy={copyImage} onFeature={showFeature} savedBuilds={savedBuilds} onSaved={(id, image) => setSavedBuilds(values => ({...values, [id]: image}))} />}
    {help && <HelpDrawer onClose={() => setHelp(false)} sourceUrl={data.source.url} />}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </div>;
}

function Metric({ label, value, unit, icon, detail, tone }: { label: string; value: number; unit: string; icon: React.ReactNode; detail: string; tone: string }) {
  return <article className="metric"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value.toString().padStart(2, '0')}<span>{unit}</span></div><p><span className={`tiny-dot ${tone}`} />{detail}</p></article>;
}

function Timeline({ features, anchor, weeks, today, onSelect }: { features: Feature[]; anchor: string; weeks: number; today: string; onSelect: (f: Feature) => void }) {
  const days = weeks * 7;
  const end = addDays(anchor, days - 1);
  const todayOffset = daysBetween(anchor, today);
  const inWindow = todayOffset >= 0 && todayOffset < days;
  return <div className="timeline-scroll"><div className="timeline-table" style={{ '--weeks': weeks, '--days': days } as React.CSSProperties}><div className="timeline-header"><div className="feature-column">FEATURE / PROJECT<span>{features.length} งาน</span></div><div className="calendar-header"><div className="week-labels">{Array.from({ length: weeks }, (_, i) => <span key={i}>{formatDate(addDays(anchor, i * 7))}</span>)}</div><div className="week-day-labels">{Array.from({ length: days }, (_, i) => <span key={i} className={addDays(anchor, i) === today ? 'is-today' : i % 7 >= 5 ? 'weekend' : ''}>{new Date(addDays(anchor, i) + 'T00:00:00Z').getUTCDate()}</span>)}</div></div></div>
    {features.map((feature, index) => {
      const stages = feature.stages.filter(s => s.start <= end && s.end >= anchor);
      const date = featureDate(feature);
      return <div className="timeline-row" key={feature.id}><button className="feature-cell" onClick={() => onSelect(feature)}><span className="feature-number">{String(index + 1).padStart(2, '0')}</span><span className="feature-title"><b title={feature.title}>{feature.title.replace(/\s*(?:-->|==>)\s*Done/i, '')}</b><span><PlatformBadge platform={feature.platform} /><small>{date ? `Release ${formatDate(date)}` : 'ยังไม่ระบุวัน release'}</small></span></span><ChevronRight size={14} className="feature-chevron" /></button><div className="calendar-cell"><div className="week-grid">{Array.from({ length: weeks }, (_, i) => <span key={i} />)}</div>{inWindow && <div className="today-line" style={{ left: `${(todayOffset + .5) / days * 100}%` }}><span>{index === 0 ? 'วันนี้' : ''}</span></div>}{stages.map((stage, i) => {
        const offset = Math.max(0, daysBetween(anchor, stage.start));
        const width = Math.min(days - offset, daysBetween(stage.start < anchor ? anchor : stage.start, stage.end) + 1);
        const lane = stage.kind === 'dev' || stage.kind === 'integration' ? 0 : stage.kind === 'qa' ? 1 : 2;
        const milestone = ['cut', 'release', 'production', 'preprod'].includes(stage.kind);
        return <button key={`${stage.kind}-${i}`} className={`stage-bar ${stage.kind} ${milestone ? 'milestone' : ''} ${stage.tentative ? 'tentative' : ''}`} style={{ left: `${offset / days * 100}%`, width: `${Math.max(width / days * 100, milestone ? 1.5 : 1)}%`, top: `${12 + lane * 20}px` }} onClick={() => onSelect(feature)} title={stageTitle(stage)} aria-label={`${feature.title}: ${stageTitle(stage)}`}>{milestone ? <span className="diamond" /> : <span>{stage.kind === 'dev' ? 'Dev FE' : stage.kind === 'integration' ? 'Integrate' : STAGE_LABEL[stage.kind]}</span>}</button>;
      })}{!stages.length && <button className="no-dates" onClick={() => onSelect(feature)}>{feature.stages.length ? <><ArrowRight size={12} />อยู่นอกช่วงวันที่แสดง</> : 'รอระบุวันที่ในชีต'}</button>}</div></div>;
    })}
  </div></div>;
}

function ReleaseCard({ release, all, onOpen }: { release: Release; all: Release[]; onOpen: () => void }) {
  const readiness = canStartMerge(release, all);
  return <button className="release-card" onClick={onOpen}><div className="release-card-top"><span className="release-package"><Package size={19} /></span><StatusBadge status={release.status} /></div><span className="release-type">{release.explicit ? 'RELEASE ROUND' : 'GROUPED BY SHEET PLAN'}</span><h3>{release.name}</h3><div className="release-date"><CalendarDays size={14} />{formatDate(release.date, true)}</div><div className="release-features">{release.features.slice(0, 3).map(f => <span key={f.id}><i />{f.title}</span>)}{release.features.length > 3 && <small>+ อีก {release.features.length - 3} งาน</small>}</div><div className="release-image"><Package size={13} /><code>{release.images[0] || 'ยังไม่มีเลข image / build'}</code></div><div className={`readiness ${readiness.allowed === true ? 'ready' : ''}`}><GitBranch size={13} /><span>{readiness.reason}</span><ChevronRight size={14} /></div></button>;
}

function DrawerShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const els = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, [tabindex="0"]');
        if (!els?.length) return;
        const first = els[0], last = els[els.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handle); prev?.focus(); };
  }, [onClose]);
  return <div className="drawer-overlay"><button className="drawer-backdrop" aria-label="ปิดรายละเอียด" onClick={onClose} /><section className="drawer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}><div className="drawer-top"><span><Layers3 size={16} />{label}</span><button className="icon-button" aria-label="ปิดรายละเอียด" onClick={onClose}><X size={20} /></button></div>{children}</section></div>;
}

function DetailDrawer({ selected, all, onClose, onCopy, onFeature, savedBuilds, onSaved }: { selected: Feature | Release; all: Release[]; onClose: () => void; onCopy: (text: string) => void; onFeature: (feature: Feature) => void; savedBuilds: Record<string, string>; onSaved: (id: string, image: string) => void }) {
  const isRelease = 'features' in selected;
  const images = savedBuilds[selected.id] !== undefined ? (savedBuilds[selected.id] ? [savedBuilds[selected.id]] : []) : (isRelease ? selected.images : selected.image ? [selected.image] : []);
  const release = isRelease ? selected : all.find(r => r.features.some(f => f.id === selected.id));
  const feature = isRelease ? null : selected;
  const readiness = release ? canStartMerge(release, all) : null;
  return <DrawerShell onClose={onClose} label={isRelease ? 'Release details' : 'Feature details'}><div className="drawer-content"><div className="detail-badges"><PlatformBadge platform={selected.platform} /><StatusBadge status={selected.status} /></div><h2>{isRelease ? selected.name : selected.title}</h2><p className="detail-subtitle">{isRelease ? `${selected.features.length} งานในรอบนี้ · ${formatDate(selected.date, true)}` : `${selected.sheetTitle} · แถว ${selected.sourceRow}`}</p>
    <div className="detail-callout"><CircleHelp size={17} /><p>Done = merge ครบและเทสผ่าน<br />Deployed = ยืนยันว่าปล่อย production แล้ว</p></div>
    <h3>Release information</h3><dl className="detail-fields"><div><dt>รอบ / Version</dt><dd>{release?.name || 'ยังไม่ระบุ'}</dd></div><div><dt>วัน release ตามแผน</dt><dd>{formatDate(isRelease ? selected.date : featureDate(selected), true)}</dd></div><div><dt>Stream</dt><dd>{selected.stream || 'ยังไม่ระบุ'}</dd></div>{feature && <div><dt>ผู้รับผิดชอบ</dt><dd>{feature.owner || 'ยังไม่ระบุ'}</dd></div>}<div><dt>สถานะในชีต</dt><dd><StatusBadge status={selected.status} /></dd></div></dl>
    <h3>Image / App build</h3><BuildEditor key={selected.id} id={selected.id} initial={savedBuilds[selected.id] ?? (isRelease ? selected.images[0] || '' : selected.image)} onSaved={onSaved} />{images.length ? images.map(image => <div key={image} className="image-code"><Package size={16} /><code>{image}</code><button className="icon-button" aria-label="คัดลอก image" onClick={() => onCopy(image)}><Copy size={15} /></button></div>) : <div className="missing-image"><Package size={21} /><b>ยังไม่มีเลข image / build ในชีต</b><p>เมื่อทีมระบุใน Sheet ข้อมูลจะแสดงที่นี่</p></div>}
    {readiness && <div className={`merge-info ${readiness.allowed ? 'ready' : ''}`}><GitBranch size={17} /><div><b>การเริ่ม merge รอบถัดไป</b><p>{readiness.reason}</p></div></div>}
    {isRelease && <><h3>งานในรอบ release <span>{selected.features.length}</span></h3><div className="detail-feature-list">{selected.features.map(f => <button key={f.id} onClick={() => onFeature(f)}><div><b>{f.title}</b><PlatformBadge platform={f.platform} /></div><ChevronRight size={16} /></button>)}</div>{!selected.explicit && <p className="small-note">จัดกลุ่มจาก version และวัน release ในชีต ยังไม่ใช่รอบที่ทีมระบุ Release ID โดยตรง</p>}</>}
    {feature && <><h3>Timeline ของงาน</h3>{feature.stages.length ? <div className="stage-list">{feature.stages.map((s, i) => <div key={i}><span className={`stage-node ${s.kind}`} /><div><b>{STAGE_LABEL[s.kind]}{s.tentative && <span className="tentative-label">Tentative</span>}</b><p>{formatDate(s.start, true)}{s.end !== s.start && ` – ${formatDate(s.end, true)}`}</p>{s.note && <small>{s.note}</small>}</div></div>)}</div> : <p className="small-note">ชีตยังไม่ได้ระบุวันที่ของงานนี้</p>}{feature.notes.map((n, i) => <p className="small-note" key={i}>{n}</p>)}{feature.platformInferred && <p className="small-note">Platform อ่านจากชื่องานและวันที่ App release ที่กรอกไว้ หากไม่มีข้อมูลจะคงเป็น “ยังไม่ระบุ”</p>}<a className="source-detail-link" href={sourceLink(feature)} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิดแถวต้นฉบับใน Sheet<ExternalLink size={14} /></a></>}
  </div></DrawerShell>;
}

function HelpDrawer({ onClose, sourceUrl }: { onClose: () => void; sourceUrl: string }) {
  return <DrawerShell label="วิธีใช้ Release room" onClose={onClose}><div className="drawer-content"><span className="help-hero"><FileSpreadsheet size={28} /></span><h2>แก้ที่ Sheet<br />เห็นแผนเดียวกันที่นี่</h2><p className="detail-subtitle">เว็บอ่านข้อมูลอย่างเดียว และไม่ merge หรือ deploy โค้ดให้ทีม</p><h3>สถานะของแต่ละรอบ</h3><div className="status-guide">{(['planned', 'merging', 'testing', 'done', 'deployed'] as Status[]).map((s, i) => <div key={s}><span>{i + 1}</span><div><StatusBadge status={s} /><p>{({ planned: 'กำหนดงานที่จะเอาเข้ารอบแล้ว', merging: 'ผู้รับผิดชอบกำลังรวมโค้ด', testing: 'มี build ให้ทีมทดสอบ', done: 'รวมโค้ดครบและเทสผ่าน เริ่ม merge รอบถัดไปใน stream เดียวกันได้', deployed: 'SA ยืนยันว่า deploy production แล้ว ย้ายไปประวัติ' } as Record<string, string>)[s]}</p></div></div>)}</div><h3>ใช้รูปแบบชีตเดิมได้</h3><p className="guide-text">แถบสีและข้อความในปฏิทินใช้แสดงวันตามแผน หากต้องการระบุรอบ สถานะ และ image ให้เพิ่ม Note ที่เซลล์ชื่องาน โดยไม่ต้องเพิ่มแท็บ:</p><pre className="metadata-example">{'release: Release 1\nstream: web-main\nstatus: Done\nimage: web:release-001\nplatform: web\nowner: ชื่อผู้รับผิดชอบ'}</pre><p className="small-note">ตัวอย่างรูปแบบเท่านั้น ไม่ใช่สถานะหรือ image จริง ทุกงานในรอบต้องใช้ release และ stream เดียวกัน และ Done ครบทุกงานก่อนเว็บจะแสดงว่ารอบถัดไปเริ่ม merge ได้ ลำดับรอบอ่านจากตำแหน่งในชีต</p><h3>ข้อมูลเก่าดูที่ไหน</h3><p className="guide-text">History แยก “แผนที่ผ่านมา” ออกจาก “ยืนยัน Deployed แล้ว” วันที่ผ่านไปหรือคำว่า Done ในชื่องานจะไม่ถูกตีความเป็นการ deploy</p><a className="source-detail-link" href={sourceUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิด Google Sheet<ExternalLink size={14} /></a></div></DrawerShell>;
}

function BuildEditor({id, initial, onSaved}: {id:string; initial:string; onSaved:(id:string,image:string)=>void}) {
 const [value,setValue]=useState(initial); const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');
 async function save(){setSaving(true);setMessage('');try{const response=await fetch('/api/builds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,image:value})});if(!response.ok)throw new Error();onSaved(id,value.trim());setMessage('บันทึกแล้ว · เปิดกลับมาดูได้');}catch{setMessage('บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setSaving(false);}}
 return <div style={{marginBottom:16}}><label style={{display:'block',fontSize:12,marginBottom:8}} htmlFor="image-build">เลข Image / App build</label><input id="image-build" value={value} maxLength={500} onChange={e=>setValue(e.target.value)} placeholder="เช่น web:release-001 หรือ App build 123" style={{width:'100%',padding:12,border:'1px solid #ccd7ea',borderRadius:6,color:'#334766'}}/><button className="primary-button" style={{marginTop:10}} disabled={saving} onClick={()=>void save()}>{saving?'กำลังบันทึก...':'บันทึก Image / Build'}</button><p role="status" style={{marginTop:8,fontSize:11}}>{message}</p><p className="small-note">บันทึกบนเซิร์ฟเวอร์ของเว็บ แยกจากข้อมูล timeline ใน Sheet</p></div>;
}
