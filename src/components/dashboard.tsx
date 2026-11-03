'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Copy, ExternalLink, FileSpreadsheet, GitBranch, History, Layers3, LayoutGrid, ListFilter, Menu, Monitor, Package, PanelLeftClose, Pencil, Plus, RefreshCw, Rocket, Search, ShieldCheck, Smartphone, Sparkles, Timer, X } from 'lucide-react';
import { mergeSavedBuilds } from '@/lib/build-view';
import type { BuildData, BuildRecord } from '@/lib/build-types';
import { mergeSavedReleaseStatuses } from '@/lib/release-status-view';
import type { ReleaseStatusRecord, TeamStatus } from '@/lib/release-status-store';
import type { ManagedRelease, ManagedReleaseMember } from '@/lib/release-management';
import type { ManagedFeature } from '@/lib/managed-feature-store';
import { mergeManagedReleases } from '@/lib/release-management-view';
import type { Feature, Platform, Release, ReleaseTag, Stage, Status, TimelineData } from '@/lib/types';
import { addDays, bangkokToday, canStartMerge, daysBetween, featureDate, formatDate, PLATFORM_LABEL, selectFeatures, sourceLink, STAGE_LABEL, STATUS_LABEL } from '@/lib/timeline';

type View = 'timeline' | 'releases' | 'unassigned' | 'history';
const LEGEND = ['dev', 'qa', 'integration', 'cut', 'production', 'release'] as const;
const EMPTY_RELEASE_STATUS:ReleaseStatusRecord={releaseStatus:'unknown',beStatus:'unknown',feStatus:'unknown',qaStatus:'unknown'};
const TEAM_STATUS_LABEL:Record<TeamStatus,string>={unknown:'ยังไม่ระบุ',not_started:'Not started',in_progress:'In progress',done:'Done',testing:'Testing',passed:'Passed',failed:'Failed',blocked:'Blocked'};
const RELEASE_TAG_LABEL:Record<ReleaseTag,string>={web:'Web',app:'App',be:'BE'};
function tagsForRelease(release:Release):ReleaseTag[]{if(release.tags?.length)return release.tags;return release.platform==='shared'?['web','app']:release.platform==='web'||release.platform==='app'?[release.platform]:[];}
function artifactId(releaseId:string,tag:ReleaseTag){return `${releaseId}:artifact:${tag}`;}
function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className={`platform-badge platform-${platform}`}>{platform === 'web' ? <Monitor size={11} /> : platform === 'app' ? <Smartphone size={11} /> : platform === 'shared' ? <Layers3 size={11} /> : null}{PLATFORM_LABEL[platform]}</span>;
}
function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status}`}><i />{STATUS_LABEL[status]}</span>;
}
function TeamStatusBadge({status}:{status:TeamStatus}){return <span className={`team-status team-${status}`}><i />{TEAM_STATUS_LABEL[status]}</span>;}
function ClockText({ value }: { value: string }) {
  return <>{new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value))}</>;
}
function endOf(feature: Feature): string {
  return feature.stages.map(s => s.end).sort().at(-1) || '';
}
function stageTitle(stage: Stage) {
  return `${STAGE_LABEL[stage.kind]} · ${formatDate(stage.start)}${stage.end !== stage.start ? ` – ${formatDate(stage.end)}` : ''}${stage.note ? ` · ${stage.note}` : ''}${stage.tentative ? ' (Tentative)' : ''}`;
}
function releaseCountdown(release:Release,today:string){if(release.status==='deployed')return{tone:'complete',label:'Deployed แล้ว',date:release.date};if(!release.date)return{tone:'unknown',label:'ยังไม่ระบุวัน Release',date:null};const diff=daysBetween(today,release.date);if(diff>0)return{tone:'on-track',label:`เหลืออีก ${diff} วัน`,date:release.date};if(diff===0)return{tone:'due',label:'Release วันนี้',date:release.date};return{tone:'overdue',label:`ผ่านวัน Release ${Math.abs(diff)} วัน`,date:release.date};}
function featureDeployHealth(feature:Feature,today:string,fallbackDate?:string|null){const date=featureDate(feature)||fallbackDate||null;if(feature.status==='deployed')return{tone:'complete',label:'Deployed แล้ว',date};if(!date)return{tone:'unknown',label:'ยังไม่ระบุวัน Deploy',date:null};const diff=daysBetween(today,date);if(diff>0)return{tone:'on-track',label:`เหลืออีก ${diff} วัน`,date};if(diff===0)return{tone:'due',label:'Deploy วันนี้',date};return{tone:'overdue',label:`เกินกำหนด ${Math.abs(diff)} วัน`,date};}

export default function Dashboard({ initialData }: { initialData: TimelineData }) {
  const [data, setData] = useState(initialData);
  const [buildData, setBuildData] = useState<BuildData>({ latest: {}, history: {} });
  const [managedReleases,setManagedReleases]=useState<ManagedRelease[]>([]);
  const [managedFeatures,setManagedFeatures]=useState<ManagedFeature[]>([]);
  const [managedError,setManagedError]=useState('');
  const [managedLoaded,setManagedLoaded]=useState(false);
  const savedBuilds = useMemo(() => Object.fromEntries(Object.entries(buildData.latest).map(([id, record]) => [id, record.image])), [buildData.latest]);
  const [savedStatuses, setSavedStatuses] = useState<Record<string, ReleaseStatusRecord>>({});
  const mergedData = useMemo(() => mergeSavedReleaseStatuses(mergeSavedBuilds(mergeManagedReleases(data,managedReleases,managedFeatures), savedBuilds), savedStatuses), [data, managedReleases, managedFeatures, savedBuilds, savedStatuses]);
  const [buildsError, setBuildsError] = useState('');
  const [buildsLoaded, setBuildsLoaded] = useState(false);
  const [statusesError, setStatusesError] = useState('');
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await fetch('/api/builds', {cache:'no-store'}); if (!response.ok) throw new Error(); const values = await response.json() as BuildData; if(active){setBuildData(values);setBuildsLoaded(true);setBuildsError('');} }
      catch { if(active)setBuildsError('อ่าน Image / Build จาก Supabase ไม่สำเร็จ กรุณารีเฟรชก่อนแก้ข้อมูล'); }
    };
    void load();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);
    return ()=>{active=false;clearInterval(timer);};
  }, []);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch('/api/releases',{cache:'no-store'});if(!response.ok)throw new Error();const values=await response.json() as ManagedRelease[];if(active){setManagedReleases(values);setManagedLoaded(true);setManagedError('');}}catch{if(active)setManagedError('อ่าน Release ที่สร้างจากเว็บไม่สำเร็จ');}};void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch('/api/features',{cache:'no-store'});if(!response.ok)throw new Error();const values=await response.json() as ManagedFeature[];if(active)setManagedFeatures(values);}catch{if(active)setManagedError('อ่าน Feature ที่สร้างจากเว็บไม่สำเร็จ');}};void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const response = await fetch('/api/release-statuses', {cache:'no-store'}); if (!response.ok) throw new Error(); const values = await response.json() as Record<string, ReleaseStatusRecord>; if(active){setSavedStatuses(values);setStatusesLoaded(true);setStatusesError('');} }
      catch { if(active)setStatusesError('อ่านสถานะ Release จาก Supabase ไม่สำเร็จ กรุณารีเฟรชก่อนแก้สถานะ'); }
    };
    void load();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);
    return ()=>{active=false;clearInterval(timer);};
  }, []);
  const [view, setView] = useState<View>('timeline');
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [today, setToday] = useState(() => bangkokToday());
  const currentYear = Number(today.slice(0, 4));
  const years = [...new Set(mergedData.features.map(f => f.year))].sort((a, b) => b - a);
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
  const [releaseEditor,setReleaseEditor]=useState<ManagedRelease|null>(null);
  const [featureEditor,setFeatureEditor]=useState<ManagedFeature|null>(null);
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

  const filtered = useMemo(() => selectFeatures(mergedData.features, { view: 'all', today, platform, query, year: year === 'all' ? undefined : Number(year) }), [mergedData.features, today, platform, query, year]);
  const current = filtered.filter(f => f.status !== 'deployed');
  const datedPast = (f: Feature) => !!endOf(f) && endOf(f) < today;
  const focused = current.filter(f => includePast || !datedPast(f) || f.status !== 'unknown');
  const historyFeatures = historyMode === 'deployed' ? filtered.filter(f => f.status === 'deployed') : filtered.filter(datedPast);
  const assignedIds=new Set(managedReleases.filter(item=>!item.archived).flatMap(item=>item.members.filter(member=>member.sourceType!=='custom').map(member=>member.featureId)));
  const unassignedAll=mergedData.features.filter(feature=>!featureDate(feature)&&!assignedIds.has(feature.id)&&!feature.id.startsWith('custom:')&&!feature.id.startsWith('missing:'));
  const unassigned=unassignedAll.filter(feature=>{if(year!=='all'&&feature.year!==Number(year))return false;if(platform!=='all'&&feature.platform!==platform&&feature.platform!=='shared')return false;const text=query.toLowerCase().trim();return !text||[feature.title,feature.owner,feature.sheetTitle].join(' ').toLowerCase().includes(text);});
  const editorMemberIds=new Set(releaseEditor?.members.filter(member=>member.sourceType!=='custom').map(member=>member.featureId)||[]);
  const assignedReleaseByFeature=Object.fromEntries(managedReleases.filter(item=>!item.archived).flatMap(release=>release.members.filter(member=>member.sourceType!=='custom').map(member=>[member.featureId,release.name])));
  const managedMemberIds=new Set(Object.keys(assignedReleaseByFeature));
  const releaseFeatureOptions=[...unassignedAll,...mergedData.features.filter(feature=>(editorMemberIds.has(feature.id)||managedMemberIds.has(feature.id))&&!unassignedAll.some(item=>item.id===feature.id))];
  const shown = view === 'history' ? historyFeatures : view==='unassigned'?unassigned:focused;
  const shownIds = new Set(shown.map(f => f.id));
  const activeManagedIds=new Set(managedReleases.filter(item=>!item.archived).map(item=>item.id));
  const relevantReleases = mergedData.releases.filter(r => (r.date||activeManagedIds.has(r.id))&&r.features.some(f => shownIds.has(f.id)));
  const filteredIds = new Set(filtered.map(f => f.id));
  const filteredReleases = mergedData.releases.filter(r => (r.date||activeManagedIds.has(r.id))&&r.features.some(f => filteredIds.has(f.id)));
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
  function showFeature(feature: Feature) { const managed=managedFeatures.find(item=>item.id===feature.id);if(managed){setSelected(null);setFeatureEditor(managed);return;}setSelected(feature); }
  function resetFilters() { setQuery(''); setPlatform('all'); setYear(view === 'history' ? 'all' : String(currentYear)); }
  function editRelease(release:Release){setSelected(null);const existing=managedReleases.find(item=>item.id===release.id);if(existing){setReleaseEditor(existing);return;}setReleaseEditor({id:release.id,origin:'sheet_override',name:release.name,version:release.features[0]?.version||'',releaseDate:release.date||'',stream:release.stream,platform:release.platform,tags:tagsForRelease(release),description:'',archived:false,members:release.features.map((feature,index)=>({id:'',releaseId:release.id,sourceType:'sheet',featureId:feature.id,title:'',platform:feature.platform,owner:'',devStart:'',devEnd:'',qaStart:'',qaEnd:'',note:'',sortOrder:index}))});}
  function addRelease(){const id=`manual:${crypto.randomUUID()}`;setReleaseEditor({id,origin:'manual',name:'',version:'',releaseDate:'',stream:'',platform:'unknown',tags:[],description:'',archived:false,members:[]});}
  function addFeature(){const now=new Date().toISOString();setFeatureEditor({id:`managed:${crypto.randomUUID()}`,title:'',platform:'unknown',status:'unknown',owner:'',devStart:'',devEnd:'',qaStart:'',qaEnd:'',note:'',archived:false,createdAt:now,updatedAt:now});}

  return <div className="app-shell">
    {mobileNav && <button className="nav-scrim" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a href="/" className="brand" aria-label="Release room หน้าแรก"><span className="brand-mark"><Layers3 size={23} strokeWidth={2.1} /></span><span>release<span className="brand-light">room</span><small>FRONTEND WORKSPACE</small></span></a>
      <div className="workspace"><span className="workspace-avatar">FE</span><span><b>Frontend team</b><small>App & Web development</small></span><ChevronDown size={14} /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="เมนูหลัก">
        <button className={view === 'timeline' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('timeline')}><CalendarDays size={18} /><span>Timeline</span><span className="nav-count">{focused.length}</span></button>
        <button className={view === 'releases' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('releases')}><Rocket size={18} /><span>Release board</span></button>
        <button className={view === 'unassigned' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('unassigned')}><ListFilter size={18} /><span>Unassigned features</span><span className="nav-count">{unassigned.length}</span></button>
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
        <div className="page-heading"><div><div className="eyebrow"><span /> ONE PLAN. EVERY RELEASE.</div><h1>{view === 'history' ? 'Release history' : view === 'releases' ? 'Release board' : view==='unassigned'?'Unassigned features':'FE release timeline'}<span className="year-pill">{year === 'all' ? 'ALL YEARS' : year}</span></h1><p>{view === 'history' ? 'ย้อนดูแผนที่ผ่านมา และรอบที่ทีมยืนยันว่า deploy แล้ว' : view==='unassigned'?'รวมงานที่ยังไม่มีวัน Deploy/Release และยังไม่ได้ถูกเลือกเข้ารอบ':'เห็นแผนเดียวกัน ตั้งแต่เริ่มพัฒนา จนถึงวันที่ปล่อย App และ Web'}</p></div><a className="sheet-button" href={data.source.url} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิดต้นฉบับ Sheet<ArrowUpRight size={15} /></a></div>
        <div className="sync-line"><span className={`live-dot ${data.source.mode === 'live' ? '' : 'warning-dot'}`} /><b>{data.source.mode === 'live' ? 'เชื่อมต่อ Google Sheets แล้ว' : data.source.mode === 'cached' ? 'ข้อมูลที่อ่านสำเร็จล่าสุด' : 'สำเนาข้อมูลจาก Sheet'}</b><span className="sync-dot">·</span><span>อัปเดต <ClockText value={data.source.fetchedAt} /> น.</span><button onClick={() => void refresh(true)} disabled={refreshing} className="refresh-link"><RefreshCw size={12} className={refreshing ? 'spin' : ''} />{refreshing ? 'กำลังอัปเดต' : 'รีเฟรช'}</button></div>
        {buildsError && <div className="warning-banner" role="alert">{buildsError}<button onClick={() => window.location.reload()}>รีเฟรช</button></div>}
        {statusesError && <div className="warning-banner" role="alert">{statusesError}<button onClick={() => window.location.reload()}>รีเฟรช</button></div>}
        {managedError && <div className="warning-banner" role="alert">{managedError}<button onClick={() => window.location.reload()}>รีเฟรช</button></div>}
        {(refreshError || data.source.warning) && <div className="warning-banner" role="status"><Clock3 size={16} />{refreshError || data.source.warning}</div>}

        <section className="metrics" aria-label="ภาพรวมแผนงาน">
          <Metric label="งานในแผนปัจจุบัน" value={focused.length} unit="งาน" icon={<Layers3 size={19} />} detail="รวม App และ Web" tone="blue" />
          <Metric label="กำลังดำเนินการตามแผน" value={inProgress.length} unit="งาน" icon={<Timer size={19} />} detail="มีช่วงงานครอบคลุมวันนี้" tone="purple" />
          <Metric label="รอบ release ถัดไป" value={upcoming.length} unit="รอบ" icon={<Rocket size={19} />} detail={nextRelease?.date ? `ใกล้ที่สุด ${formatDate(nextRelease.date)}` : 'รอกำหนดวันในชีต'} tone="orange" />
          <Metric label="พร้อมส่งต่อให้ SA" value={ready.length} unit="รอบ" icon={<CheckCheck size={19} />} detail="สถานะ Done ที่ยืนยันในชีต" tone="green" />
        </section>

        {(view === 'timeline'||view === 'releases') && nextRelease && <section className="next-release"><div className="next-release-icon"><Rocket size={22} /></div><div className="next-release-copy"><div className="section-eyebrow">NEXT ON THE CALENDAR <span>ตามแผนใน Sheet</span></div><h2>{formatDate(nextRelease.date, true)}<span>·</span>{nextRelease.features.length} {nextRelease.features.length > 1 ? 'features' : 'feature'}</h2><p>{nextRelease.features.map(f => f.title).join(' · ')}</p></div><div className="next-release-right"><span className="countdown">อีก {daysBetween(today, nextRelease.date!)} วัน</span><button onClick={() => setSelected(nextRelease)}>ดูรอบ release<ArrowRight size={15} /></button></div></section>}

        <section className="planning-section">
          <div className="section-top"><div className="view-tabs" role="tablist" aria-label="มุมมองแผนงาน"><button role="tab" aria-selected={view === 'timeline'} onClick={() => navigate('timeline')} className={view === 'timeline' ? 'selected' : ''}><CalendarDays size={16} />Timeline</button><button role="tab" aria-selected={view === 'releases'} onClick={() => navigate('releases')} className={view === 'releases' ? 'selected' : ''}><LayoutGrid size={16} />Releases</button><button role="tab" aria-selected={view === 'unassigned'} onClick={() => navigate('unassigned')} className={view === 'unassigned' ? 'selected' : ''}><ListFilter size={16} />Unassigned</button><button role="tab" aria-selected={view === 'history'} onClick={() => navigate('history')} className={view === 'history' ? 'selected' : ''}><History size={16} />History</button></div><span className="section-counter">{shown.length} งาน{view !== 'releases' ? 'ในมุมมองนี้' : ` · ${relevantReleases.length} รอบ`}</span>{view==='releases'&&<button className="add-release-button" disabled={!managedLoaded} onClick={addRelease}><Plus size={14}/>เพิ่ม Release</button>}{view==='unassigned'&&<button className="add-release-button" onClick={addFeature}><Plus size={14}/>เพิ่ม Feature</button>}</div>
          <div className="filters"><label className="search-input"><Search size={16} /><input aria-label="ค้นหางานหรือ release" placeholder="ค้นหางาน หรือ release..." value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="ล้างคำค้นหา" onClick={() => setQuery('')}><X size={13} /></button>}</label><span className="filter-divider" /><div className="platform-filters" aria-label="กรอง platform">{[['all', 'ทั้งหมด'], ['web', 'Web'], ['app', 'App']].map(([value, label]) => <button key={value} aria-pressed={platform === value} className={platform === value ? 'selected' : ''} onClick={() => setPlatform(value)}>{value === 'web' ? <Monitor size={13} /> : value === 'app' ? <Smartphone size={13} /> : null}{label}</button>)}</div><div className="filter-spacer" /><label className="select-wrap"><CalendarDays size={14} /><select aria-label="เลือกปีแผน" value={year} onChange={e => setYear(e.target.value)}><option value="all">ทุกปี</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown size={13} /></label>{view !== 'history' && <button className={`filter-toggle ${includePast ? 'selected' : ''}`} onClick={() => setIncludePast(!includePast)} aria-pressed={includePast}><ListFilter size={14} />รวมแผนที่ผ่านมา</button>}</div>

          {view === 'history' && <div className="history-controls"><div className="segmented"><button className={historyMode === 'plans' ? 'selected' : ''} onClick={() => setHistoryMode('plans')}>แผนที่ผ่านมา</button><button className={historyMode === 'deployed' ? 'selected' : ''} onClick={() => setHistoryMode('deployed')}>ยืนยัน Deployed แล้ว</button></div><p>{historyMode === 'plans' ? 'วันที่ตามแผนผ่านไปแล้ว ยังไม่ถือว่า deploy สำเร็จจนกว่าทีมจะยืนยัน' : 'แสดงเฉพาะงานที่มีสถานะ Deployed หรือ Released ในชีต'}</p></div>}

          {view === 'timeline' && <><div className="timeline-toolbar"><div className="date-navigator"><button className="icon-button" aria-label="ช่วงก่อนหน้า" onClick={() => setAnchor(addDays(anchor, -28))}><ChevronLeft size={16} /></button><span>{formatDate(anchor)} – {formatDate(addDays(anchor, weeks * 7 - 1), true)}</span><button className="icon-button" aria-label="ช่วงถัดไป" onClick={() => setAnchor(addDays(anchor, 28))}><ChevronRight size={16} /></button><button className="today-button" onClick={() => setAnchor(addDays(monday(today), -7))}>วันนี้</button></div><div className="timeline-controls"><div className="legend">{LEGEND.filter(k => k !== 'integration').map(kind => <span key={kind}><i className={`legend-dot ${kind}`} />{kind === 'dev' ? 'Dev FE' : kind === 'production' ? 'Deploy' : kind === 'release' ? 'Release' : STAGE_LABEL[kind]}</span>)}</div><select aria-label="จำนวนสัปดาห์ที่แสดง" value={weeks} onChange={e => setWeeks(Number(e.target.value))}><option value={4}>4 สัปดาห์</option><option value={8}>8 สัปดาห์</option><option value={12}>12 สัปดาห์</option></select></div></div><Timeline features={shown} anchor={anchor} weeks={weeks} today={today} onSelect={showFeature} /></>}
          {view === 'releases' && <div className="release-grid">{relevantReleases.map(release => <ReleaseCard key={release.id} release={release} all={mergedData.releases} buildData={buildData} operational={savedStatuses[release.id]||EMPTY_RELEASE_STATUS} today={today} onOpen={() => setSelected(release)} onCopy={copyImage} />)}</div>}
          {view === 'unassigned' && <div className="unassigned-list">{unassigned.map(feature=><button key={feature.id} className="unassigned-row" onClick={()=>{const managed=managedFeatures.find(item=>item.id===feature.id);if(managed)setFeatureEditor(managed);else setSelected(feature);}}><span className="unassigned-icon">{feature.sheetId>0?<FileSpreadsheet size={16}/>:<Layers3 size={16}/>}</span><span className="unassigned-copy"><b>{feature.title}</b><small><span className={`source-badge ${feature.sheetId>0?'from-sheet':'web-added'}`}>{feature.sheetId>0?'From Sheet':'Web added'}</span>{feature.owner||'ยังไม่ระบุ Owner'}</small></span><PlatformBadge platform={feature.platform}/><span className="unassigned-state">ยังไม่มีรอบ Release</span><ChevronRight size={16}/></button>)}</div>}
          {view === 'history' && <div className="history-list">{historyFeatures.map(feature => <button key={feature.id} className="history-row" onClick={() => showFeature(feature)}><span className="history-icon"><History size={17} /></span><span className="history-name"><b>{feature.title}</b><small>{feature.sheetTitle} · {feature.version || 'ยังไม่ระบุ version'}</small></span><PlatformBadge platform={feature.platform} /><span className="history-date">{formatDate(featureDate(feature) || endOf(feature), true)}</span><StatusBadge status={feature.status} /><ChevronRight size={16} /></button>)}</div>}
          {!shown.length && <div className="empty-state"><span><Search size={25} /></span><h3>{view === 'history' && historyMode === 'deployed' ? 'ยังไม่มีการยืนยัน Deployed ในชีต' : 'ไม่พบงานในมุมมองนี้'}</h3><p>{view === 'history' && historyMode === 'deployed' ? 'เมื่อทีมระบุสถานะแล้ว งานจะแสดงเป็นประวัติที่นี่' : 'ลองเปลี่ยนตัวกรอง หรือเปิดดูแผนที่ผ่านมา'}</p><button onClick={resetFilters}>ล้างตัวกรอง</button></div>}
          <div className="table-footer"><span><FileSpreadsheet size={13} />ข้อมูลจาก {year === 'all' ? 'Project timeline ทุกปี' : `Project timeline ${year}`}</span><span>คลิกที่งานเพื่อดูรายละเอียด <ArrowUpRight size={12} /></span></div>
        </section>

        {view !== 'history' && pending > 0 && <div className="data-note"><span className="data-note-icon"><CircleHelp size={17} /></span><div><b>วันที่ในแผน กับสถานะจริง เป็นคนละเรื่องกัน</b><p>มี {pending} งานที่ชีตยังไม่ระบุสถานะรอบ release · เว็บจะไม่ถือว่า Done หรือ Deployed จากวันที่ที่ผ่านไป</p></div><button onClick={() => setHelp(true)}>วิธีระบุสถานะ<ArrowUpRight size={14} /></button></div>}
        <footer className="page-footer"><span>Release room<span>·</span>One source of truth for your team.</span><span><span className="live-dot" />Google Sheets เป็นข้อมูลหลัก</span></footer>
      </main>
    </div>
    {selected && <DetailDrawer selected={('features' in selected ? mergedData.releases.find(item => item.id === selected.id) : mergedData.features.find(item => item.id === selected.id)) || selected} all={mergedData.releases} managed={managedReleases.find(item=>item.id===selected.id)} onEdit={editRelease} onClose={() => setSelected(null)} onCopy={copyImage} onFeature={showFeature} buildsLoaded={buildsLoaded} buildData={buildData} onSaved={(record) => setBuildData(values => ({ latest: {...values.latest, [record.recordId]: record}, history: {...values.history, [record.recordId]: [record, ...(values.history[record.recordId] || [])]} }))} statusesLoaded={statusesLoaded} operational={savedStatuses[selected.id]||EMPTY_RELEASE_STATUS} today={today} onStatusSaved={(id, status) => setSavedStatuses(values => ({...values, [id]:status}))} />}
    {releaseEditor&&<ReleaseEditor value={releaseEditor} availableFeatures={releaseFeatureOptions} assignments={assignedReleaseByFeature} onClose={()=>setReleaseEditor(null)} onSaved={saved=>{const movedIds=new Set(saved.members.filter(member=>member.sourceType!=='custom').map(member=>member.featureId));setManagedReleases(values=>[saved,...values.filter(item=>item.id!==saved.id).map(item=>({...item,members:item.members.filter(member=>member.sourceType==='custom'||!movedIds.has(member.featureId))}))]);setReleaseEditor(null);setSelected(null);setToast(saved.archived?'Archive Release แล้ว':'บันทึก Release แล้ว');}}/>}
    {featureEditor&&<ManagedFeatureEditor value={featureEditor} onClose={()=>setFeatureEditor(null)} onSaved={saved=>{setManagedFeatures(values=>[saved,...values.filter(item=>item.id!==saved.id)]);setFeatureEditor(null);setToast(saved.archived?'Archive Feature แล้ว':'บันทึก Feature แล้ว');}}/>}
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

function ReleaseCard({ release, all, buildData, operational, today, onOpen, onCopy }: { release: Release; all: Release[]; buildData:BuildData; operational:ReleaseStatusRecord; today:string; onOpen: () => void; onCopy: (text: string) => void }) {
  const readiness = canStartMerge(release, all);
  const tags=tagsForRelease(release);
  const legacy=buildData.latest[release.id]||(release.images[0]?{recordId:release.id,image:release.images[0],comment:'',updatedAt:''}:undefined);
  const artifacts=tags.map((tag,index)=>({tag,record:buildData.latest[artifactId(release.id,tag)]||(index===0?legacy:undefined)}));
  const latest = artifacts.find(item=>item.record)?.record.image||release.images[0];
  const health=releaseCountdown(release,today);
  return <article className="release-card"><button className="release-card-main" onClick={onOpen}><div className="release-card-top"><span className="release-package"><Package size={19} /></span><span className="release-confirmed"><small>RELEASE</small><StatusBadge status={release.status} /></span></div><div className="release-tag-list">{tags.map(tag=><span key={tag}>{RELEASE_TAG_LABEL[tag]}</span>)}</div><span className="release-type">{release.explicit ? 'RELEASE ROUND' : 'GROUPED BY SHEET PLAN'}</span><h3>{release.name}</h3><div className="release-date"><CalendarDays size={14} />{formatDate(release.date, true)}</div><div className="release-features">{release.features.slice(0, 3).map(f => <span key={f.id}><i />{f.title}</span>)}{release.features.length > 3 && <small>+ อีก {release.features.length - 3} งาน</small>}</div><div className="operational-grid"><span><small>BE</small><TeamStatusBadge status={operational.beStatus}/></span><span><small>FE</small><TeamStatusBadge status={operational.feStatus}/></span><span><small>QA</small><TeamStatusBadge status={operational.qaStatus}/></span><span><small>ARTIFACTS</small><b className={latest?'value-ready':'value-missing'}>{artifacts.filter(item=>item.record).length}/{tags.length||1}</b></span><span className="timeline-health-row"><small>RELEASE DATE</small><b className={`health-${health.tone}`}>{health.label}</b></span></div></button><div className="release-artifacts">{tags.length?artifacts.map(({tag,record})=><div className={`release-image ${record?'has-image':''}`} key={tag}><b>{RELEASE_TAG_LABEL[tag]}</b><code>{record?.image||(tag==='app'?'ยังไม่มี App version/build':'ยังไม่มีเลข image')}</code>{record&&<button className="card-copy" aria-label={`คัดลอก ${record.image}`} onClick={()=>void onCopy(record.image)}><Copy size={14}/></button>}</div>):<div className={`release-image ${latest?'has-image':''}`}><Package size={13}/><code>{latest||'ยังไม่ได้เลือก Tag'}</code>{latest&&<button className="card-copy" aria-label={`คัดลอก ${latest}`} onClick={()=>void onCopy(latest)}><Copy size={14}/></button>}</div>}</div><button className={`readiness ${readiness.allowed === true ? 'ready' : ''}`} onClick={onOpen}><GitBranch size={13} /><span>{readiness.reason}</span><ChevronRight size={14} /></button></article>;
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
        const els = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]');
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

function DetailDrawer({ selected, all, managed, onEdit, onClose, onCopy, onFeature, buildsLoaded, buildData, onSaved, statusesLoaded, operational, today, onStatusSaved }: { selected: Feature | Release; all: Release[]; managed?:ManagedRelease; onEdit:(release:Release)=>void; onClose: () => void; onCopy: (text: string) => void; onFeature: (feature: Feature) => void; buildsLoaded: boolean; buildData: BuildData; onSaved: (record: BuildRecord) => void; statusesLoaded:boolean; operational:ReleaseStatusRecord; today:string; onStatusSaved:(id:string,status:ReleaseStatusRecord)=>void }) {
  const isRelease = 'features' in selected;
  const latest = buildData.latest[selected.id];
  const releaseTags = isRelease ? tagsForRelease(selected) : [];
  const artifactRecords = releaseTags.map(tag=>({tag,id:artifactId(selected.id,tag),latest:buildData.latest[artifactId(selected.id,tag)],history:buildData.history[artifactId(selected.id,tag)]||[]}));
  const artifactImages = artifactRecords.flatMap(item=>item.latest?.image?[item.latest.image]:[]);
  const images = isRelease ? (artifactImages.length?artifactImages:latest?[latest.image]:selected.images) : latest?[latest.image]:selected.image?[selected.image]:[];
  const history = buildData.history[selected.id] || [];
  const release = isRelease ? selected : all.find(r => r.features.some(f => f.id === selected.id));
  const feature = isRelease ? null : selected;
  const readiness = release ? canStartMerge(release, all) : null;
  const health = release ? releaseCountdown(release,today) : null;
  return <DrawerShell onClose={onClose} label={isRelease ? 'Release details' : 'Feature details'}><div className="drawer-content"><div className="detail-badges"><PlatformBadge platform={selected.platform} />{isRelease&&releaseTags.map(tag=><span className="release-tag" key={tag}>{RELEASE_TAG_LABEL[tag]}</span>)}<StatusBadge status={selected.status} />{isRelease&&<span className={`source-badge ${managed?.origin==='manual'?'web-added':managed?'web-edited':'from-sheet'}`}>{managed?.origin==='manual'?'Web added':managed?'Edited in Release room':'From Sheet'}</span>}</div><div className="detail-title-row"><h2>{isRelease ? selected.name : selected.title}</h2>{isRelease&&<button className="edit-release-button" onClick={()=>onEdit(selected)}><Pencil size={14}/>แก้ไข</button>}</div><p className="detail-subtitle">{isRelease ? `${selected.features.length} งานในรอบนี้ · ${formatDate(selected.date, true)}` : `${selected.sheetTitle} · แถว ${selected.sourceRow}`}</p>{managed?.description&&<p className="release-description">{managed.description}</p>}
    <div className="detail-callout"><CircleHelp size={17} /><p>Done = merge ครบและเทสผ่าน<br />Deployed = ยืนยันว่าปล่อย production แล้ว</p></div>
    {isRelease && <><h3>สถานะยืนยันของ Release และทีม</h3><ReleaseStatusEditor releaseId={selected.id} initial={{...operational,releaseStatus:selected.status}} disabled={!statusesLoaded} onSaved={onStatusSaved} /><h3>สถานะระบบแยกตามข้อมูล</h3><div className="status-summary"><div><span>Release</span><StatusBadge status={selected.status}/><small>Release Owner / SA ยืนยัน</small></div><div><span>Dev BE</span><TeamStatusBadge status={operational.beStatus}/><small>BE Owner อัปเดต</small></div><div><span>Dev FE</span><TeamStatusBadge status={operational.feStatus}/><small>FE Owner อัปเดต</small></div><div><span>QA</span><TeamStatusBadge status={operational.qaStatus}/><small>QA Owner อัปเดต</small></div><div><span>Image / Build</span><b className={images.length?'value-ready':'value-missing'}>{images.length?'มีแล้ว':'ยังไม่มี'}</b><small>อ่านค่าล่าสุดจาก Supabase</small></div><div><span>Release countdown</span><b className={`health-${health?.tone}`}>{health?.label}</b><small>{health?.date?`วัน Release ${formatDate(health.date,true)}`:'ยังไม่ระบุวัน Release'}</small></div></div></>}
    <h3>Release information</h3><dl className="detail-fields"><div><dt>รอบ / Version</dt><dd>{release?.name || 'ยังไม่ระบุ'}</dd></div><div><dt>วัน release ตามแผน</dt><dd>{formatDate(isRelease ? selected.date : featureDate(selected), true)}</dd></div><div><dt>Stream</dt><dd>{selected.stream || 'ยังไม่ระบุ'}</dd></div>{feature && <div><dt>ผู้รับผิดชอบ</dt><dd>{feature.owner || 'ยังไม่ระบุ'}</dd></div>}<div><dt>{isRelease ? 'สถานะล่าสุด' : 'สถานะในชีต'}</dt><dd><StatusBadge status={selected.status} /></dd></div></dl>
    <h3>{isRelease?'เลขส่งมอบแยกตาม Tag':'Image / App build'}</h3>{isRelease?<div className="artifact-editors">{artifactRecords.map((item,index)=>{const legacy=index===0?latest:undefined;const initial=item.latest?.image??legacy?.image??(index===0?selected.images[0]||'':'');return <section className="artifact-editor" key={item.tag}><div className="artifact-editor-title"><span className="release-tag">{RELEASE_TAG_LABEL[item.tag]}</span><b>{item.tag==='app'?'App version / build':'เลข Image'}</b></div><BuildEditor label={item.tag==='app'?'App version / build':`${RELEASE_TAG_LABEL[item.tag]} image`} disabled={!buildsLoaded} id={item.id} initial={initial} onSaved={onSaved}/>{(item.latest||legacy)&&<LatestArtifact record={(item.latest||legacy)!} onCopy={onCopy}/>}<BuildHistory records={item.history} onCopy={onCopy}/></section>})}{!releaseTags.length&&<div className="missing-image"><Package size={21}/><b>ยังไม่ได้เลือก Tag ของ Release</b><p>กดแก้ไข Release แล้วเลือก Web, App หรือ BE ก่อน</p></div>}</div>:<><BuildEditor disabled={!buildsLoaded} id={selected.id} initial={latest?.image??selected.image} onSaved={onSaved}/>{latest&&<LatestArtifact record={latest} onCopy={onCopy}/>}<BuildHistory records={history} onCopy={onCopy}/></>}
    {readiness && <div className={`merge-info ${readiness.allowed ? 'ready' : ''}`}><GitBranch size={17} /><div><b>การเริ่ม merge รอบถัดไป</b><p>{readiness.reason}</p></div></div>}
    {isRelease && <><h3>งานในรอบ release <span>{selected.features.length}</span></h3><div className="detail-feature-list">{selected.features.map(f => {const deploy=featureDeployHealth(f,today,selected.date);return <button key={f.id} onClick={() => onFeature(f)}><div><b>{f.title}</b><span><PlatformBadge platform={f.platform}/><small className={`feature-health health-${deploy.tone}`}>{deploy.label}</small></span></div><ChevronRight size={16}/></button>})}</div>{!selected.explicit && <p className="small-note">จัดกลุ่มจาก version และวัน release ในชีต ยังไม่ใช่รอบที่ทีมระบุ Release ID โดยตรง</p>}</>}
    {feature && <><h3>Timeline ของงาน</h3>{feature.stages.length ? <div className="stage-list">{feature.stages.map((s, i) => <div key={i}><span className={`stage-node ${s.kind}`} /><div><b>{STAGE_LABEL[s.kind]}{s.tentative && <span className="tentative-label">Tentative</span>}</b><p>{formatDate(s.start, true)}{s.end !== s.start && ` – ${formatDate(s.end, true)}`}</p>{s.note && <small>{s.note}</small>}</div></div>)}</div> : <p className="small-note">ยังไม่ได้ระบุวันที่ของงานนี้</p>}{feature.notes.map((n, i) => <p className="small-note" key={i}>{n}</p>)}{feature.platformInferred && <p className="small-note">Platform อ่านจากชื่องานและวันที่ App release ที่กรอกไว้ หากไม่มีข้อมูลจะคงเป็น “ยังไม่ระบุ”</p>}{feature.sheetId>0?<a className="source-detail-link" href={sourceLink(feature)} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิดแถวต้นฉบับใน Sheet<ExternalLink size={14} /></a>:<p className="small-note">งานนี้เพิ่มจาก Release room และไม่มีการเขียนกลับ Google Sheet</p>}</>}
  </div></DrawerShell>;
}

function HelpDrawer({ onClose, sourceUrl }: { onClose: () => void; sourceUrl: string }) {
  return <DrawerShell label="วิธีใช้ Release room" onClose={onClose}><div className="drawer-content"><span className="help-hero"><FileSpreadsheet size={28} /></span><h2>แก้ที่ Sheet<br />เห็นแผนเดียวกันที่นี่</h2><p className="detail-subtitle">เว็บอ่านข้อมูลอย่างเดียว และไม่ merge หรือ deploy โค้ดให้ทีม</p><h3>สถานะของแต่ละรอบ</h3><div className="status-guide">{(['planned', 'merging', 'testing', 'done', 'deployed'] as Status[]).map((s, i) => <div key={s}><span>{i + 1}</span><div><StatusBadge status={s} /><p>{({ planned: 'กำหนดงานที่จะเอาเข้ารอบแล้ว', merging: 'ผู้รับผิดชอบกำลังรวมโค้ด', testing: 'มี build ให้ทีมทดสอบ', done: 'รวมโค้ดครบและเทสผ่าน เริ่ม merge รอบถัดไปใน stream เดียวกันได้', deployed: 'SA ยืนยันว่า deploy production แล้ว ย้ายไปประวัติ' } as Record<string, string>)[s]}</p></div></div>)}</div><h3>ใช้รูปแบบชีตเดิมได้</h3><p className="guide-text">แถบสีและข้อความในปฏิทินใช้แสดงวันตามแผน หากต้องการระบุรอบ สถานะ และ image ให้เพิ่ม Note ที่เซลล์ชื่องาน โดยไม่ต้องเพิ่มแท็บ:</p><pre className="metadata-example">{'release: Release 1\nstream: web-main\nstatus: Done\nimage: web:release-001\nplatform: web\nowner: ชื่อผู้รับผิดชอบ'}</pre><p className="small-note">ตัวอย่างรูปแบบเท่านั้น ไม่ใช่สถานะหรือ image จริง ทุกงานในรอบต้องใช้ release และ stream เดียวกัน และ Done ครบทุกงานก่อนเว็บจะแสดงว่ารอบถัดไปเริ่ม merge ได้ ลำดับรอบอ่านจากตำแหน่งในชีต</p><h3>ข้อมูลเก่าดูที่ไหน</h3><p className="guide-text">History แยก “แผนที่ผ่านมา” ออกจาก “ยืนยัน Deployed แล้ว” วันที่ผ่านไปหรือคำว่า Done ในชื่องานจะไม่ถูกตีความเป็นการ deploy</p><a className="source-detail-link" href={sourceUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิด Google Sheet<ExternalLink size={14} /></a></div></DrawerShell>;
}

function ReleaseStatusEditor({releaseId, initial, disabled, onSaved}: {releaseId:string; initial:ReleaseStatusRecord; disabled:boolean; onSaved:(id:string,status:ReleaseStatusRecord)=>void}) {
  const [value,setValue]=useState(initial);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>setValue(initial),[initial]);
  async function save(){
    if(disabled || saving || value===initial)return;
    setSaving(true);setMessage('');
    try{const response=await fetch('/api/release-statuses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({releaseId,...value})});if(!response.ok)throw new Error();onSaved(releaseId,value);setMessage('บันทึกสถานะแล้ว · การ์ดอัปเดตทันที');}
    catch{setMessage('บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่');setValue(initial);}finally{setSaving(false);}
  }
  const releaseOptions:Status[]=['unknown','planned','merging','testing','done','deployed'];
  const workOptions:TeamStatus[]=['unknown','not_started','in_progress','done','blocked'];
  const qaOptions:TeamStatus[]=['unknown','not_started','testing','passed','failed','blocked'];
  const changed=JSON.stringify(value)!==JSON.stringify(initial);
  const field=(label:string,key:'beStatus'|'feStatus'|'qaStatus',options:TeamStatus[])=><label><span>{label}</span><div className="status-select-wrap"><TeamStatusBadge status={value[key]}/><select aria-label={`เลือกสถานะ ${label}`} value={value[key]} disabled={disabled||saving} onChange={event=>setValue(current=>({...current,[key]:event.target.value as TeamStatus}))}>{options.map(status=><option key={status} value={status}>{TEAM_STATUS_LABEL[status]}</option>)}</select><ChevronDown size={15}/></div></label>;
  return <div className="release-status-editor"><label><span>Release</span><div className="status-select-wrap"><StatusBadge status={value.releaseStatus}/><select aria-label="เลือกสถานะ Release" value={value.releaseStatus} disabled={disabled||saving} onChange={event=>setValue(current=>({...current,releaseStatus:event.target.value as Status}))}>{releaseOptions.map(status=><option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select><ChevronDown size={15}/></div></label>{field('Dev BE','beStatus',workOptions)}{field('Dev FE','feStatus',workOptions)}{field('QA','qaStatus',qaOptions)}<button className="primary-button" disabled={disabled||saving||!changed} onClick={()=>void save()}>{disabled?'กำลังอ่านสถานะ...':saving?'กำลังบันทึก...':'บันทึกทุกสถานะ'}</button><p role="status">{message}</p><small>สถานะแต่ละส่วนเก็บแยกกันใน Supabase และไม่แก้ Google Sheet</small></div>;
}

function ReleaseEditor({value,availableFeatures,assignments,onClose,onSaved}:{value:ManagedRelease;availableFeatures:Feature[];assignments:Record<string,string>;onClose:()=>void;onSaved:(value:ManagedRelease)=>void}){
 const [draft,setDraft]=useState(value);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');
 const selected=new Set(draft.members.filter(item=>item.sourceType!=='custom').map(item=>item.featureId));
 const custom=draft.members.filter(item=>item.sourceType==='custom');
 function set<K extends keyof ManagedRelease>(key:K,next:ManagedRelease[K]){setDraft(current=>({...current,[key]:next}));}
 function toggleFeature(feature:Feature){setDraft(current=>{const exists=current.members.some(item=>item.sourceType!=='custom'&&item.featureId===feature.id);const members=exists?current.members.filter(item=>item.sourceType==='custom'||item.featureId!==feature.id):[...current.members,{id:'',releaseId:current.id,sourceType:(feature.sheetId>0?'sheet':'managed') as 'sheet'|'managed',featureId:feature.id,title:'',platform:feature.platform,owner:'',devStart:'',devEnd:'',qaStart:'',qaEnd:'',note:'',sortOrder:current.members.length}];return{...current,members};});}
 function moveFeature(feature:Feature){const source=assignments[feature.id];if(!source||!window.confirm(`ย้าย “${feature.title}” จาก ${source} มา ${draft.name||'Release นี้'} ใช่หรือไม่?`))return;toggleFeature(feature);}
 function addCustom(){const item:ManagedReleaseMember={id:crypto.randomUUID(),releaseId:draft.id,sourceType:'custom',featureId:'',title:'',platform:'unknown',owner:'',devStart:'',devEnd:'',qaStart:'',qaEnd:'',note:'',sortOrder:draft.members.length};setDraft(current=>({...current,members:[...current.members,item]}));}
 function updateCustom(id:string,values:Partial<ManagedReleaseMember>){setDraft(current=>({...current,members:current.members.map(item=>item.id===id?{...item,...values}:item)}));}
 function toggleTag(tag:ReleaseTag){set('tags',draft.tags.includes(tag)?draft.tags.filter(item=>item!==tag):[...draft.tags,tag]);}
 async function save(next=draft){if(saving||!next.name.trim())return;setSaving(true);setMessage('');try{const response=await fetch('/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error);}onSaved(await response.json() as ManagedRelease);}catch(error){setMessage(error instanceof Error&&error.message?error.message:'บันทึก Release ไม่สำเร็จ');}finally{setSaving(false);}}
 return <DrawerShell onClose={onClose} label={draft.origin==='manual'?'เพิ่ม Release':'แก้ไข Release'}><div className="drawer-content release-editor"><div className="editor-heading"><div><span className={`source-badge ${draft.origin==='manual'?'web-added':'web-edited'}`}>{draft.origin==='manual'?'Web added':'Edited in Release room'}</span><h2>{draft.origin==='manual'?'สร้าง Release ใหม่':'แก้ไขข้อมูล Release'}</h2></div></div><div className="release-form-grid"><label><span>ชื่อ Release *</span><input value={draft.name} maxLength={200} onChange={event=>set('name',event.target.value)} placeholder="เช่น Release 1"/></label><label><span>Version</span><input value={draft.version} maxLength={150} onChange={event=>set('version',event.target.value)} placeholder="เช่น 11.2.0"/></label><label><span>วันที่ Release</span><input type="date" value={draft.releaseDate} onChange={event=>set('releaseDate',event.target.value)}/></label><label><span>Stream</span><input value={draft.stream} maxLength={150} onChange={event=>set('stream',event.target.value)} placeholder="เช่น web-main"/></label><label><span>Platform ของงาน</span><select value={draft.platform} onChange={event=>set('platform',event.target.value as Platform)}><option value="unknown">ยังไม่ระบุ</option><option value="web">Web</option><option value="app">App</option><option value="shared">App + Web</option></select></label><fieldset className="release-tag-field"><legend>Release tags * <small>เลือกได้มากกว่า 1</small></legend><div className="release-tag-picker">{(['web','app','be'] as ReleaseTag[]).map(tag=><label className={draft.tags.includes(tag)?'selected':''} key={tag}><input type="checkbox" checked={draft.tags.includes(tag)} onChange={()=>toggleTag(tag)}/><span>{RELEASE_TAG_LABEL[tag]}</span></label>)}</div></fieldset><label className="full"><span>รายละเอียด</span><textarea value={draft.description} maxLength={2000} rows={3} onChange={event=>set('description',event.target.value)} placeholder="รายละเอียดหรือขอบเขตของ Release"/></label></div><h3>เลือกงานค้างเข้า Release <span>{selected.size}</span></h3><p className="picker-note">งานค้างเลือกได้ทันที ส่วนงานใน Release อื่นกดย้ายและยืนยันก่อน</p><div className="sheet-feature-picker">{availableFeatures.map(feature=>{const assignedElsewhere=!!assignments[feature.id]&&!selected.has(feature.id);return <div key={feature.id} className={`feature-option ${selected.has(feature.id)?'selected':''} ${assignedElsewhere?'assigned-elsewhere':''}`}><input type="checkbox" disabled={assignedElsewhere} checked={selected.has(feature.id)} onChange={()=>toggleFeature(feature)}/><span><b>{feature.title}</b><small><span className={`source-badge ${feature.sheetId>0?'from-sheet':'web-added'}`}>{feature.sheetId>0?'From Sheet':'Web added'}</span>{feature.owner||feature.sheetTitle||'ยังไม่ระบุ Owner'} · {PLATFORM_LABEL[feature.platform]}{assignedElsewhere&&<em>อยู่ใน {assignments[feature.id]}</em>}</small></span>{assignedElsewhere&&<button type="button" className="move-feature-button" onClick={()=>moveFeature(feature)}>ย้ายมารอบนี้</button>}</div>})}</div>{!availableFeatures.length&&<p className="custom-empty">ไม่มีงานค้างที่ยังไม่ได้จัดเข้า Release</p>}<div className="custom-heading"><h3>งานเฉพาะ Release นี้ <span>{custom.length}</span></h3><button onClick={addCustom}><Plus size={13}/>เพิ่มงาน</button></div><div className="custom-items">{custom.map((item,index)=><div className="custom-item" key={item.id}><div className="custom-item-top"><b>งานนอก Sheet #{index+1}</b><button aria-label="ลบงาน" onClick={()=>setDraft(current=>({...current,members:current.members.filter(member=>member.id!==item.id)}))}><X size={14}/></button></div><label><span>ชื่องาน *</span><input value={item.title} maxLength={300} onChange={event=>updateCustom(item.id,{title:event.target.value})}/></label><div className="custom-item-grid"><label><span>Platform</span><select value={item.platform} onChange={event=>updateCustom(item.id,{platform:event.target.value as Platform})}><option value="unknown">ยังไม่ระบุ</option><option value="web">Web</option><option value="app">App</option><option value="shared">App + Web</option></select></label><label><span>Owner</span><input value={item.owner} maxLength={150} onChange={event=>updateCustom(item.id,{owner:event.target.value})}/></label><label><span>เริ่ม Dev FE</span><input type="date" value={item.devStart} onChange={event=>updateCustom(item.id,{devStart:event.target.value})}/></label><label><span>จบ Dev FE</span><input type="date" value={item.devEnd} onChange={event=>updateCustom(item.id,{devEnd:event.target.value})}/></label><label><span>เริ่ม QA</span><input type="date" value={item.qaStart} onChange={event=>updateCustom(item.id,{qaStart:event.target.value})}/></label><label><span>จบ QA</span><input type="date" value={item.qaEnd} onChange={event=>updateCustom(item.id,{qaEnd:event.target.value})}/></label></div><label><span>หมายเหตุ</span><textarea value={item.note} maxLength={2000} rows={2} onChange={event=>updateCustom(item.id,{note:event.target.value})}/></label></div>)}{!custom.length&&<p className="custom-empty">ยังไม่มีงานเฉพาะ Release นี้</p>}</div><div className="release-editor-actions">{draft.origin==='sheet_override'||value.origin==='manual'?<button className="archive-button" disabled={saving} onClick={()=>void save({...draft,archived:true})}><Archive size={14}/>Archive</button>:null}<span/><button className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" disabled={saving||!draft.name.trim()||!draft.tags.length||custom.some(item=>!item.title.trim())} onClick={()=>void save()}>{saving?'กำลังบันทึก...':'บันทึก Release'}</button></div>{message&&<p className="editor-error" role="alert">{message}</p>}<p className="small-note">ข้อมูลนี้เก็บใน Supabase เท่านั้น และจะไม่แก้ Google Sheet</p></div></DrawerShell>;
}

function ManagedFeatureEditor({value,onClose,onSaved}:{value:ManagedFeature;onClose:()=>void;onSaved:(value:ManagedFeature)=>void}){const [draft,setDraft]=useState(value);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');function set<K extends keyof ManagedFeature>(key:K,next:ManagedFeature[K]){setDraft(current=>({...current,[key]:next}));}async function save(next=draft){if(saving||!next.title.trim())return;setSaving(true);setMessage('');try{const response=await fetch('/api/features',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});const body=await response.json().catch(()=>null) as ManagedFeature|{error?:string}|null;if(!response.ok)throw new Error(body&&'error'in body?body.error:'');onSaved(body as ManagedFeature);}catch(error){setMessage(error instanceof Error&&error.message?error.message:'บันทึก Feature ไม่สำเร็จ');}finally{setSaving(false);}}return <DrawerShell onClose={onClose} label="Feature details"><div className="drawer-content release-editor"><div className="editor-heading"><span className="source-badge web-added">Web added</span><h2>{value.title?'แก้ไข Feature':'เพิ่ม Feature'}</h2></div><div className="release-form-grid"><label className="full"><span>ชื่อ Feature *</span><input value={draft.title} maxLength={300} onChange={event=>set('title',event.target.value)} placeholder="เช่น Package landing improvement"/></label><label><span>Platform</span><select value={draft.platform} onChange={event=>set('platform',event.target.value as Platform)}><option value="unknown">ยังไม่ระบุ</option><option value="web">Web</option><option value="app">App</option><option value="shared">App + Web</option></select></label><label><span>สถานะ Feature</span><select value={draft.status} onChange={event=>set('status',event.target.value as Status)}>{(['unknown','planned','merging','testing','done','deployed'] as Status[]).map(status=><option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></label><label><span>Owner</span><input value={draft.owner} maxLength={150} onChange={event=>set('owner',event.target.value)}/></label><label><span>เริ่ม Dev FE</span><input type="date" value={draft.devStart} onChange={event=>set('devStart',event.target.value)}/></label><label><span>จบ Dev FE</span><input type="date" value={draft.devEnd} onChange={event=>set('devEnd',event.target.value)}/></label><label><span>เริ่ม QA</span><input type="date" value={draft.qaStart} onChange={event=>set('qaStart',event.target.value)}/></label><label><span>จบ QA</span><input type="date" value={draft.qaEnd} onChange={event=>set('qaEnd',event.target.value)}/></label><label className="full"><span>รายละเอียด / หมายเหตุ</span><textarea value={draft.note} maxLength={2000} rows={4} onChange={event=>set('note',event.target.value)}/></label></div><div className="release-editor-actions"><button className="archive-button" disabled={saving} onClick={()=>void save({...draft,archived:true})}><Archive size={14}/>Archive</button><span/><button className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" disabled={saving||!draft.title.trim()||!!(draft.devStart&&draft.devEnd&&draft.devStart>draft.devEnd)||!!(draft.qaStart&&draft.qaEnd&&draft.qaStart>draft.qaEnd)} onClick={()=>void save()}>{saving?'กำลังบันทึก...':'บันทึก Feature'}</button></div>{message&&<p className="editor-error" role="alert">{message}</p>}<p className="small-note">Feature นี้เก็บใน Supabase และจะไม่เขียนกลับ Google Sheet</p></div></DrawerShell>}

function LatestArtifact({record,onCopy}:{record:BuildRecord;onCopy:(value:string)=>void}){return <div className="image-code latest-image"><Package size={16}/><div><small>เลขล่าสุด</small><code>{record.image}</code></div><button className="icon-button" aria-label={`คัดลอก ${record.image}`} onClick={()=>onCopy(record.image)}><Copy size={15}/></button></div>}
function BuildHistory({records,onCopy}:{records:BuildRecord[];onCopy:(value:string)=>void}){return records.length?<div className="build-history"><h4>ประวัติ <span>{records.length}</span></h4>{records.map((record,index)=><div className="build-history-item" key={`${record.updatedAt}-${index}`}><div className="build-history-head"><code>{record.image}</code><button className="icon-button" aria-label={`คัดลอก ${record.image}`} onClick={()=>onCopy(record.image)}><Copy size={14}/></button></div>{record.comment&&<p>{record.comment}</p>}<small><Clock3 size={12}/><ClockText value={record.updatedAt}/> น.</small></div>)}</div>:null}
function BuildEditor({id, initial, onSaved, disabled, label='เลข Image / App build'}: {id:string; initial:string; disabled:boolean; label?:string; onSaved:(record:BuildRecord)=>void}) {
 const [draft,setDraft]=useState<{value:string;base:string}|null>(null);
 const value=draft?.value ?? initial;
 const [comment,setComment]=useState('');
 const conflict=draft !== null && draft.base !== initial;
 const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');
 async function save(){
  if(disabled || saving || conflict)return;
  setSaving(true);setMessage('');
  try{const response=await fetch('/api/builds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,image:value,comment})});if(!response.ok)throw new Error();const result=await response.json() as {record:BuildRecord};onSaved(result.record);setDraft(null);setComment('');setMessage('บันทึกแล้ว · เพิ่มในประวัติเรียบร้อย');}
  catch{setMessage('บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setSaving(false);}
 }
 const inputId=`artifact-${id.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
 return <div className="build-editor"><label htmlFor={inputId}>{label}</label><input id={inputId} disabled={disabled || saving} value={value} maxLength={500} onChange={e=>setDraft(previous=>({value:e.target.value,base:previous?.base ?? initial}))} placeholder="เช่น web:release-001 หรือ App build 123"/><label htmlFor={`${inputId}-comment`}>Comment <small>ระบุว่าเลขนี้ใช้กับเรื่องอะไร</small></label><textarea id={`${inputId}-comment`} disabled={disabled || saving} value={comment} maxLength={1000} rows={3} onChange={e=>setComment(e.target.value)} placeholder="เช่น รวม IR Insurance phase 1 และแก้หน้า package"/><button className="primary-button" disabled={disabled || saving || conflict || !value.trim() || (value.trim()===initial && !comment.trim())} onClick={()=>void save()}>{disabled?'กำลังอ่านข้อมูล...':saving?'กำลังบันทึก...':'บันทึกเลขส่งมอบ'}</button>{conflict && <div role="alert"><p className="small-note">มีผู้แก้ไขข้อมูลล่าสุดแล้ว กรุณาโหลดค่าล่าสุดก่อนบันทึก เพื่อไม่เขียนทับข้อมูลของผู้อื่น</p><button className="primary-button" onClick={()=>{setDraft(null);setMessage('โหลดค่าล่าสุดแล้ว');}}>ใช้ค่าล่าสุด</button></div>}<p role="status" className="build-message">{message}</p><p className="small-note">ทุกครั้งที่บันทึกจะเก็บเลข, comment และเวลาไว้ในประวัติ โดยไม่แก้ Google Sheet</p></div>;
}
