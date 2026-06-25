/**
 * 사용설명서(docs/guide.dc.html)용 메뉴별 스크린샷을 실제 앱에서 자동 캡처한다.
 * store-assets/.../captioned/capture-screens.js 의 캡처 파이프라인을 각색한 것:
 *   · 루트 index.html 을 헤드리스 브라우저로 띄우고
 *   · Supabase 요청 abort + navigator.onLine=false 로 강제 오프라인 → 로컬 시드 상태만 렌더
 *   · 가상 데모 데이터(그룹키 KEY-DEMO26, 가상 이름)를 주입 → 개인정보 노출 없음
 *   · activateView()/activateAdminPanel()/탭 토글로 각 메뉴를 띄운 뒤 캡처
 *
 * 실행 (이 폴더 기준):
 *   node capture-guide.js
 *
 * 결과: docs/guide/img/NN-*.png  (메뉴별 스크린샷, 대부분 fullPage)
 *
 * 데이터 규약: 모두 가상 샘플. 실제 이메일/이름/그룹키 없음.
 */
const path = require("path");
const fs = require("fs");

// puppeteer-core 는 캡처 도구 폴더에만 설치돼 있으므로 그 경로에서 직접 가져온다.
const CAPTIONED = path.resolve(
  __dirname, "..", "..", "store-assets", "google-play", "ko-KR", "captioned"
);
let puppeteer;
try {
  puppeteer = require(path.join(CAPTIONED, "node_modules", "puppeteer"));
} catch (e) {
  puppeteer = require(path.join(CAPTIONED, "node_modules", "puppeteer-core"));
}

function resolveChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

const launchOpts = { headless: "new" };
const chrome = resolveChrome();
if (chrome) launchOpts.executablePath = chrome;

// 루트 index.html (앱 본체) — docs/guide 에서 두 단계 위
const APP_HTML = path.resolve(__dirname, "..", "..", "index.html");

// ── 가상 데모 데이터 ──────────────────────────────────────────────────
const DEMO_MEMBERS = ["김민준", "이서준", "박도윤", "정시우", "최예준", "한지후", "윤도현", "강시윤"];
const DEMO_ROLES = ["당직사령", "당직부관", "당직사관", "위병사관"];
const DEMO_MEMBER_ROLES = {
  "김민준": "당직사령", "이서준": "당직사령",
  "박도윤": "당직부관", "정시우": "당직부관",
  "최예준": "당직사관", "한지후": "당직사관",
  "윤도현": "위병사관", "강시윤": "위병사관",
};
const DEMO_LEADER = "김민준";
const DEMO_EMAIL = "demo@example.com";

const demoState = {
  groupId: "GROUP-DEMO26",
  groupKey: "KEY-DEMO26",
  ownerEmail: DEMO_EMAIL,
  members: DEMO_MEMBERS,
  currentUser: DEMO_LEADER,
  leader: DEMO_LEADER,
  selectedWeekdays: [1, 2, 3, 4, 5],
  settings: {
    twoShiftWeekday: false, twoShiftSaturday: false, twoShiftSunday: false,
    permEditMembers: true, permEditRules: true, permApproveRequests: true,
    notifyDuty: true, notifyPrevTime: "13:00", notifyDayTime: "08:00",
    useKoreanHolidays: true, allowStartedMonthHoliday: false,
  },
  dutyRoles: DEMO_ROLES.slice(),
  roleCatalog: DEMO_ROLES.slice(),
  customRoles: [],
  memberRoles: DEMO_MEMBER_ROLES,
  groupStartMonth: "2026-01",
  // loadState 는 rulesMigratedAt 가 없으면 마이그레이션으로 rules 를 비운다 → 미리 설정해 샘플 룰 보존.
  rulesMigratedAt: "2026-05-28-rules-v2",
  // 순번표/일정은 loadState() normalize + makeSchedule() 가 자동 생성.
  // 관리 패널이 허전하지 않도록 휴일/훈련/룰에 샘플 1~2건씩 넣는다.
  holidays: [{ date: "2026-06-15", name: "창설기념일", source: "manual" }],
  trainings: [{ start: "2026-06-22", end: "2026-06-24", name: "분기 사격훈련" }],
  rules: [
    { date: "2026-06-30", text: "월말 인사이동 — 다음달 첫 근무자 당겨오기", dutyType: "평일 당직", strategy: "nextMonthPull" },
  ],
  // 요청/토큰 목록(표시용). 일정 자체를 바꾸는 swapOverrides 는 넣지 않는다.
  swapRequests: [
    {
      id: "demo-swap-1", status: "대기",
      requester: "정시우", requesterDate: "2026-06-20", requesterDutyType: "토요일 당직",
      date: "2026-06-20", dutyType: "토요일 당직",
      target: "박도윤", targetDate: "2026-06-27", targetDutyType: "토요일 당직",
      reason: "개인 일정", condition: "", createdAt: "2026-06-12T09:00:00.000Z",
    },
  ],
  excludeRequests: [
    {
      member: "최예준", start: "2026-06-26", end: "2026-06-28",
      reason: "교육", detail: "분기 직무교육 입소", status: "승인",
    },
    {
      // currentUser(김민준)와 같은 역할(당직사령) → "전체 제외현황" 탭에 노출
      member: "이서준", start: "2026-07-03", end: "2026-07-05",
      reason: "휴가", detail: "정기 휴가", status: "대기",
    },
  ],
  swapTokens: [
    {
      id: "demo-token-1", requester: "이서준", holder: DEMO_LEADER,
      originalDate: "2026-06-18", dutyType: "평일 당직", typeKey: "",
      reason: "근무 대체", status: "사용 가능", createdAt: "2026-06-12T09:00:00.000Z",
      sourceRequestId: "demo-swap-x",
    },
  ],
  swapOverrides: [], feedback: [],
  joinRequests: [
    { name: "오지훈", role: "위병사관", status: "대기", requestedAt: "2026-06-18T02:00:00.000Z" },
  ],
  invites: [], updatedAt: "2026-06-12T09:00:00.000Z",
};

const demoSession = {
  role: "leader", member: DEMO_LEADER, email: DEMO_EMAIL,
  groupId: "GROUP-DEMO26", groupKey: "KEY-DEMO26",
};

// 나무키우기 게이트(isDutyAuthed) 통과용 — expires_at 을 먼 미래로 둔다.
const demoAuth = {
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600,
  user: { id: "demo-user", email: DEMO_EMAIL },
};

// 나무키우기 데모 상태(서버 fetch 대체) — tree-game.js tree 스키마에 맞춤.
const demoTreeGame = {
  tree: {
    level: 3, exp: 8200, gauge: 130, water: 12, fertilizer: 8,
    harvest_ready: false, harvest_count: 1,
    missions: {
      attendance: false,
      water_use_reward: 3, water_reward_step: 0,
      fertilizer_use_reward: 1, fertilizer_reward_step: 0,
    },
    ads: {
      rewarded45: { watchedToday: 1, nextAvailableAt: null },
      water5: { watchedToday: 2, nextAvailableAt: null },
      fertilizer5: { watchedToday: 1, nextAvailableAt: null },
    },
    rewards: [
      { status: "issued", name: "아메리카노 T", brand: "카페 데모", code: "DEMO-1234-5678", issued_at: "2026-06-12", image: "" },
      { status: "pending", name: "편의점 3,000원권", brand: "데모마트", code: "", issued_at: "2026-06-20", image: "" },
    ],
  },
  giftOptions: [
    { code: "GIFT-AMERICANO", name: "아메리카노 T", brand: "카페 데모", image: "" },
    { code: "GIFT-CU3000", name: "편의점 3,000원권", brand: "데모마트", image: "" },
  ],
};

const SEED = { demoState, demoSession, demoAuth };

// ── 앱 셸(로그인 후) 화면 정의 ─────────────────────────────────────────
// setup 은 page.evaluate 로 문자열 직렬화되어 페이지 컨텍스트에서 실행된다.
// fullPage 기본 true. 오버레이(팝업/캘린더)는 false 로 뷰포트만 캡처.
const SHOTS = [
  // ── Part A. 모든 사용자 ──
  { name: "10-dashboard-duties",   setup: () => { activateView("dashboard"); activeDashboardTab = "duties"; renderDashboard(); } },
  { name: "11-dashboard-rosters",  setup: () => { activateView("dashboard"); activeDashboardTab = "rosters"; renderDashboard(); } },
  { name: "12-dashboard-tokens",   setup: () => { activateView("dashboard"); activeDashboardTab = "tokens"; renderDashboard(); } },
  { name: "13-dashboard-settings", setup: () => { activateView("dashboard"); activeDashboardTab = "settings"; renderDashboard(); } },

  { name: "20-calendar-month",     setup: () => { activateView("calendar"); calendarViewMode = "month"; renderCalendar(); } },
  { name: "21-calendar-directory", setup: () => { activateView("calendar"); calendarViewMode = "directory"; renderCalendar(); } },
  {
    name: "22-calendar-popup", fullPage: false,
    setup: () => {
      activateView("calendar"); calendarViewMode = "month"; renderCalendar();
      var d = activeMonth, y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0");
      openCalendarPopup(y + "-" + m + "-15");
    },
  },

  {
    name: "30-request-swap",
    setup: () => {
      activateView("swap");
      var p = "swap";
      document.querySelectorAll(".requests-tab").forEach((t) => t.classList.toggle("active", t.dataset.requestsPanel === p));
      document.querySelectorAll(".requests-panel").forEach((q) => q.classList.toggle("active", q.dataset.requestsPanel === p));
    },
  },
  {
    name: "31-request-exclude",
    setup: () => {
      activateView("swap");
      var p = "exclude";
      document.querySelectorAll(".requests-tab").forEach((t) => t.classList.toggle("active", t.dataset.requestsPanel === p));
      document.querySelectorAll(".requests-panel").forEach((q) => q.classList.toggle("active", q.dataset.requestsPanel === p));
    },
  },
  {
    name: "32-request-all",
    setup: () => {
      activateView("swap");
      var p = "all";
      document.querySelectorAll(".requests-tab").forEach((t) => t.classList.toggle("active", t.dataset.requestsPanel === p));
      document.querySelectorAll(".requests-panel").forEach((q) => q.classList.toggle("active", q.dataset.requestsPanel === p));
    },
  },

  {
    name: "40-tree-garden",
    setup: (tree) => { treeGameState = tree; treeActiveMenu = "garden"; activateView("tree"); renderTree(true); },
  },
  {
    name: "41-tree-inventory",
    setup: (tree) => { treeGameState = tree; treeActiveMenu = "inventory"; activateView("tree"); renderTree(true); },
  },
  {
    // 첫 접속 기프티콘 선택 게이트 — harvest_count:0 + first_gift_code:"" + giftOptions 존재 시 렌더
    name: "42-tree-first-gift",
    setup: () => {
      treeGameState = {
        tree: {
          level: 1, exp: 0, gauge: 0, water: 5, fertilizer: 3,
          harvest_ready: false, harvest_count: 0, first_gift_code: "",
          missions: { attendance: false, water_use_reward: 0, water_reward_step: 0, fertilizer_use_reward: 0, fertilizer_reward_step: 0 },
          ads: { rewarded45: { watchedToday: 0, nextAvailableAt: null }, water5: { watchedToday: 0, nextAvailableAt: null }, fertilizer5: { watchedToday: 0, nextAvailableAt: null } },
          rewards: [],
        },
        giftOptions: [
          { code: "GIFT-AMERICANO", name: "아메리카노 T", brand: "카페 데모", image: "" },
          { code: "GIFT-CU3000", name: "편의점 3,000원권", brand: "데모마트", image: "" },
          { code: "GIFT-BAKERY5000", name: "베이커리 5,000원권", brand: "데모베이커리", image: "" },
        ],
      };
      treeActiveMenu = "garden";
      activateView("tree");
      renderTree(true);
    },
  },

  // ── Part B. 그룹장 전용 ──
  {
    name: "50-admin-menu",
    setup: () => {
      activateView("admin");
      var menu = document.querySelector("#adminMenu"), sub = document.querySelector("#adminSubPanel");
      if (menu && sub) { sub.style.display = "none"; sub.classList.add("hidden"); menu.classList.remove("hidden"); }
    },
  },
  { name: "51-admin-members",   setup: () => { activateView("admin"); activateAdminPanel("members"); } },
  { name: "52-admin-basis",     setup: () => { activateView("admin"); activateAdminPanel("schedulingBasis"); } },
  { name: "53-admin-rosters",   setup: () => { activateView("admin"); activateAdminPanel("rosters"); } },
  { name: "54-admin-holidays",  setup: () => { activateView("admin"); activateAdminPanel("holidays"); } },
  { name: "55-admin-trainings", setup: () => { activateView("admin"); activateAdminPanel("trainings"); } },
  { name: "56-admin-rules",     setup: () => { activateView("admin"); activateAdminPanel("rules"); } },
  { name: "57-admin-group",     setup: () => { activateView("admin"); activateAdminPanel("group"); } },
];

// ── 로그인(인증) 화면 — 세션 시드 없이 부팅해 #authScreen 노출 ─────────
const LOGIN_SHOTS = [
  {
    name: "01-login-leader", fullPage: false,
    setup: () => {
      document.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b.dataset.authTab === "leader"));
      document.querySelectorAll(".auth-panel").forEach((p) => p.classList.toggle("active", p.dataset.authPanel === "leader"));
    },
  },
  {
    name: "02-login-email", fullPage: false,
    setup: () => {
      document.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b.dataset.authTab === "member"));
      document.querySelectorAll(".auth-panel").forEach((p) => p.classList.toggle("active", p.dataset.authPanel === "member"));
      document.querySelectorAll(".member-mode-tab").forEach((b) => b.classList.toggle("active", b.dataset.memberMode === "email"));
      document.querySelectorAll("[data-member-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.memberPane !== "email"));
    },
  },
  {
    name: "03-login-keycode", fullPage: false,
    setup: () => {
      document.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b.dataset.authTab === "member"));
      document.querySelectorAll(".auth-panel").forEach((p) => p.classList.toggle("active", p.dataset.authPanel === "member"));
      document.querySelectorAll(".member-mode-tab").forEach((b) => b.classList.toggle("active", b.dataset.memberMode === "key"));
      document.querySelectorAll("[data-member-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.memberPane !== "key"));
    },
  },
];

const VIEWPORT = { width: 460, height: 1000, deviceScaleFactor: 2 };
const outDir = path.join(__dirname, "img");
const fileUrl = "file://" + APP_HTML.replace(/\\/g, "/");

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function blockSupabase(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/supabase\.co|supabase\.in/i.test(req.url())) req.abort();
    else req.continue();
  });
}

async function runShots(page, shots, tree) {
  for (const shot of shots) {
    await page.evaluate(
      (setupSrc, t) => {
        // eslint-disable-next-line no-new-func
        const fn = new Function("tree", "(" + setupSrc + ")(tree);");
        fn(t);
      },
      shot.setup.toString(),
      tree || null
    );
    await sleep(700);
    if (shot.fullPage === false) await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(200);
    const out = path.join(outDir, shot.name + ".png");
    await page.screenshot({ path: out, fullPage: shot.fullPage !== false });
    console.log("저장:", path.relative(process.cwd(), out));
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch(launchOpts);

  // ── 1) 로그인 화면 (세션 미주입) ──
  const loginPage = await browser.newPage();
  await loginPage.setViewport(VIEWPORT);
  await blockSupabase(loginPage);
  await loginPage.evaluateOnNewDocument(() => {
    try { Object.defineProperty(navigator, "onLine", { value: false, configurable: true }); } catch (e) {}
    // 공유 file:// 오리진의 잔존 세션 제거 → authScreen 노출
    ["dutyCalendarState", "dutyCalendarSession", "dutyCalendarAuth", "dutyCalendarDirty"].forEach((k) => localStorage.removeItem(k));
  });
  await loginPage.goto(fileUrl, { waitUntil: "networkidle0" });
  await loginPage.waitForSelector(".auth-tab", { timeout: 8000 });
  await runShots(loginPage, LOGIN_SHOTS);
  await loginPage.close();

  // ── 2) 앱 셸 화면 (데모 세션 주입) ──
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await blockSupabase(page);
  await page.evaluateOnNewDocument((seed) => {
    try { Object.defineProperty(navigator, "onLine", { value: false, configurable: true }); } catch (e) {}
    localStorage.setItem("dutyCalendarState", JSON.stringify(seed.demoState));
    localStorage.setItem("dutyCalendarSession", JSON.stringify(seed.demoSession));
    localStorage.setItem("dutyCalendarAuth", JSON.stringify(seed.demoAuth));
  }, SEED);
  await page.goto(fileUrl, { waitUntil: "networkidle0" });
  await page.waitForSelector("#appShell:not(.hidden)", { timeout: 8000 });

  // 데모 안전장치: normalize 과정에서 비워졌으면 강제 재시드
  await page.evaluate((seed) => {
    if (!state.members || !state.members.length) {
      state = JSON.parse(JSON.stringify(seed.demoState));
    }
    state.groupKey = "KEY-DEMO26";
    render();
  }, SEED);

  await runShots(page, SHOTS, demoTreeGame);

  await browser.close();
  console.log("\n완료 — docs/guide/img/ 에 스크린샷 생성됨.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
